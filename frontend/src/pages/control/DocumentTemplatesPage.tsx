import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, Save, X, FileText, Image as ImageIcon, Variable } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { fetchDocumentTemplates, createDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate, DocumentTemplate, TemplateType } from '../../services/documentTemplateService';
import { documentGenerator } from '../../services/documentGeneratorService';
import { hasCapability } from '../../core/auth/permissions';
import { showAlert, showConfirm, showPrompt } from '../../components/common/Dialogs';
import { PremiumLoader } from '../../components/common/PremiumLoader';

const AVAILABLE_VARIABLES: Record<TemplateType | 'common', { name: string, desc: string }[]> = {
  common: [
    { name: '{{company_name}}', desc: 'Your Organization Name' },
    { name: '{{date}}', desc: 'Current Date' },
    { name: '{{signature}}', desc: 'Authorized Signature Line' }
  ],
  invoice: [
    { name: '{{client_name}}', desc: 'Client Company Name' },
    { name: '{{invoice_number}}', desc: 'Invoice ID' },
    { name: '{{amount}}', desc: 'Grand Total' },
    { name: '{{gst}}', desc: 'Total GST Amount' }
  ],
  offer_letter: [
    { name: '{{employee_name}}', desc: 'Candidate Name' },
    { name: '{{role}}', desc: 'Job Title' },
    { name: '{{salary}}', desc: 'CTC / Salary' },
    { name: '{{joining_date}}', desc: 'Date of Joining' }
  ],
  experience_letter: [
    { name: '{{employee_name}}', desc: 'Employee Name' },
    { name: '{{role}}', desc: 'Last Designation' },
    { name: '{{start_date}}', desc: 'Joining Date' },
    { name: '{{end_date}}', desc: 'Relieving Date' }
  ],
  salary_slip: [
    { name: '{{employee_name}}', desc: 'Employee Name' },
    { name: '{{month}}', desc: 'Salary Month' },
    { name: '{{net_pay}}', desc: 'Net Payable Amount' },
    { name: '{{deductions}}', desc: 'Total Deductions' }
  ],
  receipt: [
    { name: '{{client_name}}', desc: 'Client Name' },
    { name: '{{amount}}', desc: 'Amount Received' },
    { name: '{{receipt_number}}', desc: 'Receipt ID' }
  ],
  report: [
    { name: '{{project_name}}', desc: 'Project Name' },
    { name: '{{report_period}}', desc: 'Period Covered' }
  ],
  custom: []
};

export default function DocumentTemplatesPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<DocumentTemplate> | null>(null);
  
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (workspace?.id) {
      loadTemplates();
    }
  }, [workspace?.id]);

  const loadTemplates = async () => {
    setLoading(true);
    const data = await fetchDocumentTemplates(workspace!.id);
    setTemplates(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editingTemplate?.name || !editingTemplate?.type || !editingTemplate?.template_body) {
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Name, Type, and Body are required.', type: 'error' } }));
      return;
    }

    if (editingTemplate.id) {
      const updated = await updateDocumentTemplate(editingTemplate.id, editingTemplate);
      if (updated) {
        setTemplates(templates.map(t => t.id === updated.id ? updated : t));
        setIsEditing(false);
        window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Template updated successfully.', type: 'success' } }));
      }
    } else {
      const created = await createDocumentTemplate({
        ...editingTemplate,
        workspace_id: workspace!.id,
        created_by: profile!.id
      });
      if (created) {
        setTemplates([created, ...templates]);
        setIsEditing(false);
        window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Template created successfully.', type: 'success' } }));
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (await showConfirm('Are you sure you want to delete this template? Past generated PDFs will not be affected.')) {
      const success = await deleteDocumentTemplate(id);
      if (success) {
        setTemplates(templates.filter(t => t.id !== id));
        window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Template deleted.', type: 'success' } }));
      }
    }
  };

  const handlePreview = async (template: Partial<DocumentTemplate>) => {
    if (!template.template_body) return;
    
    // Create dummy data for preview based on type
    const dummyData: Record<string, any> = {
      company_name: 'Acme Corp',
      date: new Date().toLocaleDateString(),
      signature: 'John Doe\nDirector',
      client_name: 'Globex Inc',
      invoice_number: 'INV-2026-001',
      amount: '₹45,000.00',
      gst: '₹8,100.00',
      employee_name: 'Jane Smith',
      role: 'Senior Engineer',
      salary: '₹12,00,000',
      joining_date: '01-Jul-2026',
      start_date: '01-Jan-2024',
      end_date: '31-May-2026',
      month: 'May 2026',
      net_pay: '₹85,000',
      deductions: '₹15,000',
      receipt_number: 'REC-001',
      project_name: 'Project Phoenix',
      report_period: 'Q2 2026'
    };

    try {
      const blob = await documentGenerator(template as DocumentTemplate, dummyData);
      const url = URL.createObjectURL(blob);
      setPreviewPdfUrl(url);
      setIsPreviewing(true);
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Preview generation failed.', type: 'error' } }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PremiumLoader />
      </div>
    );
  }

  const isAdmin = hasCapability(profile, 'settings.manage');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--pm-text)]">Document Templates</h1>
          <p className="text-sm text-[var(--pm-text-secondary)] mt-1">Design organizational templates for invoices, HR letters, and reports.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingTemplate({
                name: '',
                type: 'offer_letter',
                template_body: '',
                header_config: { align: 'left', content: '' },
                footer_config: { align: 'center', content: '' },
                styles: { fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '14px', color: '#333333' },
                is_default: false
              });
              setIsEditing(true);
            }}
            className="btn-premium-primary flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 text-purple-300" />
            New Template
          </button>
        )}
      </div>

      {!isEditing && !isPreviewing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <div key={template.id} className="premium-card rounded-2xl p-5 border border-[var(--border-soft)] hover:border-purple-500/30 transition-all duration-300 relative group flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{template.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 inline-block mt-1">
                        {template.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mb-4 font-mono">
                  Last updated: {new Date(template.updated_at).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border-soft)]">
                <button 
                  onClick={() => handlePreview(template)} 
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-white bg-[var(--surface-glass)] border border-[var(--border-soft)] hover:bg-[var(--surface-hover)] rounded-lg transition-all active:scale-[0.98]"
                >
                  <Eye className="w-3.5 h-3.5 text-purple-400" /> Preview
                </button>
                {isAdmin && (
                  <>
                    <button 
                      onClick={() => { setEditingTemplate(template); setIsEditing(true); }} 
                      className="p-1.5 text-[var(--text-secondary)] hover:text-purple-400 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                      title="Edit Template"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(template.id)} 
                      className="p-1.5 text-[var(--text-secondary)] hover:text-rose-400 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              {template.is_default && (
                <div className="absolute top-4 right-4 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-[var(--pm-surface)]" title="Default Template" />
              )}
            </div>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full py-12 text-center text-[var(--pm-text-secondary)]">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No document templates configured.</p>
              {isAdmin && <p className="text-sm mt-1">Create one to get started.</p>}
            </div>
          )}
        </div>
      ) : isEditing && editingTemplate ? (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] rounded-2xl border border-[var(--border-soft)] flex flex-col md:flex-row overflow-hidden min-h-[700px] backdrop-blur-xl">
          {/* Builder Editor */}
          <div className="flex-1 border-r border-[var(--border-soft)] flex flex-col">
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--surface-glass)]">
              <h2 className="font-semibold flex items-center gap-2 text-white"><Edit2 className="w-4 h-4 text-purple-400"/> Template Builder</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handlePreview(editingTemplate)} 
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-white bg-[var(--surface-glass)] border border-[var(--border-soft)] hover:bg-[var(--surface-hover)] rounded-lg transition-all active:scale-[0.98]"
                >
                  <Eye className="w-4 h-4 text-purple-400" /> Preview
                </button>
                <button 
                  onClick={handleSave} 
                  className="btn-premium-primary flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                >
                  <Save className="w-4 h-4 text-purple-300" /> Save Template
                </button>
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="p-1.5 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-premium">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Template Name</label>
                  <input 
                    type="text" 
                    value={editingTemplate.name || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} 
                    className="input-premium w-full px-3 py-2 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50" 
                    placeholder="e.g. Standard Offer Letter v1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Document Type</label>
                  <div className="relative">
                    <select 
                      value={editingTemplate.type || 'offer_letter'} 
                      onChange={e => setEditingTemplate({...editingTemplate, type: e.target.value as TemplateType})} 
                      className="input-premium select-premium w-full px-3 py-2 bg-neutral-900 border border-[var(--border-soft)] rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="invoice">Invoice</option>
                      <option value="receipt">Receipt</option>
                      <option value="offer_letter">Offer Letter</option>
                      <option value="experience_letter">Experience Letter</option>
                      <option value="salary_slip">Salary Slip</option>
                      <option value="report">Report</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              </div>
 
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Logo URL (Optional)</label>
                  <div className="flex relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ImageIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                    </div>
                    <input 
                      type="text" 
                      value={editingTemplate.logo_url || ''} 
                      onChange={e => setEditingTemplate({...editingTemplate, logo_url: e.target.value})} 
                      className="input-premium w-full pl-9 pr-3 py-2 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50" 
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={editingTemplate.is_default || false} 
                      onChange={e => setEditingTemplate({...editingTemplate, is_default: e.target.checked})} 
                      className="rounded border-[var(--border-soft)] bg-[var(--surface-glass)] text-purple-600 focus:ring-purple-500/50 focus:ring-offset-0 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Set as Default for this type</span>
                  </label>
                </div>
              </div>
 
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Header Configuration (HTML allowed)</label>
                  <textarea 
                    value={editingTemplate.header_config?.content || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, header_config: {...editingTemplate.header_config, content: e.target.value}})} 
                    className="input-premium w-full px-3 py-2 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 font-mono h-16" 
                    placeholder="<h1>Company Title</h1>"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Document Body (HTML allowed, use variables)</label>
                  <textarea 
                    value={editingTemplate.template_body || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, template_body: e.target.value})} 
                    className="input-premium w-full px-3 py-3 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 font-mono min-h-[300px]" 
                    placeholder="Dear {{employee_name}},&#10;&#10;We are pleased to offer you the role..."
                  />
                </div>
 
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Footer Configuration (HTML allowed)</label>
                  <textarea 
                    value={editingTemplate.footer_config?.content || ''} 
                    onChange={e => setEditingTemplate({...editingTemplate, footer_config: {...editingTemplate.footer_config, content: e.target.value}})} 
                    className="input-premium w-full px-3 py-2 bg-[var(--surface-glass)] border border-[var(--border-soft)] rounded-lg text-sm text-white focus:outline-none focus:border-purple-500/50 font-mono h-16" 
                    placeholder="Confidential - {{company_name}}"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Variables Sidebar */}
          <div className="w-full md:w-72 bg-[var(--surface-glass)] flex flex-col border-l border-[var(--border-soft)]">
            <div className="p-4 border-b border-[var(--border-soft)] flex items-center gap-2">
              <Variable className="w-4 h-4 text-purple-400"/>
              <h3 className="font-semibold text-sm text-white">Available Variables</h3>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-6 scrollbar-premium">
              <div>
                <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Common</h4>
                <div className="space-y-3">
                  {AVAILABLE_VARIABLES.common.map(v => (
                    <div key={v.name} className="group cursor-copy" onClick={() => navigator.clipboard.writeText(v.name)}>
                      <div className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-0.5 inline-block mb-1 group-hover:bg-purple-500/20 transition-colors">{v.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{v.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{editingTemplate.type?.replace('_', ' ')} Specific</h4>
                <div className="space-y-3">
                  {AVAILABLE_VARIABLES[editingTemplate.type || 'custom'].map(v => (
                    <div key={v.name} className="group cursor-copy" onClick={() => navigator.clipboard.writeText(v.name)}>
                      <div className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-0.5 inline-block mb-1 group-hover:bg-purple-500/20 transition-colors">{v.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{v.desc}</div>
                    </div>
                  ))}
                  {AVAILABLE_VARIABLES[editingTemplate.type || 'custom'].length === 0 && (
                    <div className="text-xs text-[var(--text-secondary)] italic">No specific variables. You can pass custom data maps.</div>
                  )}
                </div>
              </div>
              <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 backdrop-blur-md">
                <strong>Tip:</strong> Click any variable tag to copy it to clipboard. Use basic HTML like &lt;b&gt; &lt;br/&gt; &lt;table&gt; to format your document body!
              </div>
            </div>
          </div>
        </div>
      ) : isPreviewing ? (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fade-in">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-strong)] w-full max-w-4xl h-full flex flex-col rounded-2xl overflow-hidden border border-[var(--border-soft)] shadow-2xl animate-scale-up">
            <div className="px-4 py-3 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--surface-glass)]">
              <h3 className="font-semibold flex items-center gap-2 text-white"><Eye className="w-4 h-4 text-purple-400"/> PDF Preview Tool</h3>
              <button 
                onClick={() => { setIsPreviewing(false); setPreviewPdfUrl(null); }} 
                className="p-1.5 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="flex-1 bg-neutral-900 relative">
              {previewPdfUrl ? (
                <iframe src={previewPdfUrl} className="w-full h-full border-0" title="PDF Preview"/>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <PremiumLoader />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
