-- MeritEntrance Complete Database Schema
-- Run this to recreate the database from scratch

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_regional VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    photo_url TEXT,
    class VARCHAR(50),
    school VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============ EXAMS ============
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title JSONB NOT NULL,
    description JSONB,
    instructions JSONB,
    duration INTEGER NOT NULL,
    total_marks INTEGER NOT NULL,
    passing_marks INTEGER,
    negative_marking NUMERIC(3,2),
    shuffle_questions BOOLEAN DEFAULT false,
    "showResults" VARCHAR(50) DEFAULT 'after_submit',
    status VARCHAR(50) DEFAULT 'draft',
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    name JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    duration INTEGER
);

CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    text JSONB NOT NULL,
    options JSONB,
    correct_answer JSONB NOT NULL,
    explanation JSONB,
    marks INTEGER DEFAULT 1,
    negative_marks NUMERIC(3,2),
    image_url TEXT,
    "order" INTEGER NOT NULL,
    parent_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    paragraph_text JSONB
);

-- ============ SCHEDULING ============
CREATE TABLE IF NOT EXISTS exam_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(exam_id, student_id)
);

-- ============ ATTEMPTS & RESPONSES ============
CREATE TABLE IF NOT EXISTS exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id),
    student_id UUID NOT NULL REFERENCES students(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    auto_submit BOOLEAN DEFAULT false,
    total_score NUMERIC(6,2),
    status VARCHAR(50) DEFAULT 'in_progress',
    UNIQUE(exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(exam_id, status);

CREATE TABLE IF NOT EXISTS question_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    answer JSONB,
    marked_for_review BOOLEAN DEFAULT false,
    time_spent INTEGER,
    is_correct BOOLEAN,
    marks_awarded NUMERIC(5,2),
    UNIQUE(attempt_id, question_id)
);

-- ============ DEMO CONTENT ============
CREATE TABLE IF NOT EXISTS demo_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ QUERY LOGS ============
CREATE TABLE IF NOT EXISTS query_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    query TEXT,
    params TEXT,
    success BOOLEAN DEFAULT true,
    error TEXT,
    duration INTEGER,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_logs_success_created_at ON query_logs (success, created_at);
CREATE INDEX IF NOT EXISTS idx_query_logs_route ON query_logs (route);
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs (created_at DESC);

-- ============ SAMPLE DATA ============
-- Default superadmin (password: admin123)
INSERT INTO admins (email, password_hash, name, role) 
VALUES ('admin@merit.edu', '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ2t9pILAO8C2wuq', 'Super Admin', 'superadmin')
ON CONFLICT (email) DO NOTHING;
