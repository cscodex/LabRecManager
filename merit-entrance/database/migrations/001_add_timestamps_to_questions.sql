-- Add created_at and updated_at columns to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Index for better sorting by creation time
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);
