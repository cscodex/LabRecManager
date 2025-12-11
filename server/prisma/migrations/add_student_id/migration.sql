-- Migration: Add studentId field to replace admissionNumber
-- This field will be used as the primary student identifier across the app

-- Step 1: Add the new student_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(50);

-- Step 2: Create an index on student_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);

-- Step 3: Create a unique constraint on student_id within each school
-- (A student ID should be unique per school)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_student_id_per_school'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT unique_student_id_per_school 
        UNIQUE (school_id, student_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Step 4: Migrate existing admission_number data to student_id where applicable
UPDATE users 
SET student_id = admission_number 
WHERE role = 'student' 
AND student_id IS NULL 
AND admission_number IS NOT NULL;

-- Step 5: Generate studentId for students without one
-- Format: STU-{YEAR}-{SEQUENTIAL_NUMBER}
-- This is a sample - you may want to customize the format
UPDATE users 
SET student_id = 'STU-' || EXTRACT(YEAR FROM created_at) || '-' || 
    LPAD(
        CAST(
            ROW_NUMBER() OVER (
                PARTITION BY school_id, EXTRACT(YEAR FROM created_at) 
                ORDER BY created_at
            ) AS VARCHAR
        ), 
        5, '0'
    )
WHERE role = 'student' 
AND student_id IS NULL;

-- Note: The admission_number column is kept for backward compatibility
-- but student_id will be the primary identifier going forward
