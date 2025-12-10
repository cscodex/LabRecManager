-- ============================================================
-- COMPLETE TEST DATA FOR GRADES PAGE
-- Run this in Neon SQL Editor
-- ============================================================

-- First, get IDs we need
DO $$
DECLARE
    v_school_id UUID;
    v_academic_year_id UUID;
    v_class_id UUID;
    v_subject_id UUID;
    v_instructor_id UUID;
    v_student_ids UUID[];
    v_assignment_id UUID;
    v_submission_id UUID;
    v_student_id UUID;
    v_class_subject_id UUID;
    i INT;
BEGIN
    -- Get school
    SELECT id INTO v_school_id FROM schools LIMIT 1;
    RAISE NOTICE 'School ID: %', v_school_id;
    
    -- Get academic year
    SELECT id INTO v_academic_year_id FROM academic_years WHERE is_current = true LIMIT 1;
    IF v_academic_year_id IS NULL THEN
        SELECT id INTO v_academic_year_id FROM academic_years LIMIT 1;
    END IF;
    RAISE NOTICE 'Academic Year ID: %', v_academic_year_id;
    
    -- Get class
    SELECT id INTO v_class_id FROM classes LIMIT 1;
    RAISE NOTICE 'Class ID: %', v_class_id;
    
    -- Get subject
    SELECT id INTO v_subject_id FROM subjects LIMIT 1;
    RAISE NOTICE 'Subject ID: %', v_subject_id;
    
    -- Get instructor
    SELECT id INTO v_instructor_id FROM users WHERE role IN ('instructor', 'admin', 'principal') LIMIT 1;
    RAISE NOTICE 'Instructor ID: %', v_instructor_id;
    
    -- Get students
    SELECT ARRAY_AGG(id) INTO v_student_ids FROM (SELECT id FROM users WHERE role = 'student' LIMIT 5) s;
    RAISE NOTICE 'Student IDs: %', v_student_ids;
    
    -- Get or create class_subject
    SELECT id INTO v_class_subject_id FROM class_subjects WHERE class_id = v_class_id AND subject_id = v_subject_id LIMIT 1;
    IF v_class_subject_id IS NULL AND v_class_id IS NOT NULL AND v_subject_id IS NOT NULL THEN
        INSERT INTO class_subjects (id, class_id, subject_id, instructor_id, created_at)
        VALUES (gen_random_uuid(), v_class_id, v_subject_id, v_instructor_id, NOW())
        RETURNING id INTO v_class_subject_id;
        RAISE NOTICE 'Created Class Subject: %', v_class_subject_id;
    END IF;
    
    -- Create assignments if none exist
    IF NOT EXISTS (SELECT 1 FROM assignments LIMIT 1) THEN
        IF v_class_id IS NOT NULL AND v_subject_id IS NOT NULL AND v_instructor_id IS NOT NULL THEN
            INSERT INTO assignments (id, title, title_hindi, description, class_id, subject_id, created_by_id, status, max_marks, due_date, created_at)
            VALUES 
                (gen_random_uuid(), 'Physics Lab Experiment 1', 'भौतिकी प्रयोगशाला प्रयोग 1', 'Verify Ohms Law using resistors', v_class_id, v_subject_id, v_instructor_id, 'active', 100, NOW() + INTERVAL '7 days', NOW()),
                (gen_random_uuid(), 'Chemistry Lab Experiment 1', 'रसायन विज्ञान प्रयोगशाला 1', 'Prepare standard solutions', v_class_id, v_subject_id, v_instructor_id, 'active', 100, NOW() + INTERVAL '14 days', NOW()),
                (gen_random_uuid(), 'Biology Lab Experiment 1', 'जीव विज्ञान प्रयोगशाला 1', 'Study of plant cells under microscope', v_class_id, v_subject_id, v_instructor_id, 'active', 100, NOW() + INTERVAL '21 days', NOW());
            RAISE NOTICE 'Created 3 assignments';
        END IF;
    END IF;
    
END $$;

-- Insert submissions for each student for each assignment
INSERT INTO submissions (id, assignment_id, student_id, status, content, submitted_at, created_at)
SELECT 
    gen_random_uuid(),
    a.id,
    u.id,
    'submitted',
    'Lab work completed. Observations recorded. Calculations done.',
    NOW() - (floor(random() * 5) * INTERVAL '1 day'),
    NOW() - (floor(random() * 5) * INTERVAL '1 day')
FROM assignments a
CROSS JOIN (SELECT id FROM users WHERE role = 'student' LIMIT 5) u
WHERE NOT EXISTS (
    SELECT 1 FROM submissions s 
    WHERE s.assignment_id = a.id AND s.student_id = u.id
);

-- Insert grades for submissions
INSERT INTO grades (
    id, submission_id, graded_by_id,
    experiment_marks, viva_marks, attendance_marks, record_marks,
    final_marks, max_marks, percentage, grade_letter, grade_points,
    feedback, is_published, graded_at, created_at
)
SELECT 
    gen_random_uuid(),
    s.id,
    (SELECT id FROM users WHERE role IN ('instructor', 'admin') LIMIT 1),
    20 + floor(random() * 10)::int,
    15 + floor(random() * 10)::int,
    8 + floor(random() * 2)::int,
    25 + floor(random() * 10)::int,
    70 + floor(random() * 25)::int,
    100,
    70 + floor(random() * 25)::numeric,
    CASE 
        WHEN random() > 0.7 THEN 'A1'
        WHEN random() > 0.5 THEN 'A2'
        WHEN random() > 0.3 THEN 'B1'
        ELSE 'B2'
    END,
    CASE 
        WHEN random() > 0.7 THEN 10.0
        WHEN random() > 0.5 THEN 9.0
        WHEN random() > 0.3 THEN 8.0
        ELSE 7.0
    END,
    CASE floor(random() * 4)::int
        WHEN 0 THEN 'Excellent work! Great understanding of concepts.'
        WHEN 1 THEN 'Good work. Minor improvements needed in calculations.'
        WHEN 2 THEN 'Well done! Keep up the good work.'
        ELSE 'Satisfactory performance. Practice more experiments.'
    END,
    true,
    NOW() - (floor(random() * 3) * INTERVAL '1 day'),
    NOW()
FROM submissions s
WHERE s.id NOT IN (SELECT submission_id FROM grades);

-- Add grade history for some grades (modifications)
INSERT INTO grade_history (id, grade_id, previous_marks, new_marks, modified_by, modified_at, reason)
SELECT 
    gen_random_uuid(),
    g.id,
    jsonb_build_object('final_marks', g.final_marks - 5, 'experiment_marks', g.experiment_marks - 2),
    jsonb_build_object('final_marks', g.final_marks, 'experiment_marks', g.experiment_marks),
    g.graded_by_id,
    g.graded_at - INTERVAL '1 day',
    CASE floor(random() * 3)::int
        WHEN 0 THEN 'Re-evaluation after student request'
        WHEN 1 THEN 'Correction in calculation'
        ELSE 'Faculty review adjustment'
    END
FROM grades g
WHERE g.id NOT IN (SELECT grade_id FROM grade_history)
LIMIT 5;

-- Update grades with modified_at for those with history
UPDATE grades 
SET modified_at = NOW(),
    modified_by_id = graded_by_id
WHERE id IN (SELECT grade_id FROM grade_history);

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT '=== DATA CREATED ===' AS status;
SELECT 'Assignments' AS table_name, COUNT(*) AS count FROM assignments;
SELECT 'Submissions' AS table_name, COUNT(*) AS count FROM submissions;
SELECT 'Grades' AS table_name, COUNT(*) AS count FROM grades;
SELECT 'Published Grades' AS table_name, COUNT(*) AS count FROM grades WHERE is_published = true;
SELECT 'Grade History' AS table_name, COUNT(*) AS count FROM grade_history;
SELECT 'Grade Scales' AS table_name, COUNT(*) AS count FROM grade_scales;

-- Show sample grades
SELECT '=== SAMPLE GRADES ===' AS info;
SELECT 
    g.id,
    g.final_marks,
    g.percentage::numeric(5,2),
    g.grade_letter,
    g.is_published,
    g.graded_at::date,
    CASE WHEN g.modified_at IS NOT NULL THEN 'Modified' ELSE 'Original' END AS status
FROM grades g
ORDER BY g.graded_at DESC
LIMIT 5;
