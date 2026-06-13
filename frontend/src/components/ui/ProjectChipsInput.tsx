import React, { useState, KeyboardEvent, useRef } from 'react';
import { X } from 'lucide-react';

interface ProjectChipsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  itemLabel?: string;
  itemLabelPlural?: string;
}

export function ProjectChipsInput({ value, onChange, placeholder, itemLabel = 'project', itemLabelPlural = 'projects' }: ProjectChipsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addChip = (project: string) => {
    const cleanProject = project.trim();
    if (!cleanProject) return;

    if (value.some(chip => chip.toLowerCase() === cleanProject.toLowerCase())) {
      setError(`Duplicate ${itemLabel}: ${cleanProject}`);
      return;
    }

    const newChips = [...value, cleanProject];
    onChange(newChips);
    setInputValue('');
    setError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeChip(value[value.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputValue) {
      addChip(inputValue);
    }
  };

  const removeChip = (projectToRemove: string) => {
    const newChips = value.filter(chip => chip !== projectToRemove);
    onChange(newChips);
    setError(null);
  };

  return (
    <div className="w-full">
      <div 
        className={`flex flex-wrap items-center gap-2 p-2 min-h-[48px] rounded-lg bg-surface-4 border transition-colors cursor-text ${error ? 'border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/50' : 'border-border/50 focus-within:border-[var(--pm-primary)] focus-within:ring-1 focus-within:ring-[var(--pm-primary)]/30'}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((chip) => (
          <div key={chip} className="flex items-center gap-1.5 bg-surface-2 border border-border/60 rounded-full pl-3 pr-1 py-1 text-sm shadow-sm group">
            <span className="text-[var(--pm-on-surface)] truncate max-w-[200px]" title={chip}>
              {chip}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeChip(chip); }}
              className="p-0.5 hover:bg-red-500/20 rounded-full transition-colors text-[var(--pm-on-surface-variant)] hover:text-red-400 ml-1 focus:outline-none focus:ring-1 focus:ring-red-400"
              title={`Remove ${chip}`}
              aria-label={`Remove ${itemLabel} ${chip}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="flex-1 bg-transparent min-w-[150px] outline-none text-sm p-1 text-[var(--pm-on-surface)]"
          placeholder={value.length === 0 ? (placeholder || `Enter ${itemLabel} name and press Enter`) : ""}
          aria-label={`${itemLabel} chips input`}
        />
      </div>
      
      <div className="flex justify-between items-center mt-2 px-1 min-h-[20px]">
        {value.length === 0 ? (
          <span className="text-[11px] text-[var(--pm-on-surface-variant)] italic">
            No {itemLabelPlural} yet. You can create {itemLabelPlural} now or later.
          </span>
        ) : (
          <span className="text-[11px] font-medium text-[var(--pm-on-surface-variant)] uppercase tracking-wide">
            {value.length} {value.length !== 1 ? itemLabelPlural : itemLabel} added
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
