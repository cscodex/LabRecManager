-- ============================================================
-- COMPLETE MIGRATION SCRIPT - Run in Neon SQL Editor
-- Date: 2025-12-08
-- ============================================================

-- ========== FIX ADMIN LOGIN ==========
-- Set admin password to 'Password123!'
UPDATE users 
SET password_hash = '$2a$10$IcSSyTqqgjbNjqMclKhujOrBKIy/j.Rlo.e97yUtxUV3sjr8rbkKO',
    is_active = true
WHERE email = 'admin@dps.edu';

-- Also fix instructor password
UPDATE users 
SET password_hash = '$2a$10$IcSSyTqqgjbNjqMclKhujOrBKIy/j.Rlo.e97yUtxUV3sjr8rbkKO',
    is_active = true
WHERE email = 'instructor@dps.edu';

-- ========== GRADE SCALES TABLE ==========
CREATE TABLE IF NOT EXISTS grade_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id),
    grade_letter VARCHAR(5) NOT NULL,
    grade_point DECIMAL(3, 2) NOT NULL,
    min_percentage INT NOT NULL,
    max_percentage INT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(school_id, grade_letter)
);

-- Insert default CBSE grade scale
INSERT INTO grade_scales (school_id, grade_letter, grade_point, min_percentage, max_percentage, description)
SELECT 
    s.id,
    gs.grade_letter,
    gs.grade_point,
    gs.min_percentage,
    gs.max_percentage,
    gs.description
FROM schools s
CROSS JOIN (
    VALUES 
        ('A1', 10.0, 91, 100, 'Outstanding'),
        ('A2', 9.0, 81, 90, 'Excellent'),
        ('B1', 8.0, 71, 80, 'Very Good'),
        ('B2', 7.0, 61, 70, 'Good'),
        ('C1', 6.0, 51, 60, 'Above Average'),
        ('C2', 5.0, 41, 50, 'Average'),
        ('D', 4.0, 33, 40, 'Below Average'),
        ('E', 0.0, 0, 32, 'Needs Improvement')
) AS gs(grade_letter, grade_point, min_percentage, max_percentage, description)
ON CONFLICT (school_id, grade_letter) DO NOTHING;

-- ========== SESSION YEAR COLUMN IN ASSIGNMENTS ==========
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);

CREATE INDEX IF NOT EXISTS idx_assignments_academic_year ON assignments(academic_year_id);

-- ========== PUBLISH/DUE DATES IN ASSIGNMENT TARGETS ==========
-- Move from assignments to assignment_targets
ALTER TABLE assignment_targets 
ADD COLUMN IF NOT EXISTS publish_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- Migrate existing dates from assignments to assignment_targets
UPDATE assignment_targets at
SET 
    publish_date = a.publish_date,
    due_date = a.due_date
FROM assignments a
WHERE at.assignment_id = a.id
AND at.due_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_assignment_targets_due_date ON assignment_targets(due_date);

-- ========== VIVA PARTICIPANTS TABLE (WAITING ROOM) ==========
DO $$ BEGIN
    CREATE TYPE "ParticipantStatus" AS ENUM ('waiting', 'admitted', 'in_session', 'left', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS viva_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES viva_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    status "ParticipantStatus" NOT NULL DEFAULT 'waiting',
    joined_waiting_at TIMESTAMP NOT NULL DEFAULT NOW(),
    admitted_at TIMESTAMP,
    left_at TIMESTAMP,
    socket_id VARCHAR(255),
    is_video_enabled BOOLEAN NOT NULL DEFAULT false,
    is_audio_enabled BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_viva_participants_session ON viva_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_viva_participants_user ON viva_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_viva_participants_status ON viva_participants(status);

-- ========== VERIFY ==========
SELECT 'All migrations completed successfully!' as status;
