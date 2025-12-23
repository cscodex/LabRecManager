-- =====================================================
-- Create Sample Labs and PCs for Testing
-- Run in Neon SQL Console
-- =====================================================

-- First, get your school ID (replace in the INSERT statements)
-- SELECT id, name FROM schools LIMIT 1;

-- Create Labs (replace YOUR_SCHOOL_ID with actual school ID)
INSERT INTO labs (id, school_id, name, room_number, description, status, created_at)
VALUES 
    (gen_random_uuid(), 'YOUR_SCHOOL_ID', 'Computer Lab 1', 'Room 101', 'Main computer lab with 30 PCs', 'active', NOW()),
    (gen_random_uuid(), 'YOUR_SCHOOL_ID', 'Computer Lab 2', 'Room 102', 'Secondary computer lab with 25 PCs', 'active', NOW()),
    (gen_random_uuid(), 'YOUR_SCHOOL_ID', 'Physics Lab', 'Room 201', 'Physics experiments lab', 'active', NOW()),
    (gen_random_uuid(), 'YOUR_SCHOOL_ID', 'Chemistry Lab', 'Room 202', 'Chemistry experiments lab', 'active', NOW());

-- After running above, get the lab IDs
-- SELECT id, name FROM labs WHERE school_id = 'YOUR_SCHOOL_ID';

-- Create PCs in Computer Lab 1 (replace LAB_ID_1 with actual lab ID)
INSERT INTO lab_items (id, school_id, lab_id, item_number, item_type, brand, model_no, status, created_at)
SELECT 
    gen_random_uuid(),
    'YOUR_SCHOOL_ID',
    'LAB_ID_1',
    'PC-' || LPAD(n::text, 3, '0'),
    'pc',
    'Dell',
    'OptiPlex 7080',
    'active',
    NOW()
FROM generate_series(1, 30) as n;

-- Create PCs in Computer Lab 2 (replace LAB_ID_2 with actual lab ID)
INSERT INTO lab_items (id, school_id, lab_id, item_number, item_type, brand, model_no, status, created_at)
SELECT 
    gen_random_uuid(),
    'YOUR_SCHOOL_ID',
    'LAB_ID_2',
    'PC-' || LPAD((30 + n)::text, 3, '0'),
    'pc',
    'HP',
    'ProDesk 400',
    'active',
    NOW()
FROM generate_series(1, 25) as n;

-- =====================================================
-- SIMPLER ALTERNATIVE: Run these one by one
-- =====================================================

-- Step 1: Get school ID
-- SELECT id, name FROM schools;

-- Step 2: Create one lab (replace SCHOOL_ID)
-- INSERT INTO labs (id, school_id, name, room_number, status)
-- VALUES (gen_random_uuid(), 'SCHOOL_ID', 'Computer Lab 1', 'Room 101', 'active')
-- RETURNING id, name;

-- Step 3: Create PCs in that lab (replace SCHOOL_ID and LAB_ID)
-- INSERT INTO lab_items (id, school_id, lab_id, item_number, item_type, brand, status)
-- VALUES 
--     (gen_random_uuid(), 'SCHOOL_ID', 'LAB_ID', 'PC-001', 'pc', 'Dell', 'active'),
--     (gen_random_uuid(), 'SCHOOL_ID', 'LAB_ID', 'PC-002', 'pc', 'Dell', 'active'),
--     (gen_random_uuid(), 'SCHOOL_ID', 'LAB_ID', 'PC-003', 'pc', 'Dell', 'active'),
--     (gen_random_uuid(), 'SCHOOL_ID', 'LAB_ID', 'PC-004', 'pc', 'Dell', 'active'),
--     (gen_random_uuid(), 'SCHOOL_ID', 'LAB_ID', 'PC-005', 'pc', 'Dell', 'active');

-- Step 4: Verify
-- SELECT li.item_number, l.name as lab_name FROM lab_items li JOIN labs l ON li.lab_id = l.id;
