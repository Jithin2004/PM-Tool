import { supabase } from '../lib/supabase';
import { storageBucketService, WORKSPACE_BUCKET } from './storageBucketService';
import { activityEventService } from './activityEventService';
import { searchIndexService } from './searchIndexService';

export interface FileRecord {
  id: string;
  workspace_id: string;
  uploaded_by: string | null;
  storage_provider: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  file_size: number;
  checksum?: string | null;
  metadata?: Record<string, any>;
  current_version_id?: string | null;
  created_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
}

export interface FileVersionRecord {
  id: string;
  file_id: string;
  version_number: number;
  storage_path: string;
  uploaded_by: string | null;
  checksum?: string | null;
  size: number;
  created_at: string;
}

function mapToFileRecord(row: any): FileRecord {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    uploaded_by: row.uploaded_by,
    storage_provider: 'supabase',
    storage_path: row.storage_path,
    original_name: row.file_name,
    mime_type: row.mime_type,
    file_size: Number(row.file_size),
    created_at: row.created_at,
    archived_at: row.deleted_at,
    archived_by: null,
  };
}

function mapToFileVersionRecord(row: any): FileVersionRecord {
  return {
    id: row.id,
    file_id: row.file_id,
    version_number: row.version_number,
    storage_path: row.storage_path,
    uploaded_by: row.uploaded_by,
    size: Number(row.file_size),
    created_at: row.created_at,
    checksum: row.checksum,
  };
}

export const fileStorageService = {
  // ─────────────────────────────────────────────────────────────────────────
  // QUOTA
  // ─────────────────────────────────────────────────────────────────────────
  async checkQuota(workspaceId: string, additionalBytes: number): Promise<boolean> {
    return true; // Storage usage tracking disabled in v1.3 pending migration
  },

  async getStorageUsage(workspaceId: string) {
    return { used_bytes: 0, quota_bytes: 10 * 1024 * 1024 * 1024 }; // Mocked for v1.3
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UPLOAD — creates workspace_files + file_versions(v1)
  // ─────────────────────────────────────────────────────────────────────────
  async uploadFile(
    file: File,
    workspaceId: string,
    entityType: string = 'workspace',
    entityId: string = workspaceId,
    options?: { emitActivity?: boolean }
  ): Promise<FileRecord | null> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return null;

    const allowed = await this.checkQuota(workspaceId, file.size);
    if (!allowed) throw new Error('Storage quota exceeded for this workspace.');

    const fileId = crypto.randomUUID();
    const version = 1;
    const storagePath = storageBucketService.generateStoragePath(
      workspaceId, entityType, entityId, fileId, version, file.name
    );

    // 1. Upload binary to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(WORKSPACE_BUCKET)
      .upload(storagePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    // 2. Create workspace_files row
    const { data: fileRecord, error: fileError } = await supabase
      .from('workspace_files')
      .insert({
        id: fileId,
        workspace_id: workspaceId,
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_type: file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin',
        mime_type: file.type || null,
        file_size: file.size,
        storage_path: storagePath,
        uploaded_by: authData.user.id,
      })
      .select()
      .single();

    if (fileError) {
      // cleanup orphaned storage object
      await storageBucketService.remove(storagePath).catch(() => {});
      throw fileError;
    }

    // 3. Create file_versions v1 row
    const { error: versionError } = await supabase
      .from('file_versions')
      .insert({
        file_id: fileId,
        version_number: version,
        storage_path: storagePath,
        uploaded_by: authData.user.id,
        file_size: file.size,
      });

    if (versionError) {
      console.error('Failed to create initial file version:', versionError.message);
    }

    // 4. Index for search
    await searchIndexService.indexEntity({
      workspace_id: workspaceId,
      entity_type: 'file',
      entity_id: fileId,
      title: file.name,
      content: '',
      keywords: { extension: file.name.split('.').pop() || '', entity_type: entityType, entity_id: entityId },
      metadata: { uploaded_by: authData.user.id, file_size: file.size, mime_type: file.type },
    }).catch(() => {});

    // 5. Activity event → automation trigger
    if (options?.emitActivity !== false) {
      await activityEventService.recordActivity({
        workspace_id: workspaceId,
        actor_id: authData.user.id,
        entity_type: 'file',
        entity_id: fileId,
        action_type: 'file_uploaded',
        metadata: {
          original_name: file.name,
          entity_type: entityType,
          entity_id: entityId,
          file_size: file.size,
          mime_type: file.type,
        },
      });
    }

    return mapToFileRecord(fileRecord);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REPLACE — new immutable version; never overwrites old
  // ─────────────────────────────────────────────────────────────────────────
  async replaceFile(
    fileId: string,
    newFile: File,
    workspaceId: string,
    entityType: string = 'workspace',
    entityId: string = workspaceId,
  ): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;

    // Resolve next version number
    const { data: versions } = await supabase
      .from('file_versions')
      .select('version_number')
      .eq('file_id', fileId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (versions?.[0]?.version_number ?? 1) + 1;
    const storagePath = storageBucketService.generateStoragePath(
      workspaceId, entityType, entityId, fileId, nextVersion, newFile.name
    );

    // Upload new binary at new path (immutable)
    const { error: uploadError } = await supabase.storage
      .from(WORKSPACE_BUCKET)
      .upload(storagePath, newFile, { upsert: false });

    if (uploadError) throw uploadError;

    // Insert new version row
    const { error: versionError } = await supabase
      .from('file_versions')
      .insert({
        file_id: fileId,
        version_number: nextVersion,
        storage_path: storagePath,
        uploaded_by: authData.user.id,
        file_size: newFile.size,
      });

    if (versionError) throw versionError;

    // Update workspace_files metadata & pointer
    await supabase
      .from('workspace_files')
      .update({
        storage_path: storagePath,
        file_size: newFile.size,
        file_name: newFile.name,
        file_type: newFile.name.includes('.') ? newFile.name.split('.').pop()!.toLowerCase() : 'bin',
        mime_type: newFile.type || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fileId);

    // Update search index
    await searchIndexService.updateEntity('file', fileId, {
      title: newFile.name,
      metadata: { file_size: newFile.size, mime_type: newFile.type },
    }).catch(() => {});

    // Emit
    await activityEventService.recordActivity({
      workspace_id: workspaceId,
      actor_id: authData.user.id,
      entity_type: 'file',
      entity_id: fileId,
      action_type: 'file_version_created',
      metadata: { version: nextVersion, original_name: newFile.name, file_size: newFile.size },
    });

    return true;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RESTORE — never overwrites; creates vN = copy of old version
  // ─────────────────────────────────────────────────────────────────────────
  async restoreVersion(fileId: string, fromVersionId: string, workspaceId: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;

    // Fetch source version
    const { data: sourceVersion } = await supabase
      .from('file_versions')
      .select('*')
      .eq('id', fromVersionId)
      .single();

    if (!sourceVersion) return false;

    // Get next version number
    const { data: versions } = await supabase
      .from('file_versions')
      .select('version_number')
      .eq('file_id', fileId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = (versions?.[0]?.version_number ?? 1) + 1;

    // New version row pointing to the SAME storage path
    const { error: versionError } = await supabase
      .from('file_versions')
      .insert({
        file_id: fileId,
        version_number: nextVersion,
        storage_path: sourceVersion.storage_path,
        uploaded_by: authData.user.id,
        file_size: sourceVersion.file_size,
        checksum: sourceVersion.checksum ?? null,
      });

    if (versionError) throw versionError;

    // Update workspace_files to point at restored version
    await supabase
      .from('workspace_files')
      .update({
        storage_path: sourceVersion.storage_path,
        file_size: sourceVersion.file_size,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fileId);

    await activityEventService.recordActivity({
      workspace_id: workspaceId,
      actor_id: authData.user.id,
      entity_type: 'file',
      entity_id: fileId,
      action_type: 'file_version_restored',
      metadata: {
        restored_from_version: sourceVersion.version_number,
        new_version: nextVersion,
      },
    });

    return true;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ARCHIVE — soft delete only
  // ─────────────────────────────────────────────────────────────────────────
  async archiveFile(fileId: string, workspaceId: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;

    const { error } = await supabase
      .from('workspace_files')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', fileId);

    if (error) return false;

    // Remove from search index
    await searchIndexService.removeEntity('file', fileId).catch(() => {});

    await activityEventService.recordActivity({
      workspace_id: workspaceId,
      actor_id: authData.user.id,
      entity_type: 'file',
      entity_id: fileId,
      action_type: 'file_archived',
      metadata: {},
    });

    return true;
  },

  async unarchiveFile(fileId: string, workspaceId: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;

    const { error } = await supabase
      .from('workspace_files')
      .update({
        deleted_at: null,
      })
      .eq('id', fileId);

    if (error) return false;

    return true;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNED DOWNLOAD URL
  // ─────────────────────────────────────────────────────────────────────────
  async getDownloadUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    return storageBucketService.getSignedUrl(storagePath, expiresIn);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH HELPERS
  // ─────────────────────────────────────────────────────────────────────────
  async getFile(fileId: string): Promise<FileRecord | null> {
    const { data } = await supabase.from('workspace_files').select('*').eq('id', fileId).maybeSingle();
    return data ? mapToFileRecord(data) : null;
  },

  async getWorkspaceFiles(workspaceId: string, includeArchived = false) {
    let q = supabase
      .from('workspace_files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!includeArchived) q = q.is('deleted_at', null);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(mapToFileRecord);
  },

  async getEntityFiles(workspaceId: string, entityType: string, entityId: string) {
    const { data, error } = await supabase
      .from('workspace_files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapToFileRecord);
  },

  async getFileVersions(fileId: string): Promise<FileVersionRecord[]> {
    const { data, error } = await supabase
      .from('file_versions')
      .select('*')
      .eq('file_id', fileId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapToFileVersionRecord);
  },

  async getUserFiles(workspaceId: string, userId: string) {
    const { data, error } = await supabase
      .from('workspace_files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('uploaded_by', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapToFileRecord);
  },

  async getSharedWithMe(workspaceId: string, userId: string) {
    // file_access table does not exist in the active schema, return empty array to prevent crashes.
    return [];
  },
};
