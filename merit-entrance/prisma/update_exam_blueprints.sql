-- Fallback Raw SQL for Neon
-- In case Prisma migration/push fails, run these queries directly.

CREATE TABLE "exam_blueprints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_blueprints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "exam_blueprints_name_key" ON "exam_blueprints"("name");

CREATE TABLE "blueprint_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blueprint_id" UUID NOT NULL,
    "topic_tag_id" UUID,
    "questionType" TEXT NOT NULL,
    "numberOfQuestions" INTEGER NOT NULL,
    "marks_per_question" DECIMAL(5,2) NOT NULL,
    "negative_marks" DECIMAL(5,2),
    "difficulty" INTEGER,
    CONSTRAINT "blueprint_rules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "blueprint_rules" ADD CONSTRAINT "blueprint_rules_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "exam_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blueprint_rules" ADD CONSTRAINT "blueprint_rules_topic_tag_id_fkey" FOREIGN KEY ("topic_tag_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
