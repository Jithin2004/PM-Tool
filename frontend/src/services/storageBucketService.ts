import { supabase } from '../lib/supabase';

export const WORKSPACE_BUCKET = 'workspace-assets';

/**
 * Manages workspace-isolated storage paths inside the single Supabase bucket.
 * Path format: workspaceId/entityType/entityId/fileId/v{n}.{ext}
 */
export const storageBucketService = {
  /** No-op; Supabase uses a single bucket — isolation is path-based. */
  async ensureWorkspaceBucket(_workspaceId: string): Promise<void> {
    return;
  },

  /**
   * Deterministic storage path for a file version.
   * Called by fileStorageService; name kept consistent.
   */
  generateStoragePath(
    workspaceId: string,
    entityType: string,
    entityId: string,
    fileId: string,
    version: number,
    originalName: string
  ): string {
    const ext = originalName.includes('.')
      ? originalName.split('.').pop()!.toLowerCase()
      : 'bin';
    return `${workspaceId}/${entityType}/${entityId}/${fileId}/v${version}.${ext}`;
  },

  /** Get a short-lived signed URL (1 hour) for a storage path. */
  async getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(WORKSPACE_BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  /** Delete a physical file from storage (only for failed uploads / cleanup). */
  async remove(storagePath: string): Promise<void> {
    await supabase.storage.from(WORKSPACE_BUCKET).remove([storagePath]);
  },
};
