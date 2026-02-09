SELECT 
    q.id, 
    q.text, 
    s.name as section_name
FROM questions q
JOIN sections s ON q.section_id = s.id
JOIN exams e ON s.exam_id = e.id
WHERE e.title::text ILIKE '%SOE2K25%';
