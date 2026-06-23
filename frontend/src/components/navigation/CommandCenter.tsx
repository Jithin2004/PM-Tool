import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, FileText, Clock, AlertCircle, Play, CheckCircle2, ChevronRight, User } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { universalSearchEngine, SearchResult } from '../../core/engines/universalSearchEngine';
import { searchIndexService } from '../../services/searchIndexService';
import { commandEngine } from '../../core/engines/commandEngine';

export function CommandCenter({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && workspace && profile) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      searchIndexService.getRecentEntities(workspace.id, profile.id).then(setRecent);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, workspace, profile]);

  useEffect(() => {
    if (!isOpen || !workspace || !profile) return;
    
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const delay = setTimeout(async () => {
      try {
        const res = await universalSearchEngine.executeSearch(workspace.id, profile.role, query);
        setResults(res);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [query, isOpen, workspace, profile]);

  const handleExecute = async (entityType: string, entityId: string, action = 'open') => {
    if (!workspace || !profile) return;
    
    setIsOpen(false);
    
    await commandEngine.executeCommand(workspace.id, profile.id, profile.role, action, entityType, entityId);

    if (action === 'open') {
      // Basic routing logic
      if (entityType === 'task') onNavigate(`/tasks`); // Or open task modal
      if (entityType === 'project') onNavigate(`/projects/${entityId}`);
      if (entityType === 'document') onNavigate(`/workspace/documents`);
      if (entityType === 'user') onNavigate(`/resources/teams`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const displayList = query.length >= 2 ? results : recent;
    if (displayList.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % displayList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + displayList.length) % displayList.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = displayList[selectedIndex];
      if (item) {
        handleExecute(item.entity_type, item.entity_id || item.id, 'open');
      }
    }
  };

  const renderIcon = (type: string) => {
    switch(type) {
      case 'task': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'document': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'user': return <User className="w-4 h-4 text-purple-400" />;
      case 'project': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default: return <ChevronRight className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex justify-center items-start pt-[10vh] bg-bg/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-2xl bg-surface-1 border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-text-quaternary mr-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search anything or type a command... (Try type:task or @user)"
                className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-quaternary font-mono"
                spellCheck={false}
              />
              {loading && <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />}
              <div className="ml-3 px-1.5 py-0.5 rounded text-[10px] font-mono border border-border-subtle text-text-quaternary">
                ESC
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {query.length < 2 ? (
                <div className="p-2">
                  <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-text-tertiary flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Recently Opened
                  </div>
                  {recent.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-text-quaternary font-mono">
                      No recent items.
                    </div>
                  )}
                  {recent.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => handleExecute(item.entity_type, item.entity_id, 'open')}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-md transition-colors ${selectedIndex === idx ? 'bg-surface-2' : 'hover:bg-surface-2/50'}`}
                    >
                      {renderIcon(item.entity_type)}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-text-primary font-medium capitalize">{item.entity_type} {item.entity_id.split('-')[0]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2">
                  <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                    Search Results
                  </div>
                  {results.length === 0 && !loading && (
                    <div className="px-3 py-6 text-center text-xs text-text-quaternary font-mono">
                      No results found for "{query}".
                    </div>
                  )}
                  {results.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => handleExecute(item.entity_type, item.entity_id, 'open')}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`group flex items-center justify-between px-3 py-2 cursor-pointer rounded-md transition-colors ${selectedIndex === idx ? 'bg-surface-2 border-l-2 border-accent-primary' : 'border-l-2 border-transparent hover:bg-surface-2/50'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderIcon(item.entity_type)}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-text-primary font-medium truncate">{item.title}</span>
                          {item.metadata?.uid && (
                            <span className="text-[10px] font-mono text-text-quaternary">{item.metadata.uid}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Quick Actions Panel (visible on hover/select) */}
                      {selectedIndex === idx && (
                        <div className="flex items-center gap-1">
                          {item.entity_type === 'task' && (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleExecute(item.entity_type, item.entity_id, 'start_timer'); }}
                                className="p-1 rounded hover:bg-bg text-text-quaternary hover:text-emerald-400 transition-colors"
                                title="Start Timer"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <div className="px-2 py-0.5 rounded text-[9px] font-mono bg-bg text-text-secondary ml-2">
                            Open ↵
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-4 py-2 border-t border-border bg-bg/50 flex justify-between items-center text-[9px] font-mono text-text-quaternary">
              <div className="flex gap-4">
                <span><kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border">↓</kbd> Navigate</span>
                <span><kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border">↵</kbd> Open</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                Index Sync Active
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

