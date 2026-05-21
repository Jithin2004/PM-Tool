import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Document {
  id: string;
  workspace_id: string;
  project_id?: string;
  author_id?: string;
  title: string;
  content: string;
  doc_type: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
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

// ---- Stubs ----

export async function fetchDocuments(workspaceId: string, projectId?: string): Promise<Document[]> {
  if (!isSupabaseConfigured) return [];
  return [];
}

export async function fetchDocument(docId: string): Promise<Document | null> {
  return null;
}

export async function createDocument(doc: Partial<Document>): Promise<Document | null> {
  return null;
}

export async function updateDocument(docId: string, updates: Partial<Document>): Promise<boolean> {
  return false;
}

export async function deleteDocument(docId: string): Promise<boolean> {
  return false;
}

export async function fetchVersions(docId: string): Promise<DocVersion[]> {
  return [];
}

export async function createVersion(docId: string, content: string, summary?: string): Promise<DocVersion | null> {
  return null;
}

export async function fetchAnnotations(docId: string): Promise<DocAnnotation[]> {
  return [];
}

export async function createAnnotation(annotation: Partial<DocAnnotation>): Promise<DocAnnotation | null> {
  return null;
}

export async function resolveAnnotation(annotationId: string): Promise<boolean> {
  return false;
}
