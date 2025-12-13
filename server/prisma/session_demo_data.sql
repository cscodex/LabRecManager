-- ============================================
-- ACADEMIC SESSION DEMO DATA
-- Complete script with your IDs
-- ============================================

-- IDs provided by user:
-- School ID: 0cc0e430-ee19-41f6-9930-065ecc9e0216  
-- Instructor ID: 32608cb1-a138-48eb-9333-2fb0a78ca094
-- Subject ID: 9b64f6f4-7f5b-4dbe-a0e0-cbbc1b9636f3

-- ============================================
-- STEP 1: CREATE ACADEMIC SESSIONS
-- ============================================

-- First, unset any existing current session
UPDATE academic_years SET is_current = false WHERE is_current = true;

-- Create 2024-2025 session (historical - read-only)
INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current, created_at)
VALUES (
    'aaaaaaaa-2024-2025-0000-000000000001',
    '0cc0e430-ee19-41f6-9930-065ecc9e0216',
    '2024-2025',
    '2024-04-01',
    '2025-03-31',
    false,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create 2025-2026 session (current - editable)
INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current, created_at)
VALUES (
    'aaaaaaaa-2025-2026-0000-000000000001',
    '0cc0e430-ee19-41f6-9930-065ecc9e0216',
    '2025-2026',
    '2025-04-01',
    '2026-03-31',
    true,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 2: CREATE CLASSES FOR EACH SESSION
-- ============================================

-- Classes for 2024-2025 session (historical)
INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students, created_at)
VALUES 
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aaaaaaaa-2024-2025-0000-000000000001', 'Class 11-A (Commerce) [2024-25]', 'कक्षा 11-अ (वाणिज्य)', 11, 'A', 'Commerce', 50, NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aaaaaaaa-2024-2025-0000-000000000001', 'Class 11-B (NonMedical) [2024-25]', 'कक्षा 11-ब (नॉन-मेडिकल)', 11, 'B', 'NonMedical', 50, NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aaaaaaaa-2024-2025-0000-000000000001', 'Class 12-A (Commerce) [2024-25]', 'कक्षा 12-अ (वाणिज्य)', 12, 'A', 'Commerce', 50, NOW());

-- Classes for 2025-2026 session (current)
INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students, created_at)
VALUES 
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aaaaaaaa-2025-2026-0000-000000000001', 'Class 11-A (Commerce)', 'कक्षा 11-अ (वाणिज्य)', 11, 'A', 'Commerce', 50, NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aaaaaaaa-2025-2026-0000-000000000001', 'Class 11-B (Medical)', 'कक्षा 11-ब (मेडिकल)', 11, 'B', 'Medical', 50, NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aaaaaaaa-2025-2026-0000-000000000001', 'Class 12-A (NonMedical)', 'कक्षा 12-अ (नॉन-मेडिकल)', 12, 'A', 'NonMedical', 50, NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aaaaaaaa-2025-2026-0000-000000000001', 'Class 12-B (Commerce)', 'कक्षा 12-ब (वाणिज्य)', 12, 'B', 'Commerce', 50, NOW());

-- ============================================
-- STEP 3: CREATE ASSIGNMENTS FOR EACH SESSION
-- ============================================

-- Assignments for 2024-2025 session (historical)
INSERT INTO assignments (id, school_id, subject_id, academic_year_id, created_by, title, title_hindi, description, experiment_number, assignment_type, status, max_marks, passing_marks, viva_marks, practical_marks, output_marks, created_at, updated_at)
VALUES 
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', '9b64f6f4-7f5b-4dbe-a0e0-cbbc1b9636f3', 'aaaaaaaa-2024-2025-0000-000000000001', '32608cb1-a138-48eb-9333-2fb0a78ca094', 
     'Python Basics - Variables [2024]', 'पायथन बेसिक्स - वेरिएबल्स', 'Learn about Python variables and data types', 'EXP-2024-01', 'program', 'published', 100, 35, 20, 60, 20, NOW(), NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', '9b64f6f4-7f5b-4dbe-a0e0-cbbc1b9636f3', 'aaaaaaaa-2024-2025-0000-000000000001', '32608cb1-a138-48eb-9333-2fb0a78ca094', 
     'Python Loops - For and While [2024]', 'पायथन लूप्स - फॉर और वाइल', 'Practice loops in Python', 'EXP-2024-02', 'program', 'published', 100, 35, 20, 60, 20, NOW(), NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', '9b64f6f4-7f5b-4dbe-a0e0-cbbc1b9636f3', 'aaaaaaaa-2024-2025-0000-000000000001', '32608cb1-a138-48eb-9333-2fb0a78ca094', 
     'Functions in Python [2024]', 'पायथन में फंक्शन्स', 'Create and use functions', 'EXP-2024-03', 'program', 'published', 100, 35, 20, 60, 20, NOW(), NOW());

-- Assignments for 2025-2026 session (current)
INSERT INTO assignments (id, school_id, subject_id, academic_year_id, created_by, title, title_hindi, description, experiment_number, assignment_type, status, max_marks, passing_marks, viva_marks, practical_marks, output_marks, created_at, updated_at)
VALUES 
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', '9b64f6f4-7f5b-4dbe-a0e0-cbbc1b9636f3', 'aaaaaaaa-2025-2026-0000-000000000001', '32608cb1-a138-48eb-9333-2fb0a78ca094', 
     'Python Advanced - OOP Basics', 'पायथन एडवांस्ड - ओओपी बेसिक्स', 'Object Oriented Programming concepts', 'EXP-2025-01', 'program', 'published', 100, 35, 20, 60, 20, NOW(), NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', '9b64f6f4-7f5b-4dbe-a0e0-cbbc1b9636f3', 'aaaaaaaa-2025-2026-0000-000000000001', '32608cb1-a138-48eb-9333-2fb0a78ca094', 
     'File Handling in Python', 'पायथन में फाइल हैंडलिंग', 'Read and write files using Python', 'EXP-2025-02', 'program', 'published', 100, 35, 20, 60, 20, NOW(), NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', '9b64f6f4-7f5b-4dbe-a0e0-cbbc1b9636f3', 'aaaaaaaa-2025-2026-0000-000000000001', '32608cb1-a138-48eb-9333-2fb0a78ca094', 
     'Exception Handling', 'एक्सेप्शन हैंडलिंग', 'Try-except blocks and error handling', 'EXP-2025-03', 'program', 'draft', 100, 35, 20, 60, 20, NOW(), NOW()),
    (gen_random_uuid(), '0cc0e430-ee19-41f6-9930-065ecc9e0216', '9b64f6f4-7f5b-4dbe-a0e0-cbbc1b9636f3', 'aaaaaaaa-2025-2026-0000-000000000001', '32608cb1-a138-48eb-9333-2fb0a78ca094', 
     'Database Operations with Python', 'पायथन के साथ डेटाबेस ऑपरेशन्स', 'Connect and query databases', 'EXP-2025-04', 'program', 'draft', 100, 35, 20, 60, 20, NOW(), NOW());

-- ============================================
-- VERIFICATION: Check session-wise data
-- ============================================

-- View sessions
SELECT id, year_label, is_current FROM academic_years ORDER BY start_date DESC;

-- View classes by session
SELECT 
    ay.year_label as "Session",
    c.name as "Class Name",
    c.stream as "Stream",
    c.grade_level as "Grade"
FROM classes c
JOIN academic_years ay ON c.academic_year_id = ay.id
ORDER BY ay.start_date DESC, c.grade_level;

-- View assignments by session
SELECT 
    ay.year_label as "Session",
    a.experiment_number as "Exp No",
    a.title as "Title",
    a.status as "Status"
FROM assignments a
JOIN academic_years ay ON a.academic_year_id = ay.id
ORDER BY ay.start_date DESC, a.experiment_number;
