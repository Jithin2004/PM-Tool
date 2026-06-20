import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';

interface MentionTextareaProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MentionTextarea({ value, onChange, onSubmit, placeholder = 'Type a message...', className = '', disabled }: MentionTextareaProps) {
  const { workspace } = useWorkspace();
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [mentionQuery, setMentionQuery] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!workspace?.id) return;
    supabase.from('users').select('id, full_name, email').eq('workspace_id', workspace.id).then(({ data }) => {
      if (data) setMembers(data);
    });
  }, [workspace?.id]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(s => Math.min(s + 1, filteredMembers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(s => Math.max(s - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPosition);
    
    // Check if we are typing a mention
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = members.filter(m => 
        (m.full_name || '').toLowerCase().includes(query) || 
        (m.email || '').toLowerCase().includes(query)
      ).slice(0, 5);

      if (filtered.length > 0) {
        setMentionQuery(mentionMatch[1]);
        setFilteredMembers(filtered);
        setSelectedIndex(0);
        setShowDropdown(true);
        // Approximate dropdown position (or just show it below the textarea for simplicity)
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
    }
  };

  const insertMention = (member: any) => {
    if (!textareaRef.current) return;
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    
    const mentionStart = textBeforeCursor.lastIndexOf('@' + mentionQuery);
    if (mentionStart !== -1) {
      const displayName = (member.full_name || member.email.split('@')[0]).replace(/\s+/g, '');
      const newText = value.substring(0, mentionStart) + `@${displayName} ` + textAfterCursor;
      onChange(newText);
      setShowDropdown(false);
      
      // Try to reset focus and cursor (requires slight delay to let render happen)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = mentionStart + displayName.length + 2;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-surface-2 border border-border rounded-lg p-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none min-h-[80px]"
        style={{ scrollbarWidth: 'thin' }}
      />
      {showDropdown && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-surface-elevated border border-border rounded-lg shadow-xl overflow-hidden z-50">
          {filteredMembers.map((m, idx) => (
            <div
              key={m.id}
              onClick={() => insertMention(m)}
              className={`px-3 py-2 text-sm cursor-pointer flex flex-col ${idx === selectedIndex ? 'bg-indigo-500/10 text-indigo-400' : 'text-text-secondary hover:bg-surface-hover'}`}
            >
              <span className="font-semibold">{m.full_name || 'Unknown User'}</span>
              <span className="text-xs opacity-70">{m.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
