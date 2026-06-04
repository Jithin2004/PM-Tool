import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

type DialogType = 'alert' | 'confirm' | 'prompt';

interface DialogOptions {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
}

interface DialogState extends DialogOptions {
  id: string;
  dialogType: DialogType;
  resolve: (value: any) => void;
}

let addDialogRef: ((dialog: DialogState) => void) | null = null;

export const showAlert = (message: string, options?: Omit<DialogOptions, 'message'>): Promise<void> => {
  return new Promise((resolve) => {
    if (addDialogRef) {
      addDialogRef({ id: Date.now().toString(), dialogType: 'alert', message, ...options, resolve });
    } else {
      console.error('GlobalDialogs is not mounted. Native alert blocked.');
      throw new Error('Native dialog fallback triggered. Ensure GlobalDialogs is mounted.');
    }
  });
};

export const showConfirm = (message: string, options?: Omit<DialogOptions, 'message'>): Promise<boolean> => {
  return new Promise((resolve) => {
    if (addDialogRef) {
      addDialogRef({ id: Date.now().toString(), dialogType: 'confirm', message, ...options, resolve });
    } else {
      console.error('GlobalDialogs is not mounted. Native confirm blocked.');
      throw new Error('Native dialog fallback triggered. Ensure GlobalDialogs is mounted.');
    }
  });
};

export const showPrompt = (message: string, options?: Omit<DialogOptions, 'message'>): Promise<string | null> => {
  return new Promise((resolve) => {
    if (addDialogRef) {
      addDialogRef({ id: Date.now().toString(), dialogType: 'prompt', message, ...options, resolve });
    } else {
      console.error('GlobalDialogs is not mounted. Native prompt blocked.');
      throw new Error('Native dialog fallback triggered. Ensure GlobalDialogs is mounted.');
    }
  });
};

export function GlobalDialogs() {
  const [dialogs, setDialogs] = useState<DialogState[]>([]);

  useEffect(() => {
    addDialogRef = (dialog) => setDialogs((prev) => [...prev, dialog]);
    return () => { addDialogRef = null; };
  }, []);

  if (dialogs.length === 0) return null;

  const handleResolve = (id: string, value: any) => {
    const dialog = dialogs.find(d => d.id === id);
    if (dialog) dialog.resolve(value);
    setDialogs(prev => prev.filter(d => d.id !== id));
  };

  return (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
      {dialogs.map((d, index) => (
        <div key={d.id} className='bg-surface-highest w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in duration-200' style={{ zIndex: 10000 + index }}>
          <div className='p-6 flex flex-col gap-4'>
            <div className='flex items-start gap-4'>
              {d.type === 'error' ? <AlertTriangle className='w-6 h-6 text-rose-500 shrink-0' /> :
               d.type === 'warning' ? <AlertTriangle className='w-6 h-6 text-amber-500 shrink-0' /> :
               d.type === 'success' ? <CheckCircle className='w-6 h-6 text-emerald-500 shrink-0' /> :
               <Info className='w-6 h-6 text-blue-500 shrink-0' />}
              <div className='flex-1'>
                <h3 className='font-semibold text-text-primary mb-1'>{d.title || (d.dialogType === 'confirm' ? 'Confirm Action' : d.dialogType === 'prompt' ? 'Input Required' : 'Notification')}</h3>
                <p className='text-sm text-text-secondary'>{d.message}</p>
              </div>
            </div>
            {d.dialogType === 'prompt' && (
              <input id={'prompt-input-' + d.id} type='text' defaultValue={d.defaultValue} className='w-full bg-surface border border-border rounded-lg p-2.5 text-sm text-text-primary focus:border-accent-primary outline-none mt-2' autoFocus />
            )}
          </div>
          <div className='p-4 bg-surface flex justify-end gap-3 border-t border-border'>
            {d.dialogType !== 'alert' && (
              <button onClick={() => handleResolve(d.id, null)} className='px-4 py-2 hover:bg-surface-highest rounded-lg text-sm font-medium text-text-primary transition-colors'>
                {d.cancelText || 'Cancel'}
              </button>
            )}
            <button onClick={() => {
              if (d.dialogType === 'prompt') {
                const val = (document.getElementById('prompt-input-' + d.id) as HTMLInputElement)?.value || '';
                handleResolve(d.id, val);
              } else {
                handleResolve(d.id, true);
              }
            }} className='px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 rounded-lg text-sm font-medium text-black transition-colors'>
              {d.confirmText || 'OK'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

