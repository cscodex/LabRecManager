-- Add current_question_id column to exam_attempts table
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS current_question_id UUID;
