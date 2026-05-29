import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { realtimeOrchestrator } from '../services/realtimeOrchestrator';
import { Project, ProjectStatus } from '../types';

export function useProjects(workspaceId?: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  const queueMutation = useCallback((operation: string, payload: any) => {
    if (!workspaceId) return;
    const queue = JSON.parse(localStorage.getItem(`offline_project_queue_${workspaceId}`) || '[]');
    queue.push({ operation, payload, timestamp: new Date().toISOString(), workspace_id: workspaceId, retry_count: 0 });
    localStorage.setItem(`offline_project_queue_${workspaceId}`, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: "Changes queued. Syncing when connection returns.", type: "warning" } }));
  }, [workspaceId]);

  const processQueue = useCallback(async () => {
    if (!workspaceId || !navigator.onLine) return;
    const queueKey = `offline_project_queue_${workspaceId}`;
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    if (queue.length === 0) return;

    const getRealId = (id: string) => {
      if (!id || !id.startsWith('local-')) return id;
      const map = JSON.parse(localStorage.getItem(`id_map_${workspaceId}`) || '{}');
      return map[id] || id;
    };

    for (const item of queue) {
      try {
        if (item.operation === 'addProject') {
          const { data: realProject, error: insertError } = await supabase
            .from('projects')
            .insert({ ...item.payload.projectData, workspace_id: workspaceId })
            .select()
            .single();

          if (insertError) throw insertError;

          if (realProject) {
            if (item.payload.temporaryId) {
              const map = JSON.parse(localStorage.getItem(`id_map_${workspaceId}`) || '{}');
              map[item.payload.temporaryId] = realProject.id;
              localStorage.setItem(`id_map_${workspaceId}`, JSON.stringify(map));

              setProjects(prev => prev.map(p => p.id === item.payload.temporaryId ? (realProject as Project) : p));
            }
          }
        }
        else if (item.operation === 'updateProjectStatus') {
          const projectId = getRealId(item.payload.projectId);
          const { error: updateError } = await supabase
            .from('projects')
            .update({ status: item.payload.status, updated_at: new Date().toISOString() })
            .eq('id', projectId)
            .eq('workspace_id', workspaceId);

          if (updateError) throw updateError;
        }
        else if (item.operation === 'updateProject') {
          const projectId = getRealId(item.payload.projectId);
          const { error: updateError } = await supabase
            .from('projects')
            .update({ ...item.payload.updates, updated_at: new Date().toISOString() })
            .eq('id', projectId)
            .eq('workspace_id', workspaceId);

          if (updateError) throw updateError;
        }
        else if (item.operation === 'deleteProject') {
          const projectId = getRealId(item.payload.projectId);
          const { error: deleteError } = await supabase
            .from('projects')
            .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', projectId)
            .eq('workspace_id', workspaceId)
            .is('deleted_at', null);

          if (deleteError) throw deleteError;
        }

        // Successfully synced: Remove item from queue safely
        const currentQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        const nextQueue = currentQueue.filter((qItem: any) => qItem.timestamp !== item.timestamp);
        localStorage.setItem(queueKey, JSON.stringify(nextQueue));
      } catch (err) {
        console.warn('Sync failed for item:', item, err);
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
  }, [workspaceId]);

  useEffect(() => {
    window.addEventListener('online', processQueue);
    return () => window.removeEventListener('online', processQueue);
  }, [processQueue]);

  const fetchProjects = useCallback(async (abortSignal?: AbortSignal, fetchAllLoaded = false) => {
    if (!workspaceId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      // Offline fallback
      const localProjects = localStorage.getItem(`projects_${workspaceId}`);
      if (localProjects) {
        setProjects(JSON.parse(localProjects));
      } else {
        setProjects([]);
      }
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const from = 0;
      const to = fetchAllLoaded ? ((page + 1) * limit - 1) : (limit - 1);

      const query = supabase
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (abortSignal) query.abortSignal(abortSignal);
      
      const { data, count, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      if (abortSignal?.aborted) return;
      
      setProjects(data as Project[]);
      if (!fetchAllLoaded) setPage(0);
      setHasMore(count !== null ? (to + 1) < count : false);
      setError(null);
    } catch (err: any) {
      if (err.name === 'AbortError' || abortSignal?.aborted) return;
      console.warn("Failed to load projects from Supabase, falling back to local cache:", err);
      const localProjects = localStorage.getItem(`projects_${workspaceId}`);
      if (localProjects) {
        setProjects(JSON.parse(localProjects));
      }
      setError(err.message || 'Failed to fetch projects');
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
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;
      setProjects(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newUnique = (data as Project[]).filter(p => !existingIds.has(p.id));
        return [...prev, ...newUnique];
      });
      setPage(nextPage);
      setHasMore(count !== null ? (to + 1) < count : false);
      setError(null);
    } catch (err: any) {
      console.warn("Failed to load more projects:", err);
    } finally {
      setLoading(false);
    }
  }, [page, hasMore, loading, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProjects(controller.signal);
    
    if (workspaceId && isSupabaseConfigured) {
      const unsubscribe = realtimeOrchestrator.subscribe(
        `projects-changes-${workspaceId}`,
        'projects',
        `workspace_id=eq.${workspaceId}`,
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          if (eventType === 'INSERT') {
            if (newRecord.deleted_at) return;
            setProjects(prev => {
              if (prev.some(p => p.id === newRecord.id)) return prev;
              return [newRecord as Project, ...prev];
            });
          } else if (eventType === 'UPDATE') {
            if (newRecord.deleted_at) {
              setProjects(prev => prev.filter(p => p.id !== newRecord.id));
            } else {
              setProjects(prev => prev.map(p => p.id === newRecord.id ? { ...p, ...newRecord } : p));
            }
          } else if (eventType === 'DELETE') {
            setProjects(prev => prev.filter(p => p.id !== oldRecord.id));
          }
        }
      );
        
      return () => {
        controller.abort();
        unsubscribe();
      };
    }
    
    return () => {
      controller.abort();
    };
  }, [fetchProjects, workspaceId]);

  // Multi-Tab State Consistency
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `projects_${workspaceId}` && e.newValue) {
        try {
          setProjects(JSON.parse(e.newValue));
        } catch (err) {
          console.warn('Failed to sync projects across tabs', err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [workspaceId]);

  const addProject = async (projectData: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    if (!workspaceId) return null;
    
    if (isSupabaseConfigured) {
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({ ...projectData, workspace_id: workspaceId })
        .select()
        .single();
        
      if (insertError) {
        if (!navigator.onLine || insertError.message?.toLowerCase().includes('fetch')) {
          const localProject = { ...projectData, id: `local-project-${Date.now()}`, workspace_id: workspaceId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Project;
          queueMutation('addProject', { projectData, temporaryId: localProject.id });
          setProjects(prev => [localProject, ...prev]);
          return localProject;
        }
        setError(insertError.message);
        throw insertError;
      }
      
      setProjects(prev => [data as Project, ...prev]);
      return data as Project;
    } else {
      // Local fallback
      const newProject: Project = {
        ...projectData,
        id: `local-project-${Date.now()}`,
        workspace_id: workspaceId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const updatedProjects = [newProject, ...projects];
      setProjects(updatedProjects);
      localStorage.setItem(`projects_${workspaceId}`, JSON.stringify(updatedProjects));
      return newProject;
    }
  };

  const updateProjectStatus = async (projectId: string, status: ProjectStatus) => {
    if (!workspaceId) return;
    
    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('workspace_id', workspaceId);
        
      if (updateError) {
        if (!navigator.onLine || updateError.message?.toLowerCase().includes('fetch')) {
          queueMutation('updateProjectStatus', { projectId, status });
          setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status } : p));
          return;
        }
        setError(updateError.message);
        throw updateError;
      }
      
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status } : p));
    } else {
      const updatedProjects = projects.map(p => p.id === projectId ? { ...p, status } : p);
      setProjects(updatedProjects);
      localStorage.setItem(`projects_${workspaceId}`, JSON.stringify(updatedProjects));
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!workspaceId) return;
    
    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('workspace_id', workspaceId);
        
      if (updateError) {
        if (!navigator.onLine || updateError.message?.toLowerCase().includes('fetch')) {
          queueMutation('updateProject', { projectId, updates });
          setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));
          return;
        }
        setError(updateError.message);
        throw updateError;
      }
      
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));
    } else {
      const updatedProjects = projects.map(p => p.id === projectId ? { ...p, ...updates } : p);
      setProjects(updatedProjects);
      localStorage.setItem(`projects_${workspaceId}`, JSON.stringify(updatedProjects));
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!workspaceId) return;
    
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null);
        
      if (deleteError) {
        if (!navigator.onLine || deleteError.message?.toLowerCase().includes('fetch')) {
          queueMutation('deleteProject', { projectId });
          setProjects(prev => prev.filter(p => p.id !== projectId));
          return;
        }
        setError(deleteError.message);
        throw deleteError;
      }
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } else {
      const updatedProjects = projects.filter(p => p.id !== projectId);
      setProjects(updatedProjects);
      localStorage.setItem(`projects_${workspaceId}`, JSON.stringify(updatedProjects));
    }
  };

  return { projects, loading, error, page, hasMore, loadMore, fetchProjects, addProject, updateProject, updateProjectStatus, deleteProject };
}
