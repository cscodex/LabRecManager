-- ============================================================
-- GRADES AND DEVICE TEST DATA - Run in Neon SQL Editor
-- ============================================================

-- 1. Create device_tests table if not exists
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

-- 2. Create grade_history table if not exists
CREATE TABLE IF NOT EXISTS grade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    previous_marks JSONB,
    new_marks JSONB,
    reason TEXT,
    modified_by UUID REFERENCES users(id),
    modified_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add modified columns to grades if not exist
ALTER TABLE grades ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS modified_by_id UUID REFERENCES users(id);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);

-- 4. Insert test device data for all users
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
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
FROM users
WHERE id NOT IN (SELECT user_id FROM device_tests)
LIMIT 10;

-- 5. Check if we have submissions without grades and create grades for them
INSERT INTO grades (
    id, submission_id, graded_by_id, 
    experiment_marks, viva_marks, attendance_marks, record_marks, 
    final_marks, max_marks, percentage, grade_letter, grade_points,
    feedback, is_published, graded_at
)
SELECT 
    gen_random_uuid(),
    s.id,
    (SELECT id FROM users WHERE role = 'instructor' LIMIT 1),
    20 + floor(random() * 10)::int,
    15 + floor(random() * 10)::int,
    8 + floor(random() * 2)::int,
    25 + floor(random() * 10)::int,
    70 + floor(random() * 25)::int,
    100,
    70 + floor(random() * 25)::numeric,
    CASE 
        WHEN random() > 0.5 THEN 'A'
        WHEN random() > 0.3 THEN 'B'
        ELSE 'C'
    END,
    CASE 
        WHEN random() > 0.5 THEN 9.0
        WHEN random() > 0.3 THEN 8.0
        ELSE 7.0
    END,
    'Good work! Well done on this assignment.',
    true,
    NOW() - (floor(random() * 10) * INTERVAL '1 day')
FROM submissions s
WHERE s.id NOT IN (SELECT submission_id FROM grades)
LIMIT 10;

-- 6. If no submissions exist, show message
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM submissions) THEN
        RAISE NOTICE 'No submissions found. Please create assignments and submissions first.';
    END IF;
END $$;

-- 7. Add grade history for some grades
INSERT INTO grade_history (grade_id, previous_marks, new_marks, modified_by, modified_at, reason)
SELECT 
    g.id,
    jsonb_build_object('final_marks', g.final_marks - 5),
    jsonb_build_object('final_marks', g.final_marks),
    g.graded_by_id,
    g.graded_at - INTERVAL '1 day',
    'Re-evaluation after student request'
FROM grades g
WHERE g.id NOT IN (SELECT grade_id FROM grade_history)
LIMIT 5;

-- 8. Update grades to show modification
UPDATE grades 
SET modified_at = NOW(),
    modified_by_id = graded_by_id
WHERE id IN (SELECT grade_id FROM grade_history);

-- 9. Verification
SELECT '=== DATA VERIFICATION ===' AS status;
SELECT 'Device Tests' AS table_name, COUNT(*) AS count FROM device_tests;
SELECT 'Grades' AS table_name, COUNT(*) AS count FROM grades;
SELECT 'Published Grades' AS table_name, COUNT(*) AS count FROM grades WHERE is_published = true;
SELECT 'Grade History' AS table_name, COUNT(*) AS count FROM grade_history;
SELECT 'Submissions' AS table_name, COUNT(*) AS count FROM submissions;

-- Show sample device tests with timestamps
SELECT 
    dt.user_id,
    u.first_name || ' ' || u.last_name AS user_name,
    dt.camera_status,
    dt.camera_tested_at,
    dt.mic_tested_at,
    dt.speaker_tested_at,
    dt.platform,
    dt.browser
FROM device_tests dt
JOIN users u ON u.id = dt.user_id
LIMIT 5;

-- Show sample grades
SELECT 
    g.id,
    s.student_id,
    g.final_marks,
    g.percentage,
    g.is_published,
    g.graded_at,
    g.modified_at
FROM grades g
JOIN submissions s ON s.id = g.submission_id
LIMIT 5;
