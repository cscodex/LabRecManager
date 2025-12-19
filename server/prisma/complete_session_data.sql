-- ============================================
-- COMPLETE SESSION SAMPLE DATA FOR NEON
-- Fixed UUIDs (hex only)
-- ============================================

-- Add missing columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'academic_year_id') THEN
        ALTER TABLE assignments ADD COLUMN academic_year_id UUID REFERENCES academic_years(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grades' AND column_name = 'academic_year_id') THEN
        ALTER TABLE grades ADD COLUMN academic_year_id UUID REFERENCES academic_years(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'student_id') THEN
        ALTER TABLE users ADD COLUMN student_id VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignment_targets' AND column_name = 'due_date') THEN
        ALTER TABLE assignment_targets ADD COLUMN due_date TIMESTAMP;
        ALTER TABLE assignment_targets ADD COLUMN publish_date TIMESTAMP;
    END IF;
END $$;

-- Reset and create sessions
UPDATE academic_years SET is_current = false;

INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current)
SELECT 'a0000000-2024-2025-0000-000000000001', id, '2024-2025', '2024-04-01', '2025-03-31', false FROM schools LIMIT 1
ON CONFLICT (id) DO UPDATE SET is_current = false;

INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current)
SELECT 'a0000000-2025-2026-0000-000000000001', id, '2025-2026', '2025-04-01', '2026-03-31', true FROM schools LIMIT 1
ON CONFLICT (id) DO UPDATE SET is_current = true;

-- Create subjects
DO $$ DECLARE v_school UUID; BEGIN SELECT id INTO v_school FROM schools LIMIT 1;
INSERT INTO subjects (id, school_id, code, name, name_hindi, has_lab) VALUES 
('10000000-0001-0000-0000-000000000001', v_school, 'CS', 'Computer Science', 'कंप्यूटर विज्ञान', true),
('10000000-0002-0000-0000-000000000002', v_school, 'PHY', 'Physics', 'भौतिकी', true)
ON CONFLICT (id) DO NOTHING; END $$;

-- Create labs
DO $$ DECLARE v_school UUID; v_inst UUID; BEGIN 
SELECT id INTO v_school FROM schools LIMIT 1;
SELECT id INTO v_inst FROM users WHERE role='instructor' LIMIT 1;
INSERT INTO labs (id, school_id, name, room_number, subject_id, incharge_id) VALUES 
('20000000-0001-0000-0000-000000000001', v_school, 'Computer Lab', 'A-101', '10000000-0001-0000-0000-000000000001', v_inst)
ON CONFLICT (id) DO NOTHING; END $$;

-- Create students
DO $$ DECLARE v_school UUID; BEGIN SELECT id INTO v_school FROM schools LIMIT 1;
INSERT INTO users (id, school_id, email, password_hash, role, first_name, last_name, student_id) VALUES 
('30000000-0001-0000-0000-000000000001', v_school, 'stu1.2024@demo.com', '$2b$10$X', 'student', 'Rahul', 'Sharma', 'STU-2024-001'),
('30000000-0002-0000-0000-000000000002', v_school, 'stu2.2024@demo.com', '$2b$10$X', 'student', 'Priya', 'Singh', 'STU-2024-002'),
('30000000-0003-0000-0000-000000000003', v_school, 'stu1.2025@demo.com', '$2b$10$X', 'student', 'Ananya', 'Verma', 'STU-2025-001'),
('30000000-0004-0000-0000-000000000004', v_school, 'stu2.2025@demo.com', '$2b$10$X', 'student', 'Rohan', 'Joshi', 'STU-2025-002')
ON CONFLICT (email) DO NOTHING; END $$;

-- Create classes
DO $$ DECLARE v_school UUID; v_inst UUID; BEGIN 
SELECT id INTO v_school FROM schools LIMIT 1;
SELECT id INTO v_inst FROM users WHERE role='instructor' LIMIT 1;
INSERT INTO classes (id, school_id, academic_year_id, name, grade_level, section, stream, class_teacher_id) VALUES 
('40000000-2024-0001-0000-000000000001', v_school, 'a0000000-2024-2025-0000-000000000001', 'Class 11-A [2024]', 11, 'A', 'Science', v_inst),
('40000000-2024-0002-0000-000000000002', v_school, 'a0000000-2024-2025-0000-000000000001', 'Class 12-A [2024]', 12, 'A', 'Science', v_inst),
('40000000-2025-0001-0000-000000000001', v_school, 'a0000000-2025-2026-0000-000000000001', 'Class 11-A [2025]', 11, 'A', 'Science', v_inst),
('40000000-2025-0002-0000-000000000002', v_school, 'a0000000-2025-2026-0000-000000000001', 'Class 12-A [2025]', 12, 'A', 'Science', v_inst)
ON CONFLICT (id) DO NOTHING; END $$;

-- Enroll students
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status) VALUES 
(gen_random_uuid(), '30000000-0001-0000-0000-000000000001', '40000000-2024-0001-0000-000000000001', 1, 'active'),
(gen_random_uuid(), '30000000-0002-0000-0000-000000000002', '40000000-2024-0001-0000-000000000001', 2, 'active'),
(gen_random_uuid(), '30000000-0003-0000-0000-000000000003', '40000000-2025-0001-0000-000000000001', 1, 'active'),
(gen_random_uuid(), '30000000-0004-0000-0000-000000000004', '40000000-2025-0001-0000-000000000001', 2, 'active')
ON CONFLICT (student_id, class_id) DO NOTHING;

-- Create groups
DO $$ DECLARE v_inst UUID; BEGIN SELECT id INTO v_inst FROM users WHERE role='instructor' LIMIT 1;
INSERT INTO student_groups (id, class_id, name, created_by) VALUES 
('50000000-2024-0001-0000-000000000001', '40000000-2024-0001-0000-000000000001', 'Team Alpha [2024]', v_inst),
('50000000-2025-0001-0000-000000000001', '40000000-2025-0001-0000-000000000001', 'Team Alpha [2025]', v_inst)
ON CONFLICT (id) DO NOTHING; END $$;

INSERT INTO group_members (id, group_id, student_id, role) VALUES 
(gen_random_uuid(), '50000000-2024-0001-0000-000000000001', '30000000-0001-0000-0000-000000000001', 'leader'),
(gen_random_uuid(), '50000000-2025-0001-0000-000000000001', '30000000-0003-0000-0000-000000000003', 'leader')
ON CONFLICT (group_id, student_id) DO NOTHING;

-- Create assignments
DO $$ DECLARE v_school UUID; v_inst UUID; BEGIN 
SELECT id INTO v_school FROM schools LIMIT 1;
SELECT id INTO v_inst FROM users WHERE role='instructor' LIMIT 1;
INSERT INTO assignments (id, school_id, subject_id, lab_id, academic_year_id, created_by, title, experiment_number, assignment_type, status, max_marks) VALUES 
('60000000-2024-0001-0000-000000000001', v_school, '10000000-0001-0000-0000-000000000001', '20000000-0001-0000-0000-000000000001', 'a0000000-2024-2025-0000-000000000001', v_inst, 'Python Variables [2024]', 'EXP-2024-01', 'program', 'published', 100),
('60000000-2024-0002-0000-000000000002', v_school, '10000000-0001-0000-0000-000000000001', '20000000-0001-0000-0000-000000000001', 'a0000000-2024-2025-0000-000000000001', v_inst, 'Python Loops [2024]', 'EXP-2024-02', 'program', 'published', 100),
('60000000-2025-0001-0000-000000000001', v_school, '10000000-0001-0000-0000-000000000001', '20000000-0001-0000-0000-000000000001', 'a0000000-2025-2026-0000-000000000001', v_inst, 'OOP Basics [2025]', 'EXP-2025-01', 'program', 'published', 100),
('60000000-2025-0002-0000-000000000002', v_school, '10000000-0001-0000-0000-000000000001', '20000000-0001-0000-0000-000000000001', 'a0000000-2025-2026-0000-000000000001', v_inst, 'File Handling [2025]', 'EXP-2025-02', 'program', 'draft', 100)
ON CONFLICT (id) DO NOTHING; END $$;

-- Create submissions
INSERT INTO submissions (id, assignment_id, student_id, code_content, output_content, status, submitted_at, last_modified) VALUES 
('70000000-2024-0001-0000-000000000001', '60000000-2024-0001-0000-000000000001', '30000000-0001-0000-0000-000000000001', 'x = 10', '10', 'graded', '2024-05-10', NOW()),
('70000000-2024-0002-0000-000000000002', '60000000-2024-0001-0000-000000000001', '30000000-0002-0000-0000-000000000002', 'y = 20', '20', 'graded', '2024-05-11', NOW()),
('70000000-2025-0001-0000-000000000001', '60000000-2025-0001-0000-000000000001', '30000000-0003-0000-0000-000000000003', 'class Dog: pass', 'OK', 'graded', '2025-05-10', NOW()),
('70000000-2025-0002-0000-000000000002', '60000000-2025-0001-0000-000000000001', '30000000-0004-0000-0000-000000000004', 'class Cat: pass', 'OK', 'submitted', '2025-05-11', NOW())
ON CONFLICT (assignment_id, student_id, submission_number) DO NOTHING;

-- Create grades
DO $$ DECLARE v_inst UUID; BEGIN SELECT id INTO v_inst FROM users WHERE role='instructor' LIMIT 1;
INSERT INTO grades (id, submission_id, student_id, graded_by, academic_year_id, practical_marks, output_marks, viva_marks, total_marks, max_marks, percentage, grade_letter, is_published) VALUES 
('80000000-2024-0001-0000-000000000001', '70000000-2024-0001-0000-000000000001', '30000000-0001-0000-0000-000000000001', v_inst, 'a0000000-2024-2025-0000-000000000001', 55, 18, 17, 90, 100, 90, 'A+', true),
('80000000-2024-0002-0000-000000000002', '70000000-2024-0002-0000-000000000002', '30000000-0002-0000-0000-000000000002', v_inst, 'a0000000-2024-2025-0000-000000000001', 50, 16, 14, 80, 100, 80, 'A', true),
('80000000-2025-0001-0000-000000000001', '70000000-2025-0001-0000-000000000001', '30000000-0003-0000-0000-000000000003', v_inst, 'a0000000-2025-2026-0000-000000000001', 58, 19, 18, 95, 100, 95, 'A+', true)
ON CONFLICT (submission_id) DO NOTHING; END $$;

-- Verify
SELECT ay.year_label, ay.is_current,
  (SELECT COUNT(*) FROM classes WHERE academic_year_id=ay.id) AS classes,
  (SELECT COUNT(*) FROM assignments WHERE academic_year_id=ay.id) AS assignments,
  (SELECT COUNT(*) FROM grades WHERE academic_year_id=ay.id) AS grades
FROM academic_years ay ORDER BY start_date DESC;
