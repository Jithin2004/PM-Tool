import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Link as LinkIcon, Copy, Check, Shield, Trash2, Calendar, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface ProjectShareModalProps {
  projectId: string;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function ProjectShareModal({ projectId, workspaceId, isOpen, onClose, notify }: ProjectShareModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [existingLinks, setExistingLinks] = useState<any[]>([]);
  
  useEscapeKey(isOpen, onClose);

  const [permissions, setPermissions] = useState({
    can_view_tasks: true,
    can_view_documents: true,
    can_approve: false
  });
  
  const [expiresInDays, setExpiresInDays] = useState('7');

  const fetchExistingLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('external_access_links')
        .select('*')
        .eq('entity_id', projectId)
        .eq('entity_type', 'project')
        .order('created_at', { ascending: false });
      if (data) setExistingLinks(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchExistingLinks();
      setGeneratedLink('');
    }
  }, [isOpen, projectId]);

  const handleGenerate = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      // Generate a random token
      const array = new Uint8Array(24);
      window.crypto.getRandomValues(array);
      const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      
      const expiresAt = expiresInDays ? new Date(Date.now() + parseInt(expiresInDays) * 24 * 60 * 60 * 1000).toISOString() : null;

      const { data, error } = await supabase.from('external_access_links').insert({
        workspace_id: workspaceId,
        entity_type: 'project',
        entity_id: projectId,
        token_hash: token,
        permissions: permissions,
        expires_at: expiresAt,
        created_by: profile.id
      }).select().single();

      if (error) throw error;

      const shareUrl = `${window.location.origin}/shared/project/${token}`;
      setGeneratedLink(shareUrl);
      notify('Secure sharing link generated.', 'success');
      fetchExistingLinks();
      
    } catch (err) {
      console.error(err);
      notify('Failed to generate sharing link.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('external_access_links')
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: profile?.id
        })
        .eq('id', linkId);

      if (error) throw error;
      notify('Link access revoked successfully.', 'success');
      fetchExistingLinks();
    } catch (err) {
      console.error(err);
      notify('Failed to revoke link access.', 'error');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLinkValue = (token: string) => {
    const url = `${window.location.origin}/shared/project/${token}`;
    navigator.clipboard.writeText(url);
    notify('Link copied to clipboard.', 'success');
  };

  // Early return must be after ALL hooks are defined (Rules of Hooks)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-premium w-full max-w-lg p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-primary flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Client Access Link
          </h3>
          <button onClick={onClose} aria-label="Close modal" className="p-1.5 border border-border hover:bg-[var(--pm-surface)]/5 transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5 text-text-tertiary" />
          </button>
        </div>

        {!generatedLink ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-[10px] font-mono uppercase text-text-tertiary">Client Permissions</label>
              
              <label className="flex items-center gap-3 p-3 bg-bg border border-border cursor-pointer">
                <input type="checkbox" checked={permissions.can_view_tasks} onChange={e => setPermissions({...permissions, can_view_tasks: e.target.checked})} className="accent-cyan-500" />
                <div>
                  <div className="text-xs text-text-primary font-mono uppercase tracking-wider">View Progress</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">Can see high-level task status</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-bg border border-border cursor-pointer">
                <input type="checkbox" checked={permissions.can_view_documents} onChange={e => setPermissions({...permissions, can_view_documents: e.target.checked})} className="accent-cyan-500" />
                <div>
                  <div className="text-xs text-text-primary font-mono uppercase tracking-wider">View Documents</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">Can access 'Client Visible' docs</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-bg border border-border cursor-pointer">
                <input type="checkbox" checked={permissions.can_approve} onChange={e => setPermissions({...permissions, can_approve: e.target.checked})} className="accent-cyan-500" />
                <div>
                  <div className="text-xs text-text-primary font-mono uppercase tracking-wider">Approve Deliverables</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">Can approve/reject assigned work</div>
                </div>
              </label>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1.5">Expiration</label>
                <select value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} className="w-full input-premium h-10 px-3 text-xs font-mono outline-none">
                  <option value="1">24 Hours</option>
                  <option value="7">7 Days</option>
                  <option value="30">30 Days</option>
                  <option value="">Never Expires (Not Recommended)</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleGenerate} 
              disabled={loading}
              className="w-full h-10 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono uppercase tracking-widest hover:bg-cyan-500/30 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Generating...' : 'Generate Secure Link'}
            </button>
            
            {/* Existing Links Panel */}
            {existingLinks.length > 0 && (
              <div className="pt-6 border-t border-border-subtle space-y-3">
                <label className="block text-[10px] font-mono uppercase text-text-tertiary">Active Access Links</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {existingLinks.map(link => {
                    const isLinkExpired = link.expires_at && new Date(link.expires_at) < new Date();
                    const isLinkRevoked = !!link.revoked_at;
                    const isActive = !isLinkExpired && !isLinkRevoked;
                    return (
                      <div key={link.id} className="p-3 bg-bg border border-border-subtle rounded-sm text-[10px] font-mono flex justify-between items-start">
                        <div className="space-y-1 truncate pr-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-text-primary font-bold">Expires: {link.expires_at ? new Date(link.expires_at).toLocaleDateString() : 'Never'}</span>
                            <span className={`px-1 rounded-[2px] text-[7px] uppercase ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {isLinkRevoked ? 'Revoked' : isLinkExpired ? 'Expired' : 'Active'}
                            </span>
                          </div>
                          <div className="text-text-tertiary flex items-center gap-3">
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-text-quaternary" /> {link.access_count || 0} hits</span>
                            {link.last_accessed_at && <span>Last: {new Date(link.last_accessed_at).toLocaleDateString()}</span>}
                          </div>
                          <div className="text-text-quaternary text-[9px] truncate">
                            Permissions: {Object.keys(link.permissions).filter(k => link.permissions[k]).map(k => k.replace('can_', '')).join(', ')}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {isActive && (
                            <>
                              <button onClick={() => copyLinkValue(link.token_hash)} className="p-1 border border-border hover:bg-surface text-text-secondary rounded-sm transition-colors cursor-pointer" title="Copy Link">
                                <Copy className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleRevoke(link.id)} className="p-1 border border-border hover:bg-red-500/20 hover:border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/30 text-red-400 rounded-sm transition-colors cursor-pointer" title="Revoke Access">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-sm">
              <p className="text-xs text-green-400 font-mono text-center">Link generated successfully.</p>
              <p className="text-[10px] text-text-tertiary mt-2 text-center">Anyone with this link can access the client view.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 h-10 bg-bg border border-border px-3 flex items-center overflow-hidden">
                <span className="text-xs font-mono text-text-secondary truncate">{generatedLink}</span>
              </div>
              <button 
                onClick={copyToClipboard}
                className="h-10 px-4 bg-[var(--pm-surface)]/10 border border-border hover:bg-[var(--pm-surface)]/20 transition-colors flex items-center justify-center text-text-secondary"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button onClick={onClose} className="w-full h-10 bg-[var(--pm-inverse-surface)] text-[var(--pm-inverse-on-surface)] text-[10px] font-mono uppercase tracking-widest hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

