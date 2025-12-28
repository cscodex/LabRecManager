-- ============================================================
-- PROCUREMENT FLOW ENHANCEMENTS
-- Billing, Payment, and Receiving workflow
-- ============================================================

-- Add billing fields to procurement_requests
ALTER TABLE procurement_requests
ADD COLUMN IF NOT EXISTS bill_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS bill_date DATE,
ADD COLUMN IF NOT EXISTS bill_amount DECIMAL(14,2),
ADD COLUMN IF NOT EXISTS bill_url VARCHAR(500);

-- Add payment fields
ALTER TABLE procurement_requests
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS cheque_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS payment_date DATE,
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

-- Add receiving fields
ALTER TABLE procurement_requests
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS received_by_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS receiving_video_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS receiving_notes TEXT;

-- Add receiving fields to procurement_items
ALTER TABLE procurement_items
ADD COLUMN IF NOT EXISTS is_received BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS received_qty INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES lab_items(id);

-- Add ordered status fields
ALTER TABLE procurement_requests
ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS po_url VARCHAR(500);

-- Update status enum to include new stages
-- Note: In PostgreSQL, you need to add new values to enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'billed' AND enumtypid = 'procurement_status'::regtype) THEN
        ALTER TYPE procurement_status ADD VALUE 'billed' AFTER 'ordered';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'paid' AND enumtypid = 'procurement_status'::regtype) THEN
        ALTER TYPE procurement_status ADD VALUE 'paid' AFTER 'billed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'received' AND enumtypid = 'procurement_status'::regtype) THEN
        ALTER TYPE procurement_status ADD VALUE 'received' AFTER 'paid';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create index for received items
CREATE INDEX IF NOT EXISTS idx_procurement_items_received ON procurement_items(is_received);

SELECT 'Procurement flow enhancements applied' as status;
