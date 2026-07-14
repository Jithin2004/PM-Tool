import React, { useState, useCallback, useRef } from 'react';
import { fileStorageService } from '../../services/fileStorageService';
import { filePreviewService } from '../../services/filePreviewService';

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  errorMsg?: string;
  result?: any;
}

interface FileUploaderProps {
  workspaceId: string;
  entityType?: string;
  entityId?: string;
  onUploaded?: (file: any) => void;
  maxFileSizeMb?: number;
  allowedTypes?: string[]; // MIME types
  compact?: boolean;
}

const BLOCKED_MIME = new Set([
  'text/html', 'application/javascript', 'application/x-javascript',
  'image/svg+xml', // SVG can embed scripts
  'application/x-sh', 'application/x-bash',
  'application/x-msdownload', 'application/x-exe',
]);

export const FileUploader: React.FC<FileUploaderProps> = ({
  workspaceId,
  entityType = 'workspace',
  entityId,
  onUploaded,
  maxFileSizeMb = 50,
  allowedTypes,
  compact = false,
}) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedEntityId = entityId ?? workspaceId;

  const validateFile = (file: File): string | null => {
    if (BLOCKED_MIME.has(file.type)) {
      return `File type "${file.type}" is not allowed for security reasons.`;
    }
    if (file.size > maxFileSizeMb * 1024 * 1024) {
      return `File exceeds the ${maxFileSizeMb} MB size limit.`;
    }
    if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return `Only the following types are accepted: ${allowedTypes.join(', ')}.`;
    }
    return null;
  };

  const enqueueFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: UploadItem[] = fileArray.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      status: 'pending',
      progress: 0,
    }));

    setItems(prev => [...prev, ...newItems]);

    for (const item of newItems) {
      const error = validateFile(item.file);
      if (error) {
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error', errorMsg: error } : i
        ));
        continue;
      }

      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, status: 'uploading', progress: 10 } : i
      ));

      try {
        const result = await fileStorageService.uploadFile(
          item.file, workspaceId, entityType, resolvedEntityId
        );

        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'done', progress: 100, result } : i
        ));

        if (result && onUploaded) onUploaded(result);
      } catch (err: any) {
        const msg = err?.message || 'Upload failed';
        if (msg.includes('quota')) setQuotaWarning(true);
        setItems(prev => prev.map(i =>
          i.id === item.id ? { ...i, status: 'error', errorMsg: msg } : i
        ));
      }
    }
  }, [workspaceId, entityType, resolvedEntityId, onUploaded, maxFileSizeMb]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) enqueueFiles(e.dataTransfer.files);
  }, [enqueueFiles]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const clearDone = () => setItems(prev => prev.filter(i => i.status !== 'done'));

  const statusIcon = (status: UploadItem['status']) => {
    if (status === 'done') return <span style={{ color: 'var(--pm-success)' }}>✓</span>;
    if (status === 'error') return <span style={{ color: 'var(--pm-error)' }}>✕</span>;
    if (status === 'uploading') return (
      <span className="spinner" style={{
        display: 'inline-block', width: 12, height: 12, border: '2px solid var(--border-soft)',
        borderTopColor: 'var(--pm-accent)', borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }} />
    );
    return <span style={{ color: 'var(--text-tertiary)' }}>○</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--pm-accent)' : 'var(--border-soft)'}`,
          borderRadius: 12,
          background: isDragging ? 'var(--surface-hover)' : 'var(--color-surface-1)',
          padding: compact ? '16px' : '32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      >
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.6 }}>⬆</div>
        {compact ? (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            Drop files or <span style={{ color: 'var(--pm-accent)' }}>browse</span>
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--pm-on-surface)', margin: 0 }}>
              Drop files here or <span style={{ color: 'var(--pm-accent)' }}>browse</span>
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Max {maxFileSizeMb} MB per file • HTML, JS, EXE blocked
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          accept={allowedTypes?.join(',') || '*/*'}
          onChange={e => e.target.files && enqueueFiles(e.target.files)}
          id="file-uploader-input"
        />
      </div>

      {/* Quota Warning */}
      {quotaWarning && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          fontSize: 12,
          color: '#f87171',
        }}>
          ⚠ Storage quota exceeded. Please archive old files or contact your admin.
        </div>
      )}

      {/* Upload Queue */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Upload Queue
            </span>
            {items.some(i => i.status === 'done') && (
              <button
                onClick={clearDone}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-tertiary)',
                }}
              >
                Clear done
              </button>
            )}
          </div>

          {items.map(item => (
            <div key={item.id} style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--surface-glass)',
              border: '1px solid var(--border-soft)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {statusIcon(item.status)}
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.file.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {filePreviewService.formatSize(item.file.size)}
                </span>
              </div>

              {item.status === 'uploading' && (
                <div style={{ height: 2, background: 'var(--border-soft)', borderRadius: 99 }}>
                  <div style={{
                    height: 2, background: 'var(--pm-accent)', borderRadius: 99,
                    width: `${item.progress}%`, transition: 'width 0.3s',
                  }} />
                </div>
              )}

              {item.status === 'error' && (
                <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{item.errorMsg}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
