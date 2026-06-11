import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { activityLogService } from '../../services/activityLogService';
import { X, Upload, Check, AlertCircle } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface EmployeeImportModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EmployeeImportModal({ workspaceId, isOpen, onClose, onSuccess }: EmployeeImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationStats, setValidationStats] = useState({ total: 0, valid: 0, errors: 0 });
  const [isImporting, setIsImporting] = useState(false);

  useEscapeKey(isOpen, onClose);

  // Early return must be after ALL hooks are defined (Rules of Hooks)
  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const headers = "Name,Email,Employee Type,Date Of Joining,Salary,Currency\n";
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ? values[i].trim() : '';
      });
      return obj;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      const text = await selectedFile.text();
      const data = parseCSV(text);
      
      let validCount = 0;
      let errorCount = 0;
      const emailSet = new Set();
      
      const validatedData = data.map(row => {
        const errors = [];
        const email = row['email'];
        const name = row['name'];
        const doj = row['date of joining'];
        const type = row['employee type'];
        const salary = row['salary'];

        if (!name) errors.push('Name is required');
        if (!email) errors.push('Email is required');
        if (!type) errors.push('Employee Type is required');
        if (!doj) errors.push('Date Of Joining is required');

        if (email && emailSet.has(email)) {
          errors.push('Duplicate Email in CSV');
        } else if (email) {
          emailSet.add(email);
        }

        if (doj && isNaN(Date.parse(doj))) {
          errors.push('Invalid Date Of Joining');
        }

        if (salary && isNaN(Number(salary))) {
          errors.push('Invalid Salary format');
        }

        if (errors.length === 0) validCount++;
        else errorCount++;

        return { ...row, errors, isValid: errors.length === 0 };
      });

      setPreviewData(validatedData);
      setValidationStats({ total: validatedData.length, valid: validCount, errors: errorCount });
      setStep('preview');
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const validRows = previewData.filter(r => r.isValid);
      
      const { data: userResp } = await supabase.auth.getUser();
      
      const { data: batchData } = await supabase.from('import_batches').insert({
        workspace_id: workspaceId,
        uploaded_by: userResp.user?.id,
        total_rows: previewData.length,
        success_count: validRows.length,
        failed_count: previewData.length - validRows.length,
        failure_details: previewData.filter(r => !r.isValid).map(r => ({ email: r.email, name: r.name, errors: r.errors }))
      }).select().single();
      
      await activityLogService.appendLog({
        workspace_id: workspaceId,
        action: 'employee_import_executed',
        metadata: { batch_id: batchData?.id, imported_count: validRows.length, total_attempted: previewData.length }
      });

      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay-premium p-4">
      <div className="modal-premium p-8 rounded-2xl shadow-2xl max-w-2xl w-full border border-[var(--border-soft)] text-white flex flex-col relative overflow-hidden">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary">Import Employees</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {step === 'upload' && (
          <div className="space-y-6">
            <p className="text-sm text-text-secondary leading-relaxed">
              Download the template, fill it out, and upload it here to invite multiple team members.
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="btn-premium-secondary w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            >
              Download Template
            </button>
            <div className="border-2 border-dashed border-accent-primary/30 bg-accent-primary/5 rounded-xl p-10 text-center transition-colors hover:bg-accent-primary/10 flex flex-col items-center justify-center">
              <Upload className="w-8 h-8 mb-4 text-accent-primary" />
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer text-sm font-medium text-accent-primary hover:text-accent-secondary transition-colors">
                Click to browse CSV file
              </label>
              <p className="text-xs text-text-tertiary mt-2">Only .csv files are supported</p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex gap-4 p-4 bg-[var(--pm-surface-lowest)]/30 rounded-xl border border-[var(--border-soft)] shadow-inner">
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-text-primary">{validationStats.total}</div>
                <div className="text-[9px] uppercase tracking-wider text-text-tertiary font-mono mt-0.5">Total Rows</div>
              </div>
              <div className="w-px bg-[var(--surface-glass)]"></div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-emerald-400">{validationStats.valid}</div>
                <div className="text-[9px] uppercase tracking-wider text-text-tertiary font-mono mt-0.5">Valid</div>
              </div>
              <div className="w-px bg-[var(--surface-glass)]"></div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-rose-400">{validationStats.errors}</div>
                <div className="text-[9px] uppercase tracking-wider text-text-tertiary font-mono mt-0.5">Errors</div>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-xl border border-[var(--border-soft)] bg-[var(--pm-surface-lowest)]/20 scrollbar-premium">
              <table className="w-full text-left text-sm table-premium">
                <thead className="bg-[var(--pm-surface-lowest)]/50 sticky top-0 border-b border-[var(--border-soft)]">
                  <tr>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase font-mono">Name</th>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase font-mono">Email</th>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase font-mono">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {previewData.map((row, i) => (
                    <tr key={i} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-2 text-text-primary">{row['name'] || '-'}</td>
                      <td className="px-4 py-2 text-text-secondary">{row['email'] || '-'}</td>
                      <td className="px-4 py-2">
                        {row.isValid ? (
                          <span className="text-emerald-400 text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Valid</span>
                        ) : (
                          <span className="text-rose-400 text-xs cursor-help flex items-center gap-1" title={row.errors.join(', ')}>
                            <AlertCircle className="w-3.5 h-3.5 inline" />
                            {row.errors[0]} {row.errors.length > 1 && `(+${row.errors.length - 1})`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-[var(--border-soft)]">
              <button 
                onClick={() => setStep('upload')} 
                className="btn-premium-secondary px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                disabled={isImporting}
              >
                Back
              </button>
              <button 
                onClick={handleImport} 
                disabled={validationStats.valid === 0 || isImporting}
                className="btn-premium-primary px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : `Import ${validationStats.valid} Employees`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
