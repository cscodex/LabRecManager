const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const queries = [
`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
`CREATE TABLE IF NOT EXISTS "training_modules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "title_hindi" VARCHAR(255),
  "description" TEXT,
  "language" VARCHAR(50) NOT NULL,
  "board_aligned" VARCHAR(50),
  "class_level" INTEGER,
  "total_units" INTEGER NOT NULL DEFAULT 0,
  "total_exercises" INTEGER NOT NULL DEFAULT 0,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
`CREATE TABLE IF NOT EXISTS "training_units" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "module_id" UUID NOT NULL REFERENCES "training_modules"("id") ON DELETE CASCADE,
  "unit_number" INTEGER NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "expected_hours" INTEGER,
  "unlock_threshold" INTEGER NOT NULL DEFAULT 80,
  "sequence_order" INTEGER NOT NULL DEFAULT 0
);`,
`CREATE TABLE IF NOT EXISTS "training_exercises" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "unit_id" UUID NOT NULL REFERENCES "training_units"("id") ON DELETE CASCADE,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "scaffold_level" TEXT NOT NULL,
  "is_review_exercise" BOOLEAN NOT NULL DEFAULT false,
  "reviews_topic_id" UUID,
  "starter_code" TEXT,
  "solution_code" TEXT,
  "test_cases" JSONB,
  "hints" JSONB,
  "time_limit" INTEGER NOT NULL DEFAULT 5,
  "sequence_order" INTEGER NOT NULL DEFAULT 0,
  "xp_reward" INTEGER NOT NULL DEFAULT 10
);`,
`CREATE TABLE IF NOT EXISTS "student_training_progress" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "module_id" UUID NOT NULL REFERENCES "training_modules"("id") ON DELETE CASCADE,
  "current_unit_id" UUID,
  "overall_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total_xp" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "last_active_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(6),
  UNIQUE("student_id", "module_id")
);`,
`CREATE TABLE IF NOT EXISTS "student_unit_mastery" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "unit_id" UUID NOT NULL REFERENCES "training_units"("id") ON DELETE CASCADE,
  "mastery_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "exercises_done" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'locked',
  "unlocked_at" TIMESTAMP(6),
  "mastered_at" TIMESTAMP(6),
  UNIQUE("student_id", "unit_id")
);`,
`CREATE TABLE IF NOT EXISTS "coding_submissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "exercise_id" UUID NOT NULL REFERENCES "training_exercises"("id") ON DELETE CASCADE,
  "student_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "output" TEXT,
  "test_results" JSONB,
  "ai_socratic_review" TEXT,
  "submitted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);`
];

async function main() {
    try {
        console.log('Beginning table creation...');
        for(let i=0; i<queries.length; i++) {
        	console.log(`Executing query ${i+1}...`);
        	await prisma.$executeRawUnsafe(queries[i]);
        }
        console.log('Tables created successfully!');
    } catch (e) {
        console.error('Error creating tables:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
