import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, Trash2, Edit2, X, RefreshCw } from 'lucide-react';
import { calendarService, CalendarEvent } from '../../services/calendarService';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';

interface EventFormData {
  summary: string;
  description: string;
  start: string;
  end: string;
}

export function CalendarView() {
  const { user, profile } = useAuth();
  const { workspace } = useWorkspace();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  
  const [formData, setFormData] = useState<EventFormData>({
    summary: '',
    description: '',
    start: new Date().toISOString().slice(0, 16),
    end: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  });

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      if (!workspace?.id) return;
      
      // Default to showing past month and next 3 months
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const data = await calendarService.getEvents(workspace.id, startDate, endDate);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not fetch events. Ensure Google Calendar is connected.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspace?.id) {
      fetchEvents();
    }
  }, [workspace?.id]);

  const handleConnect = () => {
    window.location.href = calendarService.getAuthUrl();
  };

  const handleOpenModal = (event?: CalendarEvent) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        summary: event.summary,
        description: event.description || '',
        start: new Date(event.start).toISOString().slice(0, 16),
        end: new Date(event.end).toISOString().slice(0, 16),
      });
    } else {
      setEditingEvent(null);
      setFormData({
        summary: '',
        description: '',
        start: new Date().toISOString().slice(0, 16),
        end: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!workspace?.id) throw new Error("No active workspace");

      if (editingEvent) {
        await calendarService.updateEvent(editingEvent.id, formData);
      } else {
        await calendarService.createEvent({
          ...formData,
          workspace_id: workspace.id,
          event_type: 'meeting',
          title: formData.summary,
          start_date: formData.start,
          end_date: formData.end
        } as any);
      }
      setIsModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    setLoading(true);
    try {
      await calendarService.deleteEvent(id);
      fetchEvents();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex justify-between items-center p-6 border-b border-outline-variant">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            Personal Scheduling
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Manage your work-related events and task deadlines. Synced with Google Calendar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchEvents}
            className="p-2 bg-surface-container hover:bg-surface-container-high rounded text-on-surface-variant transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleConnect}
            className="px-4 py-2 border border-outline hover:bg-surface-container rounded text-sm font-medium text-on-surface transition-colors"
          >
            Connect Google Calendar
          </button>
          {profile?.role !== 'developer' && profile?.role !== 'viewer' && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {error && (
          <div className="mb-4 p-4 bg-error/10 border border-error/20 text-error rounded-lg">
            {error}
          </div>
        )}

        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-on-surface-variant">
            <CalendarIcon className="w-12 h-12 opacity-20 mb-4" />
            <p>No events found for the upcoming period.</p>
            {profile?.role !== 'developer' && profile?.role !== 'viewer' && (
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded transition-colors"
              >
                Create your first event
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {events.map((event) => {
              const startDate = new Date(event.start);
              const endDate = new Date(event.end);
              return (
                <div key={event.id} className="p-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:border-primary/30 transition-all group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-on-surface truncate pr-2" title={event.summary}>
                      {event.summary || '(No title)'}
                    </h3>
                    {profile?.role !== 'developer' && profile?.role !== 'viewer' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(event)}
                          className="p-1 hover:bg-surface-container rounded text-on-surface-variant"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(event.id)}
                          className="p-1 hover:bg-error/10 hover:text-error rounded text-on-surface-variant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-on-surface-variant mb-3 flex flex-col gap-1">
                    <span>{startDate.toLocaleDateString()}</span>
                    <span>{startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-on-surface-variant line-clamp-3 mt-auto pt-3 border-t border-outline-variant/30">
                      {event.description}
                    </p>
                  )}
                  
                  {event.sourceType && (
                    <div className="mt-3 text-[10px] uppercase font-mono tracking-wider text-primary/70">
                      Linked: {event.sourceType}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface-container-high w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-outline-variant flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h2 className="font-semibold text-on-surface">{editingEvent ? 'Edit Event' : 'New Event'}</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-surface-container rounded text-on-surface-variant transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs uppercase font-mono text-on-surface-variant mb-1">Title</label>
                <input 
                  type="text" 
                  value={formData.summary}
                  onChange={e => setFormData({...formData, summary: e.target.value})}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-on-surface focus:border-primary outline-none"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono text-on-surface-variant mb-1">Start Time</label>
                  <input 
                    type="datetime-local" 
                    value={formData.start}
                    onChange={e => setFormData({...formData, start: e.target.value})}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-on-surface focus:border-primary outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono text-on-surface-variant mb-1">End Time</label>
                  <input 
                    type="datetime-local" 
                    value={formData.end}
                    onChange={e => setFormData({...formData, end: e.target.value})}
                    className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-on-surface focus:border-primary outline-none"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs uppercase font-mono text-on-surface-variant mb-1">Description (Optional)</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-on-surface focus:border-primary outline-none min-h-[100px] resize-y"
                />
              </div>
              
              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-outline-variant">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 hover:bg-surface-container rounded-lg font-medium text-sm text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg font-medium text-sm text-on-primary transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
