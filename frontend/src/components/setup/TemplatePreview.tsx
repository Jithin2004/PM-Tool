import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code2, Kanban, GitBranch, Users, DollarSign, Package, ChevronRight } from 'lucide-react';

export type OperatingTemplate =
  | 'scrum_dev'
  | 'kanban_dev'
  | 'release_pipeline'
  | 'recruitment'
  | 'employee_ops'
  | 'invoice_processing'
  | 'expense_flow'
  | 'delivery_tracking';

interface TemplateConfig {
  id: OperatingTemplate;
  label: string;
  category: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  lanes: string[];
  accentColor: string;
}

const TEMPLATES: TemplateConfig[] = [
  {
    id: 'scrum_dev',
    label: 'Scrum Development',
    category: 'Engineering',
    description: 'Sprint-based delivery with backlog grooming, sprint planning, and velocity tracking.',
    icon: Code2,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    lanes: ['Backlog', 'Ready', 'Development', 'Code Review', 'QA', 'Release', 'Done'],
    accentColor: 'bg-blue-500',
  },
  {
    id: 'kanban_dev',
    label: 'Kanban Development',
    category: 'Engineering',
    description: 'Continuous flow with WIP limits. Ideal for maintenance, support, and ongoing delivery.',
    icon: Kanban,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10',
    lanes: ['Queue', 'Analysis', 'In Progress', 'Review', 'Testing', 'Done'],
    accentColor: 'bg-indigo-500',
  },
  {
    id: 'release_pipeline',
    label: 'Release Pipeline',
    category: 'Engineering',
    description: 'Stage-gate release management from feature freeze through production deployment.',
    icon: GitBranch,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    lanes: ['Feature Freeze', 'Integration', 'Staging', 'UAT', 'Pre-Release', 'Production'],
    accentColor: 'bg-violet-500',
  },
  {
    id: 'recruitment',
    label: 'Recruitment Pipeline',
    category: 'HR',
    description: 'End-to-end hiring workflow from job posting through onboarding.',
    icon: Users,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    lanes: ['Applied', 'Screening', 'Interview', 'Assessment', 'Offer', 'Onboarding'],
    accentColor: 'bg-emerald-500',
  },
  {
    id: 'employee_ops',
    label: 'Employee Operations',
    category: 'HR',
    description: 'Manage HR requests, leave approvals, and employee lifecycle actions.',
    icon: Users,
    iconColor: 'text-teal-400',
    iconBg: 'bg-teal-500/10',
    lanes: ['Submitted', 'Under Review', 'Pending Approval', 'Approved', 'Completed'],
    accentColor: 'bg-teal-500',
  },
  {
    id: 'invoice_processing',
    label: 'Invoice Processing',
    category: 'Finance',
    description: 'Track invoices from draft through payment reconciliation.',
    icon: DollarSign,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    lanes: ['Draft', 'Sent', 'Acknowledged', 'Partial Payment', 'Paid', 'Reconciled'],
    accentColor: 'bg-amber-500',
  },
  {
    id: 'expense_flow',
    label: 'Expense Flow',
    category: 'Finance',
    description: 'Employee expense submission, manager approval, and reimbursement tracking.',
    icon: DollarSign,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
    lanes: ['Submitted', 'Finance Review', 'Manager Approval', 'Approved', 'Reimbursed'],
    accentColor: 'bg-orange-500',
  },
  {
    id: 'delivery_tracking',
    label: 'Delivery Tracking',
    category: 'Client',
    description: 'Client-facing delivery milestones with approval gates and status transparency.',
    icon: Package,
    iconColor: 'text-rose-400',
    iconBg: 'bg-rose-500/10',
    lanes: ['Planned', 'In Progress', 'Client Review', 'Revisions', 'Approved', 'Delivered'],
    accentColor: 'bg-rose-500',
  },
];

const CATEGORIES = ['Engineering', 'HR', 'Finance', 'Client'];

interface TemplateBoardPreviewProps {
  template: TemplateConfig;
}

function TemplateBoardPreview({ template }: TemplateBoardPreviewProps) {
  // Generate fake card counts to make the board look alive
  const fakeCards: Record<string, number> = {};
  template.lanes.forEach((lane, i) => {
    if (i === 0) fakeCards[lane] = 3;
    else if (i === template.lanes.length - 1) fakeCards[lane] = 2;
    else fakeCards[lane] = Math.floor(Math.random() * 2);
  });

  return (
    <motion.div
      key={template.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[#0b0c11] overflow-hidden"
    >
      {/* Board header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-soft)]">
        <div className={`w-6 h-6 rounded-md ${template.iconBg} flex items-center justify-center`}>
          <template.icon className={`w-3.5 h-3.5 ${template.iconColor}`} />
        </div>
        <span className="text-xs font-semibold text-[var(--text-primary)]">{template.label}</span>
        <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-[var(--text-muted)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded">Preview</span>
      </div>

      {/* Kanban columns — horizontal scroll */}
      <div className="flex gap-2 p-3 overflow-x-auto scrollbar-thin">
        {template.lanes.map((lane, i) => {
          const cardCount = fakeCards[lane] ?? 0;
          const isFirst = i === 0;
          const isLast = i === template.lanes.length - 1;

          return (
            <div key={lane} className="flex-shrink-0 w-28">
              {/* Column header */}
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isFirst ? template.accentColor : isLast ? 'bg-emerald-500' : 'bg-[var(--border-soft)]'
                }`} />
                <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)] truncate">{lane}</span>
                {cardCount > 0 && (
                  <span className="ml-auto text-[8px] font-mono text-[var(--text-muted)] bg-[var(--surface-hover)] px-1 rounded">{cardCount}</span>
                )}
              </div>

              {/* Fake cards */}
              <div className="space-y-1.5">
                {Array.from({ length: cardCount }).map((_, ci) => (
                  <div
                    key={ci}
                    className="h-7 rounded-md bg-[var(--surface-glass)] border border-[var(--border-soft)] animate-pulse"
                    style={{ opacity: 0.4 + (ci * 0.2) }}
                  />
                ))}
                {cardCount === 0 && (
                  <div className="h-7 rounded-md border border-dashed border-[var(--border-soft)] opacity-20" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* No data callout */}
      <div className="px-4 py-2 border-t border-[var(--border-soft)] text-[9px] font-mono text-[var(--text-muted)] flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
        Preview only — no sample data will be inserted into your workspace
      </div>
    </motion.div>
  );
}

interface TemplatePreviewProps {
  selected: OperatingTemplate[];
  onChange: (templates: OperatingTemplate[]) => void;
}

/**
 * TemplatePreview — shows operating workflow templates with real board previews.
 *
 * Rules:
 * - Preview is visual only — NO data insertion
 * - Multiple templates can be selected
 * - Each template shows its actual lane structure
 */
export function TemplatePreview({ selected, onChange }: TemplatePreviewProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Engineering');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateConfig | null>(null);

  const filteredTemplates = TEMPLATES.filter(t => t.category === activeCategory);

  const toggle = (id: OperatingTemplate) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
      setPreviewTemplate(TEMPLATES.find(t => t.id === id) ?? null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex gap-1 p-1 bg-[var(--surface-glass)] rounded-lg border border-[var(--border-soft)]">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-1 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all ${
              activeCategory === cat
                ? 'bg-indigo-500 text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-1 gap-2">
        {filteredTemplates.map(template => {
          const isSelected = selected.includes(template.id);
          const Icon = template.icon;

          return (
            <button
              key={template.id}
              onClick={() => toggle(template.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? 'border-indigo-500/50 bg-indigo-500/5'
                  : 'border-[var(--border-soft)] bg-[var(--surface-glass)] hover:border-indigo-500/30 hover:bg-[var(--surface-hover)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${template.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${template.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{template.label}</span>
                    {isSelected && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">Selected</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{template.description}</p>
                  {/* Lane preview strip */}
                  <div className="flex items-center gap-1 mt-2 overflow-hidden">
                    {template.lanes.slice(0, 5).map((lane, i) => (
                      <React.Fragment key={lane}>
                        <span className="text-[8px] font-mono text-[var(--text-muted)] whitespace-nowrap opacity-70">{lane}</span>
                        {i < Math.min(4, template.lanes.length - 1) && (
                          <ChevronRight className="w-2.5 h-2.5 text-[var(--text-muted)] opacity-40 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                    {template.lanes.length > 5 && (
                      <span className="text-[8px] font-mono text-[var(--text-muted)] opacity-50">+{template.lanes.length - 5}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Board preview for selected template */}
      <AnimatePresence mode="wait">
        {previewTemplate && selected.includes(previewTemplate.id) && (
          <TemplateBoardPreview key={previewTemplate.id} template={previewTemplate} />
        )}
      </AnimatePresence>

      {selected.length > 0 && (
        <div className="text-[10px] font-mono text-[var(--text-muted)] text-center">
          {selected.length} template{selected.length !== 1 ? 's' : ''} selected — these configure your team's workflow views
        </div>
      )}
    </div>
  );
}
