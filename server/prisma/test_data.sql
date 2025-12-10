-- ============================================================
-- Lab Record Manager - Test Data SQL Script
-- School: DPS (Demo Public School)
-- UDISE Code: 3090508916
-- Grade 11 Classes with Streams and Sections
-- ============================================================

-- NOTE: Run this AFTER the Prisma migrations have created the tables
-- Check existing data first to avoid conflicts

-- ============================================================
-- 1. UPDATE SCHOOL WITH UDISE CODE
-- ============================================================

-- Update existing school or insert new one with UDISE code
UPDATE schools 
SET 
    code = '3090508916',
    name = 'Demo Public School',
    name_hindi = 'डेमो पब्लिक स्कूल',
    address = '123 Education Lane, New Delhi',
    state = 'Delhi',
    district = 'Central Delhi',
    board_affiliation = 'CBSE'
WHERE code = 'DPS';

-- If no school exists, insert one
INSERT INTO schools (id, name, name_hindi, code, address, state, district, board_affiliation, primary_language, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'Demo Public School',
    'डेमो पब्लिक स्कूल',
    '3090508916',
    '123 Education Lane, New Delhi',
    'Delhi',
    'Central Delhi',
    'CBSE',
    'en',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM schools WHERE code = '3090508916' OR code = 'DPS');

-- Get the school ID for further use
DO $$
DECLARE
    school_uuid UUID;
    academic_year_uuid UUID;
    admin_uuid UUID;
    instructor_uuid UUID;
BEGIN
    -- Get school ID
    SELECT id INTO school_uuid FROM schools WHERE code = '3090508916' OR code = 'DPS' LIMIT 1;
    
    IF school_uuid IS NULL THEN
        RAISE EXCEPTION 'School not found. Please create the school first.';
    END IF;

    -- Get or create academic year
    SELECT id INTO academic_year_uuid FROM academic_years 
    WHERE school_id = school_uuid AND is_current = true LIMIT 1;
    
    IF academic_year_uuid IS NULL THEN
        INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current, created_at)
        VALUES (
            gen_random_uuid(),
            school_uuid,
            '2024-25',
            '2024-04-01',
            '2025-03-31',
            true,
            NOW()
        )
        RETURNING id INTO academic_year_uuid;
    END IF;

    -- Get instructor ID for class teacher assignment
    SELECT id INTO instructor_uuid FROM users 
    WHERE school_id = school_uuid AND role = 'instructor' LIMIT 1;

    -- ============================================================
    -- 2. CREATE GRADE 11 CLASSES WITH STREAMS AND SECTIONS
    -- ============================================================

    -- Delete existing Grade 11 classes if any (to avoid duplicates)
    DELETE FROM classes 
    WHERE school_id = school_uuid 
    AND grade_level = 11 
    AND academic_year_id = academic_year_uuid;

    -- NON-MEDICAL STREAM - Sections A, B, C
    INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students, created_at)
    VALUES 
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Non-Medical A', 'कक्षा 11 नॉन-मेडिकल ए', 11, 'A', 'NON-MEDICAL', 40, NOW()),
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Non-Medical B', 'कक्षा 11 नॉन-मेडिकल बी', 11, 'B', 'NON-MEDICAL', 40, NOW()),
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Non-Medical C', 'कक्षा 11 नॉन-मेडिकल सी', 11, 'C', 'NON-MEDICAL', 40, NOW());

    -- MEDICAL STREAM - Sections A, B, C
    INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students, created_at)
    VALUES 
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Medical A', 'कक्षा 11 मेडिकल ए', 11, 'A', 'MEDICAL', 40, NOW()),
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Medical B', 'कक्षा 11 मेडिकल बी', 11, 'B', 'MEDICAL', 40, NOW()),
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Medical C', 'कक्षा 11 मेडिकल सी', 11, 'C', 'MEDICAL', 40, NOW());

    -- COMMERCE STREAM - Sections A, B, C
    INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students, created_at)
    VALUES 
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Commerce A', 'कक्षा 11 कॉमर्स ए', 11, 'A', 'COMMERCE', 40, NOW()),
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Commerce B', 'कक्षा 11 कॉमर्स बी', 11, 'B', 'COMMERCE', 40, NOW()),
        (gen_random_uuid(), school_uuid, academic_year_uuid, 'Class 11 Commerce C', 'कक्षा 11 कॉमर्स सी', 11, 'C', 'COMMERCE', 40, NOW());

    RAISE NOTICE 'Classes created successfully!';

END $$;

-- ============================================================
-- 3. CREATE STUDENTS WITH 8-DIGIT ADMISSION NUMBERS
-- ============================================================

-- Password hash for 'student123' (same as existing students)
DO $$
DECLARE
    school_uuid UUID;
    academic_year_uuid UUID;
    class_nm_a UUID;
    class_nm_b UUID;
    class_nm_c UUID;
    class_med_a UUID;
    class_med_b UUID;
    class_med_c UUID;
    class_com_a UUID;
    class_com_b UUID;
    class_com_c UUID;
    student_uuid UUID;
    password_hash TEXT := '$2b$10$rQZ5q5X5X5X5X5X5X5X5XuX5X5X5X5X5X5X5X5X5X5X5X5X5X5X';
BEGIN
    -- Get IDs
    SELECT id INTO school_uuid FROM schools WHERE code = '3090508916' OR code = 'DPS' LIMIT 1;
    SELECT id INTO academic_year_uuid FROM academic_years WHERE school_id = school_uuid AND is_current = true LIMIT 1;
    
    -- Get class IDs
    SELECT id INTO class_nm_a FROM classes WHERE school_id = school_uuid AND stream = 'NON-MEDICAL' AND section = 'A' AND grade_level = 11 LIMIT 1;
    SELECT id INTO class_nm_b FROM classes WHERE school_id = school_uuid AND stream = 'NON-MEDICAL' AND section = 'B' AND grade_level = 11 LIMIT 1;
    SELECT id INTO class_nm_c FROM classes WHERE school_id = school_uuid AND stream = 'NON-MEDICAL' AND section = 'C' AND grade_level = 11 LIMIT 1;
    SELECT id INTO class_med_a FROM classes WHERE school_id = school_uuid AND stream = 'MEDICAL' AND section = 'A' AND grade_level = 11 LIMIT 1;
    SELECT id INTO class_med_b FROM classes WHERE school_id = school_uuid AND stream = 'MEDICAL' AND section = 'B' AND grade_level = 11 LIMIT 1;
    SELECT id INTO class_med_c FROM classes WHERE school_id = school_uuid AND stream = 'MEDICAL' AND section = 'C' AND grade_level = 11 LIMIT 1;
    SELECT id INTO class_com_a FROM classes WHERE school_id = school_uuid AND stream = 'COMMERCE' AND section = 'A' AND grade_level = 11 LIMIT 1;
    SELECT id INTO class_com_b FROM classes WHERE school_id = school_uuid AND stream = 'COMMERCE' AND section = 'B' AND grade_level = 11 LIMIT 1;
    SELECT id INTO class_com_c FROM classes WHERE school_id = school_uuid AND stream = 'COMMERCE' AND section = 'C' AND grade_level = 11 LIMIT 1;

    -- Get password hash from existing student
    SELECT password_hash INTO password_hash FROM users WHERE email = 'student1@dps.edu' LIMIT 1;

    -- ============================================================
    -- NON-MEDICAL SECTION A STUDENTS (Roll 1-5)
    -- ============================================================
    
    -- Student 1 - Aarav Sharma
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'aarav.sharma@dps.edu', password_hash, 'student', 'Aarav', 'आरव', 'Sharma', 'शर्मा', '30905001', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_nm_a, 1, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 2 - Diya Patel
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'diya.patel@dps.edu', password_hash, 'student', 'Diya', 'दीया', 'Patel', 'पटेल', '30905002', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_nm_a, 2, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 3 - Arjun Singh
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'arjun.singh@dps.edu', password_hash, 'student', 'Arjun', 'अर्जुन', 'Singh', 'सिंह', '30905003', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_nm_a, 3, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 4 - Ananya Gupta
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'ananya.gupta@dps.edu', password_hash, 'student', 'Ananya', 'अनन्या', 'Gupta', 'गुप्ता', '30905004', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_nm_a, 4, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 5 - Vihaan Kumar
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'vihaan.kumar@dps.edu', password_hash, 'student', 'Vihaan', 'विहान', 'Kumar', 'कुमार', '30905005', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_nm_a, 5, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- ============================================================
    -- NON-MEDICAL SECTION B STUDENTS (Roll 1-5)
    -- ============================================================
    
    -- Student 6 - Ishaan Mehta
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'ishaan.mehta@dps.edu', password_hash, 'student', 'Ishaan', 'ईशान', 'Mehta', 'मेहता', '30905006', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_nm_b, 1, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 7 - Priya Verma
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'priya.verma@dps.edu', password_hash, 'student', 'Priya', 'प्रिया', 'Verma', 'वर्मा', '30905007', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_nm_b, 2, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 8 - Rohan Joshi
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'rohan.joshi@dps.edu', password_hash, 'student', 'Rohan', 'रोहन', 'Joshi', 'जोशी', '30905008', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_nm_b, 3, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- ============================================================
    -- MEDICAL SECTION A STUDENTS (Roll 1-5)
    -- ============================================================
    
    -- Student 9 - Kavya Reddy
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'kavya.reddy@dps.edu', password_hash, 'student', 'Kavya', 'काव्या', 'Reddy', 'रेड्डी', '30905009', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_med_a, 1, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 10 - Aditya Nair
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'aditya.nair@dps.edu', password_hash, 'student', 'Aditya', 'आदित्य', 'Nair', 'नायर', '30905010', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_med_a, 2, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 11 - Meera Iyer
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'meera.iyer@dps.edu', password_hash, 'student', 'Meera', 'मीरा', 'Iyer', 'अय्यर', '30905011', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_med_a, 3, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 12 - Siddharth Kapoor
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'siddharth.kapoor@dps.edu', password_hash, 'student', 'Siddharth', 'सिद्धार्थ', 'Kapoor', 'कपूर', '30905012', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_med_a, 4, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- ============================================================
    -- COMMERCE SECTION A STUDENTS (Roll 1-5)
    -- ============================================================
    
    -- Student 13 - Riya Agarwal
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'riya.agarwal@dps.edu', password_hash, 'student', 'Riya', 'रिया', 'Agarwal', 'अग्रवाल', '30905013', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_com_a, 1, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 14 - Aryan Malhotra
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'aryan.malhotra@dps.edu', password_hash, 'student', 'Aryan', 'आर्यन', 'Malhotra', 'मल्होत्रा', '30905014', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_com_a, 2, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    -- Student 15 - Sneha Choudhary
    INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
    VALUES (gen_random_uuid(), school_uuid, 'sneha.choudhary@dps.edu', password_hash, 'student', 'Sneha', 'स्नेहा', 'Choudhary', 'चौधरी', '30905015', true, 'en', NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO student_uuid;
    IF student_uuid IS NOT NULL THEN
        INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
        VALUES (gen_random_uuid(), student_uuid, class_com_a, 3, 'active', NOW())
        ON CONFLICT (student_id, class_id) DO NOTHING;
    END IF;

    RAISE NOTICE 'Students created and enrolled successfully!';

END $$;

-- ============================================================
-- 4. VERIFY DATA
-- ============================================================

-- View classes created
SELECT 
    name, 
    name_hindi, 
    grade_level, 
    stream, 
    section,
    max_students
FROM classes 
WHERE grade_level = 11
ORDER BY stream, section;

-- View students with their classes
SELECT 
    u.first_name || ' ' || u.last_name AS full_name,
    u.admission_number,
    u.email,
    c.name AS class_name,
    c.stream,
    c.section,
    ce.roll_number
FROM users u
JOIN class_enrollments ce ON u.id = ce.student_id
JOIN classes c ON ce.class_id = c.id
WHERE u.role = 'student' AND c.grade_level = 11
ORDER BY c.stream, c.section, ce.roll_number;

-- Count students by stream
SELECT 
    c.stream,
    COUNT(ce.id) AS student_count
FROM classes c
LEFT JOIN class_enrollments ce ON c.id = ce.class_id
WHERE c.grade_level = 11
GROUP BY c.stream
ORDER BY c.stream;

-- ============================================================
-- NOTES
-- ============================================================
-- Admission numbers follow pattern: 30905XXX (UDISE prefix: 3090508916 -> 30905)
-- All students have password: student123
-- Email format: firstname.lastname@dps.edu
-- 
-- Classes created:
--   NON-MEDICAL: A, B, C (3 classes)
--   MEDICAL: A, B, C (3 classes)
--   COMMERCE: A, B, C (3 classes)
--   Total: 9 classes for Grade 11
--
-- Students created: 15 (5 per stream approximately)
