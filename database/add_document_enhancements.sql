-- ============================================
-- Document Enhancements Migration
-- Run this SQL directly in your database console
-- ============================================

-- 1. Add soft delete fields to documents table (Trash/Recycle Bin)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Index for efficient trash queries
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON documents(deleted_at);

-- 2. Add storage quota fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_quota_mb INT DEFAULT 500;
ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

-- ============================================
-- Verify the changes
-- ============================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'documents' 
-- AND column_name IN ('deleted_at', 'deleted_by');

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- AND column_name IN ('storage_quota_mb', 'storage_used_bytes');
