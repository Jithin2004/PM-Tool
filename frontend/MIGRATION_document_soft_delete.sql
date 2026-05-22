-- Document soft-delete restoration
-- Safely adds deleted_at + deleted_by to documents table

ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by uuid references users(id) on delete set null;

CREATE INDEX IF NOT EXISTS idx_documents_workspace_deleted ON documents(workspace_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
