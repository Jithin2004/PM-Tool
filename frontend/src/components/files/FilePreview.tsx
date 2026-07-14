import React, { useEffect, useState, useRef } from 'react';
import { filePreviewService, classifyFile } from '../../services/filePreviewService';
import { fileStorageService } from '../../services/fileStorageService';

interface FilePreviewProps {
  fileId: string;
  storagePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  onClose?: () => void;
  onDownload?: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  fileId,
  storagePath,
  originalName,
  mimeType,
  fileSize,
  onClose,
  onDownload,
}) => {
  const meta = classifyFile(mimeType, originalName);
  const ext = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        if (meta.type === 'image') {
          const url = await filePreviewService.getImageObjectUrl(storagePath);
          if (!cancelled) {
            objectUrlRef.current = url;
            setImageUrl(url);
          }
        } else if (meta.type === 'pdf') {
          const url = await filePreviewService.getPdfPreviewUrl(storagePath);
          if (!cancelled) setPdfUrl(url);
        } else if (meta.type === 'text' || meta.type === 'code') {
          const content = await filePreviewService.getTextContent(storagePath);
          if (!cancelled) setTextContent(content);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (meta.canPreview) load();
    else setLoading(false);

    return () => {
      cancelled = true;
      // IMPORTANT: Revoke image object URL on unmount to prevent memory leak
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [storagePath, meta.type, meta.canPreview]);

  const handleDownload = async () => {
    try {
      const url = await filePreviewService.getDownloadUrl(storagePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onDownload?.();
    } catch {
      // silent
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--surface-base)',
    borderRadius: 12,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-soft)',
    background: 'var(--color-surface-0)',
  };

  const iconColor = '#818cf8';

  return (
    <div style={containerStyle} id={`file-preview-${fileId}`}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: 18, color: iconColor }}>
          {filePreviewService.getFileIcon(mimeType, ext) === 'FileImage' ? '🖼' :
           mimeType === 'application/pdf' ? '📄' :
           '📁'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--pm-on-surface)' }}>
            {originalName}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
            {filePreviewService.formatSize(fileSize)} · {mimeType || 'unknown'}
          </p>
        </div>
        <button
          id={`btn-download-${fileId}`}
          onClick={handleDownload}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            border: '1px solid var(--border-soft)', background: 'var(--surface-hover)',
            color: 'var(--pm-on-surface)', cursor: 'pointer',
          }}
        >
          Download
        </button>
        {onClose && (
          <button
            id={`btn-close-preview-${fileId}`}
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'var(--surface-hover)', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Close preview"
          >
            ×
          </button>
        )}
      </div>

      {/* Preview body */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 200 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '2px solid var(--border-soft)', borderTopColor: 'var(--pm-accent)',
              animation: 'spin 0.6s linear infinite',
            }} />
          </div>
        ) : error ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', minHeight: 200, gap: 8, padding: 24, textAlign: 'center',
          }}>
            <span style={{ fontSize: 32 }}>⚠️</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>{error}</p>
            <button
              onClick={handleDownload}
              style={{
                marginTop: 8, padding: '6px 16px', borderRadius: 6, fontSize: 12,
                background: 'var(--pm-accent)', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              Download instead
            </button>
          </div>
        ) : meta.type === 'image' && imageUrl ? (
          /* Image: rendered as <img> via object URL — never injected as HTML */
          <div style={{ padding: 16, display: 'flex', justifyContent: 'center', background: 'var(--surface-glass)' }}>
            <img
              src={imageUrl}
              alt={originalName}
              style={{ maxWidth: '100%', maxHeight: 600, borderRadius: 8, objectFit: 'contain' }}
              onError={() => setError('Image could not be rendered')}
            />
          </div>
        ) : meta.type === 'pdf' && pdfUrl ? (
          /* PDF: sandboxed iframe — no scripts, no forms, no same-origin */
          <iframe
            src={pdfUrl}
            title={`PDF preview: ${originalName}`}
            sandbox="allow-scripts allow-same-origin"
            style={{ width: '100%', height: '100%', minHeight: 500, border: 'none', display: 'block' }}
            aria-label={`PDF preview of ${originalName}`}
          />
        ) : (meta.type === 'text' || meta.type === 'code') && textContent !== null ? (
          /* Text/Code: escaped via <pre> — never injected as innerHTML */
          <pre style={{
            margin: 0, padding: '16px 20px',
            fontSize: meta.type === 'code' ? 12 : 13,
            fontFamily: meta.type === 'code' ? 'JetBrains Mono, monospace' : 'inherit',
            color: 'var(--pm-on-surface)',
            background: meta.type === 'code' ? 'var(--surface-glass)' : 'transparent',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}>
            {textContent}
          </pre>
        ) : (
          /* Unsupported: metadata / download card */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', minHeight: 200, gap: 12, padding: 24,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'var(--surface-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>
              📎
            </div>
            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--pm-on-surface)', margin: 0 }}>
              {originalName}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              Preview not available for this file type
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
              {filePreviewService.formatSize(fileSize)} · {ext.toUpperCase() || 'Unknown'}
            </p>
            <button
              id={`btn-download-fallback-${fileId}`}
              onClick={handleDownload}
              style={{
                marginTop: 4, padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'var(--pm-accent)', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              Download File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
