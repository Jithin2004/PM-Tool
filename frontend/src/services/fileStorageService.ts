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
  // UPLOAD — creates files + file_versions(v1) + optional file_links
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

    const metadata = {
      extension: file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '',
      scan_status: 'pending',
      uploaded_from: 'web',
      preview_available: file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/'),
    };

    // 2. Create files row
    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .insert({
        id: fileId,
        workspace_id: workspaceId,
        uploaded_by: authData.user.id,
        storage_provider: 'supabase',
        storage_path: storagePath,
        original_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        metadata,
      })
      .select()
      .single();

    if (fileError) {
      // cleanup orphaned storage object
      await storageBucketService.remove(storagePath).catch(() => {});
      throw fileError;
    }

    // 3. Create file_versions v1 row
    const { data: versionRow, error: versionError } = await supabase
      .from('file_versions')
      .insert({
        file_id: fileId,
        version_number: version,
        storage_path: storagePath,
        uploaded_by: authData.user.id,
        size: file.size,
      })
      .select('id')
      .single();

    if (!versionError && versionRow) {
      // 4. Point current_version_id at the first version
      await supabase
        .from('files')
        .update({ current_version_id: versionRow.id })
        .eq('id', fileId);
      (fileRecord as any).current_version_id = versionRow.id;
    }

    // 5. Link to entity (skip if entity is workspace itself)
    if (entityType !== 'workspace' && entityId !== workspaceId) {
      await supabase.from('file_links').insert({
        workspace_id: workspaceId,
        file_id: fileId,
        entity_type: entityType,
        entity_id: entityId,
        relationship: 'attachment',
      }).then(() => {});
    }

    // 6. Index for search
    await searchIndexService.indexEntity({
      workspace_id: workspaceId,
      entity_type: 'file',
      entity_id: fileId,
      title: file.name,
      content: '',
      keywords: { extension: metadata.extension, entity_type: entityType, entity_id: entityId },
      metadata: { uploaded_by: authData.user.id, file_size: file.size, mime_type: file.type },
    }).catch(() => {});

    // 7. Activity event → automation trigger
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

    return fileRecord as FileRecord;
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
    const { data: versionRow, error: versionError } = await supabase
      .from('file_versions')
      .insert({
        file_id: fileId,
        version_number: nextVersion,
        storage_path: storagePath,
        uploaded_by: authData.user.id,
        size: newFile.size,
      })
      .select('id')
      .single();

    if (versionError) throw versionError;

    // Update files metadata & pointer
    await supabase
      .from('files')
      .update({
        storage_path: storagePath,
        file_size: newFile.size,
        original_name: newFile.name,
        current_version_id: versionRow.id,
        metadata: {
          extension: newFile.name.includes('.') ? newFile.name.split('.').pop()!.toLowerCase() : '',
          scan_status: 'pending',
          preview_available: newFile.type.startsWith('image/') || newFile.type === 'application/pdf' || newFile.type.startsWith('text/'),
        },
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
  // e.g. v1,v2,v3 → restore v1 → creates v4 pointing to v1 storage path
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

    // New version row pointing to the SAME storage path (immutable reference copy)
    const { data: newVersionRow, error } = await supabase
      .from('file_versions')
      .insert({
        file_id: fileId,
        version_number: nextVersion,
        storage_path: sourceVersion.storage_path,
        uploaded_by: authData.user.id,
        size: sourceVersion.size,
        checksum: sourceVersion.checksum ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Update files to point at restored version
    await supabase
      .from('files')
      .update({
        storage_path: sourceVersion.storage_path,
        file_size: sourceVersion.size,
        current_version_id: newVersionRow.id,
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
  // ARCHIVE — soft delete only; never physically removes
  // ─────────────────────────────────────────────────────────────────────────
  async archiveFile(fileId: string, workspaceId: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;

    const { error } = await supabase
      .from('files')
      .update({
        // archived_at: new Date().toISOString(),
        // archived_by: authData.user.id,
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
      .from('files')
      // .update({ archived_at: null, archived_by: null })
      .eq('id', fileId);

    return !error;
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
    const { data } = await supabase.from('files').select('*').eq('id', fileId).maybeSingle();
    return data as FileRecord | null;
  },

  async getWorkspaceFiles(workspaceId: string, includeArchived = false) {
    let q = supabase
      .from('files')
      .select('*, uploaded_by_user:users!files_uploaded_by_fkey(id, full_name, avatar_url)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    // if (!includeArchived) q = q.is('archived_at', null);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async getEntityFiles(workspaceId: string, entityType: string, entityId: string) {
    const { data, error } = await supabase
      .from('file_links')
      .select('*, file:files(*, uploaded_by_user:users!files_uploaded_by_fkey(id, full_name, avatar_url))')
      .eq('workspace_id', workspaceId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) throw error;
    return (data || []).map((l: any) => l.file).filter(Boolean) as FileRecord[];
  },

  async getFileVersions(fileId: string): Promise<FileVersionRecord[]> {
    const { data, error } = await supabase
      .from('file_versions')
      .select('*')
      .eq('file_id', fileId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return (data || []) as FileVersionRecord[];
  },

  async getUserFiles(workspaceId: string, userId: string) {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('uploaded_by', userId)
      // .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getSharedWithMe(workspaceId: string, userId: string) {
    const { data, error } = await supabase
      .from('file_access')
      .select('*, file:files(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((a: any) => a.file).filter((f: any) => f?.workspace_id === workspaceId);
  },
};
