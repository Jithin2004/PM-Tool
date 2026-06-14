import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { FileText, Download, Activity, Calendar, Users, DollarSign } from 'lucide-react';
import { exportToPDF, exportToCSV } from '../../services/pdfExportService';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../components/common/Dialogs';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';
import { generateWeeklyDigestMarkdown } from '../../core/reporting/WeeklyDigestEngine';

export default function ReportsCenter() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const { raw: { projects, tasks, teams, profiles, attendanceRows } } = useOperationalData();

  const [exporting, setExporting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string>('project');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [exportFormat, setExportFormat] = useState<'PDF' | 'CSV'>('PDF');
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [digestMarkdown, setDigestMarkdown] = useState<string | null>(null);
  
  const canManageCompensation = hasCapability(profile?.role, 'manage_compensation');

  const handleGenerate = async () => {
    if (!workspace) return;
    setExporting(true);
    setDigestMarkdown(null);
    
    let reportData: any[] = [];
    const isFinancial = ['payroll', 'invoices', 'gst', 'profit'].includes(selectedReport);
    
    try {
      if (isFinancial) {
        // 1. Check for existing snapshot for this exact period
        const snapshotKey = `${dateStart}_${dateEnd}`;
        const { data: existingSnapshot } = await supabase
          .from('financial_report_snapshots')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('report_type', `${selectedReport}_${snapshotKey}`)
          .single();

        if (existingSnapshot && existingSnapshot.snapshot_data) {
          reportData = existingSnapshot.snapshot_data;
        }
      }

      if (reportData.length === 0) {
        // Generate live data
        if (selectedReport === 'project') {
        reportData = projects.map(p => {
          const pTasks = tasks.filter(t => t.project_id === p.id);
          const completed = pTasks.filter(t => t.status === 'done' || t.status === 'review').length;
          const delayed = pTasks.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()).length;
          return {
            "Project Name": p.name,
            "Owner": profiles.find(pr => pr.id === p.owner_id)?.full_name || 'Unassigned',
            "Status": p.status,
            "Total Tasks": pTasks.length,
            "Completed Tasks": completed,
            "Delayed Tasks": delayed
          };
        });
      } else if (selectedReport === 'team') {
        reportData = profiles.map(pr => {
          const userTasks = tasks.filter(t => t.assignee_id === pr.id);
          const completed = userTasks.filter(t => t.status === 'done' || t.status === 'review').length;
          return {
            "Member": pr.full_name || 'Unknown',
            "Assigned Workload": userTasks.length,
            "Completed Work": completed,
            "Role": pr.role,
            "Active": "Yes"
          };
        });
      } else if (selectedReport === 'sprint') {
        reportData = tasks.filter(t => t.sprint_id).map(t => ({
          "Task": t.name,
          "Sprint ID": t.sprint_id,
          "Status": t.status,
          "Priority": t.priority,
          "Assignee": profiles.find(pr => pr.id === t.assignee_id)?.full_name || 'Unassigned'
        }));
      } else if (selectedReport === 'attendance') {
        reportData = attendanceRows.map(a => ({
          "User": profiles.find(p => p.id === a.user_id)?.full_name || a.user_id,
          "Date": a.date,
          "Check In": 'N/A',
          "Check Out": 'N/A',
          "Status": a.status,
          "Leave Type": a.leave_type || 'N/A'
        }));
      } else if (selectedReport === 'payroll') {
        if (!canManageCompensation) throw new Error("Unauthorized");
        const { data: comp } = await supabase.from('compensation_packages').select('*').eq('workspace_id', workspace.id);
        reportData = (comp || []).map((c: any) => ({
          "User": profiles.find(pr => pr.id === c.user_id)?.full_name || c.user_id,
          "Currency": c.currency,
          "Base Salary": c.base_salary,
          "Type": c.employment_type
        }));
      } else if (selectedReport === 'invoices') {
        if (!canManageCompensation) throw new Error("Unauthorized");
        const { data: invs } = await supabase.from('invoices').select('*').eq('workspace_id', workspace.id).gte('issue_date', dateStart || '1970-01-01').lte('issue_date', dateEnd || '2099-12-31');
        reportData = (invs || []).map((i: any) => ({
          "Invoice #": i.invoice_number,
          "Date": i.issue_date,
          "Status": i.status,
          "Amount": i.invoice_amount || i.amount,
          "Currency": i.invoice_currency || i.currency
        }));
      } else if (selectedReport === 'gst') {
        if (!canManageCompensation) throw new Error("Unauthorized");
        const { data: invs } = await supabase.from('invoices').select('*').eq('workspace_id', workspace.id).gte('issue_date', dateStart || '1970-01-01').lte('issue_date', dateEnd || '2099-12-31');
        reportData = (invs || []).map((i: any) => ({
          "Invoice #": i.invoice_number,
          "Taxable": i.taxable_amount,
          "CGST": i.cgst_amount,
          "SGST": i.sgst_amount,
          "IGST": i.igst_amount,
          "Total Tax": i.total_tax
        }));
      } else if (selectedReport === 'profit') {
        if (!canManageCompensation) throw new Error("Unauthorized");
        const { data: invs } = await supabase.from('invoices').select('amount').eq('workspace_id', workspace.id).eq('status', 'paid');
        const { data: exps } = await supabase.from('expenses').select('amount').eq('workspace_id', workspace.id).eq('status', 'approved');
        const totalRev = (invs || []).reduce((sum, i) => sum + Number(i.amount), 0);
        const totalExp = (exps || []).reduce((sum, e) => sum + Number(e.amount), 0);
        reportData = [{
          "Period Start": dateStart,
          "Period End": dateEnd,
          "Total Revenue": totalRev,
          "Total Expenses": totalExp,
          "Net Profit": totalRev - totalExp
        }];
      } else if (selectedReport === 'weekly_digest') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(new Date().getDate() - 7);
        
        const [ { data: logs }, { data: approvalsData } ] = await Promise.all([
          supabase.from('activity_logs').select('*').eq('workspace_id', workspace.id).gte('created_at', sevenDaysAgo.toISOString()),
          supabase.from('universal_approvals').select('*').eq('workspace_id', workspace.id).gte('approved_at', sevenDaysAgo.toISOString())
        ]);
        
        const md = generateWeeklyDigestMarkdown({
          tasks,
          projects,
          profiles,
          activityLogs: logs || [],
          approvals: approvalsData || [],
          workspaceSettingsBlob: workspace.settings
        });
        
        setDigestMarkdown(md);
        setExporting(false);
        return; // Weekly digest doesn't use the standard table export flow
      }

      if (reportData.length > 0 && isFinancial) {
        // Save snapshot so it's immutable for next time
        const snapshotKey = `${dateStart}_${dateEnd}`;
        const { data: existing } = await supabase.from('financial_report_snapshots').select('id').eq('workspace_id', workspace.id).eq('report_type', `${selectedReport}_${snapshotKey}`).single();
        if (!existing) {
          await supabase.from('financial_report_snapshots').insert({
            workspace_id: workspace.id,
            report_type: `${selectedReport}_${snapshotKey}`,
            snapshot_data: reportData,
            created_by: profile?.id
          });
        }
      }
    }

      if (reportData.length === 0) {
        await showAlert("No records found for selected filters.", { type: "info" });
        setExporting(false);
        return;
      }

      // 1. Generate Report
      if (exportFormat === 'PDF') {
        await exportToPDF(workspace.id, `${selectedReport.toUpperCase()}_Report` as any, { data: reportData, dateStart, dateEnd });
      } else {
        await exportToCSV(workspace.id, `${selectedReport.toUpperCase()}_Report`, reportData);
      }
      
      // Update Preview
      if (reportData.length > 0) {
        setPreviewColumns(Object.keys(reportData[0]));
        setPreviewData(reportData);
      } else {
        setPreviewData([]);
        setPreviewColumns([]);
      }
      
      // 2. Track Report Generation
      await supabase.from('generated_reports').insert({
        workspace_id: workspace.id,
        report_type: selectedReport,
        generated_by: profile?.id,
        file_path: `virtual/${selectedReport}_${Date.now()}.${exportFormat.toLowerCase()}`
      });
      
    } catch (e: any) {
      console.error("Failed to generate report:", e);
      await showAlert(e.message || "Failed to generate report", { type: "error" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Reports Center
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Generate enterprise business reports and analytics.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(96,165,250,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             REPORTING ENGINE
          </span>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border space-y-6">
            {projects.length === 0 ? (
              <PremiumEmptyState 
                icon={FileText}
                title="No Data for Reports"
                description="Reports will be automatically generated once you have active projects, tasks, and team activity."
              />
            ) : (
              <>
            
            <div className="flex items-center gap-3 border-b border-border/50 pb-4">
               <FileText className="w-6 h-6 text-emerald-400" />
               <h2 className="text-lg font-semibold text-[var(--pm-on-surface)]">Report Configuration</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">Choose Report</label>
                <select 
                  value={selectedReport}
                  onChange={(e) => setSelectedReport(e.target.value)}
                  className="w-full input-premium p-3 text-sm outline-none"
                >
                  <option className="bg-surface-highest text-text-primary" value="project">Project Report</option>
                  <option className="bg-surface-highest text-text-primary" value="team">Team Report</option>
                  <option className="bg-surface-highest text-text-primary" value="weekly_digest">Weekly Digest (Markdown)</option>
                  <option className="bg-surface-highest text-text-primary" value="sprint">Sprint Report</option>
                  <option className="bg-surface-highest text-text-primary" value="attendance">Attendance Report</option>
                  {canManageCompensation && (
                    <>
                      <option className="bg-surface-highest text-text-primary" value="payroll">Payroll Report (Restricted)</option>
                      <option className="bg-surface-highest text-text-primary" value="invoices">Invoices Report</option>
                      <option className="bg-surface-highest text-text-primary" value="gst">GST Report</option>
                      <option className="bg-surface-highest text-text-primary" value="profit">Profit Report</option>
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">Start Date</label>
                  <input 
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full input-premium p-3 text-sm outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">End Date</label>
                  <input 
                    type="date" 
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="w-full input-premium p-3 text-sm outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">Format</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="format" value="PDF" checked={exportFormat === 'PDF'} onChange={() => setExportFormat('PDF')} className="accent-accent-primary" />
                    <span className="text-sm font-medium text-text-secondary">PDF Document</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="format" value="CSV" checked={exportFormat === 'CSV'} onChange={() => setExportFormat('CSV')} className="accent-accent-primary" />
                    <span className="text-sm font-medium text-text-secondary">CSV Data Export</span>
                  </label>
                </div>
              </div>
            </div>

            {selectedReport === 'weekly_digest' && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-sm">
                <p>The Weekly Digest deterministically parses all operational data from the last 7 days and outputs an exportable Markdown summary. Date range and format settings are ignored.</p>
              </div>
            )}

            <div className="pt-4 flex gap-3 border-t border-border/50">
              <button 
                onClick={handleGenerate} 
                disabled={exporting} 
                className="px-6 py-2.5 bg-accent-primary text-black font-semibold rounded-lg text-sm transition-all hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Generating...' : 'Preview & Download'}
              </button>
            </div>

            </>
            )}
          </div>
        </div>
      </div>

      {/* Preview Section */}
      {previewData !== null && (
        <div className="mt-8 glass-panel rounded-xl p-6 bg-surface-2 border border-border">
          <h2 className="text-lg font-semibold mb-4 text-[var(--pm-on-surface)]">
            Report Preview ({previewData.length} records)
          </h2>
          {previewData.length === 0 ? (
            <PremiumEmptyState 
              icon={FileText} 
              title="No Report Data Available" 
              description="There is no data matching your selected filters. Try adjusting the date range or selecting a different report type to see insights." 
              compact={true}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50 bg-surface-3/10 backdrop-blur-md">
              <table className="w-full text-left border-collapse whitespace-nowrap table-premium">
                <thead>
                  <tr className="border-b border-border/50">
                    {previewColumns.map((col, i) => (
                      <th key={i} className="p-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {previewData.slice(0, 50).map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-surface-highest/50 transition-colors">
                      {previewColumns.map((col, colIndex) => (
                        <td key={colIndex} className="p-3 text-sm text-text-primary">
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {previewData.length > 50 && (
            <p className="text-xs text-text-tertiary mt-3 text-center italic">
              Showing first 50 records. Download to see all {previewData.length} records.
            </p>
          )}
        </div>
      )}

      {/* Markdown Digest Preview */}
      {digestMarkdown !== null && (
        <div className="mt-8 glass-panel rounded-xl p-6 bg-surface-2 border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[var(--pm-on-surface)]">
              Weekly Digest Report
            </h2>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(digestMarkdown);
                showAlert("Markdown copied to clipboard!", { type: "success" });
              }} 
              className="px-4 py-2 bg-[var(--pm-surface-highest)] border border-[var(--pm-border)] rounded text-sm text-[var(--pm-text)] hover:bg-[var(--pm-surface-hover)] transition-colors"
            >
              Copy Markdown
            </button>
          </div>
          <div className="p-6 rounded-lg border border-border/50 bg-surface-3/10 backdrop-blur-md overflow-x-auto">
            <pre className="text-sm font-mono text-text-primary whitespace-pre-wrap leading-relaxed">
              {digestMarkdown}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
