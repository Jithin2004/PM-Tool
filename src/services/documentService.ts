import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sha256 } from '../utils/cryptoUtils';
import { logServiceFailure } from '../utils/supabaseError';
import { activityLogService } from './activityLogService';
import { fireEventWebhooks } from './webhookService';
import { evaluateTriggers } from './automationEngine';

export interface Document {
  id: string;
  workspace_id: string;
  project_id?: string;
  author_id?: string;
  title: string;
  content: string;
  doc_type: string;
  tags: string[];
  pinned?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface DocVersion {
  id: string;
  doc_id: string;
  version: number;
  content: string;
  author_id?: string;
  change_summary?: string;
  hash: string;
  created_at: string;
}

export interface DocAnnotation {
  id: string;
  doc_id: string;
  author_id?: string;
  selection_start: number;
  selection_end: number;
  comment: string;
  resolved: boolean;
  created_at: string;
}

// ── Soft Delete Support Check ──

let _supportsSoftDelete: boolean | null = null;

export async function supportsSoftDelete(): Promise<boolean> {
  if (_supportsSoftDelete !== null) return _supportsSoftDelete;
  try {
    const { error } = await supabase
      .from('documents')
      .select('deleted_at')
      .limit(1)
      .maybeSingle();
    _supportsSoftDelete = !error;
  } catch {
    _supportsSoftDelete = false;
  }
  return _supportsSoftDelete;
}

export function clearSoftDeleteCache(): void {
  _supportsSoftDelete = null;
}

// ── Documents ──

export async function fetchDocuments(workspaceId: string, projectId?: string): Promise<Document[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  try {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (await supportsSoftDelete()) {
      query = query.is('deleted_at', null);
    }
    query = query.order('updated_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data } = await query;
    if (data) return data as Document[];
  } catch { /* ignore */ }
  return [];
}

export async function searchDocuments(workspaceId: string, queryText: string): Promise<Document[]> {
  if (!isSupabaseConfigured || !workspaceId || !queryText.trim()) return [];
  try {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .or(`title.ilike.%${queryText}%,content.ilike.%${queryText}%`);
    if (await supportsSoftDelete()) {
      query = query.is('deleted_at', null);
    }
    const { data } = await query
      .order('updated_at', { ascending: false })
      .limit(20);
    if (data) return data as Document[];
  } catch { /* ignore */ }
  return [];
}

export async function fetchDocument(docId: string): Promise<Document | null> {
  if (!isSupabaseConfigured) return null;
  try {
    let query = supabase
      .from('documents')
      .select('*')
      .eq('id', docId);
    if (await supportsSoftDelete()) {
      query = query.is('deleted_at', null);
    }
    const { data } = await query.maybeSingle();
    if (data) return data as Document;
  } catch { /* ignore */ }
  return null;
}

export async function fetchDocumentIncludingDeleted(docId: string): Promise<Document | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .maybeSingle();
    if (data) return data as Document;
  } catch { /* ignore */ }
  return null;
}

export async function fetchArchivedDocuments(workspaceId: string): Promise<Document[]> {
  if (!isSupabaseConfigured || !workspaceId) return [];
  if (!(await supportsSoftDelete())) return [];
  try {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (data) return data as Document[];
  } catch { /* ignore */ }
  return [];
}

export async function createDocument(doc: Partial<Document>): Promise<Document | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('documents')
      .insert({ ...doc, doc_type: doc.doc_type || 'markdown', tags: doc.tags || [], pinned: doc.pinned || false })
      .select()
      .single();
    if (error) { logServiceFailure('createDocument', doc, error); return null; }
    if (data) {
      await activityLogService.appendLog({
        workspace_id: doc.workspace_id!, actor_id: doc.author_id,
        action: 'document_created',
        metadata: { doc_id: data.id, title: data.title },
      });
      fireEventWebhooks('document_created', doc.workspace_id!, {
        doc_id: data.id, title: data.title, author_id: doc.author_id,
      }).catch(() => {});
      evaluateTriggers('document.created', {
        workspace_id: doc.workspace_id!, doc_id: data.id, title: data.title, author_id: doc.author_id,
      }).catch(() => {});
      return data as Document;
    }
  } catch (err) { logServiceFailure('createDocument', doc, err); }
  return null;
}

export async function updateDocument(docId: string, updates: Partial<Document>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data: current } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .maybeSingle();
    if (!current) return false;
    if (updates.content !== undefined || updates.title !== undefined) {
      const prevContent = updates.content !== undefined ? current.content : '';
      const prevTitle = updates.title !== undefined ? current.title : '';
      const versionNum = await getNextVersion(docId);
      const versionHash = await sha256(prevContent + (updates.author_id || '') + new Date().toISOString());
      await supabase.from('doc_versions').insert({
        doc_id: docId, version: versionNum,
        content: prevContent, author_id: updates.author_id,
        change_summary: `Updated "${updates.title || prevTitle}"`,
        hash: versionHash,
      });
      await activityLogService.logFileVersionCreated(
        current.workspace_id, docId, versionNum, updates.author_id
      );
    }
    await supabase.from('documents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', docId);
    return true;
  } catch { return false; }
}

export async function deleteDocument(docId: string, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  if (!(await supportsSoftDelete())) return false;
  try {
    const { data: current } = await supabase
      .from('documents')
      .select('workspace_id, title')
      .eq('id', docId)
      .maybeSingle();
    if (!current) return false;
    await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId || null })
      .eq('id', docId);
    await activityLogService.logDocumentDeleted(current.workspace_id, docId, current.title, userId);
    return true;
  } catch { return false; }
}

export async function restoreDocument(docId: string, userId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  if (!(await supportsSoftDelete())) return false;
  try {
    const { data: current } = await supabase
      .from('documents')
      .select('workspace_id, title')
      .eq('id', docId)
      .maybeSingle();
    if (!current) return false;
    await supabase
      .from('documents')
      .update({ deleted_at: null, deleted_by: null, updated_at: new Date().toISOString() })
      .eq('id', docId);
    await activityLogService.logDocumentRestored(current.workspace_id, docId, current.title, userId);
    return true;
  } catch { return false; }
}

export async function togglePinDocument(docId: string, pinned: boolean): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('documents').update({ pinned, updated_at: new Date().toISOString() }).eq('id', docId);
    return true;
  } catch { return false; }
}

// ── Versions ──

async function getNextVersion(docId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('doc_versions')
      .select('version')
      .eq('doc_id', docId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.version ?? 0) + 1;
  } catch { return 1; }
}

export async function fetchVersions(docId: string): Promise<DocVersion[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabase
      .from('doc_versions')
      .select('*')
      .eq('doc_id', docId)
      .order('version', { ascending: false });
    if (data) return data as DocVersion[];
  } catch { /* ignore */ }
  return [];
}

export async function createVersion(
  docId: string, content: string, authorId?: string, summary?: string
): Promise<DocVersion | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const version = await getNextVersion(docId);
    const hash = await sha256(content + (authorId || '') + new Date().toISOString());
    const { data } = await supabase
      .from('doc_versions')
      .insert({ doc_id: docId, version, content, author_id: authorId, change_summary: summary || '', hash })
      .select()
      .single();
    if (data) return data as DocVersion;
  } catch { /* ignore */ }
  return null;
}

// ── Annotations ──

export async function fetchAnnotations(docId: string): Promise<DocAnnotation[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabase
      .from('doc_annotations')
      .select('*')
      .eq('doc_id', docId)
      .order('created_at', { ascending: true });
    if (data) return data as DocAnnotation[];
  } catch { /* ignore */ }
  return [];
}

export async function createAnnotation(annotation: Partial<DocAnnotation>): Promise<DocAnnotation | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from('doc_annotations')
      .insert(annotation)
      .select()
      .single();
    if (data) {
      await activityLogService.appendLog({
        workspace_id: '', actor_id: annotation.author_id,
        action: 'annotation_added',
        metadata: { doc_id: annotation.doc_id, annotation_id: data.id, selection: `${data.selection_start}-${data.selection_end}` },
      });
      return data as DocAnnotation;
    }
  } catch { /* ignore */ }
  return null;
}

export async function resolveAnnotation(annotationId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    await supabase.from('doc_annotations').update({ resolved: true }).eq('id', annotationId);
    return true;
  } catch { return false; }
}
