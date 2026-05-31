import React, { useState, KeyboardEvent, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface EmailChip {
  email: string;
  role: 'Developer' | 'PM' | 'Viewer';
}

interface EmailChipsInputProps {
  value: EmailChip[];
  onChange: (value: EmailChip[]) => void;
  placeholder?: string;
}

export function EmailChipsInput({ value, onChange, placeholder }: EmailChipsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addChip = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    if (!isValidEmail(cleanEmail)) {
      setError(`Invalid email: ${cleanEmail}`);
      return;
    }

    if (value.some(chip => chip.email.toLowerCase() === cleanEmail)) {
      setError(`Duplicate: ${cleanEmail}`);
      return;
    }

    const newChips = [...value, { email: cleanEmail, role: 'Developer' as const }];
    onChange(newChips);
    setInputValue('');
    setError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeChip(value[value.length - 1].email);
    }
  };

  const handleBlur = () => {
    if (inputValue) {
      addChip(inputValue);
    }
  };

  const removeChip = (emailToRemove: string) => {
    const newChips = value.filter(chip => chip.email !== emailToRemove);
    onChange(newChips);
    setError(null);
  };

  const updateRole = (emailToUpdate: string, newRole: EmailChip['role']) => {
    const newChips = value.map(chip => 
      chip.email === emailToUpdate ? { ...chip, role: newRole } : chip
    );
    onChange(newChips);
  };

  return (
    <div className="w-full">
      <div 
        className={`flex flex-wrap items-center gap-2 p-2 min-h-[48px] rounded-lg bg-surface-4 border transition-colors cursor-text ${error ? 'border-red-500/50' : 'border-border/50 focus-within:border-[var(--pm-primary)] focus-within:ring-1 focus-within:ring-[var(--pm-primary)]/30'}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((chip) => (
          <div key={chip.email} className="flex items-center gap-1 bg-surface-2 border border-border/60 rounded-full pl-3 pr-1 py-1 text-sm shadow-sm group">
            <span className="text-[var(--pm-on-surface)] truncate max-w-[150px] sm:max-w-[200px]" title={chip.email}>
              {chip.email}
            </span>
            <select
              value={chip.role}
              onChange={(e) => updateRole(chip.email, e.target.value as EmailChip['role'])}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] uppercase font-semibold text-[var(--pm-primary)] bg-[var(--pm-primary)]/10 hover:bg-[var(--pm-primary)]/20 px-1.5 py-0.5 rounded-full ml-1 border-none outline-none cursor-pointer appearance-none text-center min-w-[70px] transition-colors focus:ring-1 focus:ring-[var(--pm-primary)]"
              aria-label={`Select role for ${chip.email}`}
            >
              <option value="Developer" className="bg-surface-3 text-[var(--pm-text)] dark:text-white">Developer</option>
              <option value="PM" className="bg-surface-3 text-[var(--pm-text)] dark:text-white">PM</option>
              <option value="Viewer" className="bg-surface-3 text-[var(--pm-text)] dark:text-white">Viewer</option>
            </select>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeChip(chip.email); }}
              className="p-0.5 hover:bg-red-500/20 rounded-full transition-colors text-[var(--pm-on-surface-variant)] hover:text-red-400 ml-0.5 focus:outline-none focus:ring-1 focus:ring-red-400"
              title={`Remove ${chip.email}`}
              aria-label={`Remove invitation for ${chip.email}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        
        <input
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="flex-1 bg-transparent min-w-[150px] outline-none text-sm p-1 text-[var(--pm-on-surface)]"
          placeholder={value.length === 0 ? (placeholder || "Enter email and press Enter") : ""}
          aria-label="Email invitation input"
        />
      </div>
      
      <div className="flex justify-between items-center mt-2 px-1 min-h-[20px]">
        {value.length === 0 ? (
          <span className="text-[11px] text-[var(--pm-on-surface-variant)] italic">
            You can invite teammates now or later.
          </span>
        ) : (
          <span className="text-[11px] font-medium text-[var(--pm-on-surface-variant)] uppercase tracking-wide">
            {value.length} invitation{value.length !== 1 ? 's' : ''} queued
          </span>
        )}
        {error && (
          <span className="text-[11px] text-red-400 font-medium animate-in fade-in">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

