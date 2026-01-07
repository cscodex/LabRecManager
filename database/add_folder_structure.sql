-- ============================================
-- Folder Structure Migration
-- Run this SQL directly in your database console
-- ============================================

-- 1. Create document_folders table
CREATE TABLE IF NOT EXISTS document_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id),
    parent_id UUID REFERENCES document_folders(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- 2. Add folder_id to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_document_folders_school_id ON document_folders(school_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent_id ON document_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_id ON documents(folder_id);

-- ============================================
-- Verify
-- ============================================
-- SELECT * FROM document_folders LIMIT 5;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'folder_id';
