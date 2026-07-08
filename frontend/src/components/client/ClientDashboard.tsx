import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LogOut, FolderKanban, CheckCircle2, Clock, Inbox, ShieldCheck } from 'lucide-react';
import { navigate } from '../../lib/navigation';


interface Task {
  id: string;
  name: string;
  status: string;
  priority: string;
  due_date: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  tasks: Task[];
}

export const ClientDashboard: React.FC = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let tasksChannel: any;

    const fetchClientData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          setUserEmail(userData.user.email ?? null);
        }

        // RLS natively restricts this fetch to the client's assigned projects and tasks
        const { data, error } = await supabase
          .from('projects')
          .select('*, tasks(*)');

        if (error) throw error;
        
        setProjects(data as Project[] || []);

        // 🟢 Realtime Subscription for Live Sync Engine
        tasksChannel = supabase.channel('public:tasks')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
            setProjects((currentProjects) => {
              const updatedProjects = [...currentProjects];
              
              if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                const updatedTask = payload.new as any;
                const projectIndex = updatedProjects.findIndex(p => p.id === updatedTask.project_id);
                
                if (projectIndex !== -1) {
                  const project = { ...updatedProjects[projectIndex] };
                  const tasks = [...project.tasks];
                  const taskIndex = tasks.findIndex(t => t.id === updatedTask.id);
                  
                  if (taskIndex !== -1) {
                    tasks[taskIndex] = { ...tasks[taskIndex], ...updatedTask };
                  } else {
                    tasks.push(updatedTask);
                  }
                  
                  project.tasks = tasks;
                  updatedProjects[projectIndex] = project;
                }
              } else if (payload.eventType === 'DELETE') {
                const deletedTask = payload.old as any;
                // Supabase DELETE payload often only contains the PK (id) if replica identity isn't FULL
                // So we have to search across all projects to find and remove the task
                updatedProjects.forEach((project, index) => {
                  const hasTask = project.tasks.some(t => t.id === deletedTask.id);
                  if (hasTask) {
                    const newProject = { ...project };
                    newProject.tasks = project.tasks.filter(t => t.id !== deletedTask.id);
                    updatedProjects[index] = newProject;
                  }
                });
              }
              
              return updatedProjects;
            });
          })
          .subscribe();

      } catch (err) {
        console.error('Error fetching client data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();

    return () => {
      if (tasksChannel) {
        supabase.removeChannel(tasksChannel);
      }
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse" />
        <div className="flex-1 p-8 max-w-7xl mx-auto w-full space-y-8">
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl animate-pulse" />
          <div className="h-96 bg-zinc-200 dark:bg-zinc-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white">
              Client Portal
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-zinc-500 dark:text-zinc-400">
              {userEmail}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {projects.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center shadow-sm">
            <div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Inbox className="h-10 w-10 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2">
              No Projects Assigned
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              You currently do not have any active projects linked to your account. Your project manager will invite you when your workspace is ready.
            </p>
          </div>
        ) : (
          projects.map((project) => {
            const totalTasks = project.tasks?.length || 0;
            const completedTasks = project.tasks?.filter(t => t.status === 'completed' || t.status === 'done').length || 0;
            const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

            return (
              <div key={project.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-all hover:shadow-md">
                
                {/* Project Header & Progress */}
                <div className="p-6 sm:p-8 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <FolderKanban className="h-6 w-6 text-indigo-500" />
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                          {project.name}
                        </h2>
                      </div>
                      {project.description && (
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl">
                          {project.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-6 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700/50 min-w-[200px]">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Progress</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Task List Read-Only */}
                <div className="p-6 sm:p-8 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">
                    Tasks & Milestones
                  </h3>
                  
                  {totalTasks === 0 ? (
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">No tasks have been scheduled yet.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {project.tasks.map((task) => {
                        const isCompleted = task.status === 'completed' || task.status === 'done';
                        
                        return (
                          <div 
                            key={task.id} 
                            className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-start gap-3"
                          >
                            <div className="mt-0.5 shrink-0">
                              {isCompleted ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              ) : (
                                <Clock className="h-5 w-5 text-amber-500" />
                              )}
                            </div>
                            <div>
                              <p className={`font-medium ${isCompleted ? 'text-zinc-500 line-through dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                {task.name}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300">
                                  {task.status.replace('_', ' ')}
                                </span>
                                {task.priority && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
                                    {task.priority}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            );
          })
        )}
      </main>
    </div>
  );
};
