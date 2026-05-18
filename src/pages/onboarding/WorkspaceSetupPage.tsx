import React, { useMemo, useState } from 'react';
import { BUSINESS_TYPES } from '../../constants/product';
import { predictEta } from '../../services/etaService';
import type { BusinessType, WorkspaceSettings } from '../../types/workspace';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';

const DEFAULT_SETTINGS: WorkspaceSettings = {
  businessType: 'Software',
  teamSize: 6,
  workStart: '09:00',
  workEnd: '17:00',
  lunchDurationMinutes: 60,
  workingDays: [1, 2, 3, 4, 5],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  attendanceEnabled: true,
  payrollEnabled: false,
  productivityFactor: 0.8
};

export function WorkspaceSetupPage() {
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const preview = useMemo(() => predictEta({
    likely: 40,
    workWindow: settings,
    startDate: new Date()
  }), [settings]);

  return (
    <ResolveLayout eyebrow="Workspace Setup">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/45">Step {step} of 4</p>
              <h2 className="mt-2 text-2xl font-semibold">Set up how your team works</h2>
            </div>
          </div>

          {step === 1 && (
            <div>
              <label className="mb-3 block text-sm font-medium">Business Type</label>
              <div className="grid gap-3 sm:grid-cols-2">
                {BUSINESS_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setSettings(prev => ({ ...prev, businessType: type as BusinessType }))}
                    className={`border px-4 py-3 text-left text-sm ${settings.businessType === type ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-white/80'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="mb-3 block text-sm font-medium">Team Size</label>
              <input
                type="number"
                min={1}
                value={settings.teamSize}
                onChange={event => setSettings(prev => ({ ...prev, teamSize: Number(event.target.value) || 1 }))}
                className="h-12 w-full border border-white/10 bg-black px-4 text-white outline-none focus:border-white/40"
              />
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Work Start
                <input type="time" value={settings.workStart} onChange={event => setSettings(prev => ({ ...prev, workStart: event.target.value }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
              <label className="text-sm font-medium">
                Work End
                <input type="time" value={settings.workEnd} onChange={event => setSettings(prev => ({ ...prev, workEnd: event.target.value }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
              <label className="text-sm font-medium">
                Lunch Duration
                <input type="number" min={0} value={settings.lunchDurationMinutes} onChange={event => setSettings(prev => ({ ...prev, lunchDurationMinutes: Number(event.target.value) || 0 }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
              <label className="text-sm font-medium">
                Timezone
                <input value={settings.timezone} onChange={event => setSettings(prev => ({ ...prev, timezone: event.target.value }))} className="mt-2 h-12 w-full border border-white/10 bg-black px-4 text-white" />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <label className="flex items-center justify-between border border-white/10 bg-white/5 p-4">
                Attendance enabled
                <input type="checkbox" checked={settings.attendanceEnabled} onChange={event => setSettings(prev => ({ ...prev, attendanceEnabled: event.target.checked }))} />
              </label>
              <label className="flex items-center justify-between border border-white/10 bg-white/5 p-4">
                Payroll enabled
                <input type="checkbox" checked={settings.payrollEnabled} onChange={event => setSettings(prev => ({ ...prev, payrollEnabled: event.target.checked }))} />
              </label>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button disabled={step === 1} onClick={() => setStep(prev => Math.max(1, prev - 1))} className="border border-white/10 px-4 py-2 text-sm text-white/80 disabled:opacity-40">
              Back
            </button>
            <button onClick={() => setStep(prev => Math.min(4, prev + 1))} className="bg-white px-4 py-2 text-sm font-medium text-black">
              {step === 4 ? 'Finish Setup' : 'Next'}
            </button>
          </div>
        </section>

        <aside className="border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/45">Live Preview</p>
          <h3 className="mt-3 text-lg font-semibold">A 40 hour project finishes around</h3>
          <p className="mt-4 text-3xl font-semibold">{preview.predictedCompletion.toLocaleDateString()}</p>
          <dl className="mt-6 space-y-3 text-sm text-white/70">
            <div className="flex justify-between"><dt>Daily capacity</dt><dd>{preview.dailyCapacityHours}h</dd></div>
            <div className="flex justify-between"><dt>Confidence</dt><dd>{preview.confidence}%</dd></div>
            <div className="flex justify-between"><dt>Risk</dt><dd className="capitalize">{preview.risk}</dd></div>
          </dl>
        </aside>
      </div>
    </ResolveLayout>
  );
}
