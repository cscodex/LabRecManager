-- Migration: Add storage quota fields to users table
-- Run this migration to enable storage quota management

ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_quota_mb INT DEFAULT 500;
ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN users.storage_quota_mb IS 'Storage quota in megabytes (default: 500 MB)';
COMMENT ON COLUMN users.storage_used_bytes IS 'Current storage used in bytes';
