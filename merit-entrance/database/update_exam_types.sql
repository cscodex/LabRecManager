-- 1. Create Exam Types Table (Enum-like reference)
CREATE TABLE IF NOT EXISTS "exam_types" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'JEE_MAIN', 'NEET'
    "name" VARCHAR(100) NOT NULL,       -- e.g., 'IIT JEE Main', 'NEET UG'
    "description" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert Default Exam Types
INSERT INTO "exam_types" ("code", "name", "description") VALUES
('JEE_MAIN', 'IIT JEE Main', 'Joint Entrance Examination Main'),
('JEE_ADV', 'IIT JEE Advanced', 'Joint Entrance Examination Advanced'),
('NEET', 'NEET UG', 'National Eligibility cum Entrance Test'),
('UPSC_CSE', 'UPSC Civil Services', 'Civil Services Examination'),
('GATE', 'GATE', 'Graduate Aptitude Test in Engineering'),
('CAT', 'CAT', 'Common Admission Test'),
('SOE', 'SOE Entrance', 'School of Eminence Entrance'),
('OTHER', 'Other', 'Other Competitive Exams')
ON CONFLICT ("code") DO NOTHING;

-- 3. Ensure 'type' column exists in exams table (if not already added)
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "type" VARCHAR(50);

-- 4. Backfill/Update Existing Exams based on keywords in Title
-- Default to 'OTHER' if no match found
UPDATE "exams" 
SET "type" = CASE 
    WHEN "title"::text ILIKE '%JEE%' THEN 'JEE_MAIN'
    WHEN "title"::text ILIKE '%NEET%' THEN 'NEET'
    WHEN "title"::text ILIKE '%GATE%' THEN 'GATE'
    WHEN "title"::text ILIKE '%UPSC%' THEN 'UPSC_CSE'
    WHEN "title"::text ILIKE '%SOE%' THEN 'SOE'
    WHEN "title"::text ILIKE '%CAT%' THEN 'CAT'
    ELSE 'OTHER'
END
WHERE "type" IS NULL OR "type" = '';

-- Verification
SELECT id, title, type FROM exams;
