import { supabase } from '../lib/supabase';
import { activityEventService } from './activityEventService';
import { searchIndexService } from './searchIndexService';

export interface Document {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  document_type: string;
  entity_type?: string;
  entity_id?: string;
  status: 'draft' | 'review' | 'approved' | 'archived';
  current_version_id?: string;
  owner_id: string;
  visibility: 'workspace' | 'team' | 'restricted';
  metadata?: Record<string, any>;
  content?: string;
  pinned?: boolean;
  deleted_at?: string;
  tags?: string[];
  archived_at?: string;
  archived_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  content: string;
  file_metadata?: Record<string, any>;
  created_by: string;
  change_summary?: string;
  is_locked: boolean;
  approved_at?: string;
  approved_by?: string;
  created_at: string;
}

export const documentService = {
  async createDocument(doc: Partial<Document>, initialContent: string): Promise<Document | null> {
    try {
      const docId = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Unauthenticated');

      // 1. Create document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          id: docId,
          ...doc,
          owner_id: userId,
          current_version_id: null // To be updated
        })
        .select()
        .single();

      if (docError) throw docError;

      // 2. Create version 1
      const { error: verError } = await supabase
        .from('document_versions')
        .insert({
          id: versionId,
          document_id: docId,
          version_number: 1,
          content: initialContent,
          created_by: userId,
          change_summary: 'Initial version',
          is_locked: false
        });

      if (verError) throw verError;

      // 3. Update document with current_version_id
      const { data: finalDoc, error: updateError } = await supabase
        .from('documents')
        .update({ current_version_id: versionId })
        .eq('id', docId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Tracking
      await activityEventService.recordActivity({
        workspace_id: doc.workspace_id!,
        actor_id: userId,
        action_type: 'document_created',
        entity_type: 'document',
        entity_id: docId,
        metadata: { title: doc.title, document_type: doc.document_type }
      });
      
      // Indexing via searchService (simulated or actual integration)
      searchIndexService.indexEntity({ workspace_id: doc.workspace_id!, entity_type: 'document', entity_id: docId, title: doc.title!, content: initialContent, metadata: { document_type: doc.document_type } });

      return finalDoc;
    } catch (err) {
      console.error('[documentService.createDocument] Error:', err);
      return null;
    }
  },

  async updateDocument(documentId: string, updates: Partial<Document>): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('[documentService.updateDocument] Error:', error);
      return null;
    }
    
    if (updates.title && data) {
      searchIndexService.indexEntity({ workspace_id: data.workspace_id, entity_type: 'document', entity_id: documentId, title: updates.title, content: '', metadata: { document_type: data.document_type } });
    }
    
    return data;
  },

  async createVersion(documentId: string, content: string, changeSummary?: string): Promise<DocumentVersion | null> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Unauthenticated');

      // Get current version number
      const { data: currentVersions, error: verError } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1);

      if (verError) throw verError;
      const nextVersionNum = currentVersions && currentVersions.length > 0 ? currentVersions[0].version_number + 1 : 1;

      const versionId = crypto.randomUUID();
      const { data: newVersion, error: insertError } = await supabase
        .from('document_versions')
        .insert({
          id: versionId,
          document_id: documentId,
          version_number: nextVersionNum,
          content,
          created_by: userId,
          change_summary: changeSummary || 'Content update',
          is_locked: false
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update document's current_version_id
      const { data: updatedDoc } = await supabase
        .from('documents')
        .update({ current_version_id: versionId, updated_at: new Date().toISOString() })
        .eq('id', documentId)
        .select()
        .single();

      // Tracking
      if (updatedDoc) {
        await activityEventService.recordActivity({
          workspace_id: updatedDoc.workspace_id,
          actor_id: userId,
          action_type: 'document_version_created',
          entity_type: 'document',
          entity_id: documentId,
          metadata: { version: nextVersionNum, summary: changeSummary }
        });
        
        searchIndexService.indexEntity({ workspace_id: updatedDoc.workspace_id, entity_type: 'document', entity_id: documentId, title: updatedDoc.title, content: content, metadata: { document_type: updatedDoc.document_type } });
      }

      return newVersion;
    } catch (err) {
      console.error('[documentService.createVersion] Error:', err);
      return null;
    }
  },

  async getDocument(documentId: string): Promise<{ document: Document, currentVersion: DocumentVersion } | null> {
    try {
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) return null;

      let currentVersion = null;
      if (document.current_version_id) {
        const { data: version } = await supabase
          .from('document_versions')
          .select('*')
          .eq('id', document.current_version_id)
          .single();
        currentVersion = version;
      }

      return { document, currentVersion };
    } catch (err) {
      console.error('[documentService.getDocument] Error:', err);
      return null;
    }
  },

  async getEntityDocuments(entityType: string, entityId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[documentService.getEntityDocuments] Error:', error);
      return [];
    }
    return data || [];
  },

  async getWorkspaceDocuments(workspaceId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[documentService.getWorkspaceDocuments] Error:', error);
      return [];
    }
    return data || [];
  },

  async getVersionHistory(documentId: string): Promise<DocumentVersion[]> {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('[documentService.getVersionHistory] Error:', error);
      return [];
    }
    return data || [];
  },

  async archiveDocument(documentId: string): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { error } = await supabase
      .from('documents')
      .update({ archived_at: new Date().toISOString(), archived_by: userId, status: 'archived' })
      .eq('id', documentId);

    if (error) {
      console.error('[documentService.archiveDocument] Error:', error);
      return false;
    }
    return true;
  }
};

// --- STUBS FOR OLD IMPORTS ---
export async function fetchDocuments(workspaceId: string): Promise<any[]> { return []; }
export async function searchDocuments(workspaceId: string, queryText: string): Promise<any[]> { return []; }
export async function fetchDocument(docId: string): Promise<any | null> { return null; }
export async function createDocument(doc: Partial<any>): Promise<any | null> { return null; }
export async function togglePinDocument(docId: string, pinned: boolean): Promise<boolean> { return false; }
export async function deleteDocument(docId: string, userId?: string): Promise<boolean> { return false; }
export async function fetchArchivedDocuments(workspaceId: string): Promise<any[]> { return []; }
export async function restoreDocument(docId: string, userId?: string): Promise<boolean> { return false; }
export async function supportsSoftDelete(): Promise<boolean> { return false; }
export async function fetchVersions(docId: string): Promise<any[]> { return []; }
export async function fetchAnnotations(docId: string): Promise<any[]> { return []; }
export async function createAnnotation(annotation: any): Promise<any | null> { return null; }
export async function resolveAnnotation(annotationId: string): Promise<boolean> { return false; }
export async function fetchDocumentIncludingDeleted(docId: string): Promise<any | null> { return null; }

export type DocVersion = any;
export type DocAnnotation = any;

// --- NAMED EXPORTS FOR BACKWARD COMPATIBILITY ---
export const updateDocument = documentService.updateDocument;
export const createVersion = documentService.createVersion;
export const getDocument = documentService.getDocument;
export const getEntityDocuments = documentService.getEntityDocuments;
export const getWorkspaceDocuments = documentService.getWorkspaceDocuments;
export const getVersionHistory = documentService.getVersionHistory;
export const archiveDocument = documentService.archiveDocument;
