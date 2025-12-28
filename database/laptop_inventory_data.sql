-- ============================================================
-- LAPTOP INVENTORY DATA UPDATE
-- Assign existing laptops to Computer Lab 2
-- ============================================================

-- STEP 1: Check for duplicate item_numbers (run this first)
SELECT item_number, COUNT(*) as count 
FROM lab_items 
WHERE item_type = 'laptop' 
GROUP BY item_number 
HAVING COUNT(*) > 1;

-- STEP 2: If duplicates exist, delete them keeping only one copy
DELETE FROM lab_items 
WHERE id NOT IN (
    SELECT MIN(id) FROM lab_items WHERE item_type = 'laptop' GROUP BY item_number
) AND item_type = 'laptop';

-- STEP 3: Now safely update all laptops to assign to Computer Lab 2
UPDATE lab_items 
SET lab_id = (SELECT id FROM labs WHERE LOWER(name) LIKE '%computer lab 2%' OR LOWER(name) LIKE '%lab 2%' LIMIT 1)
WHERE item_type = 'laptop';

-- STEP 4: Verify laptops with their lab assignment
SELECT li.item_number, li.brand, li.model_no, li.serial_no, li.status, l.name as lab_name
FROM lab_items li
LEFT JOIN labs l ON li.lab_id = l.id
WHERE li.item_type = 'laptop' 
ORDER BY li.item_number;
