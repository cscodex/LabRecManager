-- ============================================================
-- CREATE GRADE SCALE HISTORY TABLE
-- Run this in Neon SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS grade_scale_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_scale_id UUID NOT NULL REFERENCES grade_scales(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- created, updated, deleted, restored
    
    -- Previous values (null for 'created' action)
    previous_letter VARCHAR(10),
    previous_min_pct INTEGER,
    previous_max_pct INTEGER,
    previous_points DECIMAL(4,2),
    
    -- New values (null for 'deleted' action)
    new_letter VARCHAR(10),
    new_min_pct INTEGER,
    new_max_pct INTEGER,
    new_points DECIMAL(4,2),
    
    changed_by_id UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_grade_scale_history_scale_id ON grade_scale_history(grade_scale_id);
CREATE INDEX IF NOT EXISTS idx_grade_scale_history_changed_at ON grade_scale_history(changed_at);

-- Insert history for existing grade scales (mark as 'created')
INSERT INTO grade_scale_history (grade_scale_id, action, new_letter, new_min_pct, new_max_pct, new_points, changed_by_id, changed_at, reason)
SELECT 
    gs.id,
    'created',
    gs.letter,
    gs.min_percentage,
    gs.max_percentage,
    gs.grade_points,
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    gs.created_at,
    'Initial grade scale setup'
FROM grade_scales gs
WHERE NOT EXISTS (SELECT 1 FROM grade_scale_history gsh WHERE gsh.grade_scale_id = gs.id);

-- Verification
SELECT 'Grade Scale History' AS table_name, COUNT(*) AS count FROM grade_scale_history;
SELECT * FROM grade_scale_history ORDER BY changed_at DESC LIMIT 5;
