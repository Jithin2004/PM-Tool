import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Check, Search, Loader2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { searchWorkspaceUsers } from '../../services/operationalDataService';
import { useOperationalData } from '../../context/OperationalDataContext';
import { formatUserName, isUserArchived } from '../../utils/userFormatting';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  employment_status?: string;
}

interface AssigneePickerProps {
  users?: UserProfile[]; // kept for compatibility, but we fetch directly now
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
  contextText?: string;
}

export function AssigneePicker({ users = [], value, onChange, disabled, contextText = '' }: AssigneePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const { raw: { skills = [], userSkills = [], tasks = [] } } = useOperationalData();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // The currently selected user, either from props or search results
  const selectedUser = users.find(u => u.id === value) || searchResults.find(u => u.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch users when dropdown opens or query changes
  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchWorkspaceUsers(workspaceId, searchQuery, 20);
        // Map the RPC result to UserProfile format
        const formatted = results.map((r: any) => ({
          id: r.id,
          email: r.email || '',
          full_name: r.name,
          avatar_url: r.avatar,
          role: r.role
        }));
        setSearchResults(formatted);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isOpen, workspaceId]);

  // Skill matching
  const relevantSkills = skills.filter(s => 
    contextText.toLowerCase().includes(s.name.toLowerCase())
  );
  
  const userSkillMatchMap = new Map<string, string[]>(); 
  
  if (relevantSkills.length > 0) {
    searchResults.forEach(user => {
      const userSkillRows = userSkills.filter(us => us.user_id === user.id);
      const matches = userSkillRows
        .filter(us => relevantSkills.some(rs => rs.id === us.skill_id))
        .map(us => skills.find(s => s.id === us.skill_id)?.name || '');
      if (matches.length > 0) {
        userSkillMatchMap.set(user.id, matches);
      }
    });
  }

  // Sort users
  const sortedUsers = [...searchResults]
    .filter(u => !isUserArchived(u as any) || u.id === value)
    .sort((a, b) => {
      const aMatch = userSkillMatchMap.has(a.id) ? 1 : 0;
      const bMatch = userSkillMatchMap.has(b.id) ? 1 : 0;
      return bMatch - aMatch;
    });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!isOpen) setSearchQuery('');
          setIsOpen(!isOpen);
        }}
        className={`w-full bg-surface-2 border border-border/50 p-2.5 flex items-center justify-between text-sm font-medium text-text-primary outline-none transition-all rounded-lg shadow-inner ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-3 cursor-pointer focus:border-accent-primary/70'}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedUser ? (
            <>
              {selectedUser.avatar_url ? (
                <img src={selectedUser.avatar_url} alt="" className="w-5 h-5 rounded-full border border-border shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-surface-3 border border-border flex items-center justify-center shrink-0">
                  <User className="w-3 h-3 text-text-tertiary" />
                </div>
              )}
              <span className="truncate">
                {selectedUser.full_name || selectedUser.email}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-2 text-text-quaternary">
              <div className="w-5 h-5 border border-dashed border-border rounded-full flex items-center justify-center">
                <User className="w-3 h-3" />
              </div>
              Unassigned
            </div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-surface-3 border border-border/50 rounded-lg shadow-xl max-h-[300px] flex flex-col animate-in fade-in slide-in-from-top-2">
          
          <div className="p-2 border-b border-border/50 sticky top-0 bg-surface-3 z-10">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-quaternary" />
              <input
                type="text"
                autoFocus
                placeholder="Search team..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-surface-4 border border-border/50 rounded-md pl-9 pr-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-accent-primary animate-spin" />
              )}
            </div>
          </div>

          <div className="overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setIsOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface-4 ${!value ? 'bg-surface-4' : ''}`}
            >
              <div className="flex items-center gap-2 text-text-secondary">
                <div className="w-5 h-5 border border-dashed border-border rounded-full flex items-center justify-center shrink-0">
                  <User className="w-3 h-3 text-text-quaternary" />
                </div>
                Unassigned
              </div>
              {!value && <Check className="w-4 h-4 text-accent-primary" />}
            </button>

            {sortedUsers.map(user => {
              const isSelected = value === user.id;
              const matches = userSkillMatchMap.get(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => { onChange(user.id); setIsOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface-4 ${isSelected ? 'bg-surface-4' : ''}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full border border-border shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-surface-2 border border-border flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-text-tertiary" />
                      </div>
                    )}
                    <div className="flex flex-col items-start truncate">
                      <span className={`truncate ${isSelected ? 'text-accent-primary font-semibold' : 'text-text-primary'}`}>
                        {user.full_name || user.email}
                      </span>
                      {matches && matches.length > 0 ? (
                        <span className="text-[10px] text-emerald-400 truncate bg-emerald-400/10 px-1 rounded">
                          Skilled in: {matches.join(', ')}
                        </span>
                      ) : (
                        user.role && (
                          <span className="text-[10px] text-text-quaternary truncate">{user.role}</span>
                        )
                      )}
                      {(() => {
                        const userTasks = tasks.filter(t => t.assignee_id === user.id && t.status !== 'completed' && t.status !== 'cancelled');
                        const loadHours = userTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
                        const utilization = Math.round((loadHours / 40) * 100);
                        if (utilization > 100) {
                          return (
                            <span className="text-[10px] text-rose-400 truncate bg-rose-400/10 px-1 rounded mt-0.5">
                              Warning: Dev is at {utilization}% capacity
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-accent-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
