-- ============================================================
-- LAB EVENT HISTORY TABLE
-- Tracks comprehensive lab events: inventory additions, 
-- incharge changes, and procurement-sourced items
-- ============================================================

-- Create the lab_event_history table
CREATE TABLE IF NOT EXISTS lab_event_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    
    -- Event type: 'item_added', 'item_removed', 'incharge_assigned', 'incharge_removed', 'procurement_received'
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- For item-related events
    item_id UUID REFERENCES lab_items(id) ON DELETE SET NULL,
    item_details JSONB,  -- Store item snapshot: {itemType, itemNumber, brand, modelNo, serialNo, quantity}
    
    -- For incharge-related events  
    old_incharge_id UUID REFERENCES users(id) ON DELETE SET NULL,
    new_incharge_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- For procurement-sourced items
    procurement_request_id UUID REFERENCES procurement_requests(id) ON DELETE SET NULL,
    procurement_item_id UUID REFERENCES procurement_items(id) ON DELETE SET NULL,
    
    -- Metadata
    performed_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_lab_event_history_lab_id ON lab_event_history(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_event_history_event_type ON lab_event_history(event_type);
CREATE INDEX IF NOT EXISTS idx_lab_event_history_created_at ON lab_event_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_event_history_item_id ON lab_event_history(item_id);
CREATE INDEX IF NOT EXISTS idx_lab_event_history_procurement ON lab_event_history(procurement_request_id);

-- ============================================================
-- VERIFY TABLE CREATION
-- ============================================================
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'lab_event_history'
ORDER BY ordinal_position;
