import React, { useState, useEffect, useRef } from 'react';
import { Search, FolderOpen, Check, FileText, Users, Activity, Zap, X, ChevronRight, BrainCircuit } from 'lucide-react';
import { universalSearchService, UniversalSearchResult } from '../../services/universalSearchService';
import { EmptyState } from '../core';
import { CANONICAL_ROUTES, renderRouteIcon } from '../../app/routeRegistry';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const ACTION_ITEMS = [
  { label: 'Create Project', path: '/projects?create=true', icon: <FolderOpen className="w-4 h-4 text-indigo-400" /> },
  { label: 'Create Task', path: '/tasks?create=true', icon: <Check className="w-4 h-4 text-emerald-400" /> },
  { label: 'Create Milestone', path: '/projects?create_milestone=true', icon: <Activity className="w-4 h-4 text-amber-400" /> },
  { label: 'Open Decision Center', path: '/workspace/decisions', icon: <BrainCircuit className="w-4 h-4 text-cyan-400" /> },
  { label: 'Open Executive Dashboard', path: '/overview', icon: <Zap className="w-4 h-4 text-violet-400" /> }
];

export default function CommandPalette({ isOpen, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [dbResults, setDbResults] = useState<UniversalSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Focus trap and shortcut handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        // The parent usually toggles isOpen, but we catch it just in case
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDbResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced Universal Search
  useEffect(() => {
    const rawQuery = query.trim();
    if (!rawQuery) {
      setDbResults([]);
      setIsSearching(false);
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      setIsSearching(true);
      const results = await universalSearchService.searchWorkspace(rawQuery, 20);
      setDbResults(results);
      setIsSearching(false);
      setSelectedIndex(0);
    }, 200);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Compile viewable items for keyboard navigation
  const visibleItems = query.trim()
    ? dbResults.map(r => ({ ...r, isAction: false }))
    : ACTION_ITEMS.map(a => ({ ...a, isAction: true }));

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || visibleItems.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % visibleItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + visibleItems.length) % visibleItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = visibleItems[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, visibleItems, selectedIndex]);

  const handleSelect = (item: any) => {
    if (item.isAction) {
      onNavigate(item.path);
    } else {
      onNavigate(item.url);
    }
    onClose();
  };

  if (!isOpen) return null;

  const renderIcon = (type: string) => {
    switch (type) {
      case 'project': return <FolderOpen className="w-4 h-4 text-indigo-400" />;
      case 'task': return <Check className="w-4 h-4 text-emerald-400" />;
      case 'document': 
      case 'file': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'user': return <Users className="w-4 h-4 text-purple-400" />;
      case 'comment': return <Activity className="w-4 h-4 text-orange-400" />;
      case 'decision': return <BrainCircuit className="w-4 h-4 text-cyan-400" />;
      default: return <Zap className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-start justify-center pt-[15vh] px-4 font-geist animate-fade-in">
      <div onClick={e => e.stopPropagation()} className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] border border-[var(--border-soft)] w-full max-w-2xl rounded-2xl shadow-premium overflow-hidden flex flex-col transition-all animate-scale-up">
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-soft)] bg-[var(--surface-glass)]">
          <Search className="w-5 h-5 text-[var(--text-secondary)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Find anything (projects, tasks, decisions, people, etc)..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm font-medium placeholder-[var(--text-tertiary)]"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--text-secondary)] border border-[var(--border-soft)] rounded px-1.5 py-0.5">Ctrl K</span>
            <button onClick={onClose} className="p-1 hover:bg-[var(--surface-hover)] rounded-md transition-colors text-[var(--text-secondary)] hover:text-white" aria-label="Close search">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results Body */}
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
          ) : !query.trim() ? (
            // Empty / Initial State
            <div className="p-1">
              <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest px-3 mb-2 font-mono">Quick Actions</div>
              <div className="space-y-1.5 mb-6">
                {ACTION_ITEMS.map((action, i) => {
                  const isSelected = selectedIndex === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSelect({...action, isAction: true})}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left group transition-all ${
                        isSelected
                          ? 'bg-[var(--surface-glass)] border border-[var(--border-soft)] translate-x-1 shadow-md shadow-indigo-500/5'
                          : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg border transition-all ${
                          isSelected ? 'bg-indigo-500/15 border-indigo-500/35 shadow-[0_0_12px_rgba(99,102,241,0.2)]' : 'bg-[var(--surface-glass)] border-[var(--border-soft)]'
                        }`}>
                          {action.icon}
                        </div>
                        <span className={`text-sm font-medium transition-colors ${
                          isSelected ? 'text-white' : 'text-[var(--text-secondary)] group-hover:text-white'
                        }`}>{action.label}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-opacity ${isSelected ? 'text-[var(--text-secondary)] opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                    </button>
                  );
                })}
              </div>

              {/* Memory Smart Empty State */}
              <div className="mx-3 mt-4 mb-2 p-5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-glass)] flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center mb-3">
                  <BrainCircuit className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">Universal Search</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-[250px]">
                  Resolve will remember your projects, decisions, and documents as your workspace grows.
                </p>
              </div>
            </div>
          ) : dbResults.length > 0 ? (
            // Search Results
            <div className="p-1">
              <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest px-3 mb-2 font-mono">Search Results</div>
              <div className="space-y-1">
                {dbResults.map((result, i) => {
                  const isSelected = selectedIndex === i;
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect({...result, isAction: false})}
                      className={`w-full flex items-start p-3 rounded-xl text-left group transition-all ${
                        isSelected
                          ? 'bg-[var(--surface-glass)] border border-[var(--border-soft)] shadow-md shadow-indigo-500/5'
                          : 'border border-transparent'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg border mt-0.5 transition-all ${
                        isSelected ? 'bg-indigo-500/15 border-indigo-500/35' : 'bg-[var(--surface-glass)] border-[var(--border-soft)]'
                      }`}>
                        {renderIcon(result.type)}
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold truncate transition-colors ${
                            isSelected ? 'text-white' : 'text-[var(--text-primary)]'
                          }`}>
                            {result.title}
                          </span>
                          <span className={`text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded border ${
                            isSelected ? 'bg-[var(--surface-hover)] border-[var(--border-soft)] text-white' : 'border-transparent text-[var(--text-tertiary)]'
                          }`}>
                            {result.type}
                          </span>
                        </div>
                        {result.matchedContext && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                            {result.matchedContext}
                          </p>
                        )}
                        {result.lastUpdated && (
                          <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">
                            Updated: {new Date(result.lastUpdated).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // No Results
             <EmptyState
              icon={Search}
              title="No results found"
              description={`We couldn't find any projects, tasks, or decisions matching "${query}".`}
              accentColor="#818cf8"
            />
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
        </div>

      </div>
    </div>
  );
}
