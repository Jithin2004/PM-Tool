import React, { useMemo, useState } from 'react';
import { PROJECT_TEMPLATES, EXECUTION_MODES } from '../../constants/product';
import { predictEtaSync } from '../../services/etaService';
import type { Priority, ProjectDraft, ProjectTemplate } from '../../types/project';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';

const INITIAL_PROJECT: ProjectDraft = {
  name: '',
  description: '',
  priority: 'medium',
  deadline: '',
  teamId: '',
  template: 'Software Sprint'
};

export function ProjectCreatePage() {
  const [draft, setDraft] = useState<ProjectDraft>(INITIAL_PROJECT);
  const [executionMode, setExecutionMode] = useState('KANBAN');
  const prediction = useMemo(() => predictEtaSync({
    best: 24,
    likely: 40,
    worst: 72,
    deadline: draft.deadline ? new Date(draft.deadline) : null,
    workWindow: {
      workStart: '09:00',
      workEnd: '17:00',
      lunchDuration: 60,
      workingDays: [1, 2, 3, 4, 5],
      productivityFactor: 0.8
    }
  }), [draft.deadline]);

  return (
    <ResolveLayout eyebrow="Create Project">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="border border-border bg-surface-3 p-6">
          <h2 className="text-2xl font-semibold">Create a project with a delivery prediction</h2>
          <div className="mt-6 grid gap-4">
            <label className="text-sm font-medium">
              Project Name
              <input value={draft.name} onChange={event => setDraft(prev => ({ ...prev, name: event.target.value }))} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary" />
            </label>
            <label className="text-sm font-medium">
              Description
              <textarea value={draft.description} onChange={event => setDraft(prev => ({ ...prev, description: event.target.value }))} rows={4} className="mt-2 w-full border border-border bg-bg p-4 text-text-primary" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Priority
                <select value={draft.priority} onChange={event => setDraft(prev => ({ ...prev, priority: event.target.value as Priority }))} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Deadline
                <input type="date" value={draft.deadline} onChange={event => setDraft(prev => ({ ...prev, deadline: event.target.value }))} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary" />
              </label>
            </div>
            <label className="text-sm font-medium">
              Template
              <select value={draft.template} onChange={event => setDraft(prev => ({ ...prev, template: event.target.value as ProjectTemplate }))} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary">
                {PROJECT_TEMPLATES.map(template => <option key={template}>{template}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Execution Mode
              <select value={executionMode} onChange={event => setExecutionMode(event.target.value)} className="mt-2 h-12 w-full border border-border bg-bg px-4 text-text-primary">
                {EXECUTION_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
          </div>
        </section>

        <aside className="border border-border bg-surface-3 p-6">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-tertiary">Prediction Preview</p>
          <h3 className="mt-3 text-lg font-semibold">Resolve estimate</h3>
          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between"><dt className="text-text-tertiary">Estimated effort</dt><dd>{prediction.adjustedEffortHours}h</dd></div>
            <div className="flex justify-between"><dt className="text-text-tertiary">Predicted completion</dt><dd>{prediction.predictedCompletion.toLocaleDateString()}</dd></div>
            <div className="flex justify-between"><dt className="text-text-tertiary">Confidence</dt><dd>{prediction.confidence}%</dd></div>
            <div className="flex justify-between"><dt className="text-text-tertiary">Risk</dt><dd className="capitalize">{prediction.risk}</dd></div>
            <div className="flex justify-between"><dt className="text-text-tertiary">Delivery drift</dt><dd>{prediction.delayDriftDays > 0 ? `+${prediction.delayDriftDays}d` : `${prediction.delayDriftDays}d`}</dd></div>
          </dl>
        </aside>
      </div>
    </ResolveLayout>
  );
}
