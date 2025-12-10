-- ============================================================
-- Lab Record Manager - Neon Database Test Data SQL
-- Run this directly in Neon SQL Editor (console.neon.tech)
-- ============================================================

-- STEP 1: Update School with UDISE Code
-- ============================================================
UPDATE schools 
SET 
    code = '3090508916',
    name = 'Demo Public School',
    name_hindi = 'डेमो पब्लिक स्कूल'
WHERE id = '0cc0e430-ee19-41f6-9930-065ecc9e0216';

-- STEP 2: Create Grade 11 Classes (9 classes total)
-- ============================================================
-- First delete any existing enrollments for Grade 11 classes
DELETE FROM class_enrollments 
WHERE class_id IN (
    SELECT id FROM classes 
    WHERE school_id = '0cc0e430-ee19-41f6-9930-065ecc9e0216' 
    AND grade_level = 11
);

-- Now delete existing Grade 11 classes
DELETE FROM classes 
WHERE school_id = '0cc0e430-ee19-41f6-9930-065ecc9e0216'
AND grade_level = 11;

-- NON-MEDICAL Stream Classes
INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students, created_at)
VALUES 
    ('11111111-1111-1111-1111-111111111101', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Non-Medical A', 'कक्षा 11 नॉन-मेडिकल ए', 11, 'A', 'NON-MEDICAL', 40, NOW()),
    ('11111111-1111-1111-1111-111111111102', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Non-Medical B', 'कक्षा 11 नॉन-मेडिकल बी', 11, 'B', 'NON-MEDICAL', 40, NOW()),
    ('11111111-1111-1111-1111-111111111103', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Non-Medical C', 'कक्षा 11 नॉन-मेडिकल सी', 11, 'C', 'NON-MEDICAL', 40, NOW());

-- MEDICAL Stream Classes
INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students, created_at)
VALUES 
    ('11111111-1111-1111-1111-111111111201', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Medical A', 'कक्षा 11 मेडिकल ए', 11, 'A', 'MEDICAL', 40, NOW()),
    ('11111111-1111-1111-1111-111111111202', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Medical B', 'कक्षा 11 मेडिकल बी', 11, 'B', 'MEDICAL', 40, NOW()),
    ('11111111-1111-1111-1111-111111111203', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Medical C', 'कक्षा 11 मेडिकल सी', 11, 'C', 'MEDICAL', 40, NOW());

-- COMMERCE Stream Classes
INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students, created_at)
VALUES 
    ('11111111-1111-1111-1111-111111111301', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Commerce A', 'कक्षा 11 कॉमर्स ए', 11, 'A', 'COMMERCE', 40, NOW()),
    ('11111111-1111-1111-1111-111111111302', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Commerce B', 'कक्षा 11 कॉमर्स बी', 11, 'B', 'COMMERCE', 40, NOW()),
    ('11111111-1111-1111-1111-111111111303', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Commerce C', 'कक्षा 11 कॉमर्स सी', 11, 'C', 'COMMERCE', 40, NOW());

-- STEP 3: Create Students with 8-digit Admission Numbers
-- ============================================================
-- Password hash for 'student123' (copied from existing student)

-- NON-MEDICAL Section A Students
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
VALUES 
    ('22222222-2222-2222-2222-222222222201', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aarav.sharma@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Aarav', 'आरव', 'Sharma', 'शर्मा', '30905001', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222202', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'diya.patel@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Diya', 'दीया', 'Patel', 'पटेल', '30905002', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222203', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'arjun.singh@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Arjun', 'अर्जुन', 'Singh', 'सिंह', '30905003', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222204', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'ananya.gupta@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Ananya', 'अनन्या', 'Gupta', 'गुप्ता', '30905004', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222205', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'vihaan.kumar@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Vihaan', 'विहान', 'Kumar', 'कुमार', '30905005', true, 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- NON-MEDICAL Section B Students
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
VALUES 
    ('22222222-2222-2222-2222-222222222206', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'ishaan.mehta@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Ishaan', 'ईशान', 'Mehta', 'मेहता', '30905006', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222207', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'priya.verma@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Priya', 'प्रिया', 'Verma', 'वर्मा', '30905007', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222208', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'rohan.joshi@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Rohan', 'रोहन', 'Joshi', 'जोशी', '30905008', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222209', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'neha.saxena@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Neha', 'नेहा', 'Saxena', 'सक्सेना', '30905009', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222210', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'kabir.das@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Kabir', 'कबीर', 'Das', 'दास', '30905010', true, 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- MEDICAL Section A Students
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
VALUES 
    ('22222222-2222-2222-2222-222222222301', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'kavya.reddy@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Kavya', 'काव्या', 'Reddy', 'रेड्डी', '30905011', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222302', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aditya.nair@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Aditya', 'आदित्य', 'Nair', 'नायर', '30905012', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222303', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'meera.iyer@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Meera', 'मीरा', 'Iyer', 'अय्यर', '30905013', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222304', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'siddharth.kapoor@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Siddharth', 'सिद्धार्थ', 'Kapoor', 'कपूर', '30905014', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222305', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'tanya.sharma@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Tanya', 'तान्या', 'Sharma', 'शर्मा', '30905015', true, 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- MEDICAL Section B Students
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
VALUES 
    ('22222222-2222-2222-2222-222222222306', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'varun.khanna@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Varun', 'वरुण', 'Khanna', 'खन्ना', '30905016', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222307', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'simran.kaur@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Simran', 'सिमरन', 'Kaur', 'कौर', '30905017', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222308', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'harsh.rawat@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Harsh', 'हर्ष', 'Rawat', 'रावत', '30905018', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222309', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'divya.rastogi@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Divya', 'दिव्या', 'Rastogi', 'रस्तोगी', '30905019', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222310', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'kunal.bhatia@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Kunal', 'कुणाल', 'Bhatia', 'भाटिया', '30905020', true, 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- COMMERCE Section A Students
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
VALUES 
    ('22222222-2222-2222-2222-222222222401', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'riya.agarwal@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Riya', 'रिया', 'Agarwal', 'अग्रवाल', '30905021', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222402', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aryan.malhotra@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Aryan', 'आर्यन', 'Malhotra', 'मल्होत्रा', '30905022', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222403', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'sneha.choudhary@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Sneha', 'स्नेहा', 'Choudhary', 'चौधरी', '30905023', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222404', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'dev.bajaj@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Dev', 'देव', 'Bajaj', 'बजाज', '30905024', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222405', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aisha.khan@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Aisha', 'आयशा', 'Khan', 'खान', '30905025', true, 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- COMMERCE Section B Students
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number, is_active, preferred_language, created_at, updated_at)
VALUES 
    ('22222222-2222-2222-2222-222222222406', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'yash.goel@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Yash', 'यश', 'Goel', 'गोयल', '30905026', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222407', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'kritika.jain@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Kritika', 'कृतिका', 'Jain', 'जैन', '30905027', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222408', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'akshat.mittal@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Akshat', 'अक्षत', 'Mittal', 'मित्तल', '30905028', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222409', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'pooja.singhal@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Pooja', 'पूजा', 'Singhal', 'सिंघल', '30905029', true, 'en', NOW(), NOW()),
    ('22222222-2222-2222-2222-222222222410', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'rahul.bansal@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Rahul', 'राहुल', 'Bansal', 'बंसल', '30905030', true, 'en', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- STEP 4: Enroll Students in Classes
-- ============================================================

-- NON-MEDICAL Section A Enrollments
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
VALUES 
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 2, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 3, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 4, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111101', 5, 'active', NOW())
ON CONFLICT (student_id, class_id) DO NOTHING;

-- NON-MEDICAL Section B Enrollments
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
VALUES 
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111102', 1, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111102', 2, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111102', 3, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111102', 4, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111102', 5, 'active', NOW())
ON CONFLICT (student_id, class_id) DO NOTHING;

-- MEDICAL Section A Enrollments
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
VALUES 
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222301', '11111111-1111-1111-1111-111111111201', 1, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222302', '11111111-1111-1111-1111-111111111201', 2, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222303', '11111111-1111-1111-1111-111111111201', 3, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222304', '11111111-1111-1111-1111-111111111201', 4, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222305', '11111111-1111-1111-1111-111111111201', 5, 'active', NOW())
ON CONFLICT (student_id, class_id) DO NOTHING;

-- MEDICAL Section B Enrollments
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
VALUES 
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222306', '11111111-1111-1111-1111-111111111202', 1, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222307', '11111111-1111-1111-1111-111111111202', 2, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222308', '11111111-1111-1111-1111-111111111202', 3, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222309', '11111111-1111-1111-1111-111111111202', 4, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222310', '11111111-1111-1111-1111-111111111202', 5, 'active', NOW())
ON CONFLICT (student_id, class_id) DO NOTHING;

-- COMMERCE Section A Enrollments
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
VALUES 
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222401', '11111111-1111-1111-1111-111111111301', 1, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222402', '11111111-1111-1111-1111-111111111301', 2, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222403', '11111111-1111-1111-1111-111111111301', 3, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222404', '11111111-1111-1111-1111-111111111301', 4, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222405', '11111111-1111-1111-1111-111111111301', 5, 'active', NOW())
ON CONFLICT (student_id, class_id) DO NOTHING;

-- COMMERCE Section B Enrollments
INSERT INTO class_enrollments (id, student_id, class_id, roll_number, status, enrollment_date)
VALUES 
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222406', '11111111-1111-1111-1111-111111111302', 1, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222407', '11111111-1111-1111-1111-111111111302', 2, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222408', '11111111-1111-1111-1111-111111111302', 3, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222409', '11111111-1111-1111-1111-111111111302', 4, 'active', NOW()),
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222410', '11111111-1111-1111-1111-111111111302', 5, 'active', NOW())
ON CONFLICT (student_id, class_id) DO NOTHING;
