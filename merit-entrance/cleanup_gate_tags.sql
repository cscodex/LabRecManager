-- Update Question Text
UPDATE questions
SET text = REPLACE(
    REPLACE(
        REPLACE(
            REPLACE(text::text, '<sup>', '^'),
            '</sup>', ''
        ),
        '<sub>', ''
    ),
    '</sub>', ''
)::jsonb
WHERE section_id IN (
    SELECT s.id 
    FROM sections s
    JOIN exams e ON s.exam_id = e.id
    WHERE e.title->>'en' ILIKE '%GATE%'
);

-- Update Options Text
UPDATE questions
SET options = REPLACE(
    REPLACE(
        REPLACE(
            REPLACE(options::text, '<sup>', '^'),
            '</sup>', ''
        ),
        '<sub>', ''
    ),
    '</sub>', ''
)::jsonb
WHERE options IS NOT NULL 
AND section_id IN (
    SELECT s.id 
    FROM sections s
    JOIN exams e ON s.exam_id = e.id
    WHERE e.title->>'en' ILIKE '%GATE%'
);
