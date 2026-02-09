-- 1. Create Tags table
CREATE TABLE IF NOT EXISTS "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- 2. Create unique index on tag name
CREATE UNIQUE INDEX IF NOT EXISTS "tags_name_key" ON "tags"("name");

-- 3. Create QuestionTags table (Many-to-Many)
CREATE TABLE IF NOT EXISTS "question_tags" (
    "question_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "question_tags_pkey" PRIMARY KEY ("question_id","tag_id")
);

-- 4. Add foreign keys
ALTER TABLE "question_tags" ADD CONSTRAINT "question_tags_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_tags" ADD CONSTRAINT "question_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
