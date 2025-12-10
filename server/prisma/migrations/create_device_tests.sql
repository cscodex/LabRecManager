-- ============================================================
-- STEP 1: CREATE DEVICE_TESTS TABLE
-- Run this FIRST in Neon SQL Editor
-- ============================================================

-- Create the table (all column names match Prisma schema)
CREATE TABLE IF NOT EXISTS device_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    camera_status VARCHAR(50),
    camera_tested_at TIMESTAMPTZ,
    camera_device_id TEXT,
    camera_device_name TEXT,
    
    mic_status VARCHAR(50),
    mic_tested_at TIMESTAMPTZ,
    mic_device_id TEXT,
    mic_device_name TEXT,
    
    speaker_status VARCHAR(50),
    speaker_tested_at TIMESTAMPTZ,
    speaker_device_id TEXT,
    speaker_device_name TEXT,
    speaker_volume INTEGER,
    
    user_agent TEXT,
    platform VARCHAR(50),
    browser VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_device_tests_user_id ON device_tests(user_id);

-- Verify table exists
SELECT 'device_tests table created!' AS status;

-- ============================================================
-- STEP 2: INSERT TEST DATA INTO DEVICE_TESTS
-- ============================================================

INSERT INTO device_tests (user_id, camera_status, camera_tested_at, mic_status, mic_tested_at, speaker_status, speaker_tested_at, speaker_volume, platform, browser, user_agent)
SELECT 
    id,
    'granted',
    NOW() - INTERVAL '2 hours',
    'granted',
    NOW() - INTERVAL '2 hours',
    'granted',
    NOW() - INTERVAL '1 hour',
    75,
    'desktop',
    'Chrome',
    'Mozilla/5.0 Test Browser'
FROM users
LIMIT 5
ON CONFLICT (user_id) DO UPDATE SET 
    camera_tested_at = NOW() - INTERVAL '2 hours',
    mic_tested_at = NOW() - INTERVAL '2 hours',
    speaker_tested_at = NOW() - INTERVAL '1 hour',
    updated_at = NOW();

-- Verify data with timestamps
SELECT 
    user_id,
    camera_status,
    camera_tested_at,
    mic_tested_at,
    speaker_tested_at,
    platform,
    browser
FROM device_tests;

-- ============================================================
-- STEP 3: CREATE GRADE_HISTORY TABLE (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS grade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    previous_marks JSONB,
    new_marks JSONB,
    reason TEXT,
    modified_by UUID REFERENCES users(id),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grade_history_grade_id ON grade_history(grade_id);

-- ============================================================
-- STEP 4: Check what data exists for grades
-- ============================================================
SELECT 'Current data status:' AS info;
SELECT 'Users' AS table_name, COUNT(*) AS count FROM users;
SELECT 'Submissions' AS table_name, COUNT(*) AS count FROM submissions;
SELECT 'Grades' AS table_name, COUNT(*) AS count FROM grades;
SELECT 'Device Tests' AS table_name, COUNT(*) AS count FROM device_tests;
