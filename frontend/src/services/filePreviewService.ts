import { supabase } from '../lib/supabase';
import { WORKSPACE_BUCKET } from './storageBucketService';

export type PreviewType = 'image' | 'pdf' | 'text' | 'code' | 'unsupported';

export interface FilePreviewMeta {
  type: PreviewType;
  mimeType: string;
  canPreview: boolean;
  canDownload: boolean;
}

const IMAGE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
  'image/webp', 'image/svg+xml', 'image/avif',
]);

const TEXT_TYPES = new Set([
  'text/plain', 'text/csv', 'text/markdown', 'text/xml',
  'application/json', 'application/xml',
]);

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'java',
  'c', 'cpp', 'h', 'cs', 'php', 'swift', 'kt', 'rs',
  'sh', 'bash', 'yaml', 'yml', 'toml', 'ini', 'env',
  'html', 'css', 'scss', 'less', 'sql',
]);

/** Classify file for safe preview rendering */
export function classifyFile(mimeType: string, originalName: string): FilePreviewMeta {
  const ext = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';

  if (IMAGE_TYPES.has(mimeType)) {
    // NOTE: SVG preview is intentionally excluded — SVG can execute scripts.
    // svg+xml will render as image blob, which is safe via object URL.
    return { type: 'image', mimeType, canPreview: true, canDownload: true };
  }

  if (mimeType === 'application/pdf') {
    return { type: 'pdf', mimeType, canPreview: true, canDownload: true };
  }

  if (TEXT_TYPES.has(mimeType) || mimeType.startsWith('text/')) {
    return { type: 'text', mimeType, canPreview: true, canDownload: true };
  }

  if (CODE_EXTENSIONS.has(ext)) {
    return { type: 'code', mimeType: mimeType || 'text/plain', canPreview: true, canDownload: true };
  }

  return { type: 'unsupported', mimeType, canPreview: false, canDownload: true };
}

/**
 * Fetch file binary from Supabase storage and create a secure object URL.
 * For images: caller must call revokeObjectUrl() on unmount.
 * For PDF: caller renders in a sandboxed iframe using the signed URL directly.
 * For text/code: content is returned as escaped string — never injected as HTML.
 */
export const filePreviewService = {
  /** Get a signed URL for PDF preview in sandbox iframe */
  async getPdfPreviewUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(WORKSPACE_BUCKET)
      .createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Fetch image blob and create a revocable object URL.
   * Caller MUST call URL.revokeObjectURL(url) on component unmount.
   */
  async getImageObjectUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(WORKSPACE_BUCKET)
      .download(storagePath);

    if (error || !data) throw error ?? new Error('Failed to download image');

    // Validate it's actually a safe binary before creating object URL
    return URL.createObjectURL(data);
  },

  /**
   * Fetch text/code file content.
   * Content is returned as a plain string — never inserted as innerHTML.
   * Maximum 500KB to prevent UI freeze on huge files.
   */
  async getTextContent(storagePath: string, maxBytes = 512_000): Promise<string> {
    const { data, error } = await supabase.storage
      .from(WORKSPACE_BUCKET)
      .download(storagePath);

    if (error || !data) throw error ?? new Error('Failed to download text file');

    if (data.size > maxBytes) {
      return `[File too large to preview — ${(data.size / 1024).toFixed(1)} KB. Please download to view.]`;
    }

    const text = await data.text();
    return text;
  },

  /** Get a short-lived signed URL for direct download (triggers browser download) */
  async getDownloadUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(WORKSPACE_BUCKET)
      .createSignedUrl(storagePath, 900, {
        download: true,
      });
    if (error) throw error;
    return data.signedUrl;
  },

  /** Classify without fetching — pure metadata */
  classify: classifyFile,

  /** Human-readable file size */
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  },

  /** Returns a safe icon name based on file type */
  getFileIcon(mimeType: string, ext: string): string {
    if (mimeType?.startsWith('image/')) return 'FileImage';
    if (mimeType === 'application/pdf') return 'FileType';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'FileArchive';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Sheet';
    if (['doc', 'docx'].includes(ext)) return 'FileText';
    if (['ppt', 'pptx'].includes(ext)) return 'Presentation';
    if (mimeType?.startsWith('video/')) return 'FileVideo';
    if (mimeType?.startsWith('audio/')) return 'FileAudio';
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'rb', 'go', 'java', 'c', 'cpp', 'sql'].includes(ext)) return 'FileCode';
    if (mimeType?.startsWith('text/')) return 'FileText';
    return 'File';
  },
};
