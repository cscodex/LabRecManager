-- ============================================================
-- Session Year, Grade Scale & Assignment Dates Migration
-- Run in Neon SQL Editor
-- ============================================================

-- Step 1: Add academic_year_id to assignments table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);

-- Step 2: Add publish_date and due_date to assignment_targets table
ALTER TABLE assignment_targets 
ADD COLUMN IF NOT EXISTS publish_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- Step 3: Create grade_scales table for grading configuration
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

-- Step 4: Insert default grade scale (CBSE pattern)
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

-- Step 5: Migrate existing due dates from assignments to assignment_targets
UPDATE assignment_targets at
SET 
    publish_date = a.publish_date,
    due_date = a.due_date
FROM assignments a
WHERE at.assignment_id = a.id
AND at.due_date IS NULL;

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignments_academic_year ON assignments(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_assignment_targets_due_date ON assignment_targets(due_date);
CREATE INDEX IF NOT EXISTS idx_grade_scales_school ON grade_scales(school_id);

-- Verify
SELECT 'Migration completed successfully!' as status;
