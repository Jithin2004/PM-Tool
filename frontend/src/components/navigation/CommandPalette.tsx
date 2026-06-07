import React, { useState, useEffect, useRef, useContext } from 'react';
import { Search, Folder, CheckSquare, Flag, FileText, User, X, ChevronRight, Zap } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { OperationalDataContext } from '../../context/OperationalDataContext';
import { PremiumEmptyState } from '../common/PremiumEmptyState';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { workspace } = useWorkspace() || { workspace: null };
  const operationalData = useContext(OperationalDataContext);
  const projects = operationalData?.raw?.projects || [];
  const tasks = operationalData?.raw?.tasks || [];
  const profiles = operationalData?.raw?.profiles || [];
  const skills = operationalData?.raw?.skills || [];
  const userSkills = operationalData?.raw?.userSkills || [];
  const inputRef = useRef<HTMLInputElement>(null);

  const quickActions = [
    { type: 'action', label: 'Create Project', icon: <Folder className="w-4 h-4 text-indigo-400" />, action: () => { window.location.href = '/projects?create=true'; } },
    { type: 'action', label: 'Create Task', icon: <CheckSquare className="w-4 h-4 text-emerald-400" />, action: () => { window.location.href = '/tasks?create=true'; } },
    { type: 'action', label: 'Create Milestone', icon: <Flag className="w-4 h-4 text-amber-400" />, action: () => { window.location.href = '/projects?create_milestone=true'; } },
    { type: 'action', label: 'Generate Report', icon: <FileText className="w-4 h-4 text-rose-400" />, action: () => { window.location.href = '/reports'; } },
    { type: 'action', label: 'Open Executive Dashboard', icon: <Zap className="w-4 h-4 text-violet-400" />, action: () => { window.location.href = '/overview'; } }
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keyboard focus trap inside CommandPalette dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const closeBtn = document.querySelector('[aria-label="Close search"]') as HTMLElement;
        const focusable = [inputRef.current, closeBtn].filter(Boolean) as HTMLElement[];
        if (focusable.length < 2) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle search simulation
  useEffect(() => {
    if (query) {
      setIsSearching(true);
      const timer = setTimeout(() => setIsSearching(false), 200);
      return () => clearTimeout(timer);
    } else {
      setIsSearching(false);
    }
  }, [query]);

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
  };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  const filteredTasks = tasks.filter(t => t.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3);
  
  // Skill Search
  const matchingSkills = skills.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  let skilledProfiles: any[] = [];
  if (matchingSkills.length > 0 && query.trim().length > 0) {
    const matchedUserIds = userSkills
      .filter(us => matchingSkills.some(s => s.id === us.skill_id))
      .map(us => us.user_id);
    const uniqueUserIds = Array.from(new Set(matchedUserIds));
    skilledProfiles = profiles.filter(p => uniqueUserIds.includes(p.id)).slice(0, 5);
  }

  // Compile active flat list items for unified keyboard index navigation
  const items = query
    ? [
        ...filteredProjects.map(p => ({ type: 'project', label: p.name, id: p.id, icon: <Folder className="w-4 h-4 text-indigo-400" /> })),
        ...filteredTasks.map(t => ({ type: 'task', label: t.name, id: t.id, icon: <CheckSquare className="w-4 h-4 text-emerald-400" /> })),
        ...skilledProfiles.map(p => ({ type: 'profile', label: p.full_name || p.email, id: p.id, icon: <User className="w-4 h-4 text-cyan-400" /> }))
      ]
    : quickActions;

  // Reset keyboard index on query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, items.length]);

  // Keyboard navigation listener
  useEffect(() => {
    if (!isOpen || items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          handleSelect(items[selectedIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex]);

  const handleSelect = (item: any) => {
    if (item.action) {
      item.action();
    } else if (item.type === 'project') {
      window.location.href = `/projects?id=${item.id}`;
    } else if (item.type === 'task') {
      window.location.href = `/tasks?id=${item.id}`;
    } else if (item.type === 'profile') {
      window.location.href = `/hr?user=${item.id}`;
    }
    handleClose();
  };

  if (!isOpen) return null;

  // Help calculate item counter dynamically during layout render
  let itemRenderCounter = 0;

  return (
    <div onClick={handleClose} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-start justify-center pt-[15vh] px-4 font-geist animate-fade-in">
      <div onClick={e => e.stopPropagation()} className="premium-panel border border-[var(--border-soft)] w-full max-w-2xl rounded-2xl shadow-premium overflow-hidden flex flex-col transition-all animate-scale-up">
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--surface-glass)]">
          <Search className="w-5 h-5 text-[var(--text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks, skills, or run a action..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm font-medium placeholder-white/30"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--text-secondary)] border border-[var(--border-soft)] rounded px-1.5 py-0.5">Ctrl K</span>
            <button onClick={handleClose} className="p-1 hover:bg-[var(--surface-hover)] rounded-md transition-colors text-[var(--text-secondary)] hover:text-white" aria-label="Close search">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-3 scrollbar-thin">
          {isSearching ? (
            <div className="p-4 space-y-4">
              <div className="h-3 bg-[var(--surface-glass)] animate-pulse rounded-md w-1/4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-glass)] animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-[var(--surface-glass)] animate-pulse rounded w-2/3"></div>
                      <div className="h-3 bg-[var(--surface-glass)] animate-pulse rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !query ? (
            <div className="p-1">
              <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest px-3 mb-2 font-mono">Quick Actions</div>
              <div className="space-y-1.5">
                {quickActions.map((action, i) => {
                  const currentIndex = itemRenderCounter++;
                  const isSelected = selectedIndex === currentIndex;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect(action)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left group transition-all ${
                        isSelected
                          ? 'bg-[var(--surface-glass)] border border-[var(--border-soft)] translate-x-1 shadow-md shadow-purple-500/5'
                          : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-purple-500/15 border-purple-500/35 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                            : 'bg-[var(--surface-glass)] border-[var(--border-soft)]'
                        }`}>
                          {action.icon}
                        </div>
                        <span className={`text-sm font-medium transition-colors ${
                          isSelected ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'
                        }`}>{action.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-widest px-1.5 py-0.5 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded">
                            Enter
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {filteredProjects.length > 0 && (
                <div className="p-1">
                  <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest px-3 mb-2 font-mono">Projects</div>
                  <div className="space-y-1">
                    {filteredProjects.map(p => {
                      const currentIndex = itemRenderCounter++;
                      const isSelected = selectedIndex === currentIndex;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelect({ type: 'project', id: p.id })}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left group transition-all ${
                            isSelected
                              ? 'bg-[var(--surface-glass)] border border-[var(--border-soft)] translate-x-1 shadow-md shadow-purple-500/5'
                              : 'border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-purple-500/15 border-purple-500/35 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                                : 'bg-[var(--surface-glass)] border-[var(--border-soft)]'
                            }`}>
                              <Folder className="w-4 h-4 text-indigo-400" />
                            </div>
                            <span className={`text-sm font-medium transition-colors ${
                              isSelected ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'
                            }`}>{p.name}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-widest px-1.5 py-0.5 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded">
                              Enter
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {filteredTasks.length > 0 && (
                <div className="p-1 mt-3">
                  <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest px-3 mb-2 font-mono">Tasks</div>
                  <div className="space-y-1">
                    {filteredTasks.map(t => {
                      const currentIndex = itemRenderCounter++;
                      const isSelected = selectedIndex === currentIndex;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelect({ type: 'task', id: t.id })}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left group transition-all ${
                            isSelected
                              ? 'bg-[var(--surface-glass)] border border-[var(--border-soft)] translate-x-1 shadow-md shadow-purple-500/5'
                              : 'border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-purple-500/15 border-purple-500/35 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                                : 'bg-[var(--surface-glass)] border-[var(--border-soft)]'
                            }`}>
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className={`text-sm font-medium transition-colors ${
                              isSelected ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'
                            }`}>{t.name}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-widest px-1.5 py-0.5 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded">
                              Enter
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {skilledProfiles.length > 0 && (
                <div className="p-1 mt-3">
                  <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest px-3 mb-2 font-mono">People by Skill</div>
                  <div className="space-y-1">
                    {skilledProfiles.map(p => {
                      const currentIndex = itemRenderCounter++;
                      const isSelected = selectedIndex === currentIndex;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelect({ type: 'profile', id: p.id })}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left group transition-all ${
                            isSelected
                              ? 'bg-[var(--surface-glass)] border border-[var(--border-soft)] translate-x-1 shadow-md shadow-purple-500/5'
                              : 'border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg border transition-all ${
                              isSelected
                                ? 'bg-purple-500/15 border-purple-500/35 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                                : 'bg-[var(--surface-glass)] border-[var(--border-soft)]'
                            }`}>
                              <User className="w-4 h-4 text-cyan-400" />
                            </div>
                            <span className={`text-sm font-medium transition-colors ${
                              isSelected ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'
                            }`}>{p.full_name || p.email}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-widest px-1.5 py-0.5 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded">
                              Enter
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {filteredProjects.length === 0 && filteredTasks.length === 0 && skilledProfiles.length === 0 && (
                <PremiumEmptyState
                  icon={Search}
                  title="No results found"
                  description={`No accessible results found for "${query}". Try another search term.`}
                  accentColor="#a78bfa"
                />
              )}
            </>
          )}
        </div>
        
        {/* Footer shortcuts */}
        <div className="border-t border-[var(--border-soft)] bg-[var(--surface-glass)] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">Navigate</span>
              <kbd className="px-1.5 py-0.5 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded text-[9px] font-mono text-[var(--text-secondary)]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded text-[9px] font-mono text-[var(--text-secondary)]">↓</kbd>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">Open</span>
              <kbd className="px-1.5 py-0.5 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded text-[9px] font-mono text-[var(--text-secondary)]">↵</kbd>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-secondary)] font-medium">Close</span>
            <kbd className="px-1.5 py-0.5 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded text-[9px] font-mono text-[var(--text-secondary)]">ESC</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
