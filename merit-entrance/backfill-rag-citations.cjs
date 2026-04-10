const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

(async () => {
    const sql = neon(process.env.MERIT_DATABASE_URL);

    // 1. Find all AI-generated questions with RAG citation
    const ragQuestions = await sql`
        SELECT id, text, citation 
        FROM questions 
        WHERE is_ai_generated = true 
        AND citation->>'source' = 'RAG Knowledge Base Generation'
        ORDER BY created_at DESC
    `;

    console.log(`Found ${ragQuestions.length} RAG-generated questions to backfill.\n`);

    if (ragQuestions.length === 0) {
        console.log('No RAG questions found. Exiting.');
        return;
    }

    // 2. For each question, find matching document chunks via text similarity search
    for (const q of ragQuestions) {
        const existingCit = q.citation || {};

        // Skip if already has rich citation
        if (existingCit.pages && existingCit.pages.length > 0) {
            console.log(`[SKIP] ${q.id} — already has rich citation (pages: ${existingCit.pages.join(',')})`);
            continue;
        }

        // Use the question text to find matching chunks
        const questionText = typeof q.text === 'object' ? (q.text.en || '') : String(q.text || '');
        const searchTerms = questionText.substring(0, 200); // Use first 200 chars as search terms

        // Find similar chunks using text search
        const matchingChunks = await sql`
            SELECT page_number, chunk_index, content 
            FROM document_chunks 
            WHERE content ILIKE ${'%' + searchTerms.split(' ').slice(0, 5).join('%') + '%'}
            OR content ILIKE ${'%' + searchTerms.split(' ').slice(0, 3).join('%') + '%'}
            ORDER BY page_number ASC
            LIMIT 5
        `;

        // If text search didn't find anything, try broader approach using the text_excerpt
        let chunks = matchingChunks;
        if (chunks.length === 0 && existingCit.text_excerpt) {
            const excerpt = existingCit.text_excerpt.substring(0, 50);
            chunks = await sql`
                SELECT page_number, chunk_index, content 
                FROM document_chunks 
                WHERE content ILIKE ${'%' + excerpt + '%'}
                ORDER BY page_number ASC
                LIMIT 5
            `;
        }

        // If still no chunks, try finding any chunks from the same page as the old excerpt
        if (chunks.length === 0 && existingCit.text_excerpt) {
            // Extract page number from old text_excerpt if format is "33  creation..."
            const pageMatch = existingCit.text_excerpt.match(/^(\d+)\s/);
            if (pageMatch) {
                const pageNum = parseInt(pageMatch[1]);
                chunks = await sql`
                    SELECT page_number, chunk_index, content 
                    FROM document_chunks 
                    WHERE page_number = ${pageNum}
                    ORDER BY chunk_index ASC
                    LIMIT 5
                `;
            }
        }

        if (chunks.length === 0) {
            console.log(`[WARN] ${q.id} — no matching chunks found, keeping old citation`);
            continue;
        }

        // Build rich citation
        const pages = [...new Set(chunks.map(c => c.page_number).filter(Boolean))].sort((a, b) => a - b);
        const chunkMeta = chunks.map(c => {
            const text = (c.content || '').trim();
            const lines = text.split('\n').filter(l => l.trim());
            return {
                pageNumber: c.page_number || 0,
                chunkIndex: c.chunk_index || 0,
                startText: (lines[0] || '').substring(0, 80),
                endText: (lines[lines.length - 1] || '').substring(0, 80),
            };
        });

        const newCitation = {
            source: 'RAG Knowledge Base Generation',
            pages: pages,
            chunks: chunkMeta,
            text_excerpt: chunkMeta.length > 0
                ? `Page ${chunkMeta[0].pageNumber}: "${chunkMeta[0].startText}" ... "${chunkMeta[0].endText}"`
                : existingCit.text_excerpt || '',
        };

        // Update the question
        await sql`
            UPDATE questions 
            SET citation = ${JSON.stringify(newCitation)}::jsonb
            WHERE id = ${q.id}
        `;

        console.log(`[OK] ${q.id} — pages: [${pages.join(', ')}], chunks: ${chunkMeta.length}`);
    }

    console.log('\nBackfill complete!');
})();
