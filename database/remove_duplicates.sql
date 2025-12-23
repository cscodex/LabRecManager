-- =====================================================
-- Remove Duplicate Classes and Groups
-- Run this BEFORE the unique constraints migration
-- =====================================================

-- Step 1: Remove duplicate classes (keep oldest by created_at)
DELETE FROM classes 
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY school_id, name ORDER BY created_at ASC) as rn
        FROM classes
    ) ranked
    WHERE rn > 1
);

-- Step 2: Remove duplicate groups (keep oldest by created_at)
DELETE FROM student_groups 
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY class_id, name ORDER BY created_at ASC) as rn
        FROM student_groups
    ) ranked
    WHERE rn > 1
);

-- Step 3: Remove duplicate document shares (keep oldest by shared_at)
DELETE FROM document_shares 
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY document_id, target_type, 
                COALESCE(target_class_id, '00000000-0000-0000-0000-000000000000'),
                COALESCE(target_group_id, '00000000-0000-0000-0000-000000000000'),
                COALESCE(target_user_id, '00000000-0000-0000-0000-000000000000')
            ORDER BY shared_at ASC
        ) as rn
        FROM document_shares
    ) ranked
    WHERE rn > 1
);

-- Verify duplicates are removed
SELECT 'Classes duplicates remaining:' as check, COUNT(*) as count
FROM (SELECT school_id, name FROM classes GROUP BY school_id, name HAVING COUNT(*) > 1) x;

SELECT 'Groups duplicates remaining:' as check, COUNT(*) as count
FROM (SELECT class_id, name FROM student_groups GROUP BY class_id, name HAVING COUNT(*) > 1) x;

SELECT 'Duplicates removed!' as status;
