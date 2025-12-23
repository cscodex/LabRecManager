-- =====================================================
-- Check Shift Requests Database Details
-- Run in Neon SQL Console  
-- =====================================================

-- 1. Check column types for equipment_shift_requests
SELECT column_name, data_type, udt_name
FROM information_schema.columns 
WHERE table_name = 'equipment_shift_requests';

-- 2. Check if enum type exists
SELECT typname, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'equipment_shift_status';

-- 3. Check the actual shift request data
SELECT id, status, requested_by, item_id FROM equipment_shift_requests;

-- 4. Check what labs exist and their school_id
SELECT id, name, school_id FROM labs;
