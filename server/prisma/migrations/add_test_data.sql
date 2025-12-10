-- =============================================
-- COMPREHENSIVE TEST DATA INSERTION
-- Run this in Neon SQL Editor
-- This creates all necessary test data
-- =============================================

-- 1. First check existing data
SELECT 'Users:' as table_name, COUNT(*) as count FROM users;
SELECT 'Assignments:' as table_name, COUNT(*) as count FROM assignments;
SELECT 'Submissions:' as table_name, COUNT(*) as count FROM submissions;
SELECT 'Grades:' as table_name, COUNT(*) as count FROM grades;
SELECT 'Grade History:' as table_name, COUNT(*) as count FROM grade_history;

-- 2. CREATE DEVICE_TESTS TABLE (if not exists)
CREATE TABLE IF NOT EXISTS device_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    camera_status VARCHAR(50),
    camera_tested_at TIMESTAMPTZ,
    camera_device_id TEXT,
    camera_device_name TEXT,
    mic_status VARCHAR(50),
    mic_tested_at TIMESTAMPTZ,
    mic_device_id TEXT,
    mic_device_name TEXT,
    speaker_status VARCHAR(50),
    speaker_tested_at TIMESTAMPTZ,
    speaker_device_id TEXT,
    speaker_device_name TEXT,
    speaker_volume INTEGER,
    user_agent TEXT,
    platform VARCHAR(50),
    browser VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 3. CREATE GRADE_HISTORY TABLE (if not exists)
CREATE TABLE IF NOT EXISTS grade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    previous_marks JSONB,
    new_marks JSONB,
    reason TEXT,
    modified_by UUID REFERENCES users(id),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ADD MISSING COLUMNS TO GRADES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grades' AND column_name = 'modified_at') THEN
        ALTER TABLE grades ADD COLUMN modified_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grades' AND column_name = 'modified_by_id') THEN
        ALTER TABLE grades ADD COLUMN modified_by_id UUID REFERENCES users(id);
    END IF;
END $$;

-- 5. GET IDs for inserting test data
DO $$
DECLARE
    v_school_id UUID;
    v_academic_year_id UUID;
    v_class_id UUID;
    v_subject_id UUID;
    v_student_id UUID;
    v_instructor_id UUID;
    v_assignment_id UUID;
    v_submission_id UUID;
    v_grade_id UUID;
BEGIN
    -- Get school
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    
    -- Get academic year
    SELECT id INTO v_academic_year_id FROM academic_years WHERE is_current = true LIMIT 1;
    IF v_academic_year_id IS NULL THEN
        SELECT id INTO v_academic_year_id FROM academic_years LIMIT 1;
    END IF;
    
    -- Get class
    SELECT id INTO v_class_id FROM classes LIMIT 1;
    
    -- Get subject
    SELECT id INTO v_subject_id FROM subjects LIMIT 1;
    
    -- Get student
    SELECT id INTO v_student_id FROM users WHERE role = 'student' LIMIT 1;
    
    -- Get instructor
    SELECT id INTO v_instructor_id FROM users WHERE role IN ('instructor', 'admin', 'principal') LIMIT 1;
    
    -- If no assignment exists, create one
    SELECT id INTO v_assignment_id FROM assignments LIMIT 1;
    IF v_assignment_id IS NULL AND v_class_id IS NOT NULL AND v_subject_id IS NOT NULL AND v_instructor_id IS NOT NULL THEN
        INSERT INTO assignments (id, title, description, class_id, subject_id, created_by_id, status, max_marks)
        VALUES (gen_random_uuid(), 'Test Lab Assignment 1', 'Test assignment for grade testing', v_class_id, v_subject_id, v_instructor_id, 'active', 100)
        RETURNING id INTO v_assignment_id;
        RAISE NOTICE 'Created assignment: %', v_assignment_id;
    END IF;
    
    -- If no submission exists, create one
    SELECT id INTO v_submission_id FROM submissions LIMIT 1;
    IF v_submission_id IS NULL AND v_assignment_id IS NOT NULL AND v_student_id IS NOT NULL THEN
        INSERT INTO submissions (id, assignment_id, student_id, status, content, submitted_at)
        VALUES (gen_random_uuid(), v_assignment_id, v_student_id, 'submitted', 'Test submission content', NOW())
        RETURNING id INTO v_submission_id;
        RAISE NOTICE 'Created submission: %', v_submission_id;
    END IF;
    
    -- If no grade exists, create one
    SELECT id INTO v_grade_id FROM grades LIMIT 1;
    IF v_grade_id IS NULL AND v_submission_id IS NOT NULL AND v_instructor_id IS NOT NULL THEN
        INSERT INTO grades (id, submission_id, graded_by_id, experiment_marks, viva_marks, attendance_marks, record_marks, final_marks, max_marks, percentage, feedback, is_published, graded_at)
        VALUES (gen_random_uuid(), v_submission_id, v_instructor_id, 25, 20, 10, 30, 85, 100, 85.00, 'Good work!', true, NOW())
        RETURNING id INTO v_grade_id;
        RAISE NOTICE 'Created grade: %', v_grade_id;
    END IF;
    
    RAISE NOTICE 'School: %, Academic Year: %, Class: %, Subject: %, Student: %, Instructor: %', 
        v_school_id, v_academic_year_id, v_class_id, v_subject_id, v_student_id, v_instructor_id;
END $$;

-- 6. Insert sample grades linked to existing submissions
INSERT INTO grades (id, submission_id, graded_by_id, experiment_marks, viva_marks, attendance_marks, record_marks, final_marks, max_marks, percentage, feedback, is_published, graded_at)
SELECT 
    gen_random_uuid(),
    s.id,
    (SELECT id FROM users WHERE role = 'instructor' LIMIT 1),
    20 + (RANDOM() * 10)::INT,
    15 + (RANDOM() * 10)::INT,
    8 + (RANDOM() * 2)::INT,
    25 + (RANDOM() * 10)::INT,
    70 + (RANDOM() * 25)::INT,
    100,
    70 + (RANDOM() * 25),
    CASE (RANDOM() * 3)::INT
        WHEN 0 THEN 'Good work! Keep it up.'
        WHEN 1 THEN 'Well done! Excellent understanding of concepts.'
        WHEN 2 THEN 'Satisfactory performance. Focus on practical skills.'
        ELSE 'Great effort! Minor improvements needed.'
    END,
    true,
    NOW() - (INTERVAL '1 day' * (RANDOM() * 10)::INT)
FROM submissions s
WHERE NOT EXISTS (SELECT 1 FROM grades g WHERE g.submission_id = s.id)
LIMIT 10;

-- 7. Insert grade history for existing grades
INSERT INTO grade_history (id, grade_id, previous_marks, new_marks, modified_by, modified_at, reason)
SELECT 
    gen_random_uuid(),
    g.id,
    jsonb_build_object('final_marks', g.final_marks - 5, 'experiment_marks', g.experiment_marks - 2),
    jsonb_build_object('final_marks', g.final_marks, 'experiment_marks', g.experiment_marks),
    g.graded_by_id,
    g.graded_at - INTERVAL '1 day',
    'Re-evaluation after student request'
FROM grades g
WHERE NOT EXISTS (SELECT 1 FROM grade_history gh WHERE gh.grade_id = g.id)
LIMIT 5;

-- 8. Update grades to mark as modified
UPDATE grades 
SET modified_at = NOW() - INTERVAL '1 day',
    modified_by_id = graded_by_id
WHERE id IN (SELECT DISTINCT grade_id FROM grade_history);

-- 9. Insert device test data
INSERT INTO device_tests (user_id, camera_status, camera_tested_at, mic_status, mic_tested_at, speaker_status, speaker_tested_at, speaker_volume, platform, browser)
SELECT 
    u.id,
    'granted',
    NOW() - INTERVAL '2 hours',
    'granted',
    NOW() - INTERVAL '2 hours',
    'granted',
    NOW() - INTERVAL '1 hour',
    75,
    'desktop',
    'Chrome'
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM device_tests dt WHERE dt.user_id = u.id)
LIMIT 5
ON CONFLICT (user_id) DO NOTHING;

-- 10. FINAL VERIFICATION
SELECT '=== FINAL DATA COUNT ===' as status;
SELECT 'Users' as tbl, COUNT(*) as cnt FROM users
UNION ALL SELECT 'Assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'Submissions', COUNT(*) FROM submissions
UNION ALL SELECT 'Grades', COUNT(*) FROM grades
UNION ALL SELECT 'Grade History', COUNT(*) FROM grade_history
UNION ALL SELECT 'Device Tests', COUNT(*) FROM device_tests
UNION ALL SELECT 'Grade Scales', COUNT(*) FROM grade_scales;

-- Show sample grades
SELECT 'Sample Grades:' as info;
SELECT g.id, g.final_marks, g.percentage, g.is_published, g.graded_at, g.modified_at
FROM grades g ORDER BY g.graded_at DESC LIMIT 5;

-- Show device test timestamps
SELECT 'Device Tests with Timestamps:' as info;
SELECT user_id, camera_status, camera_tested_at, mic_tested_at, speaker_tested_at 
FROM device_tests LIMIT 3;
