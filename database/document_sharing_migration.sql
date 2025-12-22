-- =====================================================
-- Lab Record Manager - Document Sharing Feature
-- Run this SQL in Neon console to add document sharing
-- =====================================================

-- Enable UUID extension (required for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create target type for document sharing
DO $$ BEGIN
    CREATE TYPE document_share_target_type AS ENUM ('class', 'group', 'instructor', 'admin', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add 'student' value to enum if table already exists
ALTER TYPE document_share_target_type ADD VALUE IF NOT EXISTS 'student';

-- Document Shares table - tracks who a document is shared with
-- Uses gen_random_uuid() which is available in PostgreSQL 13+ and Neon
CREATE TABLE IF NOT EXISTS document_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    shared_by_id UUID NOT NULL REFERENCES users(id),
    target_type document_share_target_type NOT NULL,
    target_class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    target_group_id UUID REFERENCES student_groups(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    shared_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    CONSTRAINT valid_target CHECK (
        (target_type = 'class' AND target_class_id IS NOT NULL) OR
        (target_type = 'group' AND target_group_id IS NOT NULL) OR
        (target_type IN ('instructor', 'admin', 'student') AND target_user_id IS NOT NULL)
    )
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_document_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_class ON document_shares(target_class_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_group ON document_shares(target_group_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_user ON document_shares(target_user_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_at ON document_shares(shared_at);

-- Add PDF attachment fields to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS pdf_attachment_url TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS pdf_attachment_name VARCHAR(255);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS pdf_cloudinary_id VARCHAR(255);

-- =====================================================
-- DONE! Document sharing tables created successfully
-- =====================================================
