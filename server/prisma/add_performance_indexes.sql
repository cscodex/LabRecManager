-- ============================================
-- PERFORMANCE INDEXES
-- Run this to add indexes without affecting existing data
-- ============================================

-- Classes table indexes
CREATE INDEX IF NOT EXISTS "classes_academic_year_id_idx" ON "classes"("academic_year_id");
CREATE INDEX IF NOT EXISTS "classes_school_id_academic_year_id_idx" ON "classes"("school_id", "academic_year_id");

-- Assignments table indexes
CREATE INDEX IF NOT EXISTS "assignments_academic_year_id_idx" ON "assignments"("academic_year_id");
CREATE INDEX IF NOT EXISTS "assignments_school_id_academic_year_id_idx" ON "assignments"("school_id", "academic_year_id");
CREATE INDEX IF NOT EXISTS "assignments_subject_id_academic_year_id_idx" ON "assignments"("subject_id", "academic_year_id");
CREATE INDEX IF NOT EXISTS "assignments_status_idx" ON "assignments"("status");

-- Submissions table indexes
CREATE INDEX IF NOT EXISTS "submissions_assignment_id_idx" ON "submissions"("assignment_id");
CREATE INDEX IF NOT EXISTS "submissions_student_id_idx" ON "submissions"("student_id");
CREATE INDEX IF NOT EXISTS "submissions_status_idx" ON "submissions"("status");

-- Grades table indexes
CREATE INDEX IF NOT EXISTS "grades_academic_year_id_idx" ON "grades"("academic_year_id");
CREATE INDEX IF NOT EXISTS "grades_student_id_idx" ON "grades"("student_id");

-- Activity logs table indexes
CREATE INDEX IF NOT EXISTS "activity_logs_created_at_idx" ON "activity_logs"("created_at");
CREATE INDEX IF NOT EXISTS "activity_logs_school_id_created_at_idx" ON "activity_logs"("school_id", "created_at");
CREATE INDEX IF NOT EXISTS "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- Verify indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('classes', 'assignments', 'submissions', 'grades', 'activity_logs')
ORDER BY tablename, indexname;
