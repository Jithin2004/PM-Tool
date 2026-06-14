import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RefreshCw, Upload, Plus, X, Globe, Building2, Save } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { companyCalendarService, CompanyCalendarEvent, WorkspaceCalendarSettings } from '../../services/companyCalendarService';
import { hasCapability } from '../../core/auth/permissions';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import Papa from 'papaparse';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_HEADERS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function CompanyCalendarPanel() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const canManageCalendar = hasCapability(profile?.role, 'manage_settings');
  
  const [tab, setTab] = useState<'calendar' | 'settings'>('calendar');
  const [year, setYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<CompanyCalendarEvent[]>([]);
  const [settings, setSettings] = useState<WorkspaceCalendarSettings | null>(null);
  
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', date: '', event_type: 'company' as const });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(showCreateForm, () => setShowCreateForm(false));

  const loadData = async () => {
    if (!workspace?.id) return;
    const [evts, sets] = await Promise.all([
      companyCalendarService.getEvents(workspace.id, year),
      companyCalendarService.getSettings(workspace.id)
    ]);
    setEvents(evts);
    setSettings(sets);
  };

  useEffect(() => {
    loadData();
  }, [workspace?.id, year]);

  const handleSyncNow = async () => {
    if (!workspace?.id || !workspace.settings.country || syncing) return;
    setSyncing(true);
    setLastSyncResult(null);
    try {
      const result = await companyCalendarService.syncHolidays(
        workspace.id, workspace.settings.country, workspace.settings.region || ''
      );
      setLastSyncResult(
        `Sync complete: ${result.imported} imported out of ${result.totalFound} found.`
      );
      await loadData();
    } catch (err: any) {
      setLastSyncResult(`Sync failed: ${err?.message || 'Unknown error'}`);
    } finally { setSyncing(false); }
  };

  const handleCreateEvent = async () => {
    if (!workspace?.id || !newEvent.name || !newEvent.date) return;
    const ev = await companyCalendarService.createEvent({
      workspace_id: workspace.id,
      name: newEvent.name,
      date: newEvent.date,
      event_type: newEvent.event_type,
      source: 'manual',
      year: parseInt(newEvent.date.split('-')[0], 10)
    });
    if (ev) {
      setShowCreateForm(false);
      setNewEvent({ name: '', date: '', event_type: 'company' });
      await loadData();
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!canManageCalendar) return;
    if (confirm("Remove this event?")) {
      const ok = await companyCalendarService.deleteEvent(id);
      if (ok) await loadData();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace?.id) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsed = results.data.map((row: any) => ({
          name: row['Event Name'] || row.name,
          date: row['Date'] || row.date,
          type: row['Type'] || row.type || 'company'
        })).filter(r => r.name && r.date);
        
        if (parsed.length > 0) {
          const imported = await companyCalendarService.bulkImportEvents(workspace.id, parsed);
          setLastSyncResult(`Imported ${imported} events from CSV.`);
          loadData();
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const saveSettings = async () => {
    if (!workspace?.id || !settings) return;
    await companyCalendarService.updateSettings(workspace.id, settings);
    window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Settings saved successfully.', type: 'success' }}));
  };

  const toggleWorkingDay = (dayIndex: number) => {
    if (!settings) return;
    const newDays = settings.working_days.includes(dayIndex)
      ? settings.working_days.filter(d => d !== dayIndex)
      : [...settings.working_days, dayIndex];
    setSettings({ ...settings, working_days: newDays });
  };

  const calendarGrid = useMemo(() => {
    const weeks: Array<Array<{ day: number; isOff: boolean; events: CompanyCalendarEvent[] } | null>> = [];
    const workingDays = settings?.working_days || [1,2,3,4,5,6];
    const saturdayPolicy = settings?.saturday_policy || 'ALL_WORKING';

    for (let m = 0; m < 12; m++) {
      const firstDay = new Date(year, m, 1);
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const startOffset = (firstDay.getDay() + 6) % 7;
      const days: Array<{ day: number; isOff: boolean; events: CompanyCalendarEvent[] } | null> = [];
      
      for (let i = 0; i < startOffset; i++) days.push(null);
      
      let satCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const current = new Date(year, m, d);
        const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat
        
        let isOff = !workingDays.includes(dayOfWeek);
        
        if (dayOfWeek === 6 && workingDays.includes(6)) {
          satCount++;
          if (saturdayPolicy === 'ALL_OFF') isOff = true;
          else if (saturdayPolicy === 'FIRST_THIRD_OFF' && (satCount === 1 || satCount === 3)) isOff = true;
          else if (saturdayPolicy === 'SECOND_FOURTH_OFF' && (satCount === 2 || satCount === 4)) isOff = true;
          else if (saturdayPolicy === 'CUSTOM' && settings?.custom_saturdays_off?.includes(satCount)) isOff = true;
        }

        const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEvents = events.filter(e => e.date === dateStr);
        days.push({ day: d, isOff, events: dayEvents });
      }
      weeks.push(days);
    }
    return weeks;
  }, [year, events, settings]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-1">Company Calendar</h2>
          <p className="text-[12px] text-text-tertiary font-medium">
            {canManageCalendar ? 'Manage organization working days, holidays, and syncing.' : 'Regional and company event schedule visibility.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canManageCalendar && (
            <>
              <button 
                onClick={() => setShowCreateForm(true)} 
                className="px-4 py-2 btn-premium-primary rounded-lg text-[12px] font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Event
              </button>
              
            </>
          )}
          <div className="flex items-center bg-surface-2 border border-border rounded-lg p-1 shadow-sm">
            <button onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-surface-3 rounded-md transition-colors text-text-tertiary"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-4 text-[13px] font-bold text-text-primary">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-1.5 hover:bg-surface-3 rounded-md transition-colors text-text-tertiary"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border-subtle mb-8">
        <button 
          onClick={() => setTab('calendar')} 
          className={`px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-all border-b-2 ${
            tab === 'calendar' ? 'border-accent-primary text-text-primary bg-accent-primary/5' : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          Calendar View
        </button>
        {canManageCalendar && (
          <button 
            onClick={() => setTab('settings')} 
            className={`px-5 py-3 text-[12px] font-bold uppercase tracking-wider transition-all border-b-2 ${
              tab === 'settings' ? 'border-accent-primary text-text-primary bg-accent-primary/5' : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Working Rules
          </button>
        )}
      </div>

      {tab === 'calendar' && (
        <div className="space-y-8">
          

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {calendarGrid.map((monthDays, mi) => (
              <div key={mi} className="bg-surface-2 border border-border rounded-xl p-4 shadow-sm hover:border-accent-primary/20 transition-all">
                <h4 className="text-[12px] font-bold uppercase tracking-widest text-accent-primary mb-4">{MONTHS[mi]}</h4>
                <div className="grid grid-cols-7 gap-1">
                  {DAY_HEADERS.map(d => <div key={d} className="text-[10px] font-bold text-text-quaternary text-center py-1">{d}</div>)}
                  {monthDays.map((cell, ci) => (
                    <div key={ci} className="aspect-square flex items-center justify-center text-[11px] font-bold relative group">
                      {cell && (
                        <div className={`w-full h-full flex items-center justify-center rounded-lg transition-all ${
                          cell.events.length > 0 ? 'bg-accent-primary text-white shadow-sm' 
                          : cell.isOff ? 'bg-signal-critical/10 text-signal-critical'
                          : 'text-text-tertiary hover:bg-surface-3 hover:text-text-primary'
                        }`}>
                          {cell.day}
                        </div>
                      )}
                      {cell && (cell.events.length > 0 || cell.isOff) && (
                        <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 pb-2 hidden group-hover:block w-48">
                          <div className="bg-surface border border-border rounded-xl shadow-2xl p-3 overflow-hidden">
                            <div className="space-y-2">
                              {cell.isOff && (
                                <div className="text-xs font-bold text-signal-critical mb-1">Weekly Off</div>
                              )}
                              {cell.events.map((ev: CompanyCalendarEvent) => (
                                <div key={ev.id} className="flex flex-col gap-1 p-2 rounded-lg bg-surface-2 border border-border-subtle">
                                  <span className="text-[11px] font-bold text-text-primary truncate">{ev.name}</span>
                                  {canManageCalendar && (
                                    <button
                                      onClick={() => handleDeleteEvent(ev.id!)}
                                      className="text-[9px] text-signal-critical hover:underline text-left mt-1"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'settings' && settings && (
        <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Rules & Hours */}
          <div className="space-y-6">
            <div className="bg-surface-2 border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 border-b border-border-subtle pb-2">Working Week</h3>
              <div className="flex flex-wrap gap-4">
                {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, i) => (
                  <label key={day} className="flex items-center gap-2 text-sm font-medium text-text-secondary cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={settings.working_days.includes(i)}
                      onChange={() => toggleWorkingDay(i)}
                      className="w-4 h-4 rounded text-accent-primary focus:ring-accent-primary bg-surface border-border"
                    />
                    {day.substring(0,3)}
                  </label>
                ))}
              </div>
            </div>

            {settings.working_days.includes(6) && (
              <div className="bg-surface-2 border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 border-b border-border-subtle pb-2">Saturday Policy</h3>
                <select 
                  value={settings.saturday_policy}
                  onChange={(e: any) => setSettings({ ...settings, saturday_policy: e.target.value })}
                  className="w-full input-premium h-10 px-3 text-sm mb-4"
                >
                  <option value="ALL_WORKING">All Saturdays Working</option>
                  <option value="ALL_OFF">All Saturdays Off</option>
                  <option value="FIRST_THIRD_OFF">1st & 3rd Saturdays Off</option>
                  <option value="SECOND_FOURTH_OFF">2nd & 4th Saturdays Off</option>
                  <option value="CUSTOM">Custom Saturday Rules</option>
                </select>

                {settings.saturday_policy === 'CUSTOM' && (
                  <div className="p-4 rounded-lg bg-surface-3 border border-border mt-2 flex flex-wrap gap-3">
                    {[1, 2, 3, 4, 5].map(week => (
                      <label key={week} className="flex items-center gap-2 text-xs font-bold text-text-secondary cursor-pointer bg-surface-2 px-3 py-1.5 rounded-md border border-border hover:border-accent-primary/50 transition-colors">
                        <input 
                          type="checkbox"
                          checked={settings.custom_saturdays_off?.includes(week)}
                          onChange={(e) => {
                            const current = settings.custom_saturdays_off || [];
                            const updated = e.target.checked 
                              ? [...current, week] 
                              : current.filter(w => w !== week);
                            setSettings({ ...settings, custom_saturdays_off: updated });
                          }}
                          className="w-3.5 h-3.5 rounded text-accent-primary bg-surface"
                        />
                        {week}{week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'} Sat
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-surface-2 border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 border-b border-border-subtle pb-2">Working Hours</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Office Start Time</label>
                  <input 
                    type="time" 
                    value={settings.working_hours?.office_start_time || '09:00'}
                    onChange={e => setSettings({
                      ...settings, 
                      working_hours: { ...settings.working_hours, office_start_time: e.target.value } as any
                    })}
                    className="w-full input-premium h-10 px-3 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Office End Time</label>
                  <input 
                    type="time" 
                    value={settings.working_hours?.office_end_time || '17:00'}
                    onChange={e => setSettings({
                      ...settings, 
                      working_hours: { ...settings.working_hours, office_end_time: e.target.value } as any
                    })}
                    className="w-full input-premium h-10 px-3 text-sm" 
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Daily Working Hours</label>
                  <input 
                    type="number" 
                    step="0.5"
                    value={settings.working_hours?.daily_working_hours || 8}
                    onChange={e => setSettings({
                      ...settings, 
                      working_hours: { ...settings.working_hours, daily_working_hours: parseFloat(e.target.value) } as any
                    })}
                    className="w-full input-premium h-10 px-3 text-sm" 
                  />
                  <p className="text-[10px] text-text-tertiary mt-1">Used for capacity and sprint point calculations.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Holiday Config & Save */}
          <div className="space-y-6 flex flex-col h-full">
            <div className="bg-surface-2 border border-border rounded-xl p-6 shadow-sm flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 border-b border-border-subtle pb-2">Holiday Configuration</h3>
              
              <div className="space-y-6">
                <div className="p-5 rounded-xl border border-border bg-surface flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">Smart Holiday Sync</h4>
                      <p className="text-[11px] text-text-tertiary">Based on workspace location ({workspace?.settings?.country || 'Unconfigured'})</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSyncNow} 
                    disabled={syncing || !workspace?.settings?.country} 
                    className="w-full py-2.5 bg-surface-3 border border-border rounded-lg text-xs font-bold hover:bg-surface-4 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Government Holidays'}
                  </button>
                  {lastSyncResult && lastSyncResult.includes('imported') && (
                    <p className="text-[10px] font-bold text-signal-safe text-center mt-2">{lastSyncResult}</p>
                  )}
                </div>

                <div className="p-5 rounded-xl border border-border bg-surface flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center text-text-secondary">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">Manual Calendar Upload</h4>
                      <p className="text-[11px] text-text-tertiary">Upload HR calendars via CSV format</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-full py-2.5 bg-surface-3 border border-border rounded-lg text-xs font-bold hover:bg-surface-4 transition-all flex items-center justify-center gap-2 mt-auto"
                  >
                    <Upload className="w-3.5 h-3.5" /> Select File
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                </div>
              </div>
            </div>

            <div className="bg-surface-2 border border-border rounded-xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-text-tertiary font-medium">Any changes will recalculate active sprint capacities.</p>
              </div>
              <button onClick={saveSettings} className="px-6 py-2.5 btn-premium-primary rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-accent-primary/20">
                <Save className="w-4 h-4" /> Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateForm && canManageCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
          <div className="relative modal-premium w-full max-w-md p-6 rounded-2xl shadow-2xl flex flex-col text-white animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-primary">Create Event</h3>
              <button onClick={() => setShowCreateForm(false)} aria-label="Close modal"><X className="w-4 h-4 text-text-tertiary hover:text-text-primary" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Name</label>
                <input value={newEvent.name} onChange={e => setNewEvent(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Company Retreat" className="w-full input-premium h-10 px-3 text-xs outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Date</label>
                <input type="date" value={newEvent.date} onChange={e => setNewEvent(prev => ({ ...prev, date: e.target.value }))} className="w-full input-premium h-10 px-3 text-xs outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Type</label>
                <select value={newEvent.event_type} onChange={(e: any) => setNewEvent(prev => ({ ...prev, event_type: e.target.value }))} className="w-full input-premium h-10 px-3 text-xs outline-none">
                  <option value="company">Company Holiday</option>
                  <option value="meeting">Meeting</option>
                  <option value="event">Event</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <button onClick={handleCreateEvent} disabled={!newEvent.name || !newEvent.date} className="w-full btn-premium-primary h-10 font-semibold uppercase text-xs tracking-wide disabled:opacity-50 text-white rounded-lg">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
