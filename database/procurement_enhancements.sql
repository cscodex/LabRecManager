-- ============================================================
-- PROCUREMENT ENHANCEMENTS
-- 1. School letterhead image
-- 2. Committee members for procurement
-- ============================================================

-- Add letterhead URL to schools
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS letterhead_url VARCHAR(500);

-- Procurement Committee Members (3-5 staff per procurement)
CREATE TABLE IF NOT EXISTS procurement_committee (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES procurement_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'chairperson', 'member', 'secretary'
    designation VARCHAR(100),
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_procurement_committee_request ON procurement_committee(request_id);
CREATE INDEX IF NOT EXISTS idx_procurement_committee_user ON procurement_committee(user_id);

-- Verification
SELECT 'Procurement enhancements applied' as status;
