import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, CheckCircle2, Loader2, AlertCircle, Calendar } from 'lucide-react';

interface TimeLoggerProps {
  workspaceId: string;
  projectId: string;
}

interface Task {
  id: string;
  name: string;
  status: string;
}

interface TimeLog {
  id: string;
  task_id: string;
  hours_logged: number;
  description: string;
  is_billable: boolean;
  billing_status: string;
  logged_at: string;
  tasks: { name: string };
}

export const TimeLogger: React.FC<TimeLoggerProps> = ({ workspaceId, projectId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recentLogs, setRecentLogs] = useState<TimeLog[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  // Form State
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [hours, setHours] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchInitialData = async () => {
    try {
      setLoadingInitial(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch Tasks for the selected project
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, name, status')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

      // Fetch Recent Time Logs for this user in this project
      const { data: logsData, error: logsError } = await supabase
        .from('time_logs')
        .select(`
          id, hours_logged, description, is_billable, billing_status, logged_at, task_id,
          tasks!inner ( name, project_id )
        `)
        .eq('user_id', user.id)
        .eq('tasks.project_id', projectId)
        .order('logged_at', { ascending: false })
        .limit(10);

      if (logsError) throw logsError;
      setRecentLogs(logsData as any || []);

    } catch (err: any) {
      console.error('Error fetching time logger data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [workspaceId, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      if (!hours || Number(hours) <= 0) {
        throw new Error('Hours logged must be greater than 0');
      }
      if (!selectedTaskId) {
        throw new Error('Please select a task');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      const { error: insertError } = await supabase
        .from('time_logs')
        .insert({
          workspace_id: workspaceId,
          task_id: selectedTaskId,
          user_id: user.id,
          hours_logged: Number(hours),
          description: description.trim() || null,
          is_billable: isBillable,
          billing_status: 'unbilled'
        });

      if (insertError) throw insertError;

      // Reset form
      setHours('');
      setDescription('');
      setIsBillable(true);
      setSuccess(true);
      
      // Refresh the recent logs list
      await fetchInitialData();
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Time logging error:', err);
      setError(err.message || 'Failed to log time');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-zinc-800 rounded w-1/4 mb-6"></div>
        <div className="space-y-4">
          <div className="h-10 bg-zinc-800 rounded"></div>
          <div className="h-10 bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-zinc-50 border border-zinc-800 rounded-xl shadow-xl overflow-hidden font-sans">
      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-center">
            <Clock className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Log Time</h2>
            <p className="text-sm text-zinc-400">Record your billable hours and activities</p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Task Selector */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300">Task / Milestone</label>
              <select
                required
                value={selectedTaskId}
                onChange={e => setSelectedTaskId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-zinc-100 focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <option value="" disabled>Select an active task...</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {task.name} ({task.status.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            {/* Hours Input */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300">Hours</label>
              <div className="relative">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={hours}
                  onChange={e => setHours(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-3 pr-12 py-2.5 text-zinc-100 focus:ring-2 focus:ring-indigo-500 transition-colors placeholder:text-zinc-600"
                  placeholder="e.g. 1.5"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-500 text-sm">
                  hrs
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Description (Optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:ring-2 focus:ring-indigo-500 transition-colors placeholder:text-zinc-600 resize-none"
              placeholder="What did you work on?"
            />
          </div>

          {/* Billable Toggle & Submit */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={isBillable}
                  onChange={e => setIsBillable(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-10 h-6 bg-zinc-700 rounded-full peer peer-checked:bg-indigo-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
              </div>
              <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                Mark as Billable
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !hours || !selectedTaskId}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-500/20 disabled:shadow-none"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Entry
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm animate-in fade-in zoom-in">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p>Time successfully logged!</p>
            </div>
          )}
        </form>
      </div>

      {/* Recent Logs List */}
      <div className="bg-zinc-900/30 p-6">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Your Recent Logs (Project)</h3>
        
        {recentLogs.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No time logged for this project yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
                <div className="space-y-1 mb-3 sm:mb-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-200">{log.tasks?.name}</span>
                    {log.is_billable && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Billable
                      </span>
                    )}
                  </div>
                  {log.description && (
                    <p className="text-sm text-zinc-500 truncate max-w-md">{log.description}</p>
                  )}
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1 shrink-0">
                  <div className="text-lg font-mono font-semibold text-white">
                    {log.hours_logged.toFixed(2)} <span className="text-sm text-zinc-500 font-sans font-normal">hrs</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(log.logged_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
