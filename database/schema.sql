-- =====================================================
-- Lab Record Manager - Database Schema for Neon
-- Run this SQL in Neon console to create all tables
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('admin', 'principal', 'instructor', 'student', 'accountant', 'lab_assistant');
CREATE TYPE enrollment_status AS ENUM ('active', 'transferred', 'dropped', 'graduated');
CREATE TYPE group_role AS ENUM ('leader', 'member');
CREATE TYPE assignment_type AS ENUM ('program', 'experiment', 'project', 'observation', 'viva_only');
CREATE TYPE assignment_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE target_type AS ENUM ('class', 'group', 'student');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'under_review', 'needs_revision', 'viva_scheduled', 'viva_completed', 'graded', 'returned');
CREATE TYPE viva_mode AS ENUM ('online', 'offline', 'recorded');
CREATE TYPE viva_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE fee_frequency AS ENUM ('monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time');
CREATE TYPE fee_status AS ENUM ('pending', 'partial', 'paid', 'overdue', 'waived');
CREATE TYPE payment_mode AS ENUM ('cash', 'cheque', 'upi', 'card', 'net_banking', 'dd');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE report_type AS ENUM ('student_progress', 'class_summary', 'assignment_analytics', 'attendance_report', 'fee_collection', 'lab_utilization');
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'push', 'whatsapp');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'read');

-- =====================================================
-- SCHOOLS & ORGANIZATION
-- =====================================================

CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    name_hindi VARCHAR(255),
    name_regional VARCHAR(255),
    code VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    state VARCHAR(100),
    district VARCHAR(100),
    board_affiliation VARCHAR(50),
    primary_language VARCHAR(20) DEFAULT 'en',
    secondary_languages TEXT[],
    academic_year_start INTEGER DEFAULT 4,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    year_label VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- USER MANAGEMENT
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
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

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- CLASSES & GROUPS
-- =====================================================

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id),
    name VARCHAR(50) NOT NULL,
    name_hindi VARCHAR(50),
    grade_level INTEGER NOT NULL,
    section VARCHAR(10),
    stream VARCHAR(50),
    class_teacher_id UUID REFERENCES users(id),
    max_students INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    roll_number INTEGER,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status enrollment_status DEFAULT 'active',
    UNIQUE(student_id, class_id)
);

CREATE TABLE student_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES student_groups(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role group_role DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(group_id, student_id)
);

-- =====================================================
-- SUBJECTS & LABS
-- =====================================================

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    name_regional VARCHAR(100),
    has_lab BOOLEAN DEFAULT false,
    lab_hours_per_week INTEGER DEFAULT 0,
    theory_hours_per_week INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE class_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    instructor_id UUID REFERENCES users(id),
    lab_instructor_id UUID REFERENCES users(id),
    UNIQUE(class_id, subject_id)
);

CREATE TABLE labs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    room_number VARCHAR(20),
    capacity INTEGER DEFAULT 30,
    subject_id UUID REFERENCES subjects(id),
    equipment_list JSONB,
    incharge_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ASSIGNMENTS
-- =====================================================

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id),
    lab_id UUID REFERENCES labs(id),
    created_by UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    title_hindi VARCHAR(255),
    title_regional VARCHAR(255),
    description TEXT,
    description_hindi TEXT,
    description_regional TEXT,
    experiment_number VARCHAR(20),
    assignment_type assignment_type NOT NULL,
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
    max_marks INTEGER DEFAULT 100,
    passing_marks INTEGER DEFAULT 35,
    viva_marks INTEGER DEFAULT 20,
    practical_marks INTEGER DEFAULT 60,
    output_marks INTEGER DEFAULT 20,
    publish_date TIMESTAMP,
    due_date TIMESTAMP,
    late_submission_allowed BOOLEAN DEFAULT true,
    late_penalty_percent INTEGER DEFAULT 10,
    status assignment_status DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE assignment_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    file_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE assignment_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    target_type target_type NOT NULL,
    target_class_id UUID,
    target_group_id UUID REFERENCES student_groups(id),
    target_student_id UUID,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    special_instructions TEXT,
    extended_due_date TIMESTAMP
);

-- =====================================================
-- SUBMISSIONS
-- =====================================================

CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES assignments(id),
    student_id UUID REFERENCES users(id),
    group_id UUID REFERENCES student_groups(id),
    code_content TEXT,
    output_content TEXT,
    observations TEXT,
    observations_hindi TEXT,
    conclusion TEXT,
    conclusion_hindi TEXT,
    attachments JSONB,
    output_screenshot_url TEXT,
    submission_number INTEGER DEFAULT 1,
    is_late BOOLEAN DEFAULT false,
    late_days INTEGER DEFAULT 0,
    status submission_status DEFAULT 'submitted',
    submitted_at TIMESTAMP DEFAULT NOW(),
    last_modified TIMESTAMP DEFAULT NOW(),
    UNIQUE(assignment_id, student_id, submission_number)
);

CREATE TABLE submission_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    file_url TEXT NOT NULL,
    is_output BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE submission_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES submissions(id),
    revision_number INTEGER NOT NULL,
    code_content TEXT,
    output_content TEXT,
    attachments JSONB,
    revision_note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- VIVA SYSTEM
-- =====================================================

CREATE TABLE viva_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID REFERENCES submissions(id),
    student_id UUID REFERENCES users(id),
    examiner_id UUID REFERENCES users(id),
    scheduled_at TIMESTAMP,
    duration_minutes INTEGER DEFAULT 10,
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    mode viva_mode DEFAULT 'online',
    meeting_link TEXT,
    recording_url TEXT,
    questions_asked JSONB,
    student_responses JSONB,
    marks_obtained DECIMAL(5,2),
    max_marks DECIMAL(5,2),
    performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
    examiner_remarks TEXT,
    examiner_remarks_hindi TEXT,
    improvement_suggestions TEXT,
    status viva_status DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE viva_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id),
    assignment_id UUID REFERENCES assignments(id),
    question TEXT NOT NULL,
    question_hindi TEXT,
    expected_answer TEXT,
    expected_answer_hindi TEXT,
    difficulty difficulty_level DEFAULT 'medium',
    marks INTEGER DEFAULT 2,
    topic_tags TEXT[],
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- GRADING
-- =====================================================

CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID UNIQUE REFERENCES submissions(id),
    student_id UUID REFERENCES users(id),
    graded_by UUID REFERENCES users(id),
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

CREATE TABLE grade_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grade_id UUID REFERENCES grades(id),
    previous_marks JSONB,
    new_marks JSONB,
    reason TEXT,
    modified_by UUID REFERENCES users(id),
    modified_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE final_lab_marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id),
    subject_id UUID REFERENCES subjects(id),
    class_id UUID REFERENCES classes(id),
    academic_year_id UUID REFERENCES academic_years(id),
    total_assignments INTEGER,
    completed_assignments INTEGER,
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

-- =====================================================
-- TRACKING & REPORTING
-- =====================================================

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    school_id UUID REFERENCES schools(id),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    description TEXT,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lab_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_id UUID REFERENCES labs(id),
    class_id UUID REFERENCES classes(id),
    student_id UUID REFERENCES users(id),
    instructor_id UUID REFERENCES users(id),
    session_date DATE NOT NULL,
    session_slot INTEGER,
    status attendance_status DEFAULT 'present',
    entry_time TIME,
    exit_time TIME,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(lab_id, student_id, session_date, session_slot)
);

CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id),
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    report_type report_type,
    template_config JSONB,
    filters_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES report_templates(id),
    generated_by UUID REFERENCES users(id),
    filters_used JSONB,
    report_data JSONB,
    file_url TEXT,
    generated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- =====================================================
-- TRANSLATIONS & NOTIFICATIONS
-- =====================================================

CREATE TABLE translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_key VARCHAR(100) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    translation TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(entity_type, entity_key, language_code)
);

CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id),
    template_key VARCHAR(100) NOT NULL,
    channel notification_channel NOT NULL,
    subject TEXT,
    subject_hindi TEXT,
    body TEXT NOT NULL,
    body_hindi TEXT,
    variables TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(school_id, template_key, channel)
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    template_id UUID REFERENCES notification_templates(id),
    channel notification_channel,
    recipient VARCHAR(255),
    language_used VARCHAR(10),
    subject TEXT,
    body TEXT,
    status notification_status DEFAULT 'pending',
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- SYLLABUS TRACKING
-- =====================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    name_hindi VARCHAR(100),
    code VARCHAR(20),
    head_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE syllabi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id),
    class_id UUID REFERENCES classes(id),
    name VARCHAR(255) NOT NULL,
    name_hindi VARCHAR(255),
    board_reference VARCHAR(100),
    total_hours INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE syllabus_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    syllabus_id UUID REFERENCES syllabi(id) ON DELETE CASCADE,
    unit_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_hindi VARCHAR(255),
    description TEXT,
    expected_hours INTEGER,
    weightage_percent INTEGER,
    sequence_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE syllabus_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID REFERENCES syllabus_units(id) ON DELETE CASCADE,
    topic_number VARCHAR(20),
    name VARCHAR(255) NOT NULL,
    name_hindi VARCHAR(255),
    learning_objectives TEXT,
    learning_objectives_hindi TEXT,
    expected_hours INTEGER,
    is_practical BOOLEAN DEFAULT false,
    sequence_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Map assignments to syllabus topics
CREATE TABLE assignment_topic_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES syllabus_topics(id) ON DELETE CASCADE,
    coverage_percent INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(assignment_id, topic_id)
);

-- Track student completion per topic
CREATE TABLE student_topic_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES syllabus_topics(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started', -- not_started, in_progress, completed, verified
    completion_percent INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    remarks TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, topic_id)
);

-- Department-level syllabus progress summary (materialized/cached)
CREATE TABLE department_progress_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id),
    syllabus_id UUID REFERENCES syllabi(id),
    class_id UUID REFERENCES classes(id),
    academic_year_id UUID REFERENCES academic_years(id),
    total_topics INTEGER,
    completed_topics INTEGER,
    avg_class_completion_percent DECIMAL(5,2),
    students_at_100_percent INTEGER,
    students_below_50_percent INTEGER,
    last_calculated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(syllabus_id, class_id, academic_year_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_classes_school ON classes(school_id);
CREATE INDEX idx_assignments_school ON assignments(school_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_grades_submission ON grades(submission_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- =====================================================
-- DONE!
-- =====================================================
