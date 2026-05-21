import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, FolderOpen, LayoutDashboard, Activity, GitBranch, GitFork, Users, Target, BarChart3, Clock, Shield, ShieldAlert, FileText, ChartArea, Settings as SettingsIcon, PlusCircle, UserPlus, BookOpen, CalendarPlus, RefreshCw, TrendingUp, Cpu, BrainCircuit, Zap, Check, Loader } from 'lucide-react';
import { Profile, Project, Task } from '../../types';
import { activityLogService } from '../../services/activityLogService';

interface CmdResult {
  id: string;
  group: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  metadata?: Record<string, string>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  profile: Profile | null;
  projects: Project[];
  tasks: Task[];
  setSelectedProject?: (p: Project | null) => void;
  notify: (msg: string, t: 'success' | 'error' | 'info' | 'warning') => void;
  setIsAdding?: (v: boolean) => void;
  workspaceId?: string;
}

const STORAGE_KEY = 'resolve-command-recent';
const USAGE_KEY = 'resolve-command-usage';
const MAX_RECENT = 10;

// --- Alias Engine ---
const ALIASES: Record<string, string> = {
  new: 'create', proj: 'project', gt: 'gantt', spr: 'sprint',
};

function expandAliases(query: string): string {
  return query.split(' ').map(w => ALIASES[w] || w).join(' ');
}

// --- Slash Filters ---
const SLASH_FILTERS: Record<string, string> = {
  '/nav': 'NAVIGATION', '/task': 'TASKS', '/project': 'PROJECTS', '/ai': 'AI', '/action': 'ACTIONS',
};

function parseSlashFilter(query: string): { groupFilter: string | null; cleanQuery: string } {
  const first = query.split(' ')[0].toLowerCase();
  if (first in SLASH_FILTERS) {
    return { groupFilter: SLASH_FILTERS[first], cleanQuery: query.slice(first.length).trim() };
  }
  return { groupFilter: null, cleanQuery: query };
}

// --- AI Command Execution (NLP) ---
const AI_COMMANDS: { match: RegExp; label: string; group: string; icon: React.ReactNode; action: (props: Props) => void }[] = [
  { match: /show.*timeline.*risk/i, label: 'Timeline Risks', group: 'AI', icon: <TrendingUp className="w-3.5 h-3.5" />, action: (p) => p.onNavigate('/execution/timeline') },
  { match: /overload.*(engineer|team|capacity)/i, label: 'Overloaded Engineers', group: 'AI', icon: <Cpu className="w-3.5 h-3.5" />, action: (p) => p.onNavigate('/resources/capacity') },
  { match: /forecast.*sprint/i, label: 'Forecast Sprint', group: 'AI', icon: <GitFork className="w-3.5 h-3.5" />, action: (p) => p.onNavigate('/execution/sprints') },
  { match: /explain.*delay/i, label: 'Explain Delays', group: 'AI', icon: <Activity className="w-3.5 h-3.5" />, action: (p) => p.onNavigate('/execution/timeline') },
  { match: /capacity.*forecast/i, label: 'Capacity Forecast', group: 'AI', icon: <BarChart3 className="w-3.5 h-3.5" />, action: (p) => p.onNavigate('/resources/capacity') },
  { match: /decision.*center/i, label: 'Decision Center', group: 'AI', icon: <Zap className="w-3.5 h-3.5" />, action: (p) => p.onNavigate('/workspace/decisions') },
];

// --- Usage Analytics ---
function incrementUsage(id: string) {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    const usage: Record<string, number> = raw ? JSON.parse(raw) : {};
    usage[id] = (usage[id] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch { /* ignore */ }
}

function getTopUsageIds(limit = 5): string[] {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return [];
    const usage: Record<string, number> = JSON.parse(raw);
    return Object.entries(usage).sort(([, a], [, b]) => b - a).slice(0, limit).map(([id]) => id);
  } catch { return []; }
}

const NAV_ITEMS: { label: string; path: string; icon: React.ReactNode; roles?: string[] }[] = [
  { label: 'Workspace', path: '/workspace', icon: <FolderOpen className="w-3.5 h-3.5" /> },
  { label: 'Execution Board', path: '/execution', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { label: 'Timeline Engine', path: '/execution/timeline', icon: <Activity className="w-3.5 h-3.5" /> },
  { label: 'Gantt Workspace', path: '/execution/gantt', icon: <GitBranch className="w-3.5 h-3.5" /> },
  { label: 'Sprint Center', path: '/execution/sprints', icon: <GitFork className="w-3.5 h-3.5" /> },
  { label: 'Teams', path: '/resources/teams', icon: <Users className="w-3.5 h-3.5" /> },
  { label: 'Logistics', path: '/resources', icon: <Target className="w-3.5 h-3.5" /> },
  { label: 'Capacity', path: '/resources/capacity', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { label: 'Work Logs', path: '/resources/work-logs', icon: <Clock className="w-3.5 h-3.5" /> },
  { label: 'Admin', path: '/control', icon: <Shield className="w-3.5 h-3.5" />, roles: ['super_admin'] },
  { label: 'Audit', path: '/control/audit', icon: <FileText className="w-3.5 h-3.5" />, roles: ['super_admin'] },
  { label: 'Analytics', path: '/control/analytics', icon: <ChartArea className="w-3.5 h-3.5" /> },
  { label: 'Settings', path: '/control/settings', icon: <SettingsIcon className="w-3.5 h-3.5" /> },
];

const ACTION_ITEMS: { label: string; icon: React.ReactNode; roles?: string[]; onSelect: (props: Props) => void }[] = [
  { label: 'Create Project', icon: <PlusCircle className="w-3.5 h-3.5" />, roles: ['super_admin', 'pm'], onSelect: (p) => p.setIsAdding?.(true) },
  { label: 'Create Sprint', icon: <GitFork className="w-3.5 h-3.5" />, roles: ['super_admin', 'pm'], onSelect: (p) => p.onNavigate('/execution/sprints') },
  { label: 'Invite Member', icon: <UserPlus className="w-3.5 h-3.5" />, roles: ['super_admin'], onSelect: (p) => p.onNavigate('/control') },
  { label: 'Create Epic', icon: <BookOpen className="w-3.5 h-3.5" />, roles: ['super_admin', 'pm'], onSelect: (p) => p.onNavigate('/execution') },
  { label: 'Create Story', icon: <BookOpen className="w-3.5 h-3.5" />, roles: ['super_admin', 'pm'], onSelect: (p) => p.onNavigate('/execution') },
  { label: 'Create Work Item', icon: <PlusCircle className="w-3.5 h-3.5" />, roles: ['super_admin', 'pm'], onSelect: (p) => p.onNavigate('/execution') },
  { label: 'Add Company Holiday', icon: <CalendarPlus className="w-3.5 h-3.5" />, roles: ['super_admin'], onSelect: (p) => p.onNavigate('/control/settings') },
  { label: 'Start Retrospective', icon: <RefreshCw className="w-3.5 h-3.5" />, roles: ['super_admin', 'pm'], onSelect: (p) => p.onNavigate('/execution/sprints') },
];

const AI_ITEMS: { label: string; icon: React.ReactNode; onSelect: (props: Props) => void }[] = [
  { label: 'Timeline Risks', icon: <TrendingUp className="w-3.5 h-3.5" />, onSelect: (p) => p.onNavigate('/execution/timeline') },
  { label: 'Capacity Forecast', icon: <Cpu className="w-3.5 h-3.5" />, onSelect: (p) => p.onNavigate('/resources/capacity') },
  { label: 'Prediction Insights', icon: <BrainCircuit className="w-3.5 h-3.5" />, onSelect: (p) => p.onNavigate('/workspace') },
  { label: 'Decision Center', icon: <Zap className="w-3.5 h-3.5" />, onSelect: (p) => p.onNavigate('/workspace/decisions') },
];

function scoreMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 40 : 0;
}

function filterItems(items: any[], query: string): any[] {
  if (!query.trim()) return items;
  return items.map(item => ({ item, score: scoreMatch(query, item.label || item.name || '') }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

function getRecent(): CmdResult[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function addRecent(result: CmdResult) {
  const recent = getRecent().filter(r => r.id !== result.id);
  recent.unshift(result);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function commandIcon(group: string): React.ReactNode {
  const map: Record<string, React.ReactNode> = {
    NAVIGATION: <FolderOpen className="w-3 h-3 text-blue-400" />,
    PROJECTS: <BarChart3 className="w-3 h-3 text-emerald-400" />,
    TASKS: <Check className="w-3 h-3 text-amber-400" />,
    ACTIONS: <Zap className="w-3 h-3 text-purple-400" />,
    AI: <BrainCircuit className="w-3 h-3 text-cyan-400" />,
    RECENT: <Clock className="w-3 h-3 text-white/40" />,
    SUGGESTED: <TrendingUp className="w-3 h-3 text-white/30" />,
  };
  return map[group] || null;
}

export default function CommandPalette(props: Props) {
  const { isOpen, onClose, onNavigate, profile, projects, tasks, setSelectedProject, notify, setIsAdding, workspaceId } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const role = profile?.role || 'viewer';

  const debounceRef = useRef<number | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const id = debounceRef.current;
    if (id !== null) window.clearTimeout(id);
    debounceRef.current = window.setTimeout(() => setDebouncedQuery(query), 150);
    return () => {
      const id2 = debounceRef.current;
      if (id2 !== null) window.clearTimeout(id2);
    };
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const allResults = useMemo((): CmdResult[] => {
    const rawQuery = debouncedQuery.trim();

    // --- Step 1: expand aliases ---
    const aliased = expandAliases(rawQuery);

    // --- Step 2: parse slash filter ---
    const { groupFilter, cleanQuery } = parseSlashFilter(aliased);
    const q = cleanQuery;
    const hasFilter = groupFilter !== null;

    // --- Step 3: match AI NLP commands ---
    const matchedAiNlp: CmdResult[] = [];
    if (q) {
      AI_COMMANDS.forEach(cmd => {
        if (cmd.match.test(rawQuery) && !hasFilter) {
          matchedAiNlp.push({
            id: `ainlp:${cmd.label}`, group: 'AI', label: cmd.label, icon: cmd.icon,
            onSelect: () => { addRecent({ id: `ainlp:${cmd.label}`, group: 'AI', label: cmd.label, icon: cmd.icon, onSelect: () => {} }); logCmd('ai_nlp', cmd.label); cmd.action(props); onClose(); },
          });
        }
      });
    }

    const out: CmdResult[] = [];

    // --- AI NLP (always first when matched) ---
    if (matchedAiNlp.length > 0) {
      out.push({ id: '_ainlp_header', group: 'AI', label: 'AI', onSelect: () => {} });
      matchedAiNlp.forEach(r => out.push(r));
    }

    // --- SUGGESTED — preload likely next when query empty and no filter ---
    if (!q && !hasFilter) {
      const recent = getRecent();
      const topIds = getTopUsageIds(5);

      // Reconstruct results from top-used IDs
      const suggested: CmdResult[] = [];
      const seen = new Set<string>();

      // first try top usage that isn't already recent
      topIds.forEach(id => {
        if (seen.has(id)) return;
        const r = recent.find(r => r.id === id);
        if (!r) return;
        if (recent.indexOf(r) < 3) return; // skip if already in recent top 3
        seen.add(id);
        suggested.push({ ...r, group: 'SUGGESTED' });
      });

      // Then add any items frequently used with current context
      if (suggested.length > 0) {
        out.push({ id: '_suggested_header', group: 'SUGGESTED', label: 'SUGGESTED', onSelect: () => {} });
        suggested.forEach(r => out.push(r));
      }
    }

    // --- RECENT — only when query empty ---
    if (!q && !hasFilter) {
      const recent = getRecent();
      if (recent.length > 0) {
        out.push({ id: '_recent_header', group: 'RECENT', label: 'RECENT', onSelect: () => {} });
        out.push(...recent.map(r => ({ ...r, group: 'RECENT' })));
      }
    }

    // --- NAVIGATION ---
    if (!hasFilter || groupFilter === 'NAVIGATION') {
      const visibleNav = NAV_ITEMS.filter(n => !n.roles || n.roles.includes(role));
      const matchedNav = q ? filterItems(visibleNav, q) : (hasFilter ? visibleNav : []);
      if (matchedNav.length > 0) {
        out.push({ id: '_nav_header', group: 'NAVIGATION', label: 'NAVIGATION', onSelect: () => {} });
        matchedNav.forEach(n => out.push({
          id: `nav:${n.path}`, group: 'NAVIGATION', label: n.label, icon: n.icon,
          onSelect: () => { addRecent({ id: `nav:${n.path}`, group: 'NAVIGATION', label: n.label, icon: n.icon, onSelect: () => {} }); logCmd('navigation', n.label); onNavigate(n.path); onClose(); },
        }));
      }
    }

    // --- PROJECTS ---
    if (!hasFilter || groupFilter === 'PROJECTS') {
      const matchedProjects = q ? filterItems(projects, q) : (hasFilter ? projects : []);
      if (matchedProjects.length > 0) {
        out.push({ id: '_proj_header', group: 'PROJECTS', label: 'PROJECTS', onSelect: () => {} });
        matchedProjects.forEach(p => out.push({
          id: `proj:${p.id}`, group: 'PROJECTS', label: p.name,
          description: `${p.execution_mode} · ${p.status}${p.efficiency ? ` · ${p.efficiency}%` : ''}`,
          icon: <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />,
          metadata: { project_id: p.id, status: p.status, execution_mode: p.execution_mode },
          onSelect: () => { addRecent({ id: `proj:${p.id}`, group: 'PROJECTS', label: p.name, icon: <BarChart3 className="w-3.5 h-3.5" />, onSelect: () => {} }); logCmd('project_open', p.name, { project_id: p.id }); setSelectedProject?.(p); onClose(); },
        }));
      }
    }

    // --- TASKS ---
    if (!hasFilter || groupFilter === 'TASKS') {
      const matchedTasks = q ? filterItems(tasks, q) : (hasFilter ? tasks : []);
      if (matchedTasks.length > 0) {
        out.push({ id: '_task_header', group: 'TASKS', label: 'TASKS', onSelect: () => {} });
        matchedTasks.forEach(t => out.push({
          id: `task:${t.id}`, group: 'TASKS', label: t.name,
          description: `${t.status} · ${t.priority}`,
          icon: <Check className="w-3.5 h-3.5 text-amber-400" />,
          metadata: { task_id: t.id, status: t.status, priority: t.priority },
          onSelect: () => { addRecent({ id: `task:${t.id}`, group: 'TASKS', label: t.name, icon: <Check className="w-3.5 h-3.5" />, onSelect: () => {} }); logCmd('task_open', t.name, { task_id: t.id }); onNavigate('/execution'); onClose(); },
        }));
      }
    }

    // --- ACTIONS ---
    if (!hasFilter || groupFilter === 'ACTIONS') {
      const visibleActions = ACTION_ITEMS.filter(a => !a.roles || a.roles.includes(role));
      const matchedActions = q ? filterItems(visibleActions, q) : (hasFilter ? visibleActions : []);
      if (matchedActions.length > 0) {
        out.push({ id: '_action_header', group: 'ACTIONS', label: 'ACTIONS', onSelect: () => {} });
        matchedActions.forEach(a => out.push({
          id: `action:${a.label}`, group: 'ACTIONS', label: a.label, icon: a.icon,
          onSelect: () => { addRecent({ id: `action:${a.label}`, group: 'ACTIONS', label: a.label, icon: a.icon, onSelect: () => {} }); logCmd('action', a.label); a.onSelect(props); onClose(); },
        }));
      }
    }

    // --- AI (static items, shown when filtered via /ai) ---
    if (!hasFilter || groupFilter === 'AI') {
      const matchedAI = q ? filterItems(AI_ITEMS, q) : (hasFilter ? AI_ITEMS : []);
      if (matchedAI.length > 0) {
        out.push({ id: '_ai_header', group: 'AI', label: 'AI', onSelect: () => {} });
        matchedAI.forEach(a => out.push({
          id: `ai:${a.label}`, group: 'AI', label: a.label, icon: a.icon,
          onSelect: () => { addRecent({ id: `ai:${a.label}`, group: 'AI', label: a.label, icon: a.icon, onSelect: () => {} }); logCmd('ai', a.label); a.onSelect(props); onClose(); },
        }));
      }
    }

    return out;
  }, [debouncedQuery, projects, tasks, role]);

  const flatResults = useMemo(() => allResults.filter(r => !r.id.startsWith('_')), [allResults]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = flatResults[selectedIndex];
      if (result) result.onSelect();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [flatResults, selectedIndex, onClose]);

  const logCmd = async (type: string, target: string, extra?: Record<string, string>) => {
    incrementUsage(`${type}:${target}`);
    if (!workspaceId) return;
    await activityLogService.appendLog({
      workspace_id: workspaceId,
      actor_id: profile?.id,
      action: 'command_used',
      metadata: { command_type: type, target, ...extra }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[200] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed inset-0 z-[201] flex items-start justify-center pt-[15vh] px-4 pointer-events-none"
          >
            <div
              className="w-full max-w-xl bg-[#0c0c0c] border border-white/15 shadow-2xl pointer-events-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <Search className="w-4 h-4 text-white/40 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search projects, tasks, navigation and actions..."
                  className="flex-1 bg-transparent text-sm font-mono text-white outline-none placeholder:text-white/25"
                />
                <kbd className="hidden sm:inline-flex text-[9px] font-mono uppercase text-white/30 border border-white/10 px-1.5 py-0.5">esc</kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2" onKeyDown={handleKeyDown}>
                {allResults.length === 0 && (
                  <div className="px-4 py-8 text-center text-[11px] font-mono text-white/30 uppercase">
                    {debouncedQuery ? 'No results found' : 'Type to search...'}
                  </div>
                )}

                {allResults.map((result, idx) => {
                  const flatIdx = flatResults.indexOf(result);
                  const isHeader = result.id.startsWith('_');
                  const isSelected = flatIdx === selectedIndex && !isHeader;

                  return (
                    <div
                      key={result.id}
                      onClick={() => { if (!isHeader) result.onSelect(); }}
                      onMouseEnter={() => { if (!isHeader && flatIdx >= 0) setSelectedIndex(flatIdx); }}
                      className={`flex items-center gap-3 px-4 py-2 text-xs font-mono cursor-pointer transition-colors ${
                        isHeader
                          ? 'text-[9px] uppercase tracking-widest text-white/30 pt-4 pb-1.5 px-4 cursor-default'
                          : isSelected
                            ? 'bg-white/10 text-white'
                            : 'text-white/70 hover:bg-white/5'
                      }`}
                    >
                      {isHeader && (
                        <span className="flex items-center gap-2">
                          {commandIcon(result.group)}
                          {result.label}
                        </span>
                      )}
                      {!isHeader && (
                        <>
                          <span className="shrink-0">{result.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{result.label}</div>
                            {result.description && (
                              <div className="text-[10px] text-white/40 truncate">{result.description}</div>
                            )}
                          </div>
                          {result.metadata?.status && (
                            <span className={`text-[9px] uppercase px-1.5 py-0.5 border ${
                              result.metadata.status === 'active' ? 'border-emerald-500/30 text-emerald-400' :
                              result.metadata.status === 'deployed' ? 'border-blue-500/30 text-blue-400' :
                              'border-white/10 text-white/40'
                            }`}>
                              {result.metadata.status}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
