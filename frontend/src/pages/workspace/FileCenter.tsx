import React, { useEffect, useState, useCallback } from 'react';
import { fileStorageService, type FileRecord } from '../../services/fileStorageService';
import { filePreviewService } from '../../services/filePreviewService';
import { FileUploader } from '../../components/files/FileUploader';
import { FilePreview } from '../../components/files/FilePreview';
import { FileVersionHistory } from '../../components/files/FileVersionHistory';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { issueReportService } from '../../services/issueReportService';
import { AlertCircle, RefreshCw, Flag } from 'lucide-react';
import { showAlert } from '../../components/common/Dialogs';
import { hasCapability } from '../../core/auth/permissions';

type ViewTab = 'all' | 'recent' | 'mine' | 'shared' | 'archived';
type SortKey = 'name' | 'size' | 'created_at';

const TABS: { id: ViewTab; label: string }[] = [
  { id: 'all', label: 'All Files' },
  { id: 'recent', label: 'Recent' },
  { id: 'mine', label: 'My Uploads' },
  { id: 'shared', label: 'Shared With Me' },
  { id: 'archived', label: 'Archived' },
];

const FileCenterPage: React.FC = () => {
  const { workspace } = useWorkspace();
  const { user, profile } = useAuth();
  const workspaceId = workspace?.id || '';
  const userId = user?.id || '';
  const role = profile?.role || 'member';

  // State
  const [tab, setTab] = useState<ViewTab>('all');
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [activePanel, setActivePanel] = useState<'preview' | 'versions' | 'info' | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{ used_bytes: number; quota_bytes: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      let data: FileRecord[] = [];
      switch (tab) {
        case 'all':
          data = await fileStorageService.getWorkspaceFiles(workspaceId, false);
          break;
        case 'recent':
          data = (await fileStorageService.getWorkspaceFiles(workspaceId, false))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 50);
          break;
        case 'mine':
          data = await fileStorageService.getUserFiles(workspaceId, userId);
          break;
        case 'shared':
          data = await fileStorageService.getSharedWithMe(workspaceId, userId);
          break;
        case 'archived':
          data = (await fileStorageService.getWorkspaceFiles(workspaceId, true))
            .filter(f => false); // Archiving disabled in v1.3
          break;
      }
      setFiles(data);
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setFiles([]);
      setErrorMsg(err?.message || 'Failed to load files from storage server. Connection interrupted.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userId, tab]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  useEffect(() => {
    if (!workspaceId) return;
    fileStorageService.getStorageUsage(workspaceId).then(u => {
      if (u) setStorageUsage({ used_bytes: Number(u.used_bytes), quota_bytes: Number(u.quota_bytes) });
    }).catch(() => {});
  }, [workspaceId, files.length]);

  // Filter + sort pipeline
  const displayFiles = files
    .filter(f => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!f.original_name.toLowerCase().includes(q)) return false;
      }
      if (filterType) {
        const mt = f.mime_type || '';
        if (filterType === 'image' && !mt.startsWith('image/')) return false;
        if (filterType === 'pdf' && mt !== 'application/pdf') return false;
        if (filterType === 'text' && !mt.startsWith('text/')) return false;
        if (filterType === 'archive') {
          const ext = (f.original_name.split('.').pop() || '').toLowerCase();
          if (!['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'name') return a.original_name.localeCompare(b.original_name);
      if (sortKey === 'size') return b.file_size - a.file_size;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const getExt = (name: string) => name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  const quotaPct = storageUsage ? Math.round((storageUsage.used_bytes / storageUsage.quota_bytes) * 100) : 0;

  const handleArchive = async (file: FileRecord) => {
    await fileStorageService.archiveFile(file.id, workspaceId);
    if (selectedFile?.id === file.id) { setSelectedFile(null); setActivePanel(null); }
    loadFiles();
  };

  const handleUnarchive = async (file: FileRecord) => {
    await fileStorageService.unarchiveFile(file.id, workspaceId);
    loadFiles();
  };

  const handleUploaded = () => {
    setShowUploader(false);
    loadFiles();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const canManageFiles = hasCapability(profile, 'file.manage');

  const handleReportIssue = async () => {
    setIsReporting(true);
    try {
      await issueReportService.createIssueReport({ workspaceId: workspaceId, userId: userId || 'system', module: 'File Center', severity: 'high', title: 'File Center Error', description: errorMsg || 'Unknown upload/network failure', browserMetadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        } });
      await showAlert("Issue reported successfully to the workspace admin.", { type: "success" });
      setErrorMsg(null);
    } catch (err: any) {
      await showAlert(err.message || "Failed to report issue", { type: "error" });
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div style={{
      display: 'flex', height: '100%', minHeight: 0,
      background: 'var(--surface-base)',
      fontFamily: 'Inter, Geist, system-ui, sans-serif',
    }}>
      {/* Main panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minWidth: 0,
      }}>
        {/* Top header */}
        <div style={{
          padding: '20px 24px 0',
          borderBottom: '1px solid var(--border-soft)',
          background: 'var(--color-surface-0)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--pm-on-surface)' }}>
                File Center
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                Cloud Storage for Binary Assets (PDFs, Images, Archives)
              </p>
              {storageUsage && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {filePreviewService.formatSize(storageUsage.used_bytes)} used of {filePreviewService.formatSize(storageUsage.quota_bytes)}
                  {' '}({quotaPct}%)
                </p>
              )}
            </div>
            <button
              id="btn-upload-new-file"
              onClick={() => setShowUploader(v => !v)}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: showUploader ? 'var(--surface-hover)' : 'var(--pm-accent)',
                color: '#fff', border: 'none', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {showUploader ? '✕ Cancel' : '+ Upload'}
            </button>
          </div>

          {/* Storage bar */}
          {storageUsage && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ height: 3, borderRadius: 99, background: 'var(--border-soft)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${Math.min(quotaPct, 100)}%`,
                  background: quotaPct > 85 ? 'var(--pm-error, #ef4444)' : quotaPct > 60 ? '#f59e0b' : 'var(--pm-accent)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                id={`tab-files-${t.id}`}
                onClick={() => { setTab(t.id); setSelectedFile(null); setActivePanel(null); }}
                style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 500,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: tab === t.id ? 'var(--pm-accent)' : 'var(--text-secondary)',
                  borderBottom: `2px solid ${tab === t.id ? 'var(--pm-accent)' : 'transparent'}`,
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload area */}
        {showUploader && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-glass)' }}>
            <FileUploader
              workspaceId={workspaceId}
              entityType="workspace"
              entityId={workspaceId}
              onUploaded={handleUploaded}
            />
          </div>
        )}

        {/* Toolbar */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-soft)',
          flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: 'var(--text-tertiary)', pointerEvents: 'none',
            }}>🔍</span>
            <input
              id="file-center-search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files…"
              style={{
                width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                borderRadius: 8, border: '1px solid var(--border-soft)',
                background: 'var(--surface-glass)', color: 'var(--pm-on-surface)',
                fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Type filter */}
          <select
            id="file-center-filter-type"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--border-soft)', background: 'var(--surface-glass)',
              color: 'var(--pm-on-surface)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">All Types</option>
            <option value="image">Images</option>
            <option value="pdf">PDFs</option>
            <option value="text">Text</option>
            <option value="archive">Archives</option>
          </select>

          {/* Sort */}
          <select
            id="file-center-sort"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 12,
              border: '1px solid var(--border-soft)', background: 'var(--surface-glass)',
              color: 'var(--pm-on-surface)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="created_at">Newest First</option>
            <option value="name">Name A–Z</option>
            <option value="size">Largest First</option>
          </select>

          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
            {displayFiles.length} file{displayFiles.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="m-6 p-5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-rose-500">Storage Connection Error</h3>
                <p className="text-xs text-rose-400 mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={loadFiles} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--surface-hover)] border border-[var(--border-soft)] hover:bg-[var(--surface-active)] text-[var(--pm-text-secondary)] hover:text-white rounded-lg text-xs font-semibold transition-all w-full sm:w-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
              <button 
                onClick={handleReportIssue} 
                disabled={isReporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-400 hover:text-rose-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 w-full sm:w-auto"
              >
                <Flag className="w-3.5 h-3.5" /> {isReporting ? 'Reporting...' : 'Report Issue'}
              </button>
            </div>
          </div>
        )}

        {/* File list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 0' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                border: '2px solid var(--border-soft)', borderTopColor: 'var(--pm-accent)',
                animation: 'spin 0.6s linear infinite',
              }} />
            </div>
          ) : displayFiles.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: 200, gap: 8, color: 'var(--text-tertiary)',
            }}>
              <span style={{ fontSize: 36 }}>📁</span>
              <p style={{ fontSize: 13, margin: 0 }}>
                {searchQuery ? 'No files match your search.' : 'No files in this view yet.'}
              </p>
              {!searchQuery && tab === 'all' && (
                <button
                  onClick={() => setShowUploader(true)}
                  style={{
                    marginTop: 8, padding: '6px 16px', borderRadius: 6, fontSize: 12,
                    background: 'var(--pm-accent)', color: '#fff', border: 'none', cursor: 'pointer',
                  }}
                >
                  Upload your first file
                </button>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  {['File', 'Size', 'Type', 'Uploaded', 'Actions'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '8px 16px',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--text-tertiary)',
                      background: 'var(--surface-glass)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayFiles.map(file => {
                  const ext = getExt(file.original_name);
                  const meta = filePreviewService.classify(file.mime_type || '', file.original_name);
                  const isSelected = selectedFile?.id === file.id;

                  return (
                    <tr
                      key={file.id}
                      id={`file-row-${file.id}`}
                      onClick={() => {
                        setSelectedFile(file);
                        setActivePanel('preview');
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-soft)',
                        background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* Filename */}
                      <td style={{ padding: '10px 16px', maxWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>
                            {file.mime_type?.startsWith('image/') ? '🖼' :
                             file.mime_type === 'application/pdf' ? '📄' :
                             ['xls', 'xlsx', 'csv'].includes(ext) ? '📊' :
                             ['doc', 'docx'].includes(ext) ? '📝' :
                             ['zip', 'rar', '7z'].includes(ext) ? '🗜' :
                             meta.type === 'code' ? '💻' : '📎'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--pm-on-surface)', fontWeight: 500 }}>
                            {file.original_name}
                          </span>
                        </div>
                      </td>

                      {/* Size */}
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {filePreviewService.formatSize(file.file_size)}
                      </td>

                      {/* Type */}
                      <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {ext.toUpperCase() || meta.type}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(file.created_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {meta.canPreview && (
                            <button id={`fc-preview-${file.id}`} title="Preview" onClick={() => { setSelectedFile(file); setActivePanel('preview'); }} style={actionBtn}>👁</button>
                          )}
                          <button id={`fc-versions-${file.id}`} title="Versions" onClick={() => { setSelectedFile(file); setActivePanel('versions'); }} style={actionBtn}>🕓</button>
                          {tab === 'archived' ? (
                            <button id={`fc-unarchive-${file.id}`} title="Restore" onClick={() => handleUnarchive(file)} style={actionBtn}>♻</button>
                          ) : (
                            canManageFiles && (
                              <button id={`fc-archive-${file.id}`} title="Archive" onClick={() => handleArchive(file)} style={{ ...actionBtn, color: 'rgba(239,68,68,0.7)' }}>🗑</button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Side detail panel */}
      {selectedFile && activePanel && (
        <div style={{
          width: 400, flexShrink: 0,
          borderLeft: '1px solid var(--border-soft)',
          background: 'var(--surface-base)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Panel tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border-soft)',
            background: 'var(--surface-glass)',
          }}>
            {(['preview', 'versions', 'info'] as const).map(p => (
              <button
                key={p}
                id={`fc-panel-tab-${p}`}
                onClick={() => setActivePanel(p)}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 500, textTransform: 'capitalize',
                  color: activePanel === p ? 'var(--pm-accent)' : 'var(--text-tertiary)',
                  borderBottom: `2px solid ${activePanel === p ? 'var(--pm-accent)' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
              >
                {p === 'preview' ? '👁 Preview' : p === 'versions' ? '🕓 Versions' : 'ℹ Info'}
              </button>
            ))}
            <button
              onClick={() => { setSelectedFile(null); setActivePanel(null); }}
              style={{ width: 36, border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-tertiary)' }}
              aria-label="Close panel"
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {activePanel === 'preview' && (
              <FilePreview
                fileId={selectedFile.id}
                storagePath={selectedFile.storage_path}
                originalName={selectedFile.original_name}
                mimeType={selectedFile.mime_type || ''}
                fileSize={selectedFile.file_size}
              />
            )}
            {activePanel === 'versions' && (
              <div style={{ padding: 16 }}>
                <FileVersionHistory
                  fileId={selectedFile.id}
                  workspaceId={workspaceId}
                  currentVersionId={selectedFile.current_version_id}
                  originalName={selectedFile.original_name}
                  canRestore={canManageFiles}
                  onRestored={loadFiles}
                />
              </div>
            )}
            {activePanel === 'info' && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['File name', selectedFile.original_name],
                  ['Type', selectedFile.mime_type || '—'],
                  ['Size', filePreviewService.formatSize(selectedFile.file_size)],
                  ['Uploaded', formatDate(selectedFile.created_at)],
                  ['Storage path', selectedFile.storage_path],
                  ['Status', '✅ Active'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 2 }}>
                      {label}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--pm-on-surface)', wordBreak: 'break-all' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const actionBtn: React.CSSProperties = {
  padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border-soft)',
  background: 'var(--surface-hover)', cursor: 'pointer', fontSize: 12,
};

export default FileCenterPage;
