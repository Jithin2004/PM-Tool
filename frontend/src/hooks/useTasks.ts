import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { realtimeOrchestrator } from '../services/realtimeOrchestrator';
import { Task, TaskStatus, TaskDependency } from '../types';
import { normalizeTaskFromRow, normalizeTasksFromRows, taskToDbRow } from '../core/types/normalize';
import { sendNotification } from '../services/notificationService';
import { predictionValidationService } from '../services/predictionValidationService';
import { fireEventWebhooks } from '../services/webhookService';
import { evaluateTriggers } from '../services/automationEngine';
import { useAuth } from '../context/AuthContext';
import { sha256 } from '../utils/cryptoUtils';
import { hasCapability, guardCapability } from '../core/auth/permissions';
import { getFriendlyErrorMessage } from '../utils/errorUtils';

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

  /** Fields developers are NOT allowed to modify */
  const DEVELOPER_PROTECTED_FIELDS = new Set([
    'assignee_id', 'project_id', 'priority', 'confidence', 'risk',
    'delay_drift_days', 'predicted_completion', 'workspace_id',
  ]);

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
      console.warn('[processQueue] User lacks mutation permissions — purging offline queue.');
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
          console.warn(`[processQueue] Developer blocked from replaying '${op}' — skipping.`);
          const cq = JSON.parse(localStorage.getItem(queueKey) || '[]');
          localStorage.setItem(queueKey, JSON.stringify(cq.filter((q: any) => q.timestamp !== item.timestamp)));
          continue;
        }

        // Developers can only update tasks assigned to them
        if (isCurrentlyDeveloper && ['updateTaskStatus', 'updateTask', 'updateTaskDates'].includes(op)) {
          const targetTaskId = getRealId(item.payload.taskId);
          const targetTask = tasks.find(t => t.id === targetTaskId);
          if (targetTask && targetTask.assignee_id !== currentUserId) {
            console.warn(`[processQueue] Developer blocked from replaying '${op}' on unassigned task — skipping.`);
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
        console.warn('Sync failed for item:', item, err);
        
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
      setTasks([]);
      setDependencies([]);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      // Offline fallback
      const localTasks = localStorage.getItem(`tasks_${workspaceId}`);
      if (localTasks) {
        setTasks(JSON.parse(localTasks));
      } else {
        setTasks([]);
      }
      const localDeps = localStorage.getItem(`task_dependencies_${workspaceId}`);
      if (localDeps) {
        setDependencies(JSON.parse(localDeps));
      } else {
        setDependencies([]);
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
      
      setTasks(normalizeTasksFromRows((data || []) as Record<string, unknown>[]));
      if (!fetchAllLoaded) setPage(0);
      setHasMore(count !== null ? (to + 1) < count : false);

      // Fetch task dependencies from canonical table
      const depsQuery = supabase
        .from('task_dependencies')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (abortSignal) depsQuery.abortSignal(abortSignal);
      const { data: depData, error: depError } = await depsQuery;

      if (depError) throw depError;
      if (abortSignal?.aborted) return;
      setDependencies(depData as TaskDependency[]);

      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError' || abortSignal?.aborted) return;
      console.warn("Failed to load tasks/dependencies from Supabase, falling back to local cache:", err);
      const localTasks = localStorage.getItem(`tasks_${workspaceId}`);
      if (localTasks) {
        setTasks(JSON.parse(localTasks));
      }
      const localDeps = localStorage.getItem(`task_dependencies_${workspaceId}`);
      if (localDeps) {
        setDependencies(JSON.parse(localDeps));
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
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const newUnique = normalizeTasksFromRows((data || []) as Record<string, unknown>[]).filter(
          t => !existingIds.has(t.id),
        );
        return [...prev, ...newUnique];
      });
      setPage(nextPage);
      setHasMore(count !== null ? (to + 1) < count : false);
      setError(null);
    } catch (err: any) {
      console.warn("Failed to load more tasks:", err);
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
          setTasks(prev => {
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

    return () => {
      unsubscribeTasks();
      unsubscribeDeps();
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
        }
      } catch (err) {
        console.warn('Failed to sync across tabs', err);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [workspaceId]);

  const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    if (!workspaceId) return null;
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
    guardCapability(profile?.role, 'manage_tasks', 'updateTaskStatus');
    // Wave 7/9: Developers can only change status on their assigned tasks
    if (isDeveloper && !isAssignedTo(taskId)) {
      const msg = 'Unauthorized: You can only update tasks assigned to you.';
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

      if (status === 'done') {
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
    } else {
      const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status } : t);
      setTasks(updatedTasks);
      localStorage.setItem(`tasks_${workspaceId}`, JSON.stringify(updatedTasks));
    }
  };

  const updateTaskDates = async (taskId: string, startDate: string | null, deadline: string | null) => {
    if (!workspaceId) return;
    guardCapability(profile?.role, 'manage_tasks', 'updateTaskDates');
    // Wave 7/9: Developers can only change dates on their assigned tasks
    if (isDeveloper && !isAssignedTo(taskId)) {
      const msg = 'Unauthorized: You can only update dates for tasks assigned to you.';
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
        console.warn("Could not dispatch reschedule notification:", err);
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
    guardCapability(profile?.role, 'manage_tasks', 'updateTask');

    // Wave 7/9: Developer scope restrictions
    if (isDeveloper) {
      // Developers can only update tasks assigned to them
      if (!isAssignedTo(taskId)) {
        const msg = 'Unauthorized: You can only update tasks assigned to you.';
        setError(msg);
        throw new Error(msg);
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

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ ...taskToDbRow(updates as Record<string, unknown>), updated_at: new Date().toISOString() })
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
        for (const [key, value] of Object.entries(updates)) {
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
        console.warn("Could not dispatch dependency notification:", err);
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

  return { tasks, dependencies, loading, error, page, hasMore, loadMore, fetchTasks, addTask, updateTask, updateTaskStatus, updateTaskDates, deleteTask, addDependency, removeDependency };
}
