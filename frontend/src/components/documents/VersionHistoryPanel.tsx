import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, FileText, History, CheckCircle } from 'lucide-react';
import { DocumentVersion } from '../../services/documentService';
import { getRelativeTime } from '../../utils/timeUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  versions: DocumentVersion[];
  currentVersionId?: string;
  onRestore: (version: DocumentVersion) => void;
}

export function VersionHistoryPanel({ isOpen, onClose, versions, currentVersionId, onRestore }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-[400px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2">
              <div className="flex items-center gap-2 text-[var(--pm-text)] text-[var(--text-primary)] font-medium">
                <History className="w-5 h-5 text-indigo-500" />
                <span>Version History</span>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-surface-3 rounded-md text-[var(--pm-text-secondary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {versions.map((v) => {
                const isCurrent = v.id === currentVersionId;
                return (
                  <div
                    key={v.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      isCurrent
                        ? 'bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-200 dark:border-indigo-500/20'
                        : 'bg-surface-2 border-border hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--pm-text)] text-[var(--text-primary)]">Version {v.version_number}</span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full">
                            Current
                          </span>
                        )}
                        {v.is_locked && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Approved
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--pm-text-secondary)] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getRelativeTime(v.created_at)}
                      </span>
                    </div>

                    <div className="text-sm text-[var(--pm-text-secondary)] mb-3">
                      {v.change_summary || 'No summary provided.'}
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => onRestore(v)}
                        className="w-full py-1.5 text-sm font-medium text-[var(--pm-text)] bg-surface hover:bg-surface-3 border border-border rounded-lg transition-colors"
                      >
                        Restore as new version
                      </button>
                    )}
                  </div>
                );
              })}
              
              {versions.length === 0 && (
                <div className="text-center text-[var(--pm-text-secondary)] py-8">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>No history available.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
