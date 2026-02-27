Exporting database schema...

-- MeritEntrance Database Schema Export
-- Generated: 2026-02-24T19:33:07.673Z
-- Tables: 25


-- Table: _BlueprintRuleToTag
CREATE TABLE IF NOT EXISTS _BlueprintRuleToTag (
    A UUID NOT NULL,
    B UUID NOT NULL
);

CREATE UNIQUE INDEX "_BlueprintRuleToTag_AB_unique" ON public."_BlueprintRuleToTag" USING btree ("A", "B");
CREATE INDEX "_BlueprintRuleToTag_B_index" ON public."_BlueprintRuleToTag" USING btree ("B");


-- Table: activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    message TEXT NOT NULL,
    admin_id UUID,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);



-- Table: admin_notes
CREATE TABLE IF NOT EXISTS admin_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content JSONB NOT NULL,
    author_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
);



-- Table: admins
CREATE TABLE IF NOT EXISTS admins (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin'::text,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verification_token TEXT,
    verification_expires TIMESTAMP
);

CREATE UNIQUE INDEX admins_email_key ON public.admins USING btree (email);


-- Table: backup_logs
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    filename TEXT,
    size INTEGER,
    admin_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);



-- Table: blueprint_rules
CREATE TABLE IF NOT EXISTS blueprint_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL,
    questionType TEXT NOT NULL,
    numberOfQuestions INTEGER NOT NULL,
    marks_per_question NUMERIC NOT NULL,
    negative_marks NUMERIC,
    difficulty INTEGER,
    section_id UUID NOT NULL
);



-- Table: blueprint_sections
CREATE TABLE IF NOT EXISTS blueprint_sections (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL,
    name JSONB NOT NULL,
    order INTEGER NOT NULL
);



-- Table: demo_content
CREATE TABLE IF NOT EXISTS demo_content (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL DEFAULT 'general'::character varying,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
);



-- Table: exam_assignment_logs
CREATE TABLE IF NOT EXISTS exam_assignment_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL,
    student_id UUID NOT NULL,
    schedule_id UUID,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    action TEXT NOT NULL,
    assigned_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX exam_assignment_logs_exam_id_student_id_idx ON public.exam_assignment_logs USING btree (exam_id, student_id);


-- Table: exam_assignments
CREATE TABLE IF NOT EXISTS exam_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL,
    student_id UUID NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    schedule_id UUID
);

CREATE UNIQUE INDEX exam_assignments_exam_id_student_id_schedule_id_key ON public.exam_assignments USING btree (exam_id, student_id, schedule_id);


-- Table: exam_attempts
CREATE TABLE IF NOT EXISTS exam_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL,
    student_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ,
    auto_submit BOOLEAN NOT NULL DEFAULT false,
    total_score NUMERIC,
    status TEXT NOT NULL DEFAULT 'in_progress'::text,
    paused_at TIMESTAMPTZ,
    time_spent INTEGER DEFAULT 0,
    current_question_id UUID,
    session_token TEXT
);

CREATE INDEX exam_attempts_exam_id_status_idx ON public.exam_attempts USING btree (exam_id, status);


-- Table: exam_blueprints
CREATE TABLE IF NOT EXISTS exam_blueprints (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX exam_blueprints_name_key ON public.exam_blueprints USING btree (name);


-- Table: exam_cutoff_trends
CREATE TABLE IF NOT EXISTS exam_cutoff_trends (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    exam_type VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    category VARCHAR(50) NOT NULL,
    stage VARCHAR(50),
    total_cutoff_marks NUMERIC,
    total_cutoff_percentile NUMERIC,
    sectional_cutoffs JSONB,
    description TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exam_cutoff_lookup ON public.exam_cutoff_trends USING btree (exam_type, year, category);


-- Table: exam_schedules
CREATE TABLE IF NOT EXISTS exam_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL
);



-- Table: exam_types
CREATE TABLE IF NOT EXISTS exam_types (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX exam_types_code_key ON public.exam_types USING btree (code);


-- Table: exams
CREATE TABLE IF NOT EXISTS exams (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    title JSONB NOT NULL,
    description JSONB,
    duration INTEGER NOT NULL,
    total_marks INTEGER NOT NULL,
    passing_marks INTEGER,
    negative_marking NUMERIC,
    shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    showResults TEXT NOT NULL DEFAULT 'after_submit'::text,
    status TEXT NOT NULL DEFAULT 'draft'::text,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL,
    instructions JSONB,
    security_mode BOOLEAN DEFAULT false,
    auto_assign BOOLEAN DEFAULT false,
    auto_assign_attempts INTEGER DEFAULT 3,
    grading_instructions TEXT,
    source VARCHAR(20) DEFAULT 'admin'::character varying,
    type VARCHAR(50),
    source_pdf_url TEXT
);



-- Table: paragraphs
CREATE TABLE IF NOT EXISTS paragraphs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    text JSONB NOT NULL,
    content JSONB,
    image_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);



-- Table: query_logs
CREATE TABLE IF NOT EXISTS query_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    route VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    query TEXT,
    params TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    error TEXT,
    duration INTEGER,
    user_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX query_logs_route_idx ON public.query_logs USING btree (route);
CREATE INDEX query_logs_success_created_at_idx ON public.query_logs USING btree (success, created_at);


-- Table: question_responses
CREATE TABLE IF NOT EXISTS question_responses (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL,
    question_id UUID NOT NULL,
    answer JSONB,
    marked_for_review BOOLEAN NOT NULL DEFAULT false,
    time_spent INTEGER,
    is_correct BOOLEAN,
    marks_awarded NUMERIC,
    ai_feedback JSONB
);

CREATE UNIQUE INDEX question_responses_attempt_id_question_id_key ON public.question_responses USING btree (attempt_id, question_id);


-- Table: question_tags
CREATE TABLE IF NOT EXISTS question_tags (
    question_id UUID NOT NULL,
    tag_id UUID NOT NULL
);



-- Table: questions
CREATE TABLE IF NOT EXISTS questions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    section_id UUID,
    type TEXT NOT NULL,
    text JSONB NOT NULL,
    options JSONB,
    correct_answer JSONB NOT NULL,
    explanation JSONB,
    marks NUMERIC NOT NULL DEFAULT 1,
    negative_marks NUMERIC,
    image_url TEXT,
    order INTEGER NOT NULL,
    parent_id UUID,
    paragraph_id UUID,
    difficulty INTEGER NOT NULL DEFAULT 1,
    tag_id UUID,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    model_answer JSONB
);

CREATE INDEX idx_questions_created_at ON public.questions USING btree (created_at DESC);


-- Table: sections
CREATE TABLE IF NOT EXISTS sections (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL,
    name JSONB NOT NULL,
    order INTEGER NOT NULL,
    duration INTEGER
);



-- Table: students
CREATE TABLE IF NOT EXISTS students (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    roll_number TEXT NOT NULL,
    name TEXT NOT NULL,
    name_regional TEXT,
    email TEXT,
    phone TEXT,
    password_hash TEXT NOT NULL,
    photo_url TEXT,
    class TEXT,
    school TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT false,
    verification_token TEXT,
    verification_expires TIMESTAMP,
    google_id TEXT,
    phone_verified BOOLEAN DEFAULT false,
    firebase_uid TEXT,
    state VARCHAR(100),
    district VARCHAR(100)
);

CREATE UNIQUE INDEX students_roll_number_key ON public.students USING btree (roll_number);


-- Table: system_settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP NOT NULL
);



-- Table: tags
CREATE TABLE IF NOT EXISTS tags (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX tags_name_key ON public.tags USING btree (name);


