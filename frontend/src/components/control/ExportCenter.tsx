import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Download, Users, Briefcase, DollarSign, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useDashboard } from '../../context/DashboardContext';

export function ExportCenter() {
  const { workspace } = useWorkspace();
  const { notify } = useDashboard();
  const [exporting, setExporting] = useState<string | null>(null);

  const downloadCSV = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const convertToCSV = (arr: any[]) => {
    if (arr.length === 0) return '';
    const array = [Object.keys(arr[0])].concat(arr);
    return array.map(it => {
      return Object.values(it).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    }).join('\n');
  };

  const logExport = async (type: string) => {
    if (!workspace?.id) return;
    await supabase.from('activity_logs').insert({
      workspace_id: workspace.id,
      entity_type: 'system',
      entity_id: workspace.id,
      action: `export_csv_${type}`,
      metadata: { description: `Exported ${type} CSV` }
    });
  };

  const handleExport = async (type: string, query: Promise<any>) => {
    setExporting(type);
    try {
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) {
        notify(`There's nothing to export for ${type} right now.`, 'info');
        setExporting(null);
        return;
      }
      
      const csv = convertToCSV(data);
      downloadCSV(`${type}_export_${new Date().toISOString().split('T')[0]}.csv`, csv);
      await logExport(type);
      notify(`${type} exported successfully`, 'success');
    } catch (err: any) {
      notify(err.message || 'Export failed', 'error');
    } finally {
      setExporting(null);
    }
  };

  const exportEmployees = () => {
    handleExport('employees', supabase.from('users').select('*').eq('workspace_id', workspace?.id) as any);
  };

  const exportProjects = () => {
    handleExport('projects', supabase.from('projects').select('*').eq('workspace_id', workspace?.id) as any);
  };

  const exportFinance = () => {
    handleExport('finance', supabase.from('invoices').select('*').eq('workspace_id', workspace?.id) as any);
  };

  const exportAudit = () => {
    handleExport('audit', supabase.from('activity_logs').select('*').eq('workspace_id', workspace?.id).order('created_at', { ascending: false }).limit(1000) as any);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Backup & Export Data</h3>
          <p className="text-xs text-text-tertiary mt-1">Download your workspace data in standard CSV format. Exports are audited.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExportCard 
          title="Employees Directory" 
          description="Export all active and inactive employees, roles, and status."
          icon={<Users />}
          onClick={exportEmployees}
          loading={exporting === 'employees'}
        />
        <ExportCard 
          title="Projects Portfolio" 
          description="Export project metadata, status, and health indicators."
          icon={<Briefcase />}
          onClick={exportProjects}
          loading={exporting === 'projects'}
        />
        <ExportCard 
          title="Finance & Invoices" 
          description="Export financial records, generated invoices, and status."
          icon={<DollarSign />}
          onClick={exportFinance}
          loading={exporting === 'finance'}
        />
        <ExportCard 
          title="Audit Records" 
          description="Export the last 1000 activity logs across all modules."
          icon={<Activity />}
          onClick={exportAudit}
          loading={exporting === 'audit'}
        />
      </div>
    </div>
  );
}

function ExportCard({ title, description, icon, onClick, loading }: { title: string, description: string, icon: React.ReactNode, onClick: () => void, loading: boolean }) {
  return (
    <div className="bg-surface/40 border border-border/50 rounded-xl p-5 hover:border-accent-primary/30 transition-all flex flex-col items-start gap-4">
      <div className="p-2.5 bg-accent-primary/10 text-accent-primary rounded-lg">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' } as any)}
      </div>
      <div>
        <h4 className="text-sm font-bold text-text-secondary">{title}</h4>
        <p className="text-xs text-text-tertiary mt-1">{description}</p>
      </div>
      <button 
        onClick={onClick}
        disabled={loading}
        className="mt-auto w-full flex items-center justify-center gap-2 h-9 bg-surface border border-border/50 hover:bg-surface-2 rounded-lg text-xs font-medium text-text-secondary disabled:opacity-50 transition-colors"
      >
        {loading ? <span className="animate-pulse">Exporting...</span> : <><Download className="w-3.5 h-3.5" /> Download CSV</>}
      </button>
    </div>
  );
}
