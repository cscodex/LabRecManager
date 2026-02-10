-- Drop question_tags table
DROP TABLE IF EXISTS "question_tags";

-- Ensure tag_id column exists in questions table
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "tag_id" UUID;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_tag_id_fkey') THEN
        ALTER TABLE "questions" 
        ADD CONSTRAINT "questions_tag_id_fkey" 
        FOREIGN KEY ("tag_id") 
        REFERENCES "tags"("id") 
        ON DELETE SET NULL;
    END IF;
END $$;
