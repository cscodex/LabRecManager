-- SQL to create import_history table
-- Run this manually in your Neon database

CREATE TABLE IF NOT EXISTS import_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id),
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    items_imported INTEGER NOT NULL,
    items_failed INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    errors JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_import_history_lab_id ON import_history(lab_id);
CREATE INDEX IF NOT EXISTS idx_import_history_school_id ON import_history(school_id);
CREATE INDEX IF NOT EXISTS idx_import_history_created_at ON import_history(created_at DESC);

-- =====================================================
-- Item Maintenance History (for repairs, issues, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS item_maintenance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES lab_items(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,  -- issue, maintenance, repair, replacement
    description TEXT NOT NULL,
    cost DECIMAL(10,2),
    vendor VARCHAR(255),
    part_name VARCHAR(255),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_item_id ON item_maintenance_history(item_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_created_at ON item_maintenance_history(created_at DESC);
