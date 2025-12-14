-- ============================================
-- SQL VERIFICATION QUERIES FOR SESSION FILTERING
-- Run these queries and provide the output
-- ============================================

-- 1. List all academic years with their IDs
SELECT id, year_label, start_date, end_date, is_current 
FROM academic_years 
ORDER BY year_label;

-- 2. Count classes per academic year
SELECT 
    ay.year_label,
    ay.id as academic_year_id,
    COUNT(c.id) as class_count
FROM academic_years ay
LEFT JOIN classes c ON c.academic_year_id = ay.id
GROUP BY ay.id, ay.year_label
ORDER BY ay.year_label;

-- 3. Count assignments per academic year
SELECT 
    ay.year_label,
    ay.id as academic_year_id,
    COUNT(a.id) as assignment_count
FROM academic_years ay
LEFT JOIN assignments a ON a.academic_year_id = ay.id
GROUP BY ay.id, ay.year_label
ORDER BY ay.year_label;

-- 4. Count submissions per academic year (via assignments)
SELECT 
    ay.year_label,
    ay.id as academic_year_id,
    COUNT(s.id) as submission_count
FROM academic_years ay
LEFT JOIN assignments a ON a.academic_year_id = ay.id
LEFT JOIN submissions s ON s.assignment_id = a.id
GROUP BY ay.id, ay.year_label
ORDER BY ay.year_label;

-- 5. Count grades per academic year
SELECT 
    ay.year_label,
    ay.id as academic_year_id,
    COUNT(g.id) as grade_count
FROM academic_years ay
LEFT JOIN grades g ON g.academic_year_id = ay.id
GROUP BY ay.id, ay.year_label
ORDER BY ay.year_label;
