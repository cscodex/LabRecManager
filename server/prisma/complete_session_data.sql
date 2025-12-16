-- ============================================
-- COMPREHENSIVE SESSION SAMPLE DATA
-- Complete data for both 2024-25 and 2025-26 sessions
-- ============================================

-- NOTE: Run session_demo_data.sql first to create sessions, classes, and assignments

-- ============================================
-- STEP 1: Get IDs from existing data
-- ============================================
-- School ID: 0cc0e430-ee19-41f6-9930-065ecc9e0216
-- Instructor ID: 32608cb1-a138-48eb-9333-2fb0a78ca094
-- Session 2024-25: aaaaaaaa-2024-2025-0000-000000000001
-- Session 2025-26: aaaaaaaa-2025-2026-0000-000000000001

-- ============================================
-- STEP 2: CREATE SAMPLE STUDENTS
-- ============================================

-- Create students for testing (if not already present)
INSERT INTO users (id, school_id, email, phone, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, student_id, admission_number, is_active, preferred_language, created_at, updated_at)
VALUES 
    -- Students for 2024-25 session
    ('bbbbbbbb-0001-0000-0000-000000000001', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student1@demo.com', '9876543001', '$2b$10$DUMMY_HASH', 'student', 'Rahul', 'राहुल', 'Sharma', 'शर्मा', 'STU-2024-001', 'ADM-001', true, 'en', NOW(), NOW()),
    ('bbbbbbbb-0002-0000-0000-000000000002', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student2@demo.com', '9876543002', '$2b$10$DUMMY_HASH', 'student', 'Priya', 'प्रिया', 'Singh', 'सिंह', 'STU-2024-002', 'ADM-002', true, 'en', NOW(), NOW()),
    ('bbbbbbbb-0003-0000-0000-000000000003', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student3@demo.com', '9876543003', '$2b$10$DUMMY_HASH', 'student', 'Amit', 'अमित', 'Kumar', 'कुमार', 'STU-2024-003', 'ADM-003', true, 'en', NOW(), NOW()),
    ('bbbbbbbb-0004-0000-0000-000000000004', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student4@demo.com', '9876543004', '$2b$10$DUMMY_HASH', 'student', 'Neha', 'नेहा', 'Gupta', 'गुप्ता', 'STU-2024-004', 'ADM-004', true, 'en', NOW(), NOW()),
    ('bbbbbbbb-0005-0000-0000-000000000005', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student5@demo.com', '9876543005', '$2b$10$DUMMY_HASH', 'student', 'Vikram', 'विक्रम', 'Patel', 'पटेल', 'STU-2024-005', 'ADM-005', true, 'en', NOW(), NOW()),
    -- Students for 2025-26 session
    ('bbbbbbbb-0006-0000-0000-000000000006', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student6@demo.com', '9876543006', '$2b$10$DUMMY_HASH', 'student', 'Ananya', 'अनन्या', 'Verma', 'वर्मा', 'STU-2025-001', 'ADM-006', true, 'en', NOW(), NOW()),
    ('bbbbbbbb-0007-0000-0000-000000000007', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student7@demo.com', '9876543007', '$2b$10$DUMMY_HASH', 'student', 'Rohan', 'रोहन', 'Joshi', 'जोशी', 'STU-2025-002', 'ADM-007', true, 'en', NOW(), NOW()),
    ('bbbbbbbb-0008-0000-0000-000000000008', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student8@demo.com', '9876543008', '$2b$10$DUMMY_HASH', 'student', 'Kavita', 'कविता', 'Rao', 'राव', 'STU-2025-003', 'ADM-008', true, 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- STEP 3: ENROLL STUDENTS IN CLASSES
-- ============================================

-- Get class IDs dynamically and enroll students
DO $$
DECLARE
    class_2024_1 UUID;
    class_2024_2 UUID;
    class_2025_1 UUID;
    class_2025_2 UUID;
BEGIN
    -- Get 2024-25 classes
    SELECT id INTO class_2024_1 FROM classes WHERE academic_year_id = 'aaaaaaaa-2024-2025-0000-000000000001' LIMIT 1;
    SELECT id INTO class_2024_2 FROM classes WHERE academic_year_id = 'aaaaaaaa-2024-2025-0000-000000000001' OFFSET 1 LIMIT 1;
    
    -- Get 2025-26 classes
    SELECT id INTO class_2025_1 FROM classes WHERE academic_year_id = 'aaaaaaaa-2025-2026-0000-000000000001' LIMIT 1;
    SELECT id INTO class_2025_2 FROM classes WHERE academic_year_id = 'aaaaaaaa-2025-2026-0000-000000000001' OFFSET 1 LIMIT 1;

    -- Enroll students in 2024-25 classes
    IF class_2024_1 IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, enrollment_date, status)
        VALUES 
            (gen_random_uuid(), 'bbbbbbbb-0001-0000-0000-000000000001', class_2024_1, 1, '2024-04-01', 'active'),
            (gen_random_uuid(), 'bbbbbbbb-0002-0000-0000-000000000002', class_2024_1, 2, '2024-04-01', 'active'),
            (gen_random_uuid(), 'bbbbbbbb-0003-0000-0000-000000000003', class_2024_1, 3, '2024-04-01', 'active')
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;
    
    IF class_2024_2 IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, enrollment_date, status)
        VALUES 
            (gen_random_uuid(), 'bbbbbbbb-0004-0000-0000-000000000004', class_2024_2, 1, '2024-04-01', 'active'),
            (gen_random_uuid(), 'bbbbbbbb-0005-0000-0000-000000000005', class_2024_2, 2, '2024-04-01', 'active')
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;
    
    -- Enroll students in 2025-26 classes
    IF class_2025_1 IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, enrollment_date, status)
        VALUES 
            (gen_random_uuid(), 'bbbbbbbb-0006-0000-0000-000000000006', class_2025_1, 1, '2025-04-01', 'active'),
            (gen_random_uuid(), 'bbbbbbbb-0007-0000-0000-000000000007', class_2025_1, 2, '2025-04-01', 'active'),
            (gen_random_uuid(), 'bbbbbbbb-0008-0000-0000-000000000008', class_2025_1, 3, '2025-04-01', 'active')
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;
END $$;

-- ============================================
-- STEP 4: CREATE STUDENT GROUPS
-- ============================================

DO $$
DECLARE
    class_2024_1 UUID;
    class_2025_1 UUID;
    group_2024 UUID;
    group_2025 UUID;
BEGIN
    SELECT id INTO class_2024_1 FROM classes WHERE academic_year_id = 'aaaaaaaa-2024-2025-0000-000000000001' LIMIT 1;
    SELECT id INTO class_2025_1 FROM classes WHERE academic_year_id = 'aaaaaaaa-2025-2026-0000-000000000001' LIMIT 1;

    -- Create groups for 2024-25
    IF class_2024_1 IS NOT NULL THEN
        INSERT INTO student_groups (id, class_id, name, name_hindi, description, created_by, created_at)
        VALUES 
            ('cccccccc-0001-0000-0000-000000000001', class_2024_1, 'Group Alpha [2024]', 'ग्रुप अल्फा', 'First study group', '32608cb1-a138-48eb-9333-2fb0a78ca094', NOW()),
            ('cccccccc-0002-0000-0000-000000000002', class_2024_1, 'Group Beta [2024]', 'ग्रुप बीटा', 'Second study group', '32608cb1-a138-48eb-9333-2fb0a78ca094', NOW())
        ON CONFLICT (id) DO NOTHING;
        
        -- Add members to groups
        INSERT INTO group_members (id, group_id, student_id, role, joined_at)
        VALUES 
            (gen_random_uuid(), 'cccccccc-0001-0000-0000-000000000001', 'bbbbbbbb-0001-0000-0000-000000000001', 'leader', NOW()),
            (gen_random_uuid(), 'cccccccc-0001-0000-0000-000000000001', 'bbbbbbbb-0002-0000-0000-000000000002', 'member', NOW()),
            (gen_random_uuid(), 'cccccccc-0002-0000-0000-000000000002', 'bbbbbbbb-0003-0000-0000-000000000003', 'leader', NOW())
        ON CONFLICT (group_id, student_id) DO NOTHING;
    END IF;

    -- Create groups for 2025-26
    IF class_2025_1 IS NOT NULL THEN
        INSERT INTO student_groups (id, class_id, name, name_hindi, description, created_by, created_at)
        VALUES 
            ('cccccccc-0003-0000-0000-000000000003', class_2025_1, 'Team Innovators', 'टीम इनोवेटर्स', 'Innovation group 2025', '32608cb1-a138-48eb-9333-2fb0a78ca094', NOW()),
            ('cccccccc-0004-0000-0000-000000000004', class_2025_1, 'Team Coders', 'टीम कोडर्स', 'Coding group 2025', '32608cb1-a138-48eb-9333-2fb0a78ca094', NOW())
        ON CONFLICT (id) DO NOTHING;
        
        INSERT INTO group_members (id, group_id, student_id, role, joined_at)
        VALUES 
            (gen_random_uuid(), 'cccccccc-0003-0000-0000-000000000003', 'bbbbbbbb-0006-0000-0000-000000000006', 'leader', NOW()),
            (gen_random_uuid(), 'cccccccc-0003-0000-0000-000000000003', 'bbbbbbbb-0007-0000-0000-000000000007', 'member', NOW()),
            (gen_random_uuid(), 'cccccccc-0004-0000-0000-000000000004', 'bbbbbbbb-0008-0000-0000-000000000008', 'leader', NOW())
        ON CONFLICT (group_id, student_id) DO NOTHING;
    END IF;
END $$;

-- ============================================
-- STEP 5: CREATE SUBMISSIONS AND GRADES
-- ============================================

DO $$
DECLARE
    assignment_2024 UUID;
    assignment_2025 UUID;
    sub_id_1 UUID;
    sub_id_2 UUID;
    sub_id_3 UUID;
    sub_id_4 UUID;
BEGIN
    -- Get assignments
    SELECT id INTO assignment_2024 FROM assignments WHERE academic_year_id = 'aaaaaaaa-2024-2025-0000-000000000001' LIMIT 1;
    SELECT id INTO assignment_2025 FROM assignments WHERE academic_year_id = 'aaaaaaaa-2025-2026-0000-000000000001' AND status = 'published' LIMIT 1;

    -- Create submissions for 2024-25
    IF assignment_2024 IS NOT NULL THEN
        sub_id_1 := gen_random_uuid();
        sub_id_2 := gen_random_uuid();
        
        INSERT INTO submissions (id, assignment_id, student_id, code_content, output_content, observations, status, submitted_at, last_modified)
        VALUES 
            (sub_id_1, assignment_2024, 'bbbbbbbb-0001-0000-0000-000000000001', 'print("Hello World")', 'Hello World', 'Program runs successfully', 'graded', '2024-05-15', NOW()),
            (sub_id_2, assignment_2024, 'bbbbbbbb-0002-0000-0000-000000000002', 'print("Python Basics")', 'Python Basics', 'Completed with minor errors', 'graded', '2024-05-16', NOW())
        ON CONFLICT (assignment_id, student_id, submission_number) DO NOTHING;

        -- Create grades for 2024-25 submissions
        INSERT INTO grades (id, submission_id, student_id, graded_by, academic_year_id, practical_marks, output_marks, viva_marks, total_marks, max_marks, percentage, grade_letter, is_published, graded_at, updated_at)
        VALUES 
            (gen_random_uuid(), sub_id_1, 'bbbbbbbb-0001-0000-0000-000000000001', '32608cb1-a138-48eb-9333-2fb0a78ca094', 'aaaaaaaa-2024-2025-0000-000000000001', 55, 18, 17, 90, 100, 90.00, 'A+', true, NOW(), NOW()),
            (gen_random_uuid(), sub_id_2, 'bbbbbbbb-0002-0000-0000-000000000002', '32608cb1-a138-48eb-9333-2fb0a78ca094', 'aaaaaaaa-2024-2025-0000-000000000001', 50, 15, 15, 80, 100, 80.00, 'A', true, NOW(), NOW())
        ON CONFLICT (submission_id) DO NOTHING;
    END IF;

    -- Create submissions for 2025-26
    IF assignment_2025 IS NOT NULL THEN
        sub_id_3 := gen_random_uuid();
        sub_id_4 := gen_random_uuid();
        
        INSERT INTO submissions (id, assignment_id, student_id, code_content, output_content, observations, status, submitted_at, last_modified)
        VALUES 
            (sub_id_3, assignment_2025, 'bbbbbbbb-0006-0000-0000-000000000006', 'class Student:\n    pass', 'Object created successfully', 'OOP concepts demonstrated', 'graded', '2025-05-10', NOW()),
            (sub_id_4, assignment_2025, 'bbbbbbbb-0007-0000-0000-000000000007', 'class Teacher:\n    def teach(self):\n        return "Teaching"', 'Teaching', 'Good implementation', 'submitted', '2025-05-12', NOW())
        ON CONFLICT (assignment_id, student_id, submission_number) DO NOTHING;

        -- Create grade for 2025-26 submission
        INSERT INTO grades (id, submission_id, student_id, graded_by, academic_year_id, practical_marks, output_marks, viva_marks, total_marks, max_marks, percentage, grade_letter, is_published, graded_at, updated_at)
        VALUES 
            (gen_random_uuid(), sub_id_3, 'bbbbbbbb-0006-0000-0000-000000000006', '32608cb1-a138-48eb-9333-2fb0a78ca094', 'aaaaaaaa-2025-2026-0000-000000000001', 58, 19, 18, 95, 100, 95.00, 'A+', true, NOW(), NOW())
        ON CONFLICT (submission_id) DO NOTHING;
    END IF;
END $$;

-- ============================================
-- STEP 6: CREATE ACTIVITY LOGS
-- ============================================

INSERT INTO activity_logs (id, user_id, school_id, activity_type, entity_type, entity_id, description, created_at)
VALUES 
    -- 2024-25 session activity
    (gen_random_uuid(), 'bbbbbbbb-0001-0000-0000-000000000001', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'login', 'session', NULL, 'Student logged in', '2024-05-14 09:00:00'),
    (gen_random_uuid(), 'bbbbbbbb-0001-0000-0000-000000000001', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'submission', 'submission', NULL, 'Submitted Python Basics assignment', '2024-05-15 14:30:00'),
    (gen_random_uuid(), '32608cb1-a138-48eb-9333-2fb0a78ca094', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'grade', 'grade', NULL, 'Graded submission by Rahul Sharma', '2024-05-16 10:00:00'),
    -- 2025-26 session activity  
    (gen_random_uuid(), 'bbbbbbbb-0006-0000-0000-000000000006', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'login', 'session', NULL, 'Student logged in', '2025-05-09 08:30:00'),
    (gen_random_uuid(), 'bbbbbbbb-0006-0000-0000-000000000006', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'submission', 'submission', NULL, 'Submitted OOP Basics assignment', '2025-05-10 15:00:00'),
    (gen_random_uuid(), 'bbbbbbbb-0007-0000-0000-000000000007', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'login', 'session', NULL, 'Student logged in', '2025-05-11 09:00:00'),
    (gen_random_uuid(), '32608cb1-a138-48eb-9333-2fb0a78ca094', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'assignment', 'assignment', NULL, 'Created new assignment: File Handling', '2025-05-05 11:00:00');

-- ============================================
-- STEP 7: CREATE ASSIGNMENT TARGETS
-- ============================================

DO $$
DECLARE
    assignment_2024 UUID;
    assignment_2025 UUID;
    class_2024 UUID;
    class_2025 UUID;
BEGIN
    SELECT id INTO assignment_2024 FROM assignments WHERE academic_year_id = 'aaaaaaaa-2024-2025-0000-000000000001' LIMIT 1;
    SELECT id INTO assignment_2025 FROM assignments WHERE academic_year_id = 'aaaaaaaa-2025-2026-0000-000000000001' AND status = 'published' LIMIT 1;
    SELECT id INTO class_2024 FROM classes WHERE academic_year_id = 'aaaaaaaa-2024-2025-0000-000000000001' LIMIT 1;
    SELECT id INTO class_2025 FROM classes WHERE academic_year_id = 'aaaaaaaa-2025-2026-0000-000000000001' LIMIT 1;

    IF assignment_2024 IS NOT NULL AND class_2024 IS NOT NULL THEN
        INSERT INTO assignment_targets (id, assignment_id, target_type, target_class_id, assigned_by, assigned_at, due_date)
        VALUES (gen_random_uuid(), assignment_2024, 'class', class_2024, '32608cb1-a138-48eb-9333-2fb0a78ca094', '2024-05-01', '2024-05-20')
        ON CONFLICT DO NOTHING;
    END IF;

    IF assignment_2025 IS NOT NULL AND class_2025 IS NOT NULL THEN
        INSERT INTO assignment_targets (id, assignment_id, target_type, target_class_id, assigned_by, assigned_at, due_date)
        VALUES (gen_random_uuid(), assignment_2025, 'class', class_2025, '32608cb1-a138-48eb-9333-2fb0a78ca094', '2025-05-01', '2025-05-25')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check data counts by session
SELECT 
    ay.year_label AS "Session",
    (SELECT COUNT(*) FROM classes WHERE academic_year_id = ay.id) AS "Classes",
    (SELECT COUNT(*) FROM assignments WHERE academic_year_id = ay.id) AS "Assignments",
    (SELECT COUNT(*) FROM grades WHERE academic_year_id = ay.id) AS "Grades",
    (SELECT COUNT(*) FROM class_enrollments ce JOIN classes c ON ce.class_id = c.id WHERE c.academic_year_id = ay.id) AS "Enrollments"
FROM academic_years ay
ORDER BY ay.start_date DESC;
