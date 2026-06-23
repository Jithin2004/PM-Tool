import { hasCapability } from '../../core/auth/permissions';
import React, { useEffect, useState, useCallback } from 'react';
import { fileStorageService, type FileRecord } from '../../services/fileStorageService';
import { filePreviewService } from '../../services/filePreviewService';
import { filePermissionService } from '../../services/filePermissionService';
import { FileUploader } from './FileUploader';
import { FilePreview } from './FilePreview';
import { FileVersionHistory } from './FileVersionHistory';
import { useAuth } from '../../context/AuthContext';

export type EntityType = 'task' | 'project' | 'document' | 'comment' | 'approval';

interface EntityAttachmentsProps {
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  readOnly?: boolean;
  compact?: boolean;
}

interface FileRow extends FileRecord {
  _versionCount?: number;
}

type Panel = 'preview' | 'versions' | null;

export const EntityAttachments: React.FC<EntityAttachmentsProps> = ({
  workspaceId,
  entityType,
  entityId,
  readOnly = false,
  compact = false,
}) => {
  const { profile } = useAuth();
  const role = profile?.role || 'member';

  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FileRow | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [showUploader, setShowUploader] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fileStorageService.getEntityFiles(workspaceId, entityType, entityId);
      setFiles(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [workspaceId, entityType, entityId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUploaded = (_file: FileRecord) => {
    loadFiles();
    setShowUploader(false);
  };

  const handleArchive = async (file: FileRow) => {
    const ok = await fileStorageService.archiveFile(file.id, workspaceId);
    if (ok) loadFiles();
  };

  const openPanel = (file: FileRow, panel: Panel) => {
    setSelected(file);
    setActivePanel(panel);
  };

  const closePanel = () => {
    setSelected(null);
    setActivePanel(null);
  };

  const getExt = (name: string) => name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';

  if (loading) {
    return (
      <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid var(--border-soft)', borderTopColor: 'var(--pm-accent)',
          animation: 'spin 0.6s linear infinite',
        }} />
        Loading attachments…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>
          Attachments ({files.length})
        </span>
        {!readOnly && (
          <button
            id={`btn-attach-${entityType}-${entityId}`}
            onClick={() => setShowUploader(v => !v)}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              border: '1px solid var(--border-soft)', background: 'var(--surface-hover)',
              color: 'var(--pm-on-surface)', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {showUploader ? 'Cancel' : '+ Attach'}
          </button>
        )}
      </div>

      {/* Inline uploader */}
      {showUploader && (
        <div style={{
          padding: 12, borderRadius: 8,
          border: '1px solid var(--border-soft)',
          background: 'var(--surface-glass)',
        }}>
          <FileUploader
            workspaceId={workspaceId}
            entityType={entityType}
            entityId={entityId}
            onUploaded={handleUploaded}
            compact
          />
        </div>
      )}

      {/* File list */}
      {files.length === 0 ? (
        !showUploader && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, padding: '4px 0' }}>
            No attachments yet.
          </p>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map(file => {
            const ext = getExt(file.original_name);
            const meta = filePreviewService.classify(file.mime_type || '', file.original_name);
            const isSelected = selected?.id === file.id;

            return (
              <div key={file.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  id={`attachment-${file.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8,
                    border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : 'var(--border-soft)'}`,
                    background: isSelected ? 'rgba(99,102,241,0.06)' : 'var(--surface-glass)',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                  }}
                  onClick={() => meta.canPreview ? openPanel(file, 'preview') : undefined}
                >
                  {/* Icon */}
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
                    {file.mime_type?.startsWith('image/') ? '🖼' :
                     file.mime_type === 'application/pdf' ? '📄' :
                     ['xls', 'xlsx', 'csv'].includes(ext) ? '📊' :
                     ['doc', 'docx'].includes(ext) ? '📝' :
                     ['zip', 'rar', '7z'].includes(ext) ? '🗜' : '📎'}
                  </span>

                  {/* Name + size */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 12, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'var(--pm-on-surface)',
                    }}>
                      {file.original_name}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {filePreviewService.formatSize(file.file_size)}
                      {ext && ` · ${ext.toUpperCase()}`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {meta.canPreview && (
                      <button
                        id={`btn-preview-${file.id}`}
                        title="Preview"
                        onClick={() => openPanel(file, 'preview')}
                        style={actionBtnStyle}
                      >
                        👁
                      </button>
                    )}
                    <button
                      id={`btn-versions-${file.id}`}
                      title="Version history"
                      onClick={() => openPanel(file, 'versions')}
                      style={actionBtnStyle}
                    >
                      🕓
                    </button>
                    {!readOnly && (
                      <button
                        id={`btn-archive-${file.id}`}
                        title="Archive file"
                        onClick={() => handleArchive(file)}
                        style={{ ...actionBtnStyle, color: 'rgba(239,68,68,0.7)' }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline preview/version panel */}
                {isSelected && activePanel && (
                  <div style={{
                    marginTop: 4, borderRadius: 10,
                    border: '1px solid rgba(99,102,241,0.2)',
                    background: 'var(--surface-base)',
                    overflow: 'hidden',
                    maxHeight: activePanel === 'preview' ? 460 : 380,
                    overflowY: 'auto',
                  }}>
                    {activePanel === 'preview' ? (
                      <FilePreview
                        fileId={file.id}
                        storagePath={file.storage_path}
                        originalName={file.original_name}
                        mimeType={file.mime_type || ''}
                        fileSize={file.file_size}
                        onClose={closePanel}
                      />
                    ) : (
                      <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-on-surface)' }}>
                            Version History — {file.original_name}
                          </span>
                          <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-tertiary)' }}>×</button>
                        </div>
                        <FileVersionHistory
                          fileId={file.id}
                          workspaceId={workspaceId}
                          currentVersionId={file.current_version_id}
                          originalName={file.original_name}
                          canRestore={!readOnly && hasCapability(role as any, 'document.manage')}
                          onRestored={loadFiles}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const actionBtnStyle: React.CSSProperties = {
  padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border-soft)',
  background: 'var(--surface-hover)', cursor: 'pointer', fontSize: 12,
  lineHeight: 1, transition: 'all 0.15s',
};



