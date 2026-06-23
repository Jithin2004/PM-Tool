import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon, Plus, Trash2, Edit2, X, RefreshCw,
  ChevronLeft, ChevronRight, Grid, List, CheckCircle, Flag,
  Target, Zap, Briefcase, Clock
} from 'lucide-react';
import { calendarService, CalendarEvent } from '../../services/calendarService';
import { fetchWorkItemsForCalendar, VirtualCalendarItem } from '../../services/workItemCalendarService';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { hasCapability } from '../../core/auth/permissions';
import { showConfirm } from '../../components/common/Dialogs';

/** App-wide navigation helper (matches the custom ResolveRouter pattern). */
function navigateTo(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event('popstate'));
}

interface EventFormData {
  summary: string;
  description: string;
  start: string;
  end: string;
}

/** Union type for what the calendar can display */
type DisplayEvent = (CalendarEvent & { _virtual?: false }) | (VirtualCalendarItem & { _virtual: true });

const toLocalISOString = (date: Date) => {
  const tzoffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
};

// ── Source badge config ────────────────────────────────────────────────────────

const SOURCE_STYLES: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  meeting:   { bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    text: 'text-sky-400',    icon: <Clock   className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Meeting'   },
  holiday:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400',   icon: <CalendarIcon className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Holiday'   },
  festival:  { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400',   icon: <CalendarIcon className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Festival'  },
  regional:  { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-400',   icon: <CalendarIcon className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Regional'  },
  company:   { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', icon: <Briefcase className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Company'   },
  task:      { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400',  icon: <CheckCircle className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Task'      },
  milestone: { bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',text: 'text-emerald-400',icon: <Target  className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Milestone' },
  sprint:    { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', icon: <Zap     className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Sprint'    },
  project:   { bg: 'bg-fuchsia-500/10',border: 'border-fuchsia-500/20',text: 'text-fuchsia-400',icon: <Flag    className="w-2.5 h-2.5 inline mr-0.5" />, label: 'Project'   },
};

function getStyle(sourceOrType: string) {
  return SOURCE_STYLES[sourceOrType] ?? SOURCE_STYLES.meeting;
}

export function CalendarView() {
  const { user, profile } = useAuth();
  const { workspace } = useWorkspace();
  const [mongoEvents,  setMongoEvents]  = useState<CalendarEvent[]>([]);
  const [virtualItems, setVirtualItems] = useState<VirtualCalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const canManageEvents = hasCapability(profile, 'meeting.manage');

  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [editingEvent,  setEditingEvent]  = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    summary: '',
    description: '',
    start: toLocalISOString(new Date()),
    end:   toLocalISOString(new Date(Date.now() + 3600000)),
  });

  // ── Date window ──────────────────────────────────────────────────────────────
  const windowStart = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    return d.toISOString();
  }, [currentDate]);

  const windowEnd = useMemo(() => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 1);
    return d.toISOString();
  }, [currentDate]);

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError('');
    try {
      const [mongoData, workData] = await Promise.all([
        calendarService.getEvents(workspace.id, windowStart, windowEnd),
        fetchWorkItemsForCalendar(workspace.id, windowStart, windowEnd),
      ]);
      setMongoEvents(Array.isArray(mongoData) ? mongoData : []);
      setVirtualItems(workData);
    } catch (err: any) {
      setError(err.message || 'Could not fetch calendar data.');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, windowStart, windowEnd]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── All display events (merged) ───────────────────────────────────────────────
  const allDisplayEvents: DisplayEvent[] = useMemo(() => {
    const mongo = mongoEvents.map(e => ({ ...e, _virtual: false as const }));
    const virtual = virtualItems.map(v => ({ ...v, _virtual: true as const }));
    return [...mongo, ...virtual];
  }, [mongoEvents, virtualItems]);

  // ── Calendar grid ─────────────────────────────────────────────────────────────
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const days = useMemo(() => {
    const temp = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      temp.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      temp.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    const remaining = 42 - temp.length;
    for (let i = 1; i <= remaining; i++) {
      temp.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    return temp;
  }, [currentDate, daysInMonth, firstDayIndex, prevMonthDays]);

  const getDayEvents = (date: Date): DisplayEvent[] => {
    const cellStart = date.getTime();
    const cellEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
    return allDisplayEvents.filter(e => {
      const start = e._virtual
        ? new Date(e.start_date).getTime()
        : new Date((e as CalendarEvent).start).getTime();
      return start >= cellStart && start <= cellEnd;
    });
  };

  const getEventSource = (e: DisplayEvent): string => {
    if (e._virtual) return (e as VirtualCalendarItem).source;
    const ce = e as CalendarEvent;
    return ce.sourceType || 'meeting';
  };

  const getEventTitle = (e: DisplayEvent): string => {
    if (e._virtual) return (e as VirtualCalendarItem).title;
    return (e as CalendarEvent).summary || '(No title)';
  };

  const getEventStart = (e: DisplayEvent): string => {
    if (e._virtual) return (e as VirtualCalendarItem).start_date;
    return (e as CalendarEvent).start;
  };

  const getEventEnd = (e: DisplayEvent): string => {
    if (e._virtual) return (e as VirtualCalendarItem).end_date;
    return (e as CalendarEvent).end;
  };

  // ── Click handling ────────────────────────────────────────────────────────────
  const handleEventClick = (e: DisplayEvent) => {
    if (e._virtual) {
      const v = e as VirtualCalendarItem;
      switch (v.source) {
        case 'task':
          // Tasks live in the project board — navigate to project board
          if (v.meta.project_id) navigateTo(`/projects/${v.meta.project_id}/board`);
          break;
        case 'milestone':
          if (v.meta.project_id) navigateTo(`/projects/${v.meta.project_id}/board`);
          break;
        case 'sprint':
          if (v.meta.project_id) navigateTo(`/projects/${v.meta.project_id}/sprints`);
          break;
        case 'project':
          navigateTo(`/projects/${v.source_id}/board`);
          break;
        default:
          break;
      }
      return;
    }
    // Real Mongo event — open edit modal
    handleOpenModal(e as CalendarEvent);
  };

  // ── Notify helper ─────────────────────────────────────────────────────────────
  const notifyToast = (message: string, type: 'success' | 'error' | 'info') => {
    window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message, type } }));
  };

  // ── Modal helpers (Mongo events only) ─────────────────────────────────────────
  const handleOpenModal = (event?: CalendarEvent) => {
    if (event) {
      const isCompanyEvent = event.sourceType === 'company' || event.sourceType === 'holiday' || event.sourceType === 'festival';
      if (isCompanyEvent && !hasCapability(profile, 'settings.manage') && !hasCapability(profile, 'project.update')) {
        notifyToast('Only PMs and Admins can modify company/global events.', 'info');
        return;
      }
      if (!canManageEvents) { notifyToast('You do not have permission to modify events.', 'info'); return; }
      setEditingEvent(event);
      setFormData({
        summary:     event.summary,
        description: event.description || '',
        start: toLocalISOString(new Date(event.start)),
        end:   toLocalISOString(new Date(event.end)),
      });
    } else {
      if (!canManageEvents) { notifyToast('You do not have permission to create events.', 'info'); return; }
      setEditingEvent(null);
      setFormData({
        summary: '', description: '',
        start: toLocalISOString(new Date()),
        end:   toLocalISOString(new Date(Date.now() + 3600000)),
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenModalForDate = (date: Date) => {
    if (!canManageEvents) return;
    const start = new Date(date); start.setHours(9, 0, 0, 0);
    const end   = new Date(date); end.setHours(10, 0, 0, 0);
    setEditingEvent(null);
    setFormData({ summary: '', description: '', start: toLocalISOString(start), end: toLocalISOString(end) });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!workspace?.id) throw new Error('No active workspace');
      if (editingEvent) {
        await calendarService.updateEvent(editingEvent.id, {
          ...formData,
          start: new Date(formData.start).toISOString(),
          end:   new Date(formData.end).toISOString(),
        });
        notifyToast('Event updated.', 'success');
      } else {
        await calendarService.createEvent({
          ...formData, workspace_id: workspace.id, event_type: 'meeting',
          title:      formData.summary,
          start:      new Date(formData.start).toISOString(),
          end:        new Date(formData.end).toISOString(),
          start_date: new Date(formData.start).toISOString(),
          end_date:   new Date(formData.end).toISOString(),
        } as any);
        notifyToast('Event created.', 'success');
      }
      setIsModalOpen(false);
      fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('Delete this event?')) return;
    setLoading(true);
    try {
      await calendarService.deleteEvent(id);
      notifyToast('Event deleted.', 'success');
      fetchAll();
    } catch (err: any) {
      setError(err.message || 'Failed to delete event');
    } finally { setLoading(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-outline-variant gap-4 bg-surface-container-lowest">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            Scheduling &amp; Calendar
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Work deadlines, sprints, milestones, meetings, and holidays — all in one view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Source legend */}
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-medium text-on-surface-variant mr-2">
            {(['task','milestone','sprint','project','meeting','holiday'] as const).map(src => {
              const s = getStyle(src);
              return (
                <div key={src} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded ${s.bg} border ${s.border}`} />
                  {SOURCE_STYLES[src].label}
                </div>
              );
            })}
          </div>

          <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant">
            <button onClick={() => setViewMode('month')} className={`p-1.5 rounded transition-all ${viewMode === 'month' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`} title="Month View">
              <Grid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`} title="List View">
              <List className="w-4 h-4" />
            </button>
          </div>

          <button onClick={fetchAll} className="p-2 bg-surface-container hover:bg-surface-container-high rounded text-on-surface-variant transition-colors" title="Refresh" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canManageEvents && (
            <button onClick={() => handleOpenModal()} className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" /> New Event
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {error && (
          <div className="m-6 p-4 bg-error/10 border border-error/20 text-error rounded-lg">{error}</div>
        )}

        {loading && allDisplayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-60">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : viewMode === 'month' ? (
          /* ── Month Grid ── */
          <div className="flex-1 flex flex-col p-6 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-on-surface">
                  {currentDate.toLocaleString('default', { month: 'long' })} {year}
                </h2>
                <div className="flex items-center bg-surface-container rounded-lg p-1 border border-outline-variant">
                  <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container-high rounded transition-colors">Today</button>
                  <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-surface-container-high rounded text-on-surface-variant transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest shadow-inner">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-outline-variant bg-surface-container-low text-center">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{d}</div>
                ))}
              </div>

              {/* Days */}
              <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                {days.map((d, index) => {
                  const cellEvents = getDayEvents(d.date);
                  const isToday = new Date().toDateString() === d.date.toDateString();
                  return (
                    <div
                      key={index}
                      className={`min-h-[64px] p-1.5 border-r border-b border-outline-variant/40 flex flex-col group relative transition-colors ${d.isCurrentMonth ? 'bg-surface-container-lowest' : 'bg-surface-container-low/10 text-on-surface-variant/40'} hover:bg-surface-container-high/20`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-on-primary shadow-sm' : d.isCurrentMonth ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>
                          {d.day}
                        </span>
                        {canManageEvents && d.isCurrentMonth && (
                          <button onClick={() => handleOpenModalForDate(d.date)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-surface-container-high rounded text-primary transition-all duration-200" title="Add Event">
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-0.5 max-h-[56px]">
                        {cellEvents.length === 0 && <span className="text-[9px] text-on-surface-variant/30 select-none" />}
                        {cellEvents.map(ev => {
                          const src = getEventSource(ev);
                          const s   = getStyle(src);
                          const title = getEventTitle(ev);
                          return (
                            <button
                              key={ev.id}
                              onClick={() => handleEventClick(ev)}
                              className={`w-full text-left text-[9px] px-1.5 py-0.5 rounded border truncate block font-medium ${s.bg} ${s.border} ${s.text} hover:opacity-80 transition-opacity`}
                              title={`${title}${ev._virtual ? ' (read-only — click to open)' : ''}`}
                            >
                              {s.icon}{title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : allDisplayEvents.length === 0 ? (
          /* ── List empty state ── */
          <div className="flex flex-col items-center justify-center h-60 text-on-surface-variant">
            <CalendarIcon className="w-12 h-12 opacity-20 mb-4" />
            <p>No scheduled work or events for this period.</p>
            {canManageEvents && (
              <button onClick={() => handleOpenModal()} className="mt-4 px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded transition-colors">
                Create your first event
              </button>
            )}
          </div>
        ) : (
          /* ── List View ── */
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allDisplayEvents
              .sort((a, b) => new Date(getEventStart(a)).getTime() - new Date(getEventStart(b)).getTime())
              .map(ev => {
                const src   = getEventSource(ev);
                const s     = getStyle(src);
                const title = getEventTitle(ev);
                const start = new Date(getEventStart(ev));
                const end   = new Date(getEventEnd(ev));
                const isVirtual = ev._virtual;
                return (
                  <div
                    key={ev.id}
                    className={`p-4 bg-surface-container-lowest border ${s.border} rounded-xl hover:border-primary/30 transition-all group flex flex-col h-full shadow-sm cursor-pointer`}
                    onClick={() => handleEventClick(ev)}
                    title={isVirtual ? 'Click to open source item' : undefined}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-semibold text-on-surface truncate pr-2 text-sm ${s.text}`} title={title}>
                        {s.icon}{title}
                      </h3>
                      {!isVirtual && canManageEvents && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); handleOpenModal(ev as CalendarEvent); }} className="p-1 hover:bg-surface-container rounded text-on-surface-variant">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={async e => { e.stopPropagation(); await handleDelete((ev as CalendarEvent).id); }} className="p-1 hover:bg-error/10 hover:text-error rounded text-on-surface-variant">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant mb-2 flex flex-col gap-0.5">
                      <span>{start.toLocaleDateString()}</span>
                      <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="mt-auto flex justify-between items-center text-[9px] uppercase font-mono tracking-wider">
                      <span className={`px-2 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.text}`}>{s.label}</span>
                      {isVirtual && <span className="text-on-surface-variant/40">read-only</span>}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal (Mongo events only) ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-container-high w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h2 className="font-semibold text-on-surface">{editingEvent ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-surface-container rounded text-on-surface-variant transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs uppercase font-mono text-on-surface-variant mb-1">Title</label>
                <input type="text" value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-on-surface focus:border-primary outline-none text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase font-mono text-on-surface-variant mb-1">Start</label>
                  <input type="datetime-local" value={formData.start} onChange={e => setFormData({ ...formData, start: e.target.value })} className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-on-surface focus:border-primary outline-none text-sm" required />
                </div>
                <div>
                  <label className="block text-xs uppercase font-mono text-on-surface-variant mb-1">End</label>
                  <input type="datetime-local" value={formData.end} onChange={e => setFormData({ ...formData, end: e.target.value })} className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-on-surface focus:border-primary outline-none text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase font-mono text-on-surface-variant mb-1">Description (optional)</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-on-surface focus:border-primary outline-none min-h-[80px] resize-y text-sm" />
              </div>
              <div className="mt-2 flex justify-end gap-3 pt-3 border-t border-outline-variant">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 hover:bg-surface-container rounded-lg font-medium text-sm text-on-surface transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg font-medium text-sm text-on-primary transition-colors disabled:opacity-50">
                  {loading ? 'Saving…' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
