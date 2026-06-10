import { fileService, WorkspaceFile } from '../../services/fileService';

export const WorkspaceFileEngine = {
  /**
   * Orchestrates uploading files to tasks, projects, and decisions.
   * If a file with the same name already exists on that entity, it automatically uploads
   * it as a new version of the existing file rather than duplicating or overwriting.
   */
  async handleUpload(
    workspaceId: string,
    entityType: string,
    entityId: string,
    file: File,
    uploaderId: string,
    existingFiles: WorkspaceFile[]
  ): Promise<WorkspaceFile | null> {
    // Check if filename already exists on this entity (case-insensitive)
    const collision = existingFiles.find(
      f => f.file_name.toLowerCase() === file.name.toLowerCase()
    );

    if (collision) {
      console.log(`WorkspaceFileEngine: Collision detected for "${file.name}". Uploading as version.`);
      // Upload as a new version of the existing record
      return await fileService.replaceFile(
        collision,
        file,
        uploaderId,
        'Uploaded via auto-versioning file engine'
      );
    } else {
      console.log(`WorkspaceFileEngine: Uploading new file "${file.name}".`);
      // Upload as a brand new workspace file record
      return await fileService.uploadFile(
        workspaceId,
        entityType,
        entityId,
        file,
        uploaderId
      );
    }
  }
};
