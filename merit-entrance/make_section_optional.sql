-- Make section_id optional in questions table
ALTER TABLE questions ALTER COLUMN section_id DROP NOT NULL;
