-- ============================================================
-- LAB RECORD MANAGER - COMPLETE DATABASE SCHEMA + TEST DATA
-- Run this in Neon SQL Editor: https://console.neon.tech
-- ============================================================

-- Drop existing tables (in order of dependencies) if they exist
DROP TABLE IF EXISTS fee_payments CASCADE;
DROP TABLE IF EXISTS student_fees CASCADE;
DROP TABLE IF EXISTS fee_structures CASCADE;
DROP TABLE IF EXISTS fee_categories CASCADE;
DROP TABLE IF EXISTS lab_material_usage CASCADE;
DROP TABLE IF EXISTS lab_materials CASCADE;
DROP TABLE IF EXISTS lab_attendance CASCADE;
DROP TABLE IF EXISTS generated_reports CASCADE;
DROP TABLE IF EXISTS report_templates CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_templates CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS grade_history CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS final_lab_marks CASCADE;
DROP TABLE IF EXISTS viva_questions CASCADE;
DROP TABLE IF EXISTS viva_sessions CASCADE;
DROP TABLE IF EXISTS submission_revisions CASCADE;
DROP TABLE IF EXISTS submission_files CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS assignment_targets CASCADE;
DROP TABLE IF EXISTS assignment_files CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS student_groups CASCADE;
DROP TABLE IF EXISTS class_subjects CASCADE;
DROP TABLE IF EXISTS labs CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS class_enrollments CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;
DROP TABLE IF EXISTS schools CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS "UserRole" CASCADE;
DROP TYPE IF EXISTS "EnrollmentStatus" CASCADE;
DROP TYPE IF EXISTS "GroupRole" CASCADE;
DROP TYPE IF EXISTS "AssignmentType" CASCADE;
DROP TYPE IF EXISTS "AssignmentStatus" CASCADE;
DROP TYPE IF EXISTS "TargetType" CASCADE;
DROP TYPE IF EXISTS "SubmissionStatus" CASCADE;
DROP TYPE IF EXISTS "VivaMode" CASCADE;
DROP TYPE IF EXISTS "VivaStatus" CASCADE;
DROP TYPE IF EXISTS "DifficultyLevel" CASCADE;
DROP TYPE IF EXISTS "FeeFrequency" CASCADE;
DROP TYPE IF EXISTS "FeeStatus" CASCADE;
DROP TYPE IF EXISTS "PaymentMode" CASCADE;
DROP TYPE IF EXISTS "ReportType" CASCADE;
DROP TYPE IF EXISTS "MaterialUnit" CASCADE;
DROP TYPE IF EXISTS "AttendanceStatus" CASCADE;
DROP TYPE IF EXISTS "ActivityType" CASCADE;

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE "UserRole" AS ENUM ('admin', 'principal', 'instructor', 'student', 'accountant', 'lab_assistant');
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'transferred', 'dropped', 'graduated');
CREATE TYPE "GroupRole" AS ENUM ('leader', 'member');
CREATE TYPE "AssignmentType" AS ENUM ('program', 'experiment', 'project', 'observation', 'viva_only');
CREATE TYPE "AssignmentStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "TargetType" AS ENUM ('class', 'group', 'student');
CREATE TYPE "SubmissionStatus" AS ENUM ('draft', 'submitted', 'under_review', 'needs_revision', 'viva_scheduled', 'viva_completed', 'graded', 'returned');
CREATE TYPE "VivaMode" AS ENUM ('online', 'offline', 'recorded');
CREATE TYPE "VivaStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show');
CREATE TYPE "DifficultyLevel" AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE "FeeFrequency" AS ENUM ('monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time');
CREATE TYPE "FeeStatus" AS ENUM ('pending', 'partial', 'paid', 'overdue', 'waived');
CREATE TYPE "PaymentMode" AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi', 'card');
CREATE TYPE "ReportType" AS ENUM ('progress', 'attendance', 'grade_sheet', 'fee_receipt', 'certificate');
CREATE TYPE "MaterialUnit" AS ENUM ('piece', 'ml', 'gram', 'kg', 'litre', 'set');
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE "ActivityType" AS ENUM ('login', 'logout', 'submission', 'grade', 'assignment', 'payment', 'viva', 'other');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Schools
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_hindi VARCHAR(255),
    name_regional VARCHAR(255),
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    state VARCHAR(100),
    district VARCHAR(100),
    board_affiliation VARCHAR(100),
    primary_language VARCHAR(10) DEFAULT 'en',
    secondary_languages TEXT[],
    academic_year_start INT DEFAULT 4,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Academic Years
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    year_label VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    role "UserRole" NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    first_name_hindi VARCHAR(100),
    first_name_regional VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    last_name_hindi VARCHAR(100),
    last_name_regional VARCHAR(100),
    admission_number VARCHAR(50),
    employee_id VARCHAR(50),
    profile_image_url TEXT,
    preferred_language VARCHAR(10) DEFAULT 'en',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Classes
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    grade_level INT NOT NULL,
    section VARCHAR(10),
    stream VARCHAR(50),
    class_teacher_id UUID REFERENCES users(id),
    max_students INT DEFAULT 60,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Class Enrollments
CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    roll_number INT,
    enrollment_date TIMESTAMP DEFAULT NOW(),
    status "EnrollmentStatus" DEFAULT 'active',
    UNIQUE(student_id, class_id)
);

-- Student Groups
CREATE TABLE student_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Group Members
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role "GroupRole" DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(group_id, student_id)
);

-- Subjects
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    name_regional VARCHAR(100),
    has_lab BOOLEAN DEFAULT false,
    lab_hours_per_week INT DEFAULT 0,
    theory_hours_per_week INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Class Subjects
CREATE TABLE class_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    instructor_id UUID REFERENCES users(id),
    lab_instructor_id UUID REFERENCES users(id),
    UNIQUE(class_id, subject_id)
);

-- Labs
CREATE TABLE labs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    room_number VARCHAR(20),
    capacity INT DEFAULT 30,
    subject_id UUID REFERENCES subjects(id),
    equipment_list JSONB,
    incharge_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Assignments
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    lab_id UUID REFERENCES labs(id),
    created_by UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    title_hindi VARCHAR(255),
    title_regional VARCHAR(255),
    description TEXT,
    description_hindi TEXT,
    description_regional TEXT,
    experiment_number VARCHAR(20),
    assignment_type "AssignmentType" NOT NULL,
    programming_language VARCHAR(50),
    aim TEXT,
    aim_hindi TEXT,
    theory TEXT,
    theory_hindi TEXT,
    procedure TEXT,
    procedure_hindi TEXT,
    expected_output TEXT,
    reference_code TEXT,
    attachments JSONB,
    max_marks INT DEFAULT 100,
    passing_marks INT DEFAULT 35,
    viva_marks INT DEFAULT 20,
    practical_marks INT DEFAULT 60,
    output_marks INT DEFAULT 20,
    publish_date TIMESTAMP,
    due_date TIMESTAMP,
    late_submission_allowed BOOLEAN DEFAULT true,
    late_penalty_percent INT DEFAULT 10,
    status "AssignmentStatus" DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Assignment Files
CREATE TABLE assignment_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    file_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Assignment Targets
CREATE TABLE assignment_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    target_type "TargetType" NOT NULL,
    target_class_id UUID,
    target_group_id UUID REFERENCES student_groups(id),
    target_student_id UUID,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    special_instructions TEXT,
    extended_due_date TIMESTAMP
);

-- Submissions
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES student_groups(id),
    code_content TEXT,
    output_content TEXT,
    observations TEXT,
    observations_hindi TEXT,
    conclusion TEXT,
    conclusion_hindi TEXT,
    attachments JSONB,
    output_screenshot_url TEXT,
    submission_number INT DEFAULT 1,
    is_late BOOLEAN DEFAULT false,
    late_days INT DEFAULT 0,
    status "SubmissionStatus" DEFAULT 'submitted',
    submitted_at TIMESTAMP DEFAULT NOW(),
    last_modified TIMESTAMP DEFAULT NOW(),
    UNIQUE(assignment_id, student_id, submission_number)
);

-- Submission Files
CREATE TABLE submission_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    file_url TEXT NOT NULL,
    is_output BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Submission Revisions
CREATE TABLE submission_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    code_content TEXT,
    output_content TEXT,
    attachments JSONB,
    revision_note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Viva Sessions
CREATE TABLE viva_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id),
    examiner_id UUID NOT NULL REFERENCES users(id),
    scheduled_at TIMESTAMP,
    duration_minutes INT DEFAULT 10,
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    mode "VivaMode" DEFAULT 'online',
    meeting_link TEXT,
    recording_url TEXT,
    questions_asked JSONB,
    student_responses JSONB,
    marks_obtained DECIMAL(5,2),
    max_marks DECIMAL(5,2),
    performance_rating INT,
    examiner_remarks TEXT,
    examiner_remarks_hindi TEXT,
    improvement_suggestions TEXT,
    status "VivaStatus" DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Viva Questions
CREATE TABLE viva_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES assignments(id),
    question TEXT NOT NULL,
    question_hindi TEXT,
    expected_answer TEXT,
    expected_answer_hindi TEXT,
    difficulty "DifficultyLevel" DEFAULT 'medium',
    marks INT DEFAULT 2,
    topic_tags TEXT[],
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Grades
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID UNIQUE NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    graded_by UUID NOT NULL REFERENCES users(id),
    practical_marks DECIMAL(5,2) DEFAULT 0,
    output_marks DECIMAL(5,2) DEFAULT 0,
    viva_marks DECIMAL(5,2) DEFAULT 0,
    total_marks DECIMAL(5,2),
    max_marks DECIMAL(5,2),
    percentage DECIMAL(5,2),
    grade_letter VARCHAR(5),
    late_penalty_marks DECIMAL(5,2) DEFAULT 0,
    final_marks DECIMAL(5,2),
    code_feedback TEXT,
    code_feedback_hindi TEXT,
    output_feedback TEXT,
    general_remarks TEXT,
    general_remarks_hindi TEXT,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP,
    graded_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Grade History
CREATE TABLE grade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    previous_marks JSONB NOT NULL,
    new_marks JSONB NOT NULL,
    reason TEXT,
    modified_by UUID NOT NULL,
    modified_at TIMESTAMP DEFAULT NOW()
);

-- Final Lab Marks
CREATE TABLE final_lab_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    class_id UUID NOT NULL REFERENCES classes(id),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id),
    total_assignments INT NOT NULL,
    completed_assignments INT NOT NULL,
    internal_marks DECIMAL(5,2),
    viva_average DECIMAL(5,2),
    practical_exam_marks DECIMAL(5,2),
    total_marks DECIMAL(5,2),
    max_marks DECIMAL(5,2),
    percentage DECIMAL(5,2),
    grade_letter VARCHAR(5),
    grade_points DECIMAL(3,2),
    remarks TEXT,
    is_pass BOOLEAN,
    finalized_by UUID REFERENCES users(id),
    finalized_at TIMESTAMP,
    UNIQUE(student_id, subject_id, academic_year_id)
);

-- Fee Categories
CREATE TABLE fee_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    description TEXT,
    is_recurring BOOLEAN DEFAULT true,
    frequency "FeeFrequency" DEFAULT 'yearly',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Fee Structures
CREATE TABLE fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id),
    fee_category_id UUID NOT NULL REFERENCES fee_categories(id),
    class_id UUID REFERENCES classes(id),
    subject_id UUID REFERENCES subjects(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    due_date TIMESTAMP,
    concession_applicable BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Student Fees
CREATE TABLE student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    fee_structure_id UUID NOT NULL REFERENCES fee_structures(id),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id),
    base_amount DECIMAL(10,2) NOT NULL,
    concession_amount DECIMAL(10,2) DEFAULT 0,
    concession_reason TEXT,
    final_amount DECIMAL(10,2) NOT NULL,
    status "FeeStatus" DEFAULT 'pending',
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Fee Payments
CREATE TABLE fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_fee_id UUID NOT NULL REFERENCES student_fees(id),
    student_id UUID NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_mode "PaymentMode" NOT NULL,
    transaction_id VARCHAR(100),
    receipt_number VARCHAR(50) UNIQUE,
    payment_date TIMESTAMP DEFAULT NOW(),
    collected_by UUID NOT NULL REFERENCES users(id),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lab Materials
CREATE TABLE lab_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    description TEXT,
    unit "MaterialUnit" NOT NULL,
    cost_per_unit DECIMAL(10,2),
    current_stock DECIMAL(10,2) DEFAULT 0,
    minimum_stock DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lab Material Usage
CREATE TABLE lab_material_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES lab_materials(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES assignments(id),
    student_id UUID NOT NULL REFERENCES users(id),
    quantity_used DECIMAL(10,2) NOT NULL,
    usage_date TIMESTAMP DEFAULT NOW(),
    recorded_by UUID NOT NULL REFERENCES users(id),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Lab Attendance
CREATE TABLE lab_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id),
    student_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    status "AttendanceStatus" DEFAULT 'present',
    marked_by UUID NOT NULL REFERENCES users(id),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Report Templates
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type "ReportType" NOT NULL,
    template_content TEXT,
    header_html TEXT,
    footer_html TEXT,
    styles TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Generated Reports
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES report_templates(id),
    generated_by UUID NOT NULL REFERENCES users(id),
    file_url TEXT NOT NULL,
    parameters JSONB,
    generated_at TIMESTAMP DEFAULT NOW()
);

-- Notification Templates
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255),
    subject_hindi VARCHAR(255),
    body_template TEXT NOT NULL,
    body_template_hindi TEXT,
    trigger_event VARCHAR(100),
    channels TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    title_hindi VARCHAR(255),
    message TEXT NOT NULL,
    message_hindi TEXT,
    type VARCHAR(50),
    reference_type VARCHAR(50),
    reference_id UUID,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type "ActivityType" NOT NULL,
    description TEXT NOT NULL,
    description_hindi TEXT,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CREATE INDEXES
-- ============================================================
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_enrollments_student ON class_enrollments(student_id);
CREATE INDEX idx_enrollments_class ON class_enrollments(class_id);
CREATE INDEX idx_assignments_school ON assignments(school_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_grades_submission ON grades(submission_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================================
-- TEST DATA
-- ============================================================

-- School
INSERT INTO schools (id, name, name_hindi, code, address, state, district, board_affiliation, primary_language, secondary_languages)
VALUES (
    '0cc0e430-ee19-41f6-9930-065ecc9e0216',
    'Demo Public School',
    'डेमो पब्लिक स्कूल',
    '3090508916',
    '123 Education Lane, New Delhi',
    'Delhi',
    'Central Delhi',
    'CBSE',
    'en',
    ARRAY['hi']
);

-- Academic Year
INSERT INTO academic_years (id, school_id, year_label, start_date, end_date, is_current)
VALUES (
    '75785519-d68c-47af-a2a9-451480bdf15a',
    '0cc0e430-ee19-41f6-9930-065ecc9e0216',
    '2024-25',
    '2024-04-01',
    '2025-03-31',
    true
);

-- Admin User (password: admin123)
INSERT INTO users (id, school_id, email, password_hash, role, first_name, last_name, employee_id)
VALUES (
    'a1111111-1111-1111-1111-111111111111',
    '0cc0e430-ee19-41f6-9930-065ecc9e0216',
    'admin@dps.edu',
    '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW',
    'admin',
    'Admin',
    'User',
    'ADM001'
);

-- Instructor User (password: instructor123)
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, employee_id)
VALUES (
    'i1111111-1111-1111-1111-111111111111',
    '0cc0e430-ee19-41f6-9930-065ecc9e0216',
    'instructor@dps.edu',
    '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW',
    'instructor',
    'Rajesh',
    'राजेश',
    'Kumar',
    'कुमार',
    'INS001'
);

-- Subjects
INSERT INTO subjects (id, school_id, code, name, name_hindi, has_lab, lab_hours_per_week)
VALUES 
    ('sub11111-1111-1111-1111-111111111111', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'CS101', 'Computer Science', 'कंप्यूटर विज्ञान', true, 4),
    ('sub22222-2222-2222-2222-222222222222', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'PHY101', 'Physics', 'भौतिकी', true, 2),
    ('sub33333-3333-3333-3333-333333333333', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'CHEM101', 'Chemistry', 'रसायन विज्ञान', true, 2),
    ('sub44444-4444-4444-4444-444444444444', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'BIO101', 'Biology', 'जीव विज्ञान', true, 2),
    ('sub55555-5555-5555-5555-555555555555', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'ACC101', 'Accountancy', 'लेखाशास्त्र', false, 0);

-- Labs
INSERT INTO labs (id, school_id, name, name_hindi, room_number, capacity, subject_id, incharge_id)
VALUES 
    ('lab11111-1111-1111-1111-111111111111', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'Computer Lab 1', 'कंप्यूटर लैब 1', 'CL-101', 40, 'sub11111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111'),
    ('lab22222-2222-2222-2222-222222222222', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'Physics Lab', 'भौतिकी लैब', 'PL-101', 30, 'sub22222-2222-2222-2222-222222222222', NULL),
    ('lab33333-3333-3333-3333-333333333333', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'Chemistry Lab', 'रसायन लैब', 'CH-101', 30, 'sub33333-3333-3333-3333-333333333333', NULL);

-- Grade 11 Classes
INSERT INTO classes (id, school_id, academic_year_id, name, name_hindi, grade_level, section, stream, max_students)
VALUES 
    ('11111111-1111-1111-1111-111111111101', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Non-Medical A', 'कक्षा 11 नॉन-मेडिकल ए', 11, 'A', 'NON-MEDICAL', 40),
    ('11111111-1111-1111-1111-111111111102', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Non-Medical B', 'कक्षा 11 नॉन-मेडिकल बी', 11, 'B', 'NON-MEDICAL', 40),
    ('11111111-1111-1111-1111-111111111103', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Non-Medical C', 'कक्षा 11 नॉन-मेडिकल सी', 11, 'C', 'NON-MEDICAL', 40),
    ('11111111-1111-1111-1111-111111111201', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Medical A', 'कक्षा 11 मेडिकल ए', 11, 'A', 'MEDICAL', 40),
    ('11111111-1111-1111-1111-111111111202', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Medical B', 'कक्षा 11 मेडिकल बी', 11, 'B', 'MEDICAL', 40),
    ('11111111-1111-1111-1111-111111111203', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Medical C', 'कक्षा 11 मेडिकल सी', 11, 'C', 'MEDICAL', 40),
    ('11111111-1111-1111-1111-111111111301', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Commerce A', 'कक्षा 11 कॉमर्स ए', 11, 'A', 'COMMERCE', 40),
    ('11111111-1111-1111-1111-111111111302', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Commerce B', 'कक्षा 11 कॉमर्स बी', 11, 'B', 'COMMERCE', 40),
    ('11111111-1111-1111-1111-111111111303', '0cc0e430-ee19-41f6-9930-065ecc9e0216', '75785519-d68c-47af-a2a9-451480bdf15a', 'Class 11 Commerce C', 'कक्षा 11 कॉमर्स सी', 11, 'C', 'COMMERCE', 40);

-- Students (password: student123)
INSERT INTO users (id, school_id, email, password_hash, role, first_name, first_name_hindi, last_name, last_name_hindi, admission_number)
VALUES 
    -- Non-Medical A (5 students)
    ('22222222-2222-2222-2222-222222222201', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aarav.sharma@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Aarav', 'आरव', 'Sharma', 'शर्मा', '30905001'),
    ('22222222-2222-2222-2222-222222222202', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'diya.patel@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Diya', 'दीया', 'Patel', 'पटेल', '30905002'),
    ('22222222-2222-2222-2222-222222222203', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'arjun.singh@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Arjun', 'अर्जुन', 'Singh', 'सिंह', '30905003'),
    ('22222222-2222-2222-2222-222222222204', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'ananya.gupta@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Ananya', 'अनन्या', 'Gupta', 'गुप्ता', '30905004'),
    ('22222222-2222-2222-2222-222222222205', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'vihaan.kumar@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Vihaan', 'विहान', 'Kumar', 'कुमार', '30905005'),
    -- Non-Medical B (5 students)
    ('22222222-2222-2222-2222-222222222206', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'ishaan.mehta@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Ishaan', 'ईशान', 'Mehta', 'मेहता', '30905006'),
    ('22222222-2222-2222-2222-222222222207', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'priya.verma@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Priya', 'प्रिया', 'Verma', 'वर्मा', '30905007'),
    ('22222222-2222-2222-2222-222222222208', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'rohan.joshi@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Rohan', 'रोहन', 'Joshi', 'जोशी', '30905008'),
    ('22222222-2222-2222-2222-222222222209', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'neha.saxena@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Neha', 'नेहा', 'Saxena', 'सक्सेना', '30905009'),
    ('22222222-2222-2222-2222-222222222210', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'kabir.das@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Kabir', 'कबीर', 'Das', 'दास', '30905010'),
    -- Medical A (5 students)
    ('22222222-2222-2222-2222-222222222301', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'kavya.reddy@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Kavya', 'काव्या', 'Reddy', 'रेड्डी', '30905011'),
    ('22222222-2222-2222-2222-222222222302', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aditya.nair@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Aditya', 'आदित्य', 'Nair', 'नायर', '30905012'),
    ('22222222-2222-2222-2222-222222222303', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'meera.iyer@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Meera', 'मीरा', 'Iyer', 'अय्यर', '30905013'),
    ('22222222-2222-2222-2222-222222222304', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'siddharth.kapoor@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Siddharth', 'सिद्धार्थ', 'Kapoor', 'कपूर', '30905014'),
    ('22222222-2222-2222-2222-222222222305', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'tanya.sharma@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Tanya', 'तान्या', 'Sharma', 'शर्मा', '30905015'),
    -- Commerce A (5 students)
    ('22222222-2222-2222-2222-222222222401', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'riya.agarwal@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Riya', 'रिया', 'Agarwal', 'अग्रवाल', '30905021'),
    ('22222222-2222-2222-2222-222222222402', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aryan.malhotra@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Aryan', 'आर्यन', 'Malhotra', 'मल्होत्रा', '30905022'),
    ('22222222-2222-2222-2222-222222222403', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'sneha.choudhary@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Sneha', 'स्नेहा', 'Choudhary', 'चौधरी', '30905023'),
    ('22222222-2222-2222-2222-222222222404', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'dev.bajaj@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Dev', 'देव', 'Bajaj', 'बजाज', '30905024'),
    ('22222222-2222-2222-2222-222222222405', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'aisha.khan@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Aisha', 'आयशा', 'Khan', 'खान', '30905025'),
    -- Demo student1 for testing
    ('22222222-2222-2222-2222-222222222100', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'student1@dps.edu', '$2a$10$PU4SJkBio5IuHSRG5C3t4uhZgVvxeF1s2BBEANyopNl/IEIYQvzCW', 'student', 'Student', NULL, 'One', NULL, 'STU001');

-- Class Enrollments
INSERT INTO class_enrollments (student_id, class_id, roll_number, status)
VALUES 
    -- Non-Medical A
    ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 'active'),
    ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 2, 'active'),
    ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 3, 'active'),
    ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 4, 'active'),
    ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111101', 5, 'active'),
    -- Non-Medical B
    ('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111102', 1, 'active'),
    ('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111102', 2, 'active'),
    ('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111102', 3, 'active'),
    ('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111102', 4, 'active'),
    ('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111102', 5, 'active'),
    -- Medical A
    ('22222222-2222-2222-2222-222222222301', '11111111-1111-1111-1111-111111111201', 1, 'active'),
    ('22222222-2222-2222-2222-222222222302', '11111111-1111-1111-1111-111111111201', 2, 'active'),
    ('22222222-2222-2222-2222-222222222303', '11111111-1111-1111-1111-111111111201', 3, 'active'),
    ('22222222-2222-2222-2222-222222222304', '11111111-1111-1111-1111-111111111201', 4, 'active'),
    ('22222222-2222-2222-2222-222222222305', '11111111-1111-1111-1111-111111111201', 5, 'active'),
    -- Commerce A
    ('22222222-2222-2222-2222-222222222401', '11111111-1111-1111-1111-111111111301', 1, 'active'),
    ('22222222-2222-2222-2222-222222222402', '11111111-1111-1111-1111-111111111301', 2, 'active'),
    ('22222222-2222-2222-2222-222222222403', '11111111-1111-1111-1111-111111111301', 3, 'active'),
    ('22222222-2222-2222-2222-222222222404', '11111111-1111-1111-1111-111111111301', 4, 'active'),
    ('22222222-2222-2222-2222-222222222405', '11111111-1111-1111-1111-111111111301', 5, 'active');

-- Class Subjects
INSERT INTO class_subjects (class_id, subject_id, instructor_id, lab_instructor_id)
VALUES 
    ('11111111-1111-1111-1111-111111111101', 'sub11111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111'),
    ('11111111-1111-1111-1111-111111111101', 'sub22222-2222-2222-2222-222222222222', 'i1111111-1111-1111-1111-111111111111', NULL),
    ('11111111-1111-1111-1111-111111111102', 'sub11111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111'),
    ('11111111-1111-1111-1111-111111111201', 'sub33333-3333-3333-3333-333333333333', 'i1111111-1111-1111-1111-111111111111', NULL),
    ('11111111-1111-1111-1111-111111111201', 'sub44444-4444-4444-4444-444444444444', 'i1111111-1111-1111-1111-111111111111', NULL),
    ('11111111-1111-1111-1111-111111111301', 'sub55555-5555-5555-5555-555555555555', 'i1111111-1111-1111-1111-111111111111', NULL);

-- Sample Assignments
INSERT INTO assignments (id, school_id, subject_id, lab_id, created_by, title, title_hindi, description, experiment_number, assignment_type, programming_language, max_marks, due_date, status)
VALUES 
    ('asgn1111-1111-1111-1111-111111111111', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'sub11111-1111-1111-1111-111111111111', 'lab11111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111', 
    'Write a program to find factorial of a number', 'एक संख्या का फ़ैक्टोरियल ज्ञात करने के लिए प्रोग्राम लिखें', 
    'Write a C++ program to calculate the factorial of a given number using both iterative and recursive methods.', 
    'EXP-01', 'program', 'C++', 100, NOW() + INTERVAL '7 days', 'published'),
    
    ('asgn2222-2222-2222-2222-222222222222', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'sub11111-1111-1111-1111-111111111111', 'lab11111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111', 
    'Implement Stack using Array', 'ऐरे का उपयोग करके स्टैक लागू करें', 
    'Implement a stack data structure using arrays with push, pop, peek operations.', 
    'EXP-02', 'program', 'C++', 100, NOW() + INTERVAL '14 days', 'published'),
    
    ('asgn3333-3333-3333-3333-333333333333', '0cc0e430-ee19-41f6-9930-065ecc9e0216', 'sub22222-2222-2222-2222-222222222222', 'lab22222-2222-2222-2222-222222222222', 'i1111111-1111-1111-1111-111111111111', 
    'Verify Ohm''s Law', 'ओम के नियम का सत्यापन करें', 
    'Verify Ohm''s law by plotting V-I characteristics of a resistor.', 
    'EXP-01', 'experiment', NULL, 50, NOW() + INTERVAL '7 days', 'published');

-- Assignment Targets (assign to class)
INSERT INTO assignment_targets (assignment_id, target_type, target_class_id, assigned_by)
VALUES 
    ('asgn1111-1111-1111-1111-111111111111', 'class', '11111111-1111-1111-1111-111111111101', 'i1111111-1111-1111-1111-111111111111'),
    ('asgn2222-2222-2222-2222-222222222222', 'class', '11111111-1111-1111-1111-111111111101', 'i1111111-1111-1111-1111-111111111111'),
    ('asgn3333-3333-3333-3333-333333333333', 'class', '11111111-1111-1111-1111-111111111101', 'i1111111-1111-1111-1111-111111111111');

-- Sample Submission
INSERT INTO submissions (id, assignment_id, student_id, code_content, output_content, status, submitted_at)
VALUES (
    'subm1111-1111-1111-1111-111111111111',
    'asgn1111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    '#include <iostream>
using namespace std;

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    int num;
    cout << "Enter a number: ";
    cin >> num;
    cout << "Factorial of " << num << " is " << factorial(num) << endl;
    return 0;
}',
    'Enter a number: 5\nFactorial of 5 is 120',
    'submitted',
    NOW()
);

-- Sample Grade
INSERT INTO grades (submission_id, student_id, graded_by, practical_marks, output_marks, viva_marks, total_marks, max_marks, percentage, grade_letter, final_marks, general_remarks, is_published)
VALUES (
    'subm1111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'i1111111-1111-1111-1111-111111111111',
    55, 18, 15, 88, 100, 88.00, 'A', 88,
    'Excellent work! Code is well-structured and efficient.',
    true
);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check counts
SELECT 'Schools' as table_name, COUNT(*) as count FROM schools
UNION ALL SELECT 'Users', COUNT(*) FROM users
UNION ALL SELECT 'Classes', COUNT(*) FROM classes
UNION ALL SELECT 'Enrollments', COUNT(*) FROM class_enrollments
UNION ALL SELECT 'Subjects', COUNT(*) FROM subjects
UNION ALL SELECT 'Labs', COUNT(*) FROM labs
UNION ALL SELECT 'Assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'Submissions', COUNT(*) FROM submissions
UNION ALL SELECT 'Grades', COUNT(*) FROM grades;

-- ============================================================
-- LOGIN CREDENTIALS
-- ============================================================
-- Admin: admin@dps.edu / admin123
-- Instructor: instructor@dps.edu / instructor123
-- Student: student1@dps.edu / student123
-- Students: aarav.sharma@dps.edu / student123 (and similar)
-- ============================================================
