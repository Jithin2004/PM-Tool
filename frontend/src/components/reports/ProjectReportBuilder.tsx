import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { reportingEngine } from '../../core/engines/reportingEngine';
import { reportExportService } from '../../services/reportExportService';
import { Download, FileText, Activity, Layers, AlertTriangle } from 'lucide-react';
import { showAlert } from '../common/Dialogs';

export function ProjectReportBuilder({ workspaceId, projectId, currentUser }: any) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadTemplates() {
      const { data } = await supabase
        .from('report_templates')
        .select('*')
        .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
        .order('name');
      
      if (data) setTemplates(data);
    }
    loadTemplates();
  }, [workspaceId]);

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setLoading(true);
    
    try {
      const config = {
        workspaceId,
        projectId,
        startDate: new Date(Date.now() - 7 * 86400000), // Last 7 days
        endDate: new Date(),
        templateId: selectedTemplate.id
      };
      
      const snapshot = await reportingEngine.generateProjectReport(config);
      setReportData(snapshot);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!reportData || !currentUser) return;
    setSaving(true);
    try {
      await reportingEngine.saveReportSnapshot(
        workspaceId,
        selectedTemplate.type,
        'project',
        projectId,
        reportData,
        { id: currentUser.id, name: currentUser.full_name || currentUser.email, role: currentUser.role }
      );
      showAlert('Snapshot Saved to Database successfully.', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      showAlert(`Failed to save snapshot: ${err.message}`, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!reportData) return;
    reportExportService.exportAsMarkdown(reportData, `${selectedTemplate.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="flex flex-col h-full bg-surface p-6">
      <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent-primary" /> Report Builder
          </h2>
          <p className="text-sm text-text-tertiary mt-1">Generate automated operational digests from activity data.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            className="bg-surface-2 border border-border rounded px-3 py-2 text-sm font-bold text-text-secondary outline-none focus:border-accent-primary"
            value={selectedTemplate?.id || ''}
            onChange={e => setSelectedTemplate(templates.find(t => t.id === e.target.value))}
          >
            <option value="">Select Template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button 
            onClick={handleGenerate}
            disabled={!selectedTemplate || loading}
            className="px-4 py-2 bg-accent-primary text-white rounded font-bold text-sm disabled:opacity-50 hover:brightness-110 flex items-center gap-2"
          >
            {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
            Generate View
          </button>
        </div>
      </div>

      {reportData && (
        <div className="flex-1 overflow-auto animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-surface-2 border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-text-primary">{selectedTemplate.name} Preview</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportMarkdown}
                  className="px-3 py-1.5 text-xs font-bold text-text-secondary bg-surface border border-border rounded hover:bg-surface-3 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export MD
                </button>
                <button 
                  onClick={handleSaveSnapshot}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-bold text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded hover:bg-accent-primary/20"
                >
                  {saving ? 'Saving...' : 'Save Snapshot to DB'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="p-4 bg-surface rounded-lg border border-border-subtle">
                <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Core Metrics
                </h4>
                <div className="space-y-2 text-sm font-medium">
                  <div className="flex justify-between"><span className="text-text-secondary">Total Tasks:</span> <span className="text-text-primary">{reportData.metrics.totalTasks}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Completed:</span> <span className="text-text-primary">{reportData.metrics.completedTasks}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Currently Blocked:</span> <span className="text-signal-critical">{reportData.metrics.currentlyBlocked}</span></div>
                  <div className="flex justify-between border-t border-border-subtle pt-2 mt-2">
                    <span className="text-text-secondary">Confidence:</span> 
                    <span className="text-accent-primary">{reportData.metrics.deliveryConfidence}%</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-surface rounded-lg border border-border-subtle">
                <h4 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-3">Activity Digest</h4>
                <div className="space-y-2 text-sm font-medium">
                  <div className="flex justify-between"><span className="text-text-secondary">Progress Events:</span> <span className="text-text-primary">{reportData.activityDigest.tasksProgressed}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Timeline Shifts:</span> <span className="text-signal-warning">{reportData.activityDigest.timelineShifts}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Total Events (Raw):</span> <span className="text-text-tertiary">{reportData.activityDigest.totalEvents}</span></div>
                </div>
              </div>
            </div>

            {reportData.risks && reportData.risks.length > 0 && (
              <div className="mb-8">
                <h4 className="text-sm font-bold text-signal-critical flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4" /> Escalated Risks
                </h4>
                <div className="space-y-2">
                  {reportData.risks.map((r: any) => (
                    <div key={r.taskId} className="px-3 py-2 bg-signal-critical/5 border border-signal-critical/20 rounded text-sm text-signal-critical flex justify-between">
                      <span className="font-bold">{r.taskName}</span>
                      <span>{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
