-- Migration: Add soft delete fields to documents table
-- Run this migration to enable trash/recycle bin functionality

ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Index for efficient trash queries
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);

-- Add comments for documentation
COMMENT ON COLUMN documents.deleted_at IS 'Timestamp when document was moved to trash, NULL if not deleted';
COMMENT ON COLUMN documents.deleted_by IS 'User who deleted the document';
