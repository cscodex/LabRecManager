-- =====================================================
-- Lab Record Manager - Equipment Shifting Feature
-- Run this SQL in Neon console to add equipment shifting
-- =====================================================

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create status enum for equipment shift requests
DO $$ BEGIN
    CREATE TYPE equipment_shift_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Equipment Shift Requests table - tracks requests to move items between labs
CREATE TABLE IF NOT EXISTS equipment_shift_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES lab_items(id) ON DELETE CASCADE,
    from_lab_id UUID NOT NULL REFERENCES labs(id),
    to_lab_id UUID NOT NULL REFERENCES labs(id),
    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    status equipment_shift_status DEFAULT 'pending',
    reason TEXT,
    admin_notes TEXT,
    requested_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    CONSTRAINT different_labs CHECK (from_lab_id != to_lab_id)
);

-- Equipment Shift History table - permanent record of all completed moves
CREATE TABLE IF NOT EXISTS equipment_shift_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES lab_items(id) ON DELETE CASCADE,
    from_lab_id UUID NOT NULL REFERENCES labs(id),
    to_lab_id UUID NOT NULL REFERENCES labs(id),
    shifted_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    shift_request_id UUID REFERENCES equipment_shift_requests(id),
    notes TEXT,
    shifted_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_shift_requests_status ON equipment_shift_requests(status);
CREATE INDEX IF NOT EXISTS idx_shift_requests_item ON equipment_shift_requests(item_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_from_lab ON equipment_shift_requests(from_lab_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_to_lab ON equipment_shift_requests(to_lab_id);
CREATE INDEX IF NOT EXISTS idx_shift_requests_requested_by ON equipment_shift_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_shift_requests_requested_at ON equipment_shift_requests(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_shift_history_item ON equipment_shift_history(item_id);
CREATE INDEX IF NOT EXISTS idx_shift_history_from_lab ON equipment_shift_history(from_lab_id);
CREATE INDEX IF NOT EXISTS idx_shift_history_to_lab ON equipment_shift_history(to_lab_id);
CREATE INDEX IF NOT EXISTS idx_shift_history_shifted_at ON equipment_shift_history(shifted_at DESC);

-- =====================================================
-- DONE! Equipment shifting tables created successfully
-- =====================================================
