import React, { useState } from 'react';
import { Columns, Plus, X, GripVertical } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface ColumnDef {
  id: string;
  title: string;
  wipLimit: number;
}

interface KanbanBootstrapProps {
  projectId: string;
  workspaceId: string;
  onComplete: () => void;
  onSkip: () => void;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'backlog', title: 'Backlog', wipLimit: 0 },
  { id: 'ready', title: 'Ready', wipLimit: 5 },
  { id: 'in_progress', title: 'In Progress', wipLimit: 3 },
  { id: 'review', title: 'Review', wipLimit: 4 },
  { id: 'done', title: 'Done', wipLimit: 0 },
];

export function KanbanBootstrap({ projectId, workspaceId, onComplete, onSkip }: KanbanBootstrapProps) {
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [saving, setSaving] = useState(false);

  const updateColumn = (index: number, field: keyof ColumnDef, value: string | number) => {
    setColumns(prev => prev.map((col, i) => i === index ? { ...col, [field]: value } : col));
  };

  const addColumn = () => {
    const id = `col_${Date.now()}`;
    setColumns(prev => [...prev, { id, title: '', wipLimit: 0 }]);
  };

  const removeColumn = (index: number) => {
    setColumns(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!isSupabaseConfigured) return;
    setSaving(true);
    const { error } = await supabase
      .from('projects')
      .update({
        data: { kanban_columns: columns },
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);
    if (!error) onComplete();
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <Columns className="w-5 h-5 text-accent-primary" />
        <div>
          <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-secondary">Workflow Stages</h3>
          <p className="text-[10px] text-text-quaternary mt-0.5">Customize your board columns and WIP limits</p>
        </div>
      </div>

      <div className="space-y-2">
        {columns.map((col, i) => (
          <div key={col.id} className="flex items-center gap-2 p-2 border border-border rounded-sm bg-surface-3">
            <GripVertical className="w-3.5 h-3.5 text-text-quaternary shrink-0" />
            <input
              value={col.title}
              onChange={e => updateColumn(i, 'title', e.target.value)}
              placeholder="Column name"
              className="flex-1 bg-transparent border-0 text-xs font-mono text-text-secondary placeholder-white/20 outline-none focus:text-text-primary"
            />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-text-quaternary uppercase">WIP</span>
              <input
                type="number"
                min={0}
                value={col.wipLimit}
                onChange={e => updateColumn(i, 'wipLimit', parseInt(e.target.value) || 0)}
                className="w-12 bg-[var(--pm-surface)]/5 border border-border rounded-sm px-1.5 py-1 text-[10px] font-mono text-text-secondary text-center outline-none focus:border-border"
              />
            </div>
            {columns.length > 2 && (
              <button onClick={() => removeColumn(i)} className="text-text-quaternary hover:text-text-tertiary transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addColumn}
        className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-quaternary hover:text-text-tertiary transition-colors"
      >
        <Plus className="w-3 h-3" /> Add Column
      </button>

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-accent-primary text-[var(--pm-text)] text-[var(--text-primary)] text-[10px] font-medium uppercase tracking-wider hover:bg-accent-primary/90 transition-all rounded-sm disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Saving...' : 'Apply & Continue'}
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 text-text-quaternary text-[10px] font-medium uppercase tracking-wider hover:text-text-tertiary transition-all"
        >
          Skip — Use Defaults
        </button>
      </div>
    </div>
  );
}
