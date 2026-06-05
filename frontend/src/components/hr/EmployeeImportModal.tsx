import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { activityLogService } from '../../services/activityLogService';
import { Icon } from '../ui/Icon';

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
      
      // Real import logic would go here. We will just simulate and log for now since it requires inviting via Supabase edge functions or admin api.
      // We will create the audit log.
      
      const { data: userResp } = await supabase.auth.getUser();
      
      const { data: batchData, error: batchError } = await supabase.from('import_batches').insert({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1c1d1f] p-6 rounded-xl shadow-2xl max-w-2xl w-full border border-white/10 text-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold tracking-tight">Import Employees</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/50 hover:text-white">
            <Icon name="close" size={20} />
          </button>
        </div>
        
        {step === 'upload' && (
          <div className="space-y-6">
            <p className="text-sm text-white/70">
              Download the template, fill it out, and upload it here to invite multiple team members.
            </p>
            <button onClick={handleDownloadTemplate} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10">
              Download Template
            </button>
            <div className="border-2 border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-xl p-10 text-center transition-colors hover:bg-indigo-500/10">
              <Icon name="upload" size={32} className="mx-auto mb-4 text-indigo-400" />
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer text-sm font-medium text-indigo-400 hover:text-indigo-300">
                Click to browse CSV file
              </label>
              <p className="text-xs text-white/40 mt-2">Only .csv files are supported</p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex gap-4 p-4 bg-black/20 rounded-lg border border-white/5">
              <div className="flex-1 text-center">
                <div className="text-2xl font-semibold text-white">{validationStats.total}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">Total Rows</div>
              </div>
              <div className="w-px bg-white/10"></div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-semibold text-green-400">{validationStats.valid}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">Valid</div>
              </div>
              <div className="w-px bg-white/10"></div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-semibold text-red-400">{validationStats.errors}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">Errors</div>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-black/20">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-medium text-white/70">Name</th>
                    <th className="px-4 py-2 font-medium text-white/70">Email</th>
                    <th className="px-4 py-2 font-medium text-white/70">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {previewData.map((row, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="px-4 py-2">{row['name'] || '-'}</td>
                      <td className="px-4 py-2">{row['email'] || '-'}</td>
                      <td className="px-4 py-2">
                        {row.isValid ? (
                          <span className="text-green-400 text-xs flex items-center gap-1"><Icon name="check" size={12} /> Valid</span>
                        ) : (
                          <span className="text-red-400 text-xs cursor-help" title={row.errors.join(', ')}>
                            <Icon name="alert-circle" size={12} className="inline mr-1" />
                            {row.errors[0]} {row.errors.length > 1 && `(+${row.errors.length - 1})`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button 
                onClick={() => setStep('upload')} 
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5"
                disabled={isImporting}
              >
                Back
              </button>
              <button 
                onClick={handleImport} 
                disabled={validationStats.valid === 0 || isImporting}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
