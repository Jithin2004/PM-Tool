import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { searchWorkspaceUsers } from '../../services/operationalDataService';
import { useWorkspace } from '../../context/WorkspaceContext';

interface UserSearchSelectProps {
  value: string;
  onChange: (userId: string) => void;
  excludeUserId?: string;
}

export function UserSearchSelect({ value, onChange, excludeUserId }: UserSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id;

  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchWorkspaceUsers(workspaceId, searchQuery, 20);
        setResults(data.filter((u: any) => u.id !== excludeUserId));
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, workspaceId, excludeUserId]);

  // Load selected user detail if value exists but not in results
  useEffect(() => {
    if (value && !selectedUser && workspaceId) {
      // In a real app we'd fetch the specific user, but for now we just show ID or let the parent pass the name
      // This is a minimal implementation for scale
    }
  }, [value, workspaceId]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-black/40 border border-[var(--border-soft)] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 flex justify-between items-center"
      >
        <span>{selectedUser ? (selectedUser.name || selectedUser.email) : (value ? 'User Selected' : '-- Search Teammate --')}</span>
      </button>

      {isOpen && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-[#1f2937] border border-[var(--border-soft)] rounded-lg shadow-xl max-h-[250px] flex flex-col">
          <div className="p-2 border-b border-[var(--border-soft)]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                autoFocus
                placeholder="Search name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-[var(--border-soft)] rounded p-1.5 pl-8 text-sm text-white focus:outline-none"
              />
              {isSearching && <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />}
            </div>
          </div>
          <div className="overflow-y-auto p-1">
            {results.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setSelectedUser(user);
                  onChange(user.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 rounded flex items-center gap-2"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] uppercase">
                    {(user.name || '?')[0]}
                  </div>
                )}
                <div className="truncate">
                  {user.name || user.email} <span className="text-[10px] text-[var(--text-secondary)] opacity-70 ml-1">({user.role})</span>
                </div>
              </button>
            ))}
            {results.length === 0 && !isSearching && (
              <div className="px-3 py-4 text-xs text-center text-[var(--text-secondary)]">No active users found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
