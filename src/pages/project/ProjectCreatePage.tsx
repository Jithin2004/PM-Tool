import React, { useMemo, useState } from 'react';
import { PROJECT_TEMPLATES } from '../../constants/product';
import { predictEta } from '../../services/etaService';
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
  const prediction = useMemo(() => predictEta({
    best: 24,
    likely: 40,
    worst: 72,
    deadline: draft.deadline ? new Date(draft.deadline) : null,
    workWindow: {
      workStart: '09:00',
      workEnd: '17:00',
      lunchDurationMinutes: 60,
      workingDays: [1, 2, 3, 4, 5],
      productivityFactor: 0.8
    }
  }), [draft.deadline]);

  return (
    <ResolveLayout eyebrow="Create Project">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-semibold">Create a project with a delivery prediction</h2>
          <div className="mt-6 grid gap-4">
            <label className="text-sm font-medium">
              Project Name
              <input value={draft.name} onChange={event => setDraft(prev => ({ ...prev, name: event.target.value }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
            </label>
            <label className="text-sm font-medium">
              Description
              <textarea value={draft.description} onChange={event => setDraft(prev => ({ ...prev, description: event.target.value }))} rows={4} className="mt-2 w-full border border-white/10 bg-black p-4 text-white" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Priority
                <select value={draft.priority} onChange={event => setDraft(prev => ({ ...prev, priority: event.target.value as Priority }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Deadline
                <input type="date" value={draft.deadline} onChange={event => setDraft(prev => ({ ...prev, deadline: event.target.value }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
            </div>
            <label className="text-sm font-medium">
              Template
              <select value={draft.template} onChange={event => setDraft(prev => ({ ...prev, template: event.target.value as ProjectTemplate }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white">
                {PROJECT_TEMPLATES.map(template => <option key={template}>{template}</option>)}
              </select>
            </label>
          </div>
        </section>

        <aside className="border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/45">Prediction Preview</p>
          <h3 className="mt-3 text-lg font-semibold">Resolve estimate</h3>
          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex justify-between"><dt className="text-white/60">Estimated effort</dt><dd>{prediction.adjustedEffortHours}h</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">Predicted completion</dt><dd>{prediction.predictedCompletion.toLocaleDateString()}</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">Confidence</dt><dd>{prediction.confidence}%</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">Risk</dt><dd className="capitalize">{prediction.risk}</dd></div>
            <div className="flex justify-between"><dt className="text-white/60">Delivery drift</dt><dd>{prediction.delayDriftDays > 0 ? `+${prediction.delayDriftDays}d` : `${prediction.delayDriftDays}d`}</dd></div>
          </dl>
        </aside>
      </div>
    </ResolveLayout>
  );
}
