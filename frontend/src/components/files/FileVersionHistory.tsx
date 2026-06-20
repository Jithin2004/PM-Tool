import React, { useEffect, useState } from 'react';
import { fileStorageService, type FileVersionRecord } from '../../services/fileStorageService';
import { filePreviewService } from '../../services/filePreviewService';

interface FileVersionHistoryProps {
  fileId: string;
  workspaceId: string;
  currentVersionId?: string | null;
  originalName: string;
  canRestore?: boolean;
  onRestored?: () => void;
}

export const FileVersionHistory: React.FC<FileVersionHistoryProps> = ({
  fileId,
  workspaceId,
  currentVersionId,
  originalName,
  canRestore = false,
  onRestored,
}) => {
  const [versions, setVersions] = useState<FileVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fileStorageService.getFileVersions(fileId)
      .then(v => setVersions(v))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fileId]);

  const handleRestore = async (version: FileVersionRecord) => {
    if (!canRestore) return;
    setRestoringId(version.id);
    try {
      const ok = await fileStorageService.restoreVersion(fileId, version.id, workspaceId);
      if (ok) {
        setToastMsg(`Restored v${version.version_number} as new latest version`);
        // Refresh version list
        const updated = await fileStorageService.getFileVersions(fileId);
        setVersions(updated);
        onRestored?.();
        setTimeout(() => setToastMsg(null), 3000);
      }
    } catch (err: any) {
      setToastMsg(`Restore failed: ${err?.message}`);
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{
          width: 20, height: 20, margin: '0 auto',
          borderRadius: '50%', border: '2px solid var(--border-soft)',
          borderTopColor: 'var(--pm-accent)', animation: 'spin 0.6s linear infinite',
        }} />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
        No versions recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 12,
          background: toastMsg.startsWith('Restore failed')
            ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
          border: `1px solid ${toastMsg.startsWith('Restore failed')
            ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          color: toastMsg.startsWith('Restore failed') ? '#f87171' : '#4ade80',
        }}>
          {toastMsg}
        </div>
      )}

      {/* Timeline */}
      {versions.map((v, idx) => {
        const isCurrent = v.id === currentVersionId;
        const isFirst = idx === 0;
        const isRestoring = restoringId === v.id;

        return (
          <div
            key={v.id}
            id={`version-row-${v.id}`}
            style={{
              display: 'flex',
              gap: 12,
              paddingBottom: idx < versions.length - 1 ? 0 : 0,
            }}
          >
            {/* Timeline line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: isCurrent ? 'var(--pm-accent)' : 'var(--border-soft)',
                border: `2px solid ${isCurrent ? 'var(--pm-accent)' : 'var(--text-tertiary)'}`,
                marginTop: 4,
                boxShadow: isCurrent ? '0 0 8px rgba(99,102,241,0.4)' : 'none',
              }} />
              {idx < versions.length - 1 && (
                <div style={{
                  width: 1, flex: 1, minHeight: 32,
                  background: 'var(--border-soft)',
                  marginTop: 2,
                }} />
              )}
            </div>

            {/* Version info */}
            <div style={{
              flex: 1, paddingBottom: 16,
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 4,
              background: isCurrent ? 'rgba(99,102,241,0.06)' : 'var(--surface-glass)',
              border: `1px solid ${isCurrent ? 'rgba(99,102,241,0.2)' : 'var(--border-soft)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: isCurrent ? 'var(--pm-accent)' : 'var(--text-secondary)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  v{v.version_number}
                </span>
                {isCurrent && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--pm-accent)',
                    padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}>
                    Current
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {filePreviewService.formatSize(v.size)}
                </span>
              </div>

              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                {formatDate(v.created_at)}
              </div>

              {/* Restore button — only shows on non-current versions */}
              {canRestore && !isCurrent && (
                <div style={{ marginTop: 8 }}>
                  <button
                    id={`btn-restore-v${v.version_number}-${v.id.slice(0, 6)}`}
                    onClick={() => handleRestore(v)}
                    disabled={isRestoring || !!restoringId}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      border: '1px solid var(--border-soft)',
                      background: isRestoring ? 'var(--surface-base)' : 'var(--surface-hover)',
                      color: isRestoring ? 'var(--text-tertiary)' : 'var(--pm-on-surface)',
                      cursor: isRestoring ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isRestoring ? 'Restoring…' : `Restore v${v.version_number}`}
                  </button>
                  <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
                    Creates a new version
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
