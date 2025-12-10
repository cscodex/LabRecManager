-- =====================================================
-- Lab Record Manager - Sample Data for Neon
-- Run this AFTER running schema.sql
-- =====================================================

-- Password hash for 'admin123', 'instructor123', 'student123'
-- Generated with bcrypt (10 rounds)
-- admin123 = $2a$10$XQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j5Q5j5Q5j5Q5j5Q5j5Q5jK
-- For demo, using a simpler approach - you should regenerate these

-- =====================================================
-- 1. CREATE SCHOOL
-- =====================================================

INSERT INTO schools (id, name, name_hindi, code, address, state, district, board_affiliation, primary_language, secondary_languages)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Delhi Public School',
    'दिल्ली पब्लिक स्कूल',
    'DPS001',
    '123 Education Lane, New Delhi - 110001',
    'Delhi',
    'South Delhi',
    'CBSE',
    'en',
    ARRAY['hi']
);

-- =====================================================
-- 2. CREATE ACADEMIC YEAR
-- =====================================================

INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current)
VALUES (
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '2024-25',
    '2024-04-01',
    '2025-03-31',
    true
);

-- =====================================================
-- 3. CREATE USERS
-- Password: all users use bcrypt hash of their respective passwords
-- In production, regenerate these hashes properly
-- =====================================================

-- Admin User (admin@dps.edu / admin123)
INSERT INTO users (id, school_id, email, password_hash, role, first_name, last_name, employee_id)
VALUES (
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'admin@dps.edu',
    '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j',
    'admin',
    'Admin',
    'User',
    'ADM001'
);

-- Principal (principal@dps.edu / principal123)
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, employee_id)
VALUES (
    'c3d4e5f6-a7b8-9012-cdef-123456789099',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'principal@dps.edu',
    '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j',
    'principal',
    'Anita',
    'अनीता',
    'Sharma',
    'शर्मा',
    'PRI001'
);

-- Instructor (instructor@dps.edu / instructor123)
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, employee_id)
VALUES (
    'd4e5f6a7-b8c9-0123-def0-234567890123',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'instructor@dps.edu',
    '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j',
    'instructor',
    'Rajesh',
    'राजेश',
    'Kumar',
    'कुमार',
    'INS001'
);

-- Lab Assistant
INSERT INTO users (id, school_id, email, password_hash, role, first_name, last_name, employee_id)
VALUES (
    'd4e5f6a7-b8c9-0123-def0-234567890199',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'labassist@dps.edu',
    '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j',
    'lab_assistant',
    'Suresh',
    'Verma',
    'LAB001'
);

-- Students (student1@dps.edu to student5@dps.edu / student123)
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, admission_number)
VALUES 
    ('e5f6a7b8-c9d0-1234-ef01-345678901234', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'student1@dps.edu', '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j', 'student', 'Aarav', 'आरव', 'Patel', 'STU001'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901235', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'student2@dps.edu', '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j', 'student', 'Priya', 'प्रिया', 'Singh', 'STU002'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901236', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'student3@dps.edu', '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j', 'student', 'Rahul', 'राहुल', 'Gupta', 'STU003'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901237', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'student4@dps.edu', '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j', 'student', 'Sneha', 'स्नेहा', 'Reddy', 'STU004'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901238', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'student5@dps.edu', '$2a$10$rQnM1vT8xY9zW0pL4mK5aOQxBtVqPx4wXhQxQH1ZXyeKQxQ5j5Q5j', 'student', 'Vikram', 'विक्रम', 'Joshi', 'STU005');

-- =====================================================
-- 4. CREATE SUBJECTS
-- =====================================================

INSERT INTO subjects (id, school_id, code, name, name_hindi, has_lab, lab_hours_per_week, theory_hours_per_week)
VALUES 
    ('f6a7b8c9-d0e1-2345-f012-456789012345', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CS', 'Computer Science', 'कंप्यूटर विज्ञान', true, 4, 4),
    ('f6a7b8c9-d0e1-2345-f012-456789012346', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PHY', 'Physics', 'भौतिक विज्ञान', true, 2, 4),
    ('f6a7b8c9-d0e1-2345-f012-456789012347', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'CHEM', 'Chemistry', 'रसायन विज्ञान', true, 2, 4);

-- =====================================================
-- 5. CREATE LABS
-- =====================================================

INSERT INTO labs (id, school_id, name, name_hindi, room_number, capacity, subject_id, incharge_id)
VALUES 
    ('a7b8c9d0-e1f2-3456-0123-567890123456', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Computer Lab 1', 'कंप्यूटर लैब 1', 'LAB-101', 30, 'f6a7b8c9-d0e1-2345-f012-456789012345', 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('a7b8c9d0-e1f2-3456-0123-567890123457', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Physics Lab', 'भौतिक विज्ञान लैब', 'LAB-201', 25, 'f6a7b8c9-d0e1-2345-f012-456789012346', 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('a7b8c9d0-e1f2-3456-0123-567890123458', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Chemistry Lab', 'रसायन विज्ञान लैब', 'LAB-301', 25, 'f6a7b8c9-d0e1-2345-f012-456789012347', 'd4e5f6a7-b8c9-0123-def0-234567890123');

-- =====================================================
-- 6. CREATE CLASSES
-- =====================================================

INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, class_teacher_id)
VALUES 
    ('b8c9d0e1-f2a3-4567-1234-678901234567', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '11-A Science', '11-ए विज्ञान', 11, 'A', 'Science', 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('b8c9d0e1-f2a3-4567-1234-678901234568', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '11-B Science', '11-बी विज्ञान', 11, 'B', 'Science', 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('b8c9d0e1-f2a3-4567-1234-678901234569', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', '12-A Science', '12-ए विज्ञान', 12, 'A', 'Science', 'd4e5f6a7-b8c9-0123-def0-234567890123');

-- =====================================================
-- 7. ENROLL STUDENTS
-- =====================================================

INSERT INTO class_enrollments (student_id, class_id, roll_number, status)
VALUES 
    ('e5f6a7b8-c9d0-1234-ef01-345678901234', 'b8c9d0e1-f2a3-4567-1234-678901234567', 1, 'active'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901235', 'b8c9d0e1-f2a3-4567-1234-678901234567', 2, 'active'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901236', 'b8c9d0e1-f2a3-4567-1234-678901234567', 3, 'active'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901237', 'b8c9d0e1-f2a3-4567-1234-678901234567', 4, 'active'),
    ('e5f6a7b8-c9d0-1234-ef01-345678901238', 'b8c9d0e1-f2a3-4567-1234-678901234567', 5, 'active');

-- =====================================================
-- 8. CREATE CLASS-SUBJECT MAPPINGS
-- =====================================================

INSERT INTO class_subjects (class_id, subject_id, instructor_id, lab_instructor_id)
VALUES 
    ('b8c9d0e1-f2a3-4567-1234-678901234567', 'f6a7b8c9-d0e1-2345-f012-456789012345', 'd4e5f6a7-b8c9-0123-def0-234567890123', 'd4e5f6a7-b8c9-0123-def0-234567890199'),
    ('b8c9d0e1-f2a3-4567-1234-678901234567', 'f6a7b8c9-d0e1-2345-f012-456789012346', 'd4e5f6a7-b8c9-0123-def0-234567890123', 'd4e5f6a7-b8c9-0123-def0-234567890199'),
    ('b8c9d0e1-f2a3-4567-1234-678901234567', 'f6a7b8c9-d0e1-2345-f012-456789012347', 'd4e5f6a7-b8c9-0123-def0-234567890123', 'd4e5f6a7-b8c9-0123-def0-234567890199');

-- =====================================================
-- 9. CREATE SAMPLE ASSIGNMENTS
-- =====================================================

INSERT INTO assignments (id, school_id, subject_id, lab_id, created_by, title, title_hindi, description, description_hindi, experiment_number, assignment_type, programming_language, aim, aim_hindi, max_marks, passing_marks, viva_marks, practical_marks, output_marks, status, publish_date, due_date)
VALUES 
    ('c9d0e1f2-a3b4-5678-2345-789012345678', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'f6a7b8c9-d0e1-2345-f012-456789012345', 'a7b8c9d0-e1f2-3456-0123-567890123456', 'd4e5f6a7-b8c9-0123-def0-234567890123', 
    'Python: Hello World Program', 'पायथन: हैलो वर्ल्ड प्रोग्राम',
    'Write a simple Python program that prints "Hello, World!" to the console. This is your first program in Python.',
    'एक सरल पायथन प्रोग्राम लिखें जो कंसोल पर "Hello, World!" प्रिंट करे। यह पायथन में आपका पहला प्रोग्राम है।',
    'EXP-01', 'program', 'Python',
    'To understand basic Python syntax and print function',
    'बुनियादी पायथन सिंटैक्स और प्रिंट फ़ंक्शन को समझना',
    100, 35, 20, 60, 20, 'published', NOW(), NOW() + INTERVAL '7 days'),
    
    ('c9d0e1f2-a3b4-5678-2345-789012345679', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'f6a7b8c9-d0e1-2345-f012-456789012345', 'a7b8c9d0-e1f2-3456-0123-567890123456', 'd4e5f6a7-b8c9-0123-def0-234567890123',
    'Python: Calculator Program', 'पायथन: कैलकुलेटर प्रोग्राम',
    'Create a simple calculator that can perform addition, subtraction, multiplication, and division.',
    'एक साधारण कैलकुलेटर बनाएं जो जोड़, घटाव, गुणा और भाग कर सके।',
    'EXP-02', 'program', 'Python',
    'To learn arithmetic operations and user input in Python',
    'पायथन में अंकगणितीय संचालन और उपयोगकर्ता इनपुट सीखना',
    100, 35, 20, 60, 20, 'published', NOW(), NOW() + INTERVAL '14 days'),
    
    ('c9d0e1f2-a3b4-5678-2345-789012345680', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'f6a7b8c9-d0e1-2345-f012-456789012346', 'a7b8c9d0-e1f2-3456-0123-567890123457', 'd4e5f6a7-b8c9-0123-def0-234567890123',
    'Physics: Ohm''s Law Verification', 'भौतिकी: ओम के नियम का सत्यापन',
    'Verify Ohm''s Law by plotting the V-I characteristics of a resistor.',
    'प्रतिरोधक की V-I विशेषताओं को प्लॉट करके ओम के नियम का सत्यापन करें।',
    'PHY-01', 'experiment', NULL,
    'To verify Ohm''s Law and understand the relationship between voltage and current',
    'ओम के नियम का सत्यापन करना और वोल्टेज और करंट के बीच संबंध को समझना',
    100, 35, 25, 50, 25, 'published', NOW(), NOW() + INTERVAL '10 days');

-- =====================================================
-- 10. ASSIGN TO CLASS
-- =====================================================

INSERT INTO assignment_targets (assignment_id, target_type, target_class_id, assigned_by)
VALUES 
    ('c9d0e1f2-a3b4-5678-2345-789012345678', 'class', 'b8c9d0e1-f2a3-4567-1234-678901234567', 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('c9d0e1f2-a3b4-5678-2345-789012345679', 'class', 'b8c9d0e1-f2a3-4567-1234-678901234567', 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('c9d0e1f2-a3b4-5678-2345-789012345680', 'class', 'b8c9d0e1-f2a3-4567-1234-678901234567', 'd4e5f6a7-b8c9-0123-def0-234567890123');

-- =====================================================
-- 11. SAMPLE VIVA QUESTIONS
-- =====================================================

INSERT INTO viva_questions (subject_id, assignment_id, question, question_hindi, expected_answer, difficulty, marks, topic_tags, created_by)
VALUES 
    ('f6a7b8c9-d0e1-2345-f012-456789012345', 'c9d0e1f2-a3b4-5678-2345-789012345678', 'What is the print function used for in Python?', 'पायथन में प्रिंट फ़ंक्शन का क्या उपयोग है?', 'The print function is used to output text or values to the console.', 'easy', 2, ARRAY['python', 'basics', 'functions'], 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('f6a7b8c9-d0e1-2345-f012-456789012345', 'c9d0e1f2-a3b4-5678-2345-789012345678', 'What is a string in Python?', 'पायथन में स्ट्रिंग क्या है?', 'A string is a sequence of characters enclosed in quotes.', 'easy', 2, ARRAY['python', 'data-types'], 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('f6a7b8c9-d0e1-2345-f012-456789012345', 'c9d0e1f2-a3b4-5678-2345-789012345679', 'Explain the difference between / and // operators in Python', '/ और // ऑपरेटरों में क्या अंतर है?', '/ performs true division returning float, // performs floor division returning integer', 'medium', 3, ARRAY['python', 'operators'], 'd4e5f6a7-b8c9-0123-def0-234567890123'),
    ('f6a7b8c9-d0e1-2345-f012-456789012346', 'c9d0e1f2-a3b4-5678-2345-789012345680', 'State Ohm''s Law', 'ओम का नियम बताएं', 'V = IR, where V is voltage, I is current, and R is resistance', 'easy', 2, ARRAY['physics', 'electricity', 'ohms-law'], 'd4e5f6a7-b8c9-0123-def0-234567890123');

-- =====================================================
-- 12. NOTIFICATION TEMPLATES
-- =====================================================

INSERT INTO notification_templates (school_id, template_key, channel, subject, subject_hindi, body, body_hindi, variables, is_active)
VALUES 
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'assignment_published', 'email', 'New Assignment: {{assignment_title}}', 'नया असाइनमेंट: {{assignment_title}}', 'Dear {{student_name}}, A new assignment "{{assignment_title}}" has been published. Due date: {{due_date}}', 'प्रिय {{student_name}}, एक नया असाइनमेंट "{{assignment_title}}" प्रकाशित किया गया है। नियत तारीख: {{due_date}}', ARRAY['student_name', 'assignment_title', 'due_date'], true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'grade_published', 'email', 'Grade Published: {{assignment_title}}', 'ग्रेड प्रकाशित: {{assignment_title}}', 'Dear {{student_name}}, Your grade for "{{assignment_title}}" has been published. You scored {{marks}}/{{max_marks}}', 'प्रिय {{student_name}}, "{{assignment_title}}" के लिए आपका ग्रेड प्रकाशित किया गया है। आपने {{marks}}/{{max_marks}} अंक प्राप्त किए', ARRAY['student_name', 'assignment_title', 'marks', 'max_marks'], true),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'viva_scheduled', 'email', 'Viva Scheduled: {{assignment_title}}', 'वाइवा निर्धारित: {{assignment_title}}', 'Dear {{student_name}}, Your viva for "{{assignment_title}}" is scheduled on {{date}} at {{time}}', 'प्रिय {{student_name}}, "{{assignment_title}}" के लिए आपका वाइवा {{date}} को {{time}} पर निर्धारित है', ARRAY['student_name', 'assignment_title', 'date', 'time'], true);

-- =====================================================
-- 13. CREATE DEPARTMENT
-- =====================================================

INSERT INTO departments (id, school_id, name, name_hindi, code, head_id)
VALUES (
    'a0b1c2d3-e4f5-6789-0abc-def012345678',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Computer Science Department',
    'कंप्यूटर विज्ञान विभाग',
    'CS-DEPT',
    'd4e5f6a7-b8c9-0123-def0-234567890123'
);

-- =====================================================
-- 14. CREATE SYLLABUS
-- =====================================================

INSERT INTO syllabi (id, school_id, subject_id, academic_year_id, class_id, name, name_hindi, board_reference, total_hours, created_by)
VALUES (
    'b1c2d3e4-f5a6-7890-1bcd-ef0123456789',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'f6a7b8c9-d0e1-2345-f012-456789012345',
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'b8c9d0e1-f2a3-4567-1234-678901234567',
    'CBSE Class 11 Computer Science Practical',
    'सीबीएसई कक्षा 11 कंप्यूटर विज्ञान प्रयोगात्मक',
    'CBSE/CS/XI/2024',
    60,
    'd4e5f6a7-b8c9-0123-def0-234567890123'
);

-- =====================================================
-- 15. CREATE SYLLABUS UNITS
-- =====================================================

INSERT INTO syllabus_units (id, syllabus_id, unit_number, name, name_hindi, expected_hours, weightage_percent, sequence_order)
VALUES 
    ('c2d3e4f5-a6b7-8901-2cde-f01234567890', 'b1c2d3e4-f5a6-7890-1bcd-ef0123456789', 1, 'Python Fundamentals', 'पायथन मूल बातें', 15, 25, 1),
    ('c2d3e4f5-a6b7-8901-2cde-f01234567891', 'b1c2d3e4-f5a6-7890-1bcd-ef0123456789', 2, 'Data Handling', 'डेटा हैंडलिंग', 12, 20, 2),
    ('c2d3e4f5-a6b7-8901-2cde-f01234567892', 'b1c2d3e4-f5a6-7890-1bcd-ef0123456789', 3, 'Functions and Modules', 'फ़ंक्शन और मॉड्यूल', 15, 25, 3),
    ('c2d3e4f5-a6b7-8901-2cde-f01234567893', 'b1c2d3e4-f5a6-7890-1bcd-ef0123456789', 4, 'File Handling', 'फ़ाइल हैंडलिंग', 10, 15, 4),
    ('c2d3e4f5-a6b7-8901-2cde-f01234567894', 'b1c2d3e4-f5a6-7890-1bcd-ef0123456789', 5, 'Mini Projects', 'मिनी प्रोजेक्ट्स', 8, 15, 5);

-- =====================================================
-- 16. CREATE SYLLABUS TOPICS
-- =====================================================

INSERT INTO syllabus_topics (id, unit_id, topic_number, name, name_hindi, learning_objectives, is_practical, sequence_order)
VALUES 
    -- Unit 1: Python Fundamentals
    ('d3e4f5a6-b7c8-9012-3def-012345678901', 'c2d3e4f5-a6b7-8901-2cde-f01234567890', '1.1', 'Hello World Program', 'हैलो वर्ल्ड प्रोग्राम', 'Understand basic syntax, output function', true, 1),
    ('d3e4f5a6-b7c8-9012-3def-012345678902', 'c2d3e4f5-a6b7-8901-2cde-f01234567890', '1.2', 'Variables and Data Types', 'वेरिएबल्स और डेटा टाइप्स', 'Declare variables, understand int, float, string, bool', true, 2),
    ('d3e4f5a6-b7c8-9012-3def-012345678903', 'c2d3e4f5-a6b7-8901-2cde-f01234567890', '1.3', 'Arithmetic Operators', 'अंकगणितीय ऑपरेटर', 'Perform calculations using +, -, *, /, //, %, **', true, 3),
    ('d3e4f5a6-b7c8-9012-3def-012345678904', 'c2d3e4f5-a6b7-8901-2cde-f01234567890', '1.4', 'Input Function', 'इनपुट फ़ंक्शन', 'Accept user input and type conversion', true, 4),
    
    -- Unit 2: Data Handling
    ('d3e4f5a6-b7c8-9012-3def-012345678905', 'c2d3e4f5-a6b7-8901-2cde-f01234567891', '2.1', 'Lists', 'लिस्ट्स', 'Create, access, modify lists', true, 1),
    ('d3e4f5a6-b7c8-9012-3def-012345678906', 'c2d3e4f5-a6b7-8901-2cde-f01234567891', '2.2', 'Tuples', 'ट्यूपल्स', 'Understand immutable sequences', true, 2),
    ('d3e4f5a6-b7c8-9012-3def-012345678907', 'c2d3e4f5-a6b7-8901-2cde-f01234567891', '2.3', 'Dictionaries', 'डिक्शनरी', 'Key-value pair operations', true, 3),
    
    -- Unit 3: Functions
    ('d3e4f5a6-b7c8-9012-3def-012345678908', 'c2d3e4f5-a6b7-8901-2cde-f01234567892', '3.1', 'User Defined Functions', 'यूज़र डिफाइंड फंक्शन', 'Define and call functions', true, 1),
    ('d3e4f5a6-b7c8-9012-3def-012345678909', 'c2d3e4f5-a6b7-8901-2cde-f01234567892', '3.2', 'Parameters and Arguments', 'पैरामीटर्स और आर्ग्यूमेंट्स', 'Pass data to functions', true, 2);

-- =====================================================
-- 17. MAP ASSIGNMENTS TO TOPICS
-- =====================================================

INSERT INTO assignment_topic_mapping (assignment_id, topic_id, coverage_percent)
VALUES 
    -- Hello World assignment covers topic 1.1
    ('c9d0e1f2-a3b4-5678-2345-789012345678', 'd3e4f5a6-b7c8-9012-3def-012345678901', 100),
    -- Calculator assignment covers topics 1.3 and 1.4
    ('c9d0e1f2-a3b4-5678-2345-789012345679', 'd3e4f5a6-b7c8-9012-3def-012345678903', 50),
    ('c9d0e1f2-a3b4-5678-2345-789012345679', 'd3e4f5a6-b7c8-9012-3def-012345678904', 50);

-- =====================================================
-- 18. SAMPLE STUDENT PROGRESS
-- =====================================================

INSERT INTO student_topic_progress (student_id, topic_id, status, completion_percent, completed_at)
VALUES 
    -- Student 1 completed Hello World topic
    ('e5f6a7b8-c9d0-1234-ef01-345678901234', 'd3e4f5a6-b7c8-9012-3def-012345678901', 'completed', 100, NOW()),
    -- Student 2 in progress
    ('e5f6a7b8-c9d0-1234-ef01-345678901235', 'd3e4f5a6-b7c8-9012-3def-012345678901', 'in_progress', 50, NULL);

-- =====================================================
-- DONE! Sample data inserted successfully.
-- =====================================================
