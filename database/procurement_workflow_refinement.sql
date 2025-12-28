-- Procurement Workflow Refinement Migration
-- Step 1: Purchase Request Letter + Step 2: Local Vendor Flag

-- Add purchase letter fields to procurement_requests
ALTER TABLE procurement_requests
ADD COLUMN IF NOT EXISTS purchase_letter_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS purchase_letter_name VARCHAR(255);

-- Add local vendor flag to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS is_local BOOLEAN DEFAULT FALSE;

-- Create index for local vendor searches
CREATE INDEX IF NOT EXISTS idx_vendors_is_local ON vendors(is_local);

-- Add comments for documentation
COMMENT ON COLUMN procurement_requests.purchase_letter_url IS 'URL to the Request for New Purchase Letter explaining the need';
COMMENT ON COLUMN procurement_requests.purchase_letter_name IS 'Original filename of the purchase letter';
COMMENT ON COLUMN vendors.is_local IS 'Whether this vendor is a local vendor (required for quotation compliance)';
