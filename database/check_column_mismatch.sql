-- =====================================================
-- Compare Database Schema with Prisma Schema
-- Run in Neon SQL Console
-- =====================================================

-- Check ACTUAL columns in equipment_shift_requests table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'equipment_shift_requests'
ORDER BY ordinal_position;

-- Expected Prisma columns:
-- id (uuid)
-- item_id (uuid)
-- from_lab_id (uuid)
-- to_lab_id (uuid)
-- requested_by (uuid)
-- approved_by (uuid, nullable)
-- status (enum)
-- reason (text, nullable)
-- admin_notes (text, nullable)
-- requested_at (timestamp)
-- approved_at (timestamp, nullable)
-- completed_at (timestamp, nullable)
