-- Add model_answer column to questions table for short/long answer AI grading
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "model_answer" JSONB;
