import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { realtimeOrchestrator } from '../services/realtimeOrchestrator';
import { Task, TaskStatus, TaskDependency, TaskCollaborator } from '../types';
import { normalizeTaskFromRow, normalizeTasksFromRows, taskToDbRow } from '../core/types/normalize';
import { sendNotification } from '../services/notificationService';
import { predictionValidationService } from '../services/predictionValidationService';
import { fireEventWebhooks } from '../services/webhookService';
import { evaluateTriggers } from '../services/automationEngine';
import { useAuth } from '../context/AuthContext';
import { sha256 } from '../utils/cryptoUtils';
import { hasCapability, guardCapability } from '../core/auth/permissions';
import { getFriendlyErrorMessage } from '../utils/errorUtils';
import { WorkspaceLifecycleEngine } from '../core/system/WorkspaceLifecycleEngine';

export const wouldCreateCycle = (
  taskId: string,
  dependsOnTaskId: string,
  currentDeps: TaskDependency[]
): boolean => {
  if (taskId === dependsOnTaskId) return true;

  // 1. Build adjacency map once for O(1) lookups
  const adj = new Map<string, string[]>();
  for (const dep of currentDeps) {
    if (!adj.has(dep.task_id)) adj.set(dep.task_id, []);
    adj.get(dep.task_id)!.push(dep.depends_on_task_id);
  }

  const visited = new Set<string>();

  const dfs = (currentId: string): boolean => {
    if (currentId === taskId) return true;
    if (visited.has(currentId)) return false;

    visited.add(currentId);

    const nextTasks = adj.get(currentId) || [];
    for (const nextId of nextTasks) {
      if (dfs(nextId)) return true;
    }

    return false;
  };

  return dfs(dependsOnTaskId);
};

export function useTasks(workspaceId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [collaborators, setCollaborators] = useState<TaskCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  const { user, profile } = useAuth();

  // Wave 7/9 Hardening: Developer-scope ownership verification helpers
  const isDeveloper = profile?.role === 'developer';
  const isAssignedTo = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.assignee_id === user?.id;
  }, [tasks, user]);

  const isCollaborator = useCallback((taskId: string) => {
    return collaborators.some(c => c.task_id === taskId && c.user_id === user?.id);
  }, [collaborators, user]);

  /** Fields developers are NOT allowed to modify */
  const DEVELOPER_PROTECTED_FIELDS = new Set([
    'assignee_id', 'project_id', 'priority', 'start_date', 'deadline', 'due_date', 'estimated_hours', 'original_estimate', 'workspace_id'
  ]);

  const checkWorkspaceAcceptTasks = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured) return true;
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('status')
        .eq('id', workspaceId)
        .maybeSingle();
      if (error || !data) return true;
      return WorkspaceLifecycleEngine.canAcceptTasks(data.status);
    } catch {
      return true;
    }
  }, [workspaceId]);

  const insertTaskHistoryLog = useCallback(async (
    taskId: string,
    fieldName: string,
    oldValue: string | null,
    newValue: string | null,
    telemetrySnapshot: any = {}
  ) => {
    if (!isSupabaseConfigured || !user) return;

    try {
      const { data: latestLog, error: latestError } = await supabase
        .from('task_history_logs')
        .select('hash')
        .eq('task_id', taskId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousHash = (!latestError && latestLog?.hash) ? latestLog.hash : 'GENESIS_BLOCK';
      const timestamp = new Date().toISOString();
      
      const authorId = user.id;
      const authorName = profile?.full_name || user.email?.split('@')[0] || 'Unknown';
      const authorRole = hasCapability(profile?.role, 'platform_governance') ? 'Super Admin' : hasCapability(profile?.role, 'manage_projects') ? 'Project Manager' : 'Developer';
      
      const message = `${taskId}${timestamp}${authorName}${authorRole}${fieldName}${oldValue ?? ''}${newValue ?? ''}${previousHash}`;
      const newHash = await sha256(message);

      const { error: insertError } = await supabase
        .from('task_history_logs')
        .insert({
          task_id: taskId,
          author_id: authorId,
          author_name: authorName,
          author_role: authorRole,
          field_name: fieldName,
          old_value: oldValue,
          new_value: newValue,
          telemetry_snapshot: telemetrySnapshot,
          timestamp: timestamp,
          previous_hash: previousHash,
          hash: newHash
        });

      if (insertError) {
        console.error("Failed to insert task history log:", insertError);
      }
    } catch (e) {
      console.error("Error inserting task history log:", e);
    }
  }, [user, profile]);


  const queueMutation = useCallback((operation: string, payload: any) => {
    if (!workspaceId) return;
    const queueKey = `offline_task_queue_${workspaceId}`;
    let queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    
    // Deduplication & idempotency key
    const targetId = payload.taskId || payload.temporaryId;
    const idempotencyKey = `${operation}-${targetId}-${Date.now()}`;
    
    const existingIdx = queue.findIndex((q: any) => q.operation === operation && q.payload.taskId === targetId && targetId);
    
    if (existingIdx >= 0 && operation !== 'addTask' && operation !== 'deleteTask') {
      queue[existingIdx].payload = { ...queue[existingIdx].payload, ...payload };
      queue[existingIdx].timestamp = new Date().toISOString();
      queue[existingIdx].idempotencyKey = idempotencyKey;
    } else {
      queue.push({ operation, payload, timestamp: new Date().toISOString(), workspace_id: workspaceId, retry_count: 0, idempotencyKey });
    }

    // Size caps to prevent localStorage exhaustion
    if (queue.length > 50) {
      queue = queue.slice(queue.length - 50);
    }

    localStorage.setItem(queueKey, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Changes queued. Syncing when connection returns.", type: "warning" } }));
  }, [workspaceId]);

  const processQueue = useCallback(async () => {
    if (!workspaceId || !navigator.onLine) return;
    const queueKey = `offline_task_queue_${workspaceId}`;
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    if (queue.length === 0) return;

    // Wave 7.5 P0-8: Re-validate current role before replay.
    // The user's role may have changed (e.g. demoted) while offline.
    const currentRole = profile?.role;
    const currentUserId = user?.id;
    const isCurrentlyDeveloper = currentRole === 'developer';
    const isCurrentlyViewer = currentRole === 'viewer';
    const isPMOrAdmin = currentRole === 'super_admin' || currentRole === 'pm';

    // Viewers cannot perform ANY task mutations — purge entire queue
    if (isCurrentlyViewer || !currentRole || !currentUserId) {
      localStorage.removeItem(queueKey);
      return;
    }

    const getRealId = (id: string) => {
      if (!id || !id.startsWith('local-')) return id;
      const map = JSON.parse(localStorage.getItem(`id_map_${workspaceId}`) || '{}');
      return map[id] || id;
    };

    // Sort by timestamp to ensure event ordering integrity
    queue.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Evict stale mutations (older than 48 hours)
    let validQueue = queue.filter((q: any) => (Date.now() - new Date(q.timestamp).getTime()) < 48 * 60 * 60 * 1000);
    const staleCount = queue.length - validQueue.length;
    
    if (staleCount > 0) {
       localStorage.setItem(queueKey, JSON.stringify(validQueue));
       import('../core/observability/ObservabilityEngine').then(({ ObservabilityEngine }) => {
         for(let i=0; i<staleCount; i++) ObservabilityEngine.reportReplayAttempt(false, false, true);
       });
    }

    import('../core/observability/ObservabilityEngine').then(({ ObservabilityEngine }) => {
      ObservabilityEngine.updateQueueSize(validQueue.length);
    });

    for (const item of validQueue) {
      try {
        // Wave 7.5 P0-8: Per-item role/ownership gate
        const op = item.operation;

        // Developers cannot: create tasks, delete tasks, manage dependencies
        if (isCurrentlyDeveloper && ['addTask', 'deleteTask', 'addDependency', 'removeDependency'].includes(op)) {
          const cq = JSON.parse(localStorage.getItem(queueKey) || '[]');
          localStorage.setItem(queueKey, JSON.stringify(cq.filter((q: any) => q.timestamp !== item.timestamp)));
          continue;
        }

        // Developers can only update tasks assigned to them
        if (isCurrentlyDeveloper && ['updateTaskStatus', 'updateTask', 'updateTaskDates'].includes(op)) {
          const targetTaskId = getRealId(item.payload.taskId);
          const targetTask = tasks.find(t => t.id === targetTaskId);
          if (targetTask && targetTask.assignee_id !== currentUserId) {
            const cq = JSON.parse(localStorage.getItem(queueKey) || '[]');
            localStorage.setItem(queueKey, JSON.stringify(cq.filter((q: any) => q.timestamp !== item.timestamp)));
            continue;
          }

          // Strip protected fields from updateTask payloads
          if (op === 'updateTask' && item.payload.updates) {
            const stripped = { ...item.payload.updates };
            DEVELOPER_PROTECTED_FIELDS.forEach(f => delete stripped[f]);
            item.payload.updates = stripped;
          }
        }
        if (item.operation === 'addTask') {
          const taskData = { ...item.payload.taskData };
          if (taskData.project_id) taskData.project_id = getRealId(taskData.project_id);
          
          const { data: realTask, error: insertError } = await supabase
            .from('tasks')
            .insert({ ...taskData, workspace_id: workspaceId })
            .select()
            .single();

          if (insertError) throw insertError;

          if (realTask) {
            if (item.payload.temporaryId) {
              const map = JSON.parse(localStorage.getItem(`id_map_${workspaceId}`) || '{}');
              map[item.payload.temporaryId] = realTask.id;
              localStorage.setItem(`id_map_${workspaceId}`, JSON.stringify(map));

              setTasks(prev => prev.map(t => t.id === item.payload.temporaryId ? (realTask as Task) : t));
            }
          }
        }
        else if (item.operation === 'updateTaskStatus') {
          const taskId = getRealId(item.payload.taskId);
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ status: item.payload.status, updated_at: new Date().toISOString() })
            .eq('id', taskId)
            .eq('workspace_id', workspaceId);

          if (updateError) throw updateError;
        }
        else if (item.operation === 'updateTaskDates') {
          const taskId = getRealId(item.payload.taskId);
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              start_date: item.payload.startDate,
              ...taskToDbRow({ deadline: item.payload.deadline ?? undefined }),
              updated_at: new Date().toISOString(),
            })
            .eq('id', taskId)
            .eq('workspace_id', workspaceId);

          if (updateError) throw updateError;
        }
        else if (item.operation === 'updateTask') {
          const taskId = getRealId(item.payload.taskId);
          const updates = { ...item.payload.updates };
          if (updates.project_id) updates.project_id = getRealId(updates.project_id);
          
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ ...taskToDbRow(updates), updated_at: new Date().toISOString() })
            .eq('id', taskId)
            .eq('workspace_id', workspaceId);

          if (updateError) throw updateError;
        }
        else if (item.operation === 'deleteTask') {
          const taskId = getRealId(item.payload.taskId);
          const { error: deleteError } = await supabase
            .from('tasks')
            .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', taskId)
            .eq('workspace_id', workspaceId)
            .is('deleted_at', null);

          if (deleteError) throw deleteError;
        }
        else if (item.operation === 'addDependency') {
          const taskId = getRealId(item.payload.taskId);
          const dependsOnTaskId = getRealId(item.payload.dependsOnTaskId);
          
          const { error: insertError } = await supabase
            .from('task_dependencies')
            .insert({
              workspace_id: workspaceId,
              task_id: taskId,
              depends_on_task_id: dependsOnTaskId
            });

          if (insertError) throw insertError;
        }
        else if (item.operation === 'removeDependency') {
          const taskId = getRealId(item.payload.taskId);
          const dependsOnTaskId = getRealId(item.payload.dependsOnTaskId);
          
          const { error: deleteError } = await supabase
            .from('task_dependencies')
            .delete()
            .eq('task_id', taskId)
            .eq('depends_on_task_id', dependsOnTaskId)
            .eq('workspace_id', workspaceId);

          if (deleteError) throw deleteError;
        }

        // Successfully synced: Remove item from queue safely
        const currentQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        const nextQueue = currentQueue.filter((qItem: any) => qItem.timestamp !== item.timestamp);
        localStorage.setItem(queueKey, JSON.stringify(nextQueue));
        import('../core/observability/ObservabilityEngine').then(({ ObservabilityEngine }) => {
          ObservabilityEngine.reportReplayAttempt(true, false, false);
        });
      } catch (err: any) {
        const isRejected = err?.code === '42501' || err?.message?.includes('RLS'); // Auth/RLS failure
        import('../core/observability/ObservabilityEngine').then(({ ObservabilityEngine }) => {
          ObservabilityEngine.reportReplayAttempt(false, isRejected, false);
        });

        // Fail: Increment retry_count and keep in queue
        const currentQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        const nextQueue = currentQueue.map((qItem: any) => 
          qItem.timestamp === item.timestamp 
            ? { ...qItem, retry_count: (qItem.retry_count || 0) + 1 } 
            : qItem
        );
        localStorage.setItem(queueKey, JSON.stringify(nextQueue));
      }
    }
    
    // Final check on remaining queue
    const finalQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    import('../core/observability/ObservabilityEngine').then(({ ObservabilityEngine }) => {
      ObservabilityEngine.updateQueueSize(finalQueue.length);
    });
  }, [workspaceId, profile, user, tasks, DEVELOPER_PROTECTED_FIELDS]);

  useEffect(() => {
    window.addEventListener('online', processQueue);
    return () => window.removeEventListener('online', processQueue);
  }, [processQueue]);

  const fetchTasks = useCallback(async (abortSignal?: AbortSignal, fetchAllLoaded = false) => {
    if (!workspaceId) {
      if (!user) {
        console.log('[useTasks] setTasks (empty)'); setTasks([]);
        setDependencies([]);
        setLoading(false);
      }
      return;
    }

    if (!isSupabaseConfigured) {
      // Offline fallback
      const localTasks = localStorage.getItem(`tasks_${workspaceId}`);
      if (localTasks) {
        console.log('[useTasks] setTasks (localTasks)'); setTasks(JSON.parse(localTasks));
      } else {
        console.log('[useTasks] setTasks (empty)'); setTasks([]);
      }
      const localDeps = localStorage.getItem(`task_dependencies_${workspaceId}`);
      if (localDeps) {
        setDependencies(JSON.parse(localDeps));
      } else {
        setDependencies([]);
      }
      const localCollabs = localStorage.getItem(`task_collaborators_${workspaceId}`);
      if (localCollabs) {
        setCollaborators(JSON.parse(localCollabs));
      } else {
        setCollaborators([]);
      }
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const from = 0;
      const to = fetchAllLoaded ? ((page + 1) * limit - 1) : (limit - 1);

      const tasksQuery = supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (abortSignal) tasksQuery.abortSignal(abortSignal);
      const { data, count, error: fetchError } = await tasksQuery;

      if (fetchError) throw fetchError;
      if (abortSignal?.aborted) return;
      
      const fetchedTasks = normalizeTasksFromRows((data || []) as Record<string, unknown>[]);
      console.log('[useTasks] setTasks (fetchedTasks)'); setTasks(fetchedTasks);
      if (!fetchAllLoaded) setPage(0);
      setHasMore(count !== null ? (to + 1) < count : false);

      const taskIds = fetchedTasks.map(t => t.id);

      if (taskIds.length > 0) {
        // Fetch task dependencies from canonical table
        const depsQuery = supabase
          .from('task_dependencies')
          .select('*')
          .in('task_id', taskIds);

        if (abortSignal) depsQuery.abortSignal(abortSignal);
        const { data: depData, error: depError } = await depsQuery;

        if (depError) throw depError;
        if (abortSignal?.aborted) return;
        setDependencies(depData as TaskDependency[]);

        // Fetch task collaborators
        const collabQuery = supabase
          .from('task_collaborators')
          .select('*')
          .in('task_id', taskIds);

        if (abortSignal) collabQuery.abortSignal(abortSignal);
        const { data: collabData, error: collabError } = await collabQuery;
        if (collabError) throw collabError;
        if (abortSignal?.aborted) return;
        setCollaborators(collabData as TaskCollaborator[]);
      } else {
        setDependencies([]);
        setCollaborators([]);
      }

      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError' || abortSignal?.aborted) return;
      const localTasks = localStorage.getItem(`tasks_${workspaceId}`);
      if (localTasks) {
        console.log('[useTasks] setTasks (localTasks)'); setTasks(JSON.parse(localTasks));
      }
      const localDeps = localStorage.getItem(`task_dependencies_${workspaceId}`);
      if (localDeps) {
        setDependencies(JSON.parse(localDeps));
      }
      const localCollabs = localStorage.getItem(`task_collaborators_${workspaceId}`);
      if (localCollabs) {
        setCollaborators(JSON.parse(localCollabs));
      }
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, page]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !workspaceId || !isSupabaseConfigured) return;
    const nextPage = page + 1;
    const from = nextPage * limit;
    const to = from + limit - 1;
    setLoading(true);

    try {
      const { data, count, error: fetchError } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;
      const existingIds = new Set(tasks.map(t => t.id)); // using tasks from outer scope
      const newUnique = normalizeTasksFromRows((data || []) as Record<string, unknown>[]).filter(
        t => !existingIds.has(t.id),
      );
      
      if (newUnique.length > 0) {
        const newTaskIds = newUnique.map(t => t.id);
        
        const { data: depData } = await supabase
          .from('task_dependencies')
          .select('*')
          .in('task_id', newTaskIds);
          
        if (depData) {
          setDependencies(prev => {
            const existingDepIds = new Set(prev.map(d => `${d.task_id}-${d.depends_on_task_id}`));
            const newDeps = (depData as TaskDependency[]).filter(d => !existingDepIds.has(`${d.task_id}-${d.depends_on_task_id}`));
            return [...prev, ...newDeps];
          });
        }
        
        const { data: collabData } = await supabase
          .from('task_collaborators')
          .select('*')
          .in('task_id', newTaskIds);
          
        if (collabData) {
          setCollaborators(prev => {
            const existingCollabIds = new Set(prev.map(c => c.id));
            const newCollabs = (collabData as TaskCollaborator[]).filter(c => !existingCollabIds.has(c.id));
            return [...prev, ...newCollabs];
          });
        }
      }

      console.log('[useTasks] setTasks (realtime)'); setTasks(prev => {
        const currentIds = new Set(prev.map(t => t.id));
        const finalUnique = newUnique.filter(t => !currentIds.has(t.id));
        return [...prev, ...finalUnique];
      });
      setPage(nextPage);
      setHasMore(count !== null ? (to + 1) < count : false);
      setError(null);
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  }, [page, hasMore, loading, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTasks(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [fetchTasks, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isSupabaseConfigured) return;

    const unsubscribeTasks = realtimeOrchestrator.subscribe(
      `tasks-changes-${workspaceId}`,
      'tasks',
      `workspace_id=eq.${workspaceId}`,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (eventType === 'INSERT') {
          if (newRecord.deleted_at) return;
          console.log('[useTasks] setTasks (realtime)'); setTasks(prev => {
            if (prev.some(t => t.id === newRecord.id)) return prev;
            return [normalizeTaskFromRow(newRecord as Record<string, unknown>), ...prev];
          });
        } else if (eventType === 'UPDATE') {
          if (newRecord.deleted_at) {
            setTasks(prev => prev.filter(t => t.id !== newRecord.id));
          } else {
            setTasks(prev =>
              prev.map(t =>
                t.id === newRecord.id
                  ? normalizeTaskFromRow({ ...t, ...newRecord } as Record<string, unknown>)
                  : t,
              ),
            );
          }
        } else if (eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== oldRecord.id));
        }
      }
    );

    const unsubscribeDeps = realtimeOrchestrator.subscribe(
      `task-dependencies-changes-${workspaceId}`,
      'task_dependencies',
      `workspace_id=eq.${workspaceId}`,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (eventType === 'INSERT') {
          setDependencies(prev => {
            if (prev.some(d => d.task_id === newRecord.task_id && d.depends_on_task_id === newRecord.depends_on_task_id)) return prev;
            return [...prev, newRecord as TaskDependency];
          });
        } else if (eventType === 'DELETE') {
          setDependencies(prev => prev.filter(d => !(d.task_id === oldRecord.task_id && d.depends_on_task_id === oldRecord.depends_on_task_id)));
        }
      }
    );

    const unsubscribeCollabs = realtimeOrchestrator.subscribe(
      `task-collaborators-changes-${workspaceId}`,
      'task_collaborators',
      `workspace_id=eq.${workspaceId}`,
      (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (eventType === 'INSERT') {
          setCollaborators(prev => {
            if (prev.some(c => c.id === newRecord.id)) return prev;
            return [...prev, newRecord as TaskCollaborator];
          });
        } else if (eventType === 'DELETE') {
          setCollaborators(prev => prev.filter(c => c.id !== oldRecord.id));
        }
      }
    );

    return () => {
      unsubscribeTasks();
      unsubscribeDeps();
      unsubscribeCollabs();
    };
  }, [workspaceId]);

  // Multi-Tab State Consistency (Cross-Tab Synchronization)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (!e.newValue) return;
      try {
        if (e.key === `tasks_${workspaceId}`) {
          setTasks(JSON.parse(e.newValue));
        } else if (e.key === `task_dependencies_${workspaceId}`) {
          setDependencies(JSON.parse(e.newValue));
        } else if (e.key === `task_collaborators_${workspaceId}`) {
          setCollaborators(JSON.parse(e.newValue));
        }
      } catch (err) {
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [workspaceId]);

  const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    if (!workspaceId) return null;
    const canAccept = await checkWorkspaceAcceptTasks();
    if (!canAccept) {
      const msg = 'Workspace is inactive or retired and cannot accept task updates.';
      setError(msg);
      throw new Error(msg);
    }
    // Wave 7/9: Developers cannot create tasks — only PMs and Admins
    if (isDeveloper) {
      const msg = 'Unauthorized: Developers cannot create tasks. Contact your PM.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'addTask');

    
    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert(taskToDbRow({ ...taskData, workspace_id: workspaceId }))
        .select()
        .single();
        
      if (insertError) {
        if (!navigator.onLine || insertError.message?.toLowerCase().includes('fetch')) {
          const localTask = { ...taskData, id: `local-task-${Date.now()}`, workspace_id: workspaceId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Task;
          queueMutation('addTask', { taskData, temporaryId: localTask.id });
          setTasks(prev => [localTask, ...prev]);
          return localTask;
        }
        setError(getFriendlyErrorMessage(insertError));
        throw insertError;
      }
      
      setTasks(prev => [normalizeTaskFromRow(data as Record<string, unknown>), ...prev]);

      // Write canonical task history log
      if (data) {
        if (data.assignee_id) {
          sendNotification(
            workspaceId,
            'system',
            'New Task Assigned',
            `You have been assigned to task: ${data.name}`,
            data.assignee_id,
            { task_id: data.id, project_id: data.project_id }
          ).catch(console.error);
        }

        await insertTaskHistoryLog(
          data.id,
          'task',
          null,
          'created',
          { timestamp: new Date().toISOString(), name: data.name, status: data.status }
        );
        fireEventWebhooks('task_created', workspaceId, {
          task_id: data.id, project_id: data.project_id, name: data.name, status: data.status,
        }).catch(() => {});
        evaluateTriggers('task.created', {
          workspace_id: workspaceId, task_id: data.id, project_id: data.project_id,
          name: data.name, status: data.status,
        }).catch(() => {});
      }

      return normalizeTaskFromRow(data as Record<string, unknown>);
    } else {
      // Local fallback
      const newTask: Task = {
        ...taskData,
        id: `local-task-${Date.now()}`,
        workspace_id: workspaceId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const updatedTasks = [newTask, ...tasks];
      setTasks(updatedTasks);
      localStorage.setItem(`tasks_${workspaceId}`, JSON.stringify(updatedTasks));
      return newTask;
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!workspaceId) return;
    const canAccept = await checkWorkspaceAcceptTasks();
    if (!canAccept) {
      const msg = 'Workspace is inactive or retired and cannot accept task updates.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'updateTaskStatus');
    // Wave 7/9 + Sprint 6.5: Developers can only change status on assigned or collaborated tasks
    if (isDeveloper && !isAssignedTo(taskId) && !isCollaborator(taskId)) {
      const msg = 'Unauthorized: You can only update tasks assigned or collaborated by you.';
      setError(msg);
      throw new Error(msg);
    }

    // Sprint 2.2 restrictions
    if (isDeveloper && (status === 'completed' || status === 'changes_requested')) {
      const msg = 'Unauthorized: Only PMs can approve or request changes on tasks. Please use "Ready For Review" instead.';
      setError(msg);
      throw new Error(msg);
    }
    
    if (isSupabaseConfigured) {
      const oldStatus = tasks.find(t => t.id === taskId)?.status || null;
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('workspace_id', workspaceId);
        
      if (updateError) {
        if (!navigator.onLine || updateError.message?.toLowerCase().includes('fetch')) {
          queueMutation('updateTaskStatus', { taskId, status });
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
          return;
        }
        setError(getFriendlyErrorMessage(updateError));
        throw updateError;
      }
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));

      // Write canonical task history log
      await insertTaskHistoryLog(
        taskId,
        'status',
        oldStatus,
        status,
        { timestamp: new Date().toISOString() }
      );

      fireEventWebhooks('task_updated', workspaceId, {
        task_id: taskId, status, previous_status: oldStatus,
      }).catch(() => {});
      evaluateTriggers('task.status_changed', {
        workspace_id: workspaceId, task_id: taskId, status, previous_status: oldStatus,
      }).catch(() => {});

      if (status === 'completed') {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          await predictionValidationService.recordCompletion(task);
        }
        fireEventWebhooks('task_completed', workspaceId, {
          task_id: taskId, task_name: task?.name,
        }).catch(() => {});
        evaluateTriggers('task.completed', {
          workspace_id: workspaceId, task_id: taskId, task_name: task?.name,
        }).catch(() => {});
      }

      // Sprint 2.2 Notifications
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        try {
          if (status === 'ready_for_review') {
            // Notify Project Manager (in a real app, query project owner, for now system broadcast to PM role or just generic)
            await sendNotification(workspaceId, 'assignments', 'Task Ready for Review', `Task "${task.name}" is ready for PM review.`, undefined, { type: 'task_review', entity_id: taskId, deep_link: `/workspace/projects/${task.project_id}` });
          } else if (status === 'blocked') {
            await sendNotification(workspaceId, 'risk', 'Task Blocked', `Task "${task.name}" has been blocked.`, undefined, { type: 'task_blocked', entity_id: taskId, deep_link: `/workspace/projects/${task.project_id}` });
          } else if (status === 'changes_requested') {
            if (task.assignee_id) {
              await sendNotification(workspaceId, 'assignments', 'Changes Requested', `Changes were requested on your task "${task.name}".`, task.assignee_id, { type: 'task_changes', entity_id: taskId, deep_link: `/workspace/projects/${task.project_id}` });
            }
          } else if (status === 'completed') {
            if (task.assignee_id) {
              await sendNotification(workspaceId, 'assignments', 'Task Approved', `Your task "${task.name}" was approved and marked completed.`, task.assignee_id, { type: 'task_approved', entity_id: taskId, deep_link: `/workspace/projects/${task.project_id}` });
            }
          }
        } catch (err) {
          console.error("Failed to send task status notification", err);
        }
      }
    } else {
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status } : t);
      setTasks(updatedTasks);
      localStorage.setItem(`tasks_${workspaceId}`, JSON.stringify(updatedTasks));
    }
  };

  const updateTaskDates = async (taskId: string, startDate: string | null, deadline: string | null) => {
    if (!workspaceId) return;
    const canAccept = await checkWorkspaceAcceptTasks();
    if (!canAccept) {
      const msg = 'Workspace is inactive or retired and cannot accept task updates.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'updateTaskDates');
    // Wave 7/9: Developers cannot change dates directly
    if (isDeveloper) {
      const msg = 'Unauthorized: Only PMs and Admins can modify planning dates.';
      setError(msg);
      throw new Error(msg);
    }

    if (isSupabaseConfigured) {
      const task = tasks.find(t => t.id === taskId);
      const oldStartDate = task?.start_date || null;
      const oldDeadline = task?.deadline || task?.due_date || null;

      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          start_date: startDate,
          ...taskToDbRow({ deadline: deadline ?? undefined }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('workspace_id', workspaceId);

      if (updateError) {
        if (!navigator.onLine || updateError.message?.toLowerCase().includes('fetch')) {
          queueMutation('updateTaskDates', { taskId, startDate, deadline });
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, start_date: startDate ?? undefined, deadline: deadline ?? undefined } : t));
          return;
        }
        setError(getFriendlyErrorMessage(updateError));
        throw updateError;
      }

      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, start_date: startDate ?? undefined, deadline: deadline ?? undefined } : t));

      // Write canonical task history log
      if (oldStartDate !== startDate) {
        await insertTaskHistoryLog(
          taskId,
          'start_date',
          oldStartDate,
          startDate,
          { timestamp: new Date().toISOString() }
        );
      }
      if (oldDeadline !== deadline) {
        await insertTaskHistoryLog(
          taskId,
          'deadline',
          oldDeadline,
          deadline,
          { timestamp: new Date().toISOString() }
        );
      }

      // Dispatch notification
      try {
        await sendNotification(
          workspaceId,
          'deadlines',
          'Task Schedule Modified',
          `Task "${task?.name.toUpperCase()}" timeline updated to: ${startDate || 'Unset'} - ${deadline || 'Unset'}`
        );
      } catch (err) {
      }
    } else {
      const updatedTasks = tasks.map(t => 
        t.id === taskId 
          ? { ...t, start_date: startDate ?? undefined, deadline: deadline ?? undefined, updated_at: new Date().toISOString() } 
          : t
      );
      setTasks(updatedTasks);
      localStorage.setItem(`tasks_${workspaceId}`, JSON.stringify(updatedTasks));
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!workspaceId) return;
    const canAccept = await checkWorkspaceAcceptTasks();
    if (!canAccept) {
      const msg = 'Workspace is inactive or retired and cannot accept task updates.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'updateTask');

    // Wave 7/9: Developer scope restrictions
    if (isDeveloper) {
      // Developers can only update tasks assigned to them or if they are collaborators
      if (!isAssignedTo(taskId) && !isCollaborator(taskId)) {
        const msg = 'Unauthorized: You can only update tasks assigned or collaborated by you.';
        setError(msg);
        throw new Error(msg);
      }
      
      // Collaborators who are not primary assignees cannot directly edit description, name/scope, or estimate
      if (isCollaborator(taskId) && !isAssignedTo(taskId)) {
        const blockedFields = ['name', 'description', 'current_estimate', 'estimated_hours', 'original_estimate'];
        const unauthorizedAttempts = Object.keys(updates).filter(k => blockedFields.includes(k));
        if (unauthorizedAttempts.length > 0) {
          const msg = `Unauthorized: Collaborators cannot modify: ${unauthorizedAttempts.join(', ')}. Please submit suggestions instead.`;
          setError(msg);
          throw new Error(msg);
        }
      }

      // Strip protected fields — developers cannot modify governance fields
      const protectedAttempts = Object.keys(updates).filter(k => DEVELOPER_PROTECTED_FIELDS.has(k));
      if (protectedAttempts.length > 0) {
        const msg = `Unauthorized: Developers cannot modify: ${protectedAttempts.join(', ')}. Contact your PM.`;
        setError(msg);
        throw new Error(msg);
      }
    }
    
    if (isSupabaseConfigured) {
      const originalTask = tasks.find(t => t.id === taskId);
      
      const reason = updates.estimate_reason as string;
      const strippedUpdates = { ...updates };
      delete (strippedUpdates as any).estimate_reason;

      // Smart Task Estimation Learning enforcement
      if (isDeveloper && strippedUpdates.current_estimate !== undefined && originalTask?.current_estimate !== strippedUpdates.current_estimate) {
        if (!['in_progress', 'ready'].includes(originalTask?.status || '')) {
          const msg = 'Unauthorized: Current estimate can only be updated during discovery/in progress phases.';
          setError(msg);
          throw new Error(msg);
        }
        if (!reason || reason.trim() === '') {
          const msg = 'A reason is mandatory when updating the current estimate.';
          setError(msg);
          throw new Error(msg);
        }
      }

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ ...taskToDbRow(strippedUpdates as Record<string, unknown>), updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('workspace_id', workspaceId);
        
      if (updateError) {
        if (!navigator.onLine || updateError.message?.toLowerCase().includes('fetch')) {
          queueMutation('updateTask', { taskId, updates });
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } as Task : t));
          return;
        }
        setError(getFriendlyErrorMessage(updateError));
        throw updateError;
      }
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));

      // Write canonical task history log for metadata updates
      if (originalTask) {
        if (updates.assignee_id && updates.assignee_id !== originalTask.assignee_id) {
          sendNotification(
            workspaceId,
            'system',
            'Task Reassigned',
            `You have been assigned to task: ${updates.name || originalTask.name}`,
            updates.assignee_id,
            { task_id: taskId, project_id: originalTask.project_id }
          ).catch(console.error);
        }

        if (strippedUpdates.current_estimate !== undefined && originalTask.current_estimate !== strippedUpdates.current_estimate) {
          await supabase.from('task_estimate_history').insert({
            workspace_id: workspaceId,
            task_id: taskId,
            old_estimate: originalTask.current_estimate || originalTask.estimated_hours,
            new_estimate: strippedUpdates.current_estimate,
            reason: reason || 'Updated by PM/Admin',
            changed_by: user?.id
          });
        }

        for (const [key, value] of Object.entries(strippedUpdates)) {
          if (key === 'updated_at' || key === 'id' || key === 'workspace_id') continue;
          const oldVal = (originalTask as any)[key];
          if (oldVal !== value) {
            await insertTaskHistoryLog(
              taskId,
              key,
              oldVal !== undefined && oldVal !== null ? String(oldVal) : null,
              value !== undefined && value !== null ? String(value) : null,
              { timestamp: new Date().toISOString() }
            );
          }
        }
      }
      fireEventWebhooks('task_updated', workspaceId, {
        task_id: taskId, updates: Object.keys(updates),
      }).catch(() => {});
    } else {
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
      setTasks(updatedTasks);
      localStorage.setItem(`tasks_${workspaceId}`, JSON.stringify(updatedTasks));
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!workspaceId) return;
    const canAccept = await checkWorkspaceAcceptTasks();
    if (!canAccept) {
      const msg = 'Workspace is inactive or retired and cannot accept task updates.';
      setError(msg);
      throw new Error(msg);
    }
    // Wave 7/9: Developers cannot delete tasks
    if (isDeveloper) {
      const msg = 'Unauthorized: Developers cannot delete tasks. Contact your PM.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'deleteTask');
    
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);
        
      if (deleteError) {
        if (!navigator.onLine || deleteError.message?.toLowerCase().includes('fetch')) {
          queueMutation('deleteTask', { taskId });
          setTasks(prev => prev.filter(t => t.id !== taskId));
          return;
        }
        setError(getFriendlyErrorMessage(deleteError));
        throw deleteError;
      }
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
      fireEventWebhooks('task_updated', workspaceId, {
        task_id: taskId, status: 'deleted',
      }).catch(() => {});
    } else {
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      setTasks(updatedTasks);
      localStorage.setItem(`tasks_${workspaceId}`, JSON.stringify(updatedTasks));
    }
  };

  const addDependency = async (taskId: string, dependsOnTaskId: string, metadata?: Record<string, any>) => {
    if (!workspaceId) return;
    const canAccept = await checkWorkspaceAcceptTasks();
    if (!canAccept) {
      const msg = 'Workspace is inactive or retired and cannot accept task updates.';
      setError(msg);
      throw new Error(msg);
    }
    // Wave 7/9: Developers cannot create dependencies
    if (isDeveloper) {
      const msg = 'Unauthorized: Developers cannot create task dependencies. Contact your PM.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'addDependency');

    if (wouldCreateCycle(taskId, dependsOnTaskId, dependencies)) {
      const cycleError = "Circular dependency detected! A task cannot transitively depend on itself.";
      setError(cycleError);
      throw new Error(cycleError);
    }
    
    if (isSupabaseConfigured) {
      const { error: insertError } = await supabase
        .from('task_dependencies')
        .insert({
          workspace_id: workspaceId,
          task_id: taskId,
          depends_on_task_id: dependsOnTaskId
        });
        
      if (insertError) {
        if (!navigator.onLine || insertError.message?.toLowerCase().includes('fetch')) {
          queueMutation('addDependency', { taskId, dependsOnTaskId });
          setDependencies(prev => [...prev, { workspace_id: workspaceId, task_id: taskId, depends_on_task_id: dependsOnTaskId }]);
          return;
        }
        setError(insertError.message);
        throw insertError;
      }
      
      setDependencies(prev => [...prev, { workspace_id: workspaceId, task_id: taskId, depends_on_task_id: dependsOnTaskId }]);

      // Dispatch notification
      try {
        const taskA = tasks.find(t => t.id === taskId);
        const taskB = tasks.find(t => t.id === dependsOnTaskId);
        await sendNotification(
          workspaceId,
          'assignments',
          'Dependency Vector Wired',
          `Task "${taskA?.name.toUpperCase()}" is now linked to depend on "${taskB?.name.toUpperCase()}"`
        );
      } catch (err) {
      }
    } else {
      const newDep: TaskDependency = {
        workspace_id: workspaceId,
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId
      };
      const updatedDeps = [...dependencies, newDep];
      setDependencies(updatedDeps);
      localStorage.setItem(`task_dependencies_${workspaceId}`, JSON.stringify(updatedDeps));
    }
  };

  const removeDependency = async (taskId: string, dependsOnTaskId: string) => {
    if (!workspaceId) return;
    const canAccept = await checkWorkspaceAcceptTasks();
    if (!canAccept) {
      const msg = 'Workspace is inactive or retired and cannot accept task updates.';
      setError(msg);
      throw new Error(msg);
    }
    // Wave 7/9: Developers cannot remove dependencies
    if (isDeveloper) {
      const msg = 'Unauthorized: Developers cannot remove task dependencies. Contact your PM.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'removeDependency');
    
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('task_id', taskId)
        .eq('depends_on_task_id', dependsOnTaskId)
        .eq('workspace_id', workspaceId);
        
      if (deleteError) {
        if (!navigator.onLine || deleteError.message?.toLowerCase().includes('fetch')) {
          queueMutation('removeDependency', { taskId, dependsOnTaskId });
          setDependencies(prev => prev.filter(d => !(d.task_id === taskId && d.depends_on_task_id === dependsOnTaskId)));
          return;
        }
        setError(deleteError.message);
        throw deleteError;
      }
      
      setDependencies(prev => prev.filter(d => !(d.task_id === taskId && d.depends_on_task_id === dependsOnTaskId)));
    } else {
      const updatedDeps = dependencies.filter(d => !(d.task_id === taskId && d.depends_on_task_id === dependsOnTaskId));
      setDependencies(updatedDeps);
      localStorage.setItem(`task_dependencies_${workspaceId}`, JSON.stringify(updatedDeps));
    }
  };

  const addCollaborator = async (taskId: string, userId: string, reason: string) => {
    if (!workspaceId || !user) return;
    if (isDeveloper) {
      const msg = 'Unauthorized: Only PMs and Admins can manage collaborators.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'addCollaborator');

    if (isSupabaseConfigured) {
      const { error: insertError } = await supabase
        .from('task_collaborators')
        .insert({
          workspace_id: workspaceId,
          task_id: taskId,
          user_id: userId,
          added_by: user.id,
          reason: reason
        });
        
      if (insertError) {
        setError(insertError.message);
        throw insertError;
      }
      // Notification handled via trigger or we can send it here
      await sendNotification(
        workspaceId,
        'assignments',
        'Added as Collaborator',
        `You have been added as a collaborator to a task. Reason: ${reason}`,
        userId,
        { type: 'collaborator_added', entity_id: taskId }
      ).catch(() => {});
    }
  };

  const removeCollaborator = async (taskId: string, userId: string) => {
    if (!workspaceId) return;
    if (isDeveloper) {
      const msg = 'Unauthorized: Only PMs and Admins can manage collaborators.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'removeCollaborator');

    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase
        .from('task_collaborators')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId);
        
      if (deleteError) {
        setError(deleteError.message);
        throw deleteError;
      }
    }
  };

  const transferTaskOwnership = async (
    taskId: string,
    newAssigneeId: string,
    reason: string,
    handoverNotes: string,
    addAsCollaborator: boolean
  ) => {
    if (!workspaceId || !user) return;
    if (isDeveloper) {
      const msg = 'Unauthorized: Only PMs and Admins can transfer task ownership.';
      setError(msg);
      throw new Error(msg);
    }
    guardCapability(profile?.role, 'manage_tasks', 'transferTaskOwnership');

    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');
    const oldAssigneeId = task.assignee_id;

    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ assignee_id: newAssigneeId || null, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('workspace_id', workspaceId);

      if (updateError) {
        setError(getFriendlyErrorMessage(updateError));
        throw updateError;
      }

      const { error: historyError } = await supabase
        .from('task_assignment_history')
        .insert({
          workspace_id: workspaceId,
          task_id: taskId,
          previous_assignee_id: oldAssigneeId || null,
          new_assignee_id: newAssigneeId || null,
          transferred_by: user.id,
          transfer_reason: reason,
          handover_notes: handoverNotes
        });

      if (historyError) {
        console.error("Failed to write task assignment history:", historyError.message);
      }

      if (addAsCollaborator && oldAssigneeId && oldAssigneeId !== newAssigneeId) {
        try {
          await supabase
            .from('task_collaborators')
            .insert({
              workspace_id: workspaceId,
              task_id: taskId,
              user_id: oldAssigneeId,
              added_by: user.id,
              reason: `Handover collaborator: ${reason}`
            });
        } catch (e) {
          console.error("Failed to add previous owner as collaborator:", e);
        }
      }

      if (newAssigneeId) {
        try {
          await sendNotification(
            workspaceId,
            'assignments',
            'Task Assigned (Handover)',
            `Task "${task.name}" has been transferred to you. Handover Notes: ${handoverNotes}`,
            newAssigneeId,
            { task_id: taskId, project_id: task.project_id }
          );
        } catch (err) {
          console.error("Failed to send notification:", err);
        }
      }

      try {
        await supabase.from('activity_logs').insert({
          workspace_id: workspaceId,
          actor_id: user.id,
          action: 'task_ownership_transferred',
          task_id: taskId,
          project_id: task.project_id,
          metadata: {
            old_owner_id: oldAssigneeId,
            new_owner_id: newAssigneeId,
            reason: reason,
            handover_notes: handoverNotes
          }
        });
      } catch (err) {
        console.error("Failed to write activity log:", err);
      }

      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignee_id: newAssigneeId || undefined } : t));
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignee_id: newAssigneeId || undefined } : t));
    }
  };

  const createTaskSuggestion = async (
    taskId: string,
    suggestionType: 'estimate_change' | 'scope_note' | 'technical_risk',
    suggestedValue: any,
    oldValue: any,
    reason: string
  ) => {
    if (!workspaceId || !user) return;
    
    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase
        .from('task_suggestions')
        .insert({
          workspace_id: workspaceId,
          task_id: taskId,
          suggested_by: user.id,
          suggestion_type: suggestionType,
          old_value: oldValue,
          suggested_value: suggestedValue,
          reason: reason,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        setError(getFriendlyErrorMessage(insertError));
        throw insertError;
      }

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        try {
          await sendNotification(
            workspaceId,
            'system',
            'New Task Suggestion',
            `A collaborator suggested a change on task "${task.name}": ${reason}`,
            undefined,
            { task_id: taskId, project_id: task.project_id }
          );
        } catch (e) {
          console.error(e);
        }
      }

      return data;
    }
  };

  const reviewTaskSuggestion = async (
    suggestionId: string,
    status: 'accepted' | 'rejected'
  ) => {
    if (!workspaceId || !user) return;
    if (isDeveloper) {
      const msg = 'Unauthorized: Only PMs and Admins can review task suggestions.';
      setError(msg);
      throw new Error(msg);
    }

    if (isSupabaseConfigured) {
      const { data: suggestion, error: fetchError } = await supabase
        .from('task_suggestions')
        .select('*')
        .eq('id', suggestionId)
        .single();

      if (fetchError || !suggestion) throw new Error('Suggestion not found');

      const { error: updateError } = await supabase
        .from('task_suggestions')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', suggestionId);

      if (updateError) throw updateError;

      if (status === 'accepted') {
        const taskId = suggestion.task_id;
        const suggestedValue = suggestion.suggested_value;
        
        if (suggestion.suggestion_type === 'estimate_change' && suggestedValue) {
          const task = tasks.find(t => t.id === taskId);
          const oldEstimate = task?.current_estimate || task?.estimated_hours || 0;
          const newEstimate = Number(suggestedValue);
          
          await supabase
            .from('tasks')
            .update({ current_estimate: newEstimate, updated_at: new Date().toISOString() })
            .eq('id', taskId);

          await supabase.from('task_estimate_history').insert({
            workspace_id: workspaceId,
            task_id: taskId,
            old_estimate: oldEstimate,
            new_estimate: newEstimate,
            reason: `Accepted Suggestion: ${suggestion.reason}`,
            changed_by: user.id
          });

          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, current_estimate: newEstimate } : t));
        }
      }

      if (suggestion.suggested_by) {
        try {
          await sendNotification(
            workspaceId,
            'system',
            'Task Suggestion Reviewed',
            `Your suggestion on task has been ${status}.`,
            suggestion.suggested_by,
            { task_id: suggestion.task_id }
          );
        } catch (e) {
          console.error(e);
        }
      }

      try {
        await supabase.from('activity_logs').insert({
          workspace_id: workspaceId,
          actor_id: user.id,
          action: `task_suggestion_${status}`,
          task_id: suggestion.task_id,
          metadata: {
            suggestion_id: suggestionId,
            suggestion_type: suggestion.suggestion_type,
            reason: suggestion.reason
          }
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  return { tasks, dependencies, collaborators, loading, error, page, hasMore, loadMore, fetchTasks, addTask, updateTask, updateTaskStatus, updateTaskDates, deleteTask, addDependency, removeDependency, addCollaborator, removeCollaborator, transferTaskOwnership, createTaskSuggestion, reviewTaskSuggestion };
}
