-- =====================================================
-- Check Labs and Lab Items (PCs) Data
-- Run in Neon SQL Console
-- =====================================================

-- 1. Count labs
SELECT COUNT(*) as total_labs FROM labs;

-- 2. List all labs
SELECT id, name, room_number, status FROM labs ORDER BY name;

-- 3. Count lab items (PCs)
SELECT COUNT(*) as total_items FROM lab_items;

-- 4. Count active PCs
SELECT COUNT(*) as active_pcs FROM lab_items WHERE item_type = 'pc' AND status = 'active';

-- 5. List all PCs with lab info
SELECT li.id, li.item_number, li.item_type, li.status, l.name as lab_name
FROM lab_items li
JOIN labs l ON li.lab_id = l.id
WHERE li.item_type = 'pc'
ORDER BY l.name, li.item_number;

-- 6. Check school_id for labs (must match user's school)
SELECT l.id, l.name, l.school_id, s.name as school_name
FROM labs l
JOIN schools s ON l.school_id = s.id
LIMIT 10;
