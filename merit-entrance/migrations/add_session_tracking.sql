-- Add session tracking columns to exam_attempts
-- Run this migration to enable single device login for exams

ALTER TABLE exam_attempts 
ADD COLUMN IF NOT EXISTS current_question_id UUID,
ADD COLUMN IF NOT EXISTS session_token TEXT;

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_exam_attempts_session ON exam_attempts(session_token);
