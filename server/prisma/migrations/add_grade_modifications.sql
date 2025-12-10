-- ============================================================
-- GRADE MODIFICATIONS - Run in Neon SQL Editor
-- Adds tracking for grade modifications and academic year
-- ============================================================

-- Add modification tracking columns to grades table
ALTER TABLE grades
ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id),
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS modified_by_id UUID REFERENCES users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_grades_academic_year ON grades(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_grades_modified_at ON grades(modified_at);

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'grades' 
AND column_name IN ('academic_year_id', 'modified_at', 'modified_by_id');
