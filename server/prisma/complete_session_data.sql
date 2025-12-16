-- ============================================
-- COMPLETE SESSION-BASED SAMPLE DATA FOR NEON
-- Run this in Neon SQL Editor
-- ============================================

-- ============================================
-- PART 1: VERIFY/ADD academic_year_id TO ASSIGNMENTS
-- ============================================

-- Add academic_year_id column to assignments if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assignments' AND column_name = 'academic_year_id'
    ) THEN
        ALTER TABLE assignments ADD COLUMN academic_year_id UUID REFERENCES academic_years(id);
        RAISE NOTICE 'Added academic_year_id to assignments table';
    ELSE
        RAISE NOTICE 'academic_year_id already exists in assignments';
    END IF;
END $$;

-- Add academic_year_id column to grades if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'grades' AND column_name = 'academic_year_id'
    ) THEN
        ALTER TABLE grades ADD COLUMN academic_year_id UUID REFERENCES academic_years(id);
        RAISE NOTICE 'Added academic_year_id to grades table';
    ELSE
        RAISE NOTICE 'academic_year_id already exists in grades';
    END IF;
END $$;

-- Add student_id column to users if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'student_id'
    ) THEN
        ALTER TABLE users ADD COLUMN student_id VARCHAR(50);
        RAISE NOTICE 'Added student_id to users table';
    END IF;
END $$;

-- Add due_date to assignment_targets if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assignment_targets' AND column_name = 'due_date'
    ) THEN
        ALTER TABLE assignment_targets ADD COLUMN due_date TIMESTAMP;
        ALTER TABLE assignment_targets ADD COLUMN publish_date TIMESTAMP;
        RAISE NOTICE 'Added due_date and publish_date to assignment_targets table';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE ACADEMIC SESSIONS
-- ============================================

-- Get school ID
DO $$
DECLARE
    v_school_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'No school found! Create a school first.';
    END IF;
    RAISE NOTICE 'Using school: %', v_school_id;
END $$;

-- Reset and create academic years
UPDATE academic_years SET is_current = false;

INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current, created_at)
SELECT 
    'aaaaaaaa-2024-2025-0000-000000000001',
    id, '2024-2025', '2024-04-01', '2025-03-31', false, NOW()
FROM schools LIMIT 1
ON CONFLICT (id) DO UPDATE SET is_current = false;

INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current, created_at)
SELECT 
    'aaaaaaaa-2025-2026-0000-000000000001',
    id, '2025-2026', '2025-04-01', '2026-03-31', true, NOW()
FROM schools LIMIT 1
ON CONFLICT (id) DO UPDATE SET is_current = true;

-- ============================================
-- PART 3: CREATE SUBJECTS (School-level)
-- ============================================

DO $$
DECLARE v_school_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    
    INSERT INTO subjects (id, school_id, code, name, name_hindi, has_lab, lab_hours_per_week, theory_hours_per_week)
    VALUES 
        ('11111111-subj-0001-0000-000000000001', v_school_id, 'CS', 'Computer Science', 'कंप्यूटर विज्ञान', true, 2, 3),
        ('11111111-subj-0002-0000-000000000002', v_school_id, 'PHY', 'Physics', 'भौतिकी', true, 2, 4),
        ('11111111-subj-0003-0000-000000000003', v_school_id, 'CHEM', 'Chemistry', 'रसायन विज्ञान', true, 2, 4)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================
-- PART 4: CREATE LABS (School-level)
-- ============================================

DO $$
DECLARE 
    v_school_id UUID;
    v_instructor_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    INSERT INTO labs (id, school_id, name, name_hindi, room_number, capacity, subject_id, incharge_id)
    VALUES 
        ('22222222-labs-0001-0000-000000000001', v_school_id, 'Computer Lab 1', 'कंप्यूटर प्रयोगशाला 1', 'A-101', 40, '11111111-subj-0001-0000-000000000001', v_instructor_id),
        ('22222222-labs-0002-0000-000000000002', v_school_id, 'Physics Lab', 'भौतिकी प्रयोगशाला', 'B-102', 30, '11111111-subj-0002-0000-000000000002', v_instructor_id)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================
-- PART 5: CREATE STUDENTS (Users)
-- ============================================

DO $$
DECLARE v_school_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    
    -- Students for 2024-25 session
    INSERT INTO users (id, school_id, email, phone, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, student_id, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES 
        ('33333333-stud-0001-0000-000000000001', v_school_id, 'rahul.sharma@demo.com', '9876540001', '$2b$10$DUMMY', 'student', 'Rahul', 'राहुल', 'Sharma', 'शर्मा', 'STU-2024-001', 'ADM-2024-001', true, 'en', NOW(), NOW()),
        ('33333333-stud-0002-0000-000000000002', v_school_id, 'priya.singh@demo.com', '9876540002', '$2b$10$DUMMY', 'student', 'Priya', 'प्रिया', 'Singh', 'सिंह', 'STU-2024-002', 'ADM-2024-002', true, 'en', NOW(), NOW()),
        ('33333333-stud-0003-0000-000000000003', v_school_id, 'amit.kumar@demo.com', '9876540003', '$2b$10$DUMMY', 'student', 'Amit', 'अमित', 'Kumar', 'कुमार', 'STU-2024-003', 'ADM-2024-003', true, 'en', NOW(), NOW()),
        ('33333333-stud-0004-0000-000000000004', v_school_id, 'neha.gupta@demo.com', '9876540004', '$2b$10$DUMMY', 'student', 'Neha', 'नेहा', 'Gupta', 'गुप्ता', 'STU-2024-004', 'ADM-2024-004', true, 'en', NOW(), NOW()),
        -- Students for 2025-26 session
        ('33333333-stud-0005-0000-000000000005', v_school_id, 'ananya.verma@demo.com', '9876540005', '$2b$10$DUMMY', 'student', 'Ananya', 'अनन्या', 'Verma', 'वर्मा', 'STU-2025-001', 'ADM-2025-001', true, 'en', NOW(), NOW()),
        ('33333333-stud-0006-0000-000000000006', v_school_id, 'rohan.joshi@demo.com', '9876540006', '$2b$10$DUMMY', 'student', 'Rohan', 'रोहन', 'Joshi', 'जोशी', 'STU-2025-002', 'ADM-2025-002', true, 'en', NOW(), NOW()),
        ('33333333-stud-0007-0000-000000000007', v_school_id, 'kavita.rao@demo.com', '9876540007', '$2b$10$DUMMY', 'student', 'Kavita', 'कविता', 'Rao', 'राव', 'STU-2025-003', 'ADM-2025-003', true, 'en', NOW(), NOW()),
        ('33333333-stud-0008-0000-000000000008', v_school_id, 'vikram.patel@demo.com', '9876540008', '$2b$10$DUMMY', 'student', 'Vikram', 'विक्रम', 'Patel', 'पटेल', 'STU-2025-004', 'ADM-2025-004', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING;
END $$;

-- ============================================
-- PART 6: CREATE CLASSES (Session-specific)
-- ============================================

DO $$
DECLARE 
    v_school_id UUID;
    v_instructor_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    -- Classes for 2024-25 session
    INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, class_teacher_id, max_students)
    VALUES 
        ('44444444-cls-2024-0001-000000000001', v_school_id, 'aaaaaaaa-2024-2025-0000-000000000001', 'Class 11-A [2024-25]', 'कक्षा 11-अ [2024-25]', 11, 'A', 'Science', v_instructor_id, 50),
        ('44444444-cls-2024-0002-000000000002', v_school_id, 'aaaaaaaa-2024-2025-0000-000000000001', 'Class 11-B [2024-25]', 'कक्षा 11-ब [2024-25]', 11, 'B', 'Commerce', v_instructor_id, 50),
        ('44444444-cls-2024-0003-000000000003', v_school_id, 'aaaaaaaa-2024-2025-0000-000000000001', 'Class 12-A [2024-25]', 'कक्षा 12-अ [2024-25]', 12, 'A', 'Science', v_instructor_id, 50)
    ON CONFLICT (id) DO NOTHING;
    
    -- Classes for 2025-26 session
    INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, class_teacher_id, max_students)
    VALUES 
        ('44444444-cls-2025-0001-000000000001', v_school_id, 'aaaaaaaa-2025-2026-0000-000000000001', 'Class 11-A [2025-26]', 'कक्षा 11-अ [2025-26]', 11, 'A', 'Science', v_instructor_id, 50),
        ('44444444-cls-2025-0002-000000000002', v_school_id, 'aaaaaaaa-2025-2026-0000-000000000001', 'Class 11-B [2025-26]', 'कक्षा 11-ब [2025-26]', 11, 'B', 'Commerce', v_instructor_id, 50),
        ('44444444-cls-2025-0003-000000000003', v_school_id, 'aaaaaaaa-2025-2026-0000-000000000001', 'Class 12-A [2025-26]', 'कक्षा 12-अ [2025-26]', 12, 'A', 'Science', v_instructor_id, 50),
        ('44444444-cls-2025-0004-000000000004', v_school_id, 'aaaaaaaa-2025-2026-0000-000000000001', 'Class 12-B [2025-26]', 'कक्षा 12-ब [2025-26]', 12, 'B', 'Commerce', v_instructor_id, 50)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================
-- PART 7: ENROLL STUDENTS (Session-specific via class)
-- ============================================

-- 2024-25 enrollments
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, enrollment_date, status)
VALUES 
    (gen_random_uuid(), '33333333-stud-0001-0000-000000000001', '44444444-cls-2024-0001-000000000001', 1, '2024-04-01', 'active'),
    (gen_random_uuid(), '33333333-stud-0002-0000-000000000002', '44444444-cls-2024-0001-000000000001', 2, '2024-04-01', 'active'),
    (gen_random_uuid(), '33333333-stud-0003-0000-000000000003', '44444444-cls-2024-0002-000000000002', 1, '2024-04-01', 'active'),
    (gen_random_uuid(), '33333333-stud-0004-0000-000000000004', '44444444-cls-2024-0002-000000000002', 2, '2024-04-01', 'active')
ON CONFLICT (student_id, class_id) DO NOTHING;

-- 2025-26 enrollments
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, enrollment_date, status)
VALUES 
    (gen_random_uuid(), '33333333-stud-0005-0000-000000000005', '44444444-cls-2025-0001-000000000001', 1, '2025-04-01', 'active'),
    (gen_random_uuid(), '33333333-stud-0006-0000-000000000006', '44444444-cls-2025-0001-000000000001', 2, '2025-04-01', 'active'),
    (gen_random_uuid(), '33333333-stud-0007-0000-000000000007', '44444444-cls-2025-0002-000000000002', 1, '2025-04-01', 'active'),
    (gen_random_uuid(), '33333333-stud-0008-0000-000000000008', '44444444-cls-2025-0002-000000000002', 2, '2025-04-01', 'active')
ON CONFLICT (student_id, class_id) DO NOTHING;

-- ============================================
-- PART 8: CREATE STUDENT GROUPS (Session-specific via class)
-- ============================================

DO $$
DECLARE v_instructor_id UUID;
BEGIN
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    -- Groups for 2024-25 classes
    INSERT INTO student_groups (id, class_id, name, name_hindi, description, created_by)
    VALUES 
        ('55555555-grp-2024-0001-000000000001', '44444444-cls-2024-0001-000000000001', 'Team Alpha [2024]', 'टीम अल्फा [2024]', 'Programming group 2024', v_instructor_id),
        ('55555555-grp-2024-0002-000000000002', '44444444-cls-2024-0001-000000000001', 'Team Beta [2024]', 'टीम बीटा [2024]', 'Lab group 2024', v_instructor_id)
    ON CONFLICT (id) DO NOTHING;
    
    -- Groups for 2025-26 classes
    INSERT INTO student_groups (id, class_id, name, name_hindi, description, created_by)
    VALUES 
        ('55555555-grp-2025-0001-000000000001', '44444444-cls-2025-0001-000000000001', 'Team Innovators [2025]', 'टीम इनोवेटर्स [2025]', 'Innovation group 2025', v_instructor_id),
        ('55555555-grp-2025-0002-000000000002', '44444444-cls-2025-0001-000000000001', 'Team Coders [2025]', 'टीम कोडर्स [2025]', 'Coding group 2025', v_instructor_id)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Group members
INSERT INTO group_members (id, group_id, student_id, role)
VALUES 
    -- 2024 groups
    (gen_random_uuid(), '55555555-grp-2024-0001-000000000001', '33333333-stud-0001-0000-000000000001', 'leader'),
    (gen_random_uuid(), '55555555-grp-2024-0001-000000000001', '33333333-stud-0002-0000-000000000002', 'member'),
    -- 2025 groups
    (gen_random_uuid(), '55555555-grp-2025-0001-000000000001', '33333333-stud-0005-0000-000000000005', 'leader'),
    (gen_random_uuid(), '55555555-grp-2025-0001-000000000001', '33333333-stud-0006-0000-000000000006', 'member')
ON CONFLICT (group_id, student_id) DO NOTHING;

-- ============================================
-- PART 9: CREATE ASSIGNMENTS (Session-specific)
-- ============================================

DO $$
DECLARE v_instructor_id UUID; v_school_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    -- Assignments for 2024-25
    INSERT INTO assignments (id, school_id, subject_id, lab_id, academic_year_id, created_by, title, title_hindi, description, experiment_number, assignment_type, status, max_marks, practical_marks, output_marks, viva_marks)
    VALUES 
        ('66666666-asgn-2024-0001-000000000001', v_school_id, '11111111-subj-0001-0000-000000000001', '22222222-labs-0001-0000-000000000001', 'aaaaaaaa-2024-2025-0000-000000000001', v_instructor_id, 'Python Variables [2024]', 'पायथन वेरिएबल्स [2024]', 'Learn Python variables and data types', 'EXP-2024-01', 'program', 'published', 100, 60, 20, 20),
        ('66666666-asgn-2024-0002-000000000002', v_school_id, '11111111-subj-0001-0000-000000000001', '22222222-labs-0001-0000-000000000001', 'aaaaaaaa-2024-2025-0000-000000000001', v_instructor_id, 'Python Loops [2024]', 'पायथन लूप्स [2024]', 'Practice for/while loops', 'EXP-2024-02', 'program', 'published', 100, 60, 20, 20),
        ('66666666-asgn-2024-0003-000000000003', v_school_id, '11111111-subj-0001-0000-000000000001', '22222222-labs-0001-0000-000000000001', 'aaaaaaaa-2024-2025-0000-000000000001', v_instructor_id, 'Functions [2024]', 'फंक्शन्स [2024]', 'Create and use functions', 'EXP-2024-03', 'program', 'published', 100, 60, 20, 20)
    ON CONFLICT (id) DO NOTHING;
    
    -- Assignments for 2025-26
    INSERT INTO assignments (id, school_id, subject_id, lab_id, academic_year_id, created_by, title, title_hindi, description, experiment_number, assignment_type, status, max_marks, practical_marks, output_marks, viva_marks)
    VALUES 
        ('66666666-asgn-2025-0001-000000000001', v_school_id, '11111111-subj-0001-0000-000000000001', '22222222-labs-0001-0000-000000000001', 'aaaaaaaa-2025-2026-0000-000000000001', v_instructor_id, 'OOP Basics [2025]', 'ओओपी बेसिक्स [2025]', 'Object Oriented Programming', 'EXP-2025-01', 'program', 'published', 100, 60, 20, 20),
        ('66666666-asgn-2025-0002-000000000002', v_school_id, '11111111-subj-0001-0000-000000000001', '22222222-labs-0001-0000-000000000001', 'aaaaaaaa-2025-2026-0000-000000000001', v_instructor_id, 'File Handling [2025]', 'फाइल हैंडलिंग [2025]', 'Read/write files in Python', 'EXP-2025-02', 'program', 'published', 100, 60, 20, 20),
        ('66666666-asgn-2025-0003-000000000003', v_school_id, '11111111-subj-0001-0000-000000000001', '22222222-labs-0001-0000-000000000001', 'aaaaaaaa-2025-2026-0000-000000000001', v_instructor_id, 'Exception Handling [2025]', 'एक्सेप्शन हैंडलिंग [2025]', 'Try-except blocks', 'EXP-2025-03', 'program', 'draft', 100, 60, 20, 20),
        ('66666666-asgn-2025-0004-000000000004', v_school_id, '11111111-subj-0001-0000-000000000001', '22222222-labs-0001-0000-000000000001', 'aaaaaaaa-2025-2026-0000-000000000001', v_instructor_id, 'Database Operations [2025]', 'डेटाबेस ऑपरेशन्स [2025]', 'Connect to databases', 'EXP-2025-04', 'program', 'draft', 100, 60, 20, 20)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================
-- PART 10: CREATE ASSIGNMENT TARGETS
-- ============================================

DO $$
DECLARE v_instructor_id UUID;
BEGIN
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    -- Assignment targets for 2024-25 (class-level)
    INSERT INTO assignment_targets (id, assignment_id, target_type, target_class_id, assigned_by, assigned_at, due_date)
    VALUES 
        ('77777777-tgt-2024-0001-000000000001', '66666666-asgn-2024-0001-000000000001', 'class', '44444444-cls-2024-0001-000000000001', v_instructor_id, '2024-05-01', '2024-05-15'),
        ('77777777-tgt-2024-0002-000000000002', '66666666-asgn-2024-0002-000000000002', 'class', '44444444-cls-2024-0001-000000000001', v_instructor_id, '2024-05-16', '2024-05-30')
    ON CONFLICT (id) DO NOTHING;
    
    -- Assignment targets for 2025-26
    INSERT INTO assignment_targets (id, assignment_id, target_type, target_class_id, assigned_by, assigned_at, due_date)
    VALUES 
        ('77777777-tgt-2025-0001-000000000001', '66666666-asgn-2025-0001-000000000001', 'class', '44444444-cls-2025-0001-000000000001', v_instructor_id, '2025-05-01', '2025-05-15'),
        ('77777777-tgt-2025-0002-000000000002', '66666666-asgn-2025-0002-000000000002', 'class', '44444444-cls-2025-0001-000000000001', v_instructor_id, '2025-05-16', '2025-05-30')
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================
-- PART 11: CREATE SUBMISSIONS
-- ============================================

-- Submissions for 2024-25
INSERT INTO submissions (id, assignment_id, student_id, code_content, output_content, observations, status, submitted_at, last_modified)
VALUES 
    ('88888888-sub-2024-0001-000000000001', '66666666-asgn-2024-0001-000000000001', '33333333-stud-0001-0000-000000000001', 'x = 10\nprint(x)', '10', 'Variable assignment works', 'graded', '2024-05-10', NOW()),
    ('88888888-sub-2024-0002-000000000002', '66666666-asgn-2024-0001-000000000001', '33333333-stud-0002-0000-000000000002', 'y = "Hello"\nprint(y)', 'Hello', 'String variable demo', 'graded', '2024-05-12', NOW()),
    ('88888888-sub-2024-0003-000000000003', '66666666-asgn-2024-0002-000000000002', '33333333-stud-0001-0000-000000000001', 'for i in range(5):\n  print(i)', '0 1 2 3 4', 'Loop execution', 'graded', '2024-05-25', NOW())
ON CONFLICT (assignment_id, student_id, submission_number) DO NOTHING;

-- Submissions for 2025-26
INSERT INTO submissions (id, assignment_id, student_id, code_content, output_content, observations, status, submitted_at, last_modified)
VALUES 
    ('88888888-sub-2025-0001-000000000001', '66666666-asgn-2025-0001-000000000001', '33333333-stud-0005-0000-000000000005', 'class Dog:\n  def bark(self):\n    return "Woof!"', 'Woof!', 'Basic class created', 'graded', '2025-05-08', NOW()),
    ('88888888-sub-2025-0002-000000000002', '66666666-asgn-2025-0001-000000000001', '33333333-stud-0006-0000-000000000006', 'class Cat:\n  def meow(self):\n    return "Meow!"', 'Meow!', 'Class method works', 'submitted', '2025-05-10', NOW()),
    ('88888888-sub-2025-0003-000000000003', '66666666-asgn-2025-0002-000000000002', '33333333-stud-0005-0000-000000000005', 'with open("test.txt") as f:\n  data = f.read()', 'File read successful', 'File handling demo', 'submitted', '2025-05-20', NOW())
ON CONFLICT (assignment_id, student_id, submission_number) DO NOTHING;

-- ============================================
-- PART 12: CREATE GRADES (Session-specific)
-- ============================================

DO $$
DECLARE v_instructor_id UUID;
BEGIN
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    -- Grades for 2024-25 submissions
    INSERT INTO grades (id, submission_id, student_id, graded_by, academic_year_id, practical_marks, output_marks, viva_marks, total_marks, max_marks, percentage, grade_letter, is_published, graded_at)
    VALUES 
        ('99999999-grd-2024-0001-000000000001', '88888888-sub-2024-0001-000000000001', '33333333-stud-0001-0000-000000000001', v_instructor_id, 'aaaaaaaa-2024-2025-0000-000000000001', 55, 18, 17, 90, 100, 90.00, 'A+', true, '2024-05-12'),
        ('99999999-grd-2024-0002-000000000002', '88888888-sub-2024-0002-000000000002', '33333333-stud-0002-0000-000000000002', v_instructor_id, 'aaaaaaaa-2024-2025-0000-000000000001', 50, 16, 14, 80, 100, 80.00, 'A', true, '2024-05-14'),
        ('99999999-grd-2024-0003-000000000003', '88888888-sub-2024-0003-000000000003', '33333333-stud-0001-0000-000000000001', v_instructor_id, 'aaaaaaaa-2024-2025-0000-000000000001', 52, 17, 16, 85, 100, 85.00, 'A', true, '2024-05-27')
    ON CONFLICT (submission_id) DO NOTHING;
    
    -- Grades for 2025-26 submissions
    INSERT INTO grades (id, submission_id, student_id, graded_by, academic_year_id, practical_marks, output_marks, viva_marks, total_marks, max_marks, percentage, grade_letter, is_published, graded_at)
    VALUES 
        ('99999999-grd-2025-0001-000000000001', '88888888-sub-2025-0001-000000000001', '33333333-stud-0005-0000-000000000005', v_instructor_id, 'aaaaaaaa-2025-2026-0000-000000000001', 58, 19, 18, 95, 100, 95.00, 'A+', true, '2025-05-10')
    ON CONFLICT (submission_id) DO NOTHING;
END $$;

-- ============================================
-- PART 13: CREATE VIVA SESSIONS
-- ============================================

DO $$
DECLARE v_instructor_id UUID;
BEGIN
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    INSERT INTO viva_sessions (id, submission_id, student_id, examiner_id, scheduled_at, duration_minutes, status, mode, marks_obtained, max_marks, examiner_remarks)
    VALUES 
        -- 2024-25 vivas
        (gen_random_uuid(), '88888888-sub-2024-0001-000000000001', '33333333-stud-0001-0000-000000000001', v_instructor_id, '2024-05-11 10:00:00', 15, 'completed', 'online', 17, 20, 'Excellent understanding'),
        (gen_random_uuid(), '88888888-sub-2024-0002-000000000002', '33333333-stud-0002-0000-000000000002', v_instructor_id, '2024-05-13 11:00:00', 15, 'completed', 'online', 14, 20, 'Good effort'),
        -- 2025-26 vivas
        (gen_random_uuid(), '88888888-sub-2025-0001-000000000001', '33333333-stud-0005-0000-000000000005', v_instructor_id, '2025-05-09 10:00:00', 15, 'completed', 'online', 18, 20, 'Outstanding performance')
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PART 14: CREATE ACTIVITY LOGS
-- ============================================

DO $$
DECLARE v_school_id UUID; v_instructor_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    INSERT INTO activity_logs (id, user_id, school_id, action_type, entity_type, description, created_at)
    VALUES 
        -- 2024-25 logs
        (gen_random_uuid(), '33333333-stud-0001-0000-000000000001', v_school_id, 'login', 'user', 'Student login [2024-25]', '2024-05-09 09:00:00'),
        (gen_random_uuid(), '33333333-stud-0001-0000-000000000001', v_school_id, 'submission', 'submission', 'Submitted Python Variables [2024]', '2024-05-10 14:30:00'),
        (gen_random_uuid(), v_instructor_id, v_school_id, 'grade', 'grade', 'Graded submission [2024-25]', '2024-05-12 10:00:00'),
        -- 2025-26 logs
        (gen_random_uuid(), '33333333-stud-0005-0000-000000000005', v_school_id, 'login', 'user', 'Student login [2025-26]', '2025-05-07 08:30:00'),
        (gen_random_uuid(), '33333333-stud-0005-0000-000000000005', v_school_id, 'submission', 'submission', 'Submitted OOP Basics [2025]', '2025-05-08 15:00:00'),
        (gen_random_uuid(), v_instructor_id, v_school_id, 'assignment', 'assignment', 'Created File Handling [2025]', '2025-05-01 11:00:00')
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- PART 15: CREATE CLASS-SUBJECTS MAPPING
-- ============================================

DO $$
DECLARE v_instructor_id UUID;
BEGIN
    SELECT id INTO v_instructor_id FROM users WHERE role = 'instructor' LIMIT 1;
    
    -- 2024-25 class-subject mapping
    INSERT INTO class_subjects (id, class_id, subject_id, instructor_id, lab_instructor_id)
    VALUES 
        (gen_random_uuid(), '44444444-cls-2024-0001-000000000001', '11111111-subj-0001-0000-000000000001', v_instructor_id, v_instructor_id),
        (gen_random_uuid(), '44444444-cls-2024-0001-000000000001', '11111111-subj-0002-0000-000000000002', v_instructor_id, v_instructor_id)
    ON CONFLICT (class_id, subject_id) DO NOTHING;
    
    -- 2025-26 class-subject mapping
    INSERT INTO class_subjects (id, class_id, subject_id, instructor_id, lab_instructor_id)
    VALUES 
        (gen_random_uuid(), '44444444-cls-2025-0001-000000000001', '11111111-subj-0001-0000-000000000001', v_instructor_id, v_instructor_id),
        (gen_random_uuid(), '44444444-cls-2025-0001-000000000001', '11111111-subj-0002-0000-000000000002', v_instructor_id, v_instructor_id)
    ON CONFLICT (class_id, subject_id) DO NOTHING;
END $$;

-- ============================================
-- VERIFICATION: Check session data counts
-- ============================================

SELECT '=== VERIFICATION ===' AS info;

SELECT ay.year_label AS "Session",
       ay.is_current AS "Current",
       (SELECT COUNT(*) FROM classes c WHERE c.academic_year_id = ay.id) AS "Classes",
       (SELECT COUNT(*) FROM class_enrollments ce JOIN classes c ON ce.class_id = c.id WHERE c.academic_year_id = ay.id) AS "Enrollments",
       (SELECT COUNT(*) FROM student_groups sg JOIN classes c ON sg.class_id = c.id WHERE c.academic_year_id = ay.id) AS "Groups",
       (SELECT COUNT(*) FROM assignments a WHERE a.academic_year_id = ay.id) AS "Assignments",
       (SELECT COUNT(*) FROM submissions s JOIN assignments a ON s.assignment_id = a.id WHERE a.academic_year_id = ay.id) AS "Submissions",
       (SELECT COUNT(*) FROM grades g WHERE g.academic_year_id = ay.id) AS "Grades"
FROM academic_years ay
ORDER BY ay.start_date DESC;
