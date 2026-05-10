/**
 * Admin AI Chatbot Service
 * - Multi-provider: Gemini → Groq (llama) fallback
 * - Full database schema awareness (auto-introspected)
 * - SQL generation, execution, and explanation
 * - Chart/infographic data generation
 * - Document reading support
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const prisma = require('../config/database');

class ChatbotService {
    constructor() {
        this.geminiModels = [];
        this.groqClient = null;
        this.currentProvider = 'gemini';
        this.currentGeminiIdx = 0;
        this.cachedSchema = null;
        this.cachedCompactSchema = null;
        this.schemaCachedAt = null;
        this.SCHEMA_TTL_MS = 30 * 60 * 1000;
        this.initialize();
    }

    initialize() {
        // Initialize Gemini
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey) {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const geminiModelNames = ['gemini-2.0-flash', 'gemini-1.5-flash'];
            this.geminiModels = geminiModelNames.map(name => ({
                name, instance: genAI.getGenerativeModel({ model: name })
            }));
            console.log(`[ChatBot] Gemini initialized: ${geminiModelNames.join(' → ')}`);
        } else {
            console.warn('[ChatBot] GEMINI_API_KEY not set.');
        }

        // Initialize Groq
        const groqKey = process.env.GROQ_API_KEY;
        if (groqKey) {
            this.groqClient = new Groq({ apiKey: groqKey });
            console.log('[ChatBot] Groq initialized (llama-3.3-70b / llama-3.1-8b)');
        } else {
            console.warn('[ChatBot] GROQ_API_KEY not set.');
        }

        if (!geminiKey && !groqKey) {
            console.error('[ChatBot] No AI provider configured!');
        }

        // Pre-warm schema cache on startup (non-blocking)
        setTimeout(() => {
            this.getSchema().then(() => console.log('[ChatBot] Schema cache pre-warmed'))
                .catch(e => console.warn('[ChatBot] Schema pre-warm failed:', e.message));
        }, 5000);
    }

    // ═══ SCHEMA INTROSPECTION ═══
    async introspectSchema() {
        try {
            const tables = await prisma.$queryRawUnsafe(`
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `);
            let schemaText = '';
            for (const { table_name } of tables) {
                const columns = await prisma.$queryRawUnsafe(`
                    SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = $1
                    ORDER BY ordinal_position
                `, table_name);
                const colDefs = columns.map(c => {
                    let def = `  ${c.column_name} ${c.data_type}`;
                    if (c.character_maximum_length) def += `(${c.character_maximum_length})`;
                    if (c.is_nullable === 'NO') def += ' NOT NULL';
                    return def;
                }).join('\n');
                schemaText += `\nTABLE ${table_name}:\n${colDefs}\n`;
            }
            const fks = await prisma.$queryRawUnsafe(`
                SELECT tc.table_name AS source_table, kcu.column_name AS source_column,
                       ccu.table_name AS target_table, ccu.column_name AS target_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
                ORDER BY tc.table_name
            `);
            if (fks.length > 0) {
                schemaText += '\nFOREIGN KEYS:\n';
                fks.forEach(fk => { schemaText += `  ${fk.source_table}.${fk.source_column} → ${fk.target_table}.${fk.target_column}\n`; });
            }
            const enums = await prisma.$queryRawUnsafe(`
                SELECT t.typname AS enum_name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
                FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
                GROUP BY t.typname ORDER BY t.typname
            `);
            if (enums.length > 0) {
                schemaText += '\nENUM TYPES:\n';
                enums.forEach(en => { schemaText += `  ${en.enum_name}: [${en.values.join(', ')}]\n`; });
            }
            return schemaText;
        } catch (error) {
            console.error('[ChatBot] Schema introspection failed:', error.message);
            return this.getFallbackSchema();
        }
    }

    async getSchema() {
        const now = Date.now();
        if (this.cachedSchema && this.schemaCachedAt && (now - this.schemaCachedAt) < this.SCHEMA_TTL_MS) return this.cachedSchema;
        console.log('[ChatBot] Refreshing schema cache...');
        this.cachedSchema = await this.introspectSchema();
        this.schemaCachedAt = now;
        return this.cachedSchema;
    }

    async refreshSchema() { this.cachedSchema = null; this.cachedCompactSchema = null; this.schemaCachedAt = null; return await this.getSchema(); }

    /**
     * Compact schema for Groq — derived from cached full schema (no extra DB calls)
     */
    async getCompactSchema() {
        if (this.cachedCompactSchema) return this.cachedCompactSchema;
        const full = await this.getSchema();
        // Parse "TABLE name:\n  col1 type\n  col2 type" blocks into "name(col1,col2)"
        const lines = [];
        const tableBlocks = full.split(/\nTABLE /).filter(Boolean);
        for (const block of tableBlocks) {
            const match = block.match(/^(\S+):\n([\s\S]*?)(?=\n(?:TABLE |FOREIGN|ENUM)|$)/);
            if (match) {
                const table = match[1];
                const cols = match[2].trim().split('\n').map(l => l.trim().split(/\s+/)[0]).filter(Boolean);
                lines.push(`${table}(${cols.join(',')})`);
            }
        }
        this.cachedCompactSchema = lines.join('\n') || this.getFallbackSchema();
        return this.cachedCompactSchema;
    }

    getFallbackSchema() {
        return `CORE TABLES: users, schools, academic_years, classes, class_enrollments, subjects, assignments, submissions, grades, labs, lab_items, documents, activity_logs, tickets, procurement_requests, notifications, timetables, training_modules`;
    }

    // ═══ SQL EXECUTION (via Prisma — no separate pg dependency needed) ═══
    async executeSQL(sql) {
        try {
            const rows = await prisma.$queryRawUnsafe(sql);
            const fields = rows.length > 0
                ? Object.keys(rows[0]).map(name => ({ name }))
                : [];
            return { success: true, rows, rowCount: rows.length, fields, command: sql.trim().split(/\s+/)[0].toUpperCase() };
        } catch (error) {
            return { success: false, error: error.message, detail: error.meta?.message, hint: error.meta?.hint };
        }
    }

    // ═══ SYSTEM PROMPT ═══
    buildSystemPrompt(schema, documentContext) {
        return `You are an intelligent AI assistant for the "Lab Record Management System" — a school management platform.

YOUR CAPABILITIES:
1. **Database Queries**: Generate and execute SQL on PostgreSQL. When a user asks for data, generate SQL.
2. **Charts & Infographics**: When data is visual (trends, distributions, comparisons), generate chart data.
3. **Document Reading**: Read uploaded document content and answer questions.
4. **Schema Knowledge**: Full database schema awareness.

DATABASE SCHEMA:
${schema}

RESPONSE FORMAT RULES:
1. When the user asks for data, generate ONLY the SQL query in a \`\`\`sql block. Do NOT explain or describe the query. No "this query does X" or "here's what this means" — just the SQL.
2. Add <!--EXEC_SQL:your_query_here:END_SQL--> at the end for auto-execution (SELECT/WITH only).
3. After the query executes, give ONLY a brief 1-line summary of the result (e.g. "Total: 142 students" or "Top class: 10A with 38 submissions"). Do NOT repeat the SQL or explain how it works.
4. For destructive operations, warn and ask for confirmation. Never auto-execute INSERT/UPDATE/DELETE.
5. **CHART DATA**: When results benefit from visualization, include a chart block:
   \`\`\`chart
   {"type":"bar|line|pie|doughnut|area","title":"Chart Title","data":[{"label":"A","value":10},{"label":"B","value":20}],"colors":["#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899","#f43f5e"]}
   \`\`\`
6. Be extremely concise. No unnecessary explanations. Results speak for themselves.
${documentContext ? `\nUPLOADED DOCUMENT CONTEXT:\n${documentContext}\n` : ''}`;
    }

    // ═══ GEMINI CALL ═══
    async callGemini(contents) {
        let lastError = null;
        const start = this.currentGeminiIdx;
        for (let i = 0; i < this.geminiModels.length; i++) {
            const idx = (start + i) % this.geminiModels.length;
            const { name, instance } = this.geminiModels[idx];
            try {
                console.log(`[ChatBot] Gemini → ${name}`);
                const result = await instance.generateContent({ contents });
                const text = (await result.response).text();
                this.currentGeminiIdx = idx;
                return { text, model: name, provider: 'gemini' };
            } catch (err) {
                lastError = err;
                const is429 = err.message?.includes('429') || err.message?.includes('quota');
                console.warn(`[ChatBot] Gemini ${name} failed: ${err.message.substring(0, 80)}`);
                if (is429 && i < this.geminiModels.length - 1) {
                    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                    continue;
                }
                if (!is429) break;
            }
        }
        throw lastError || new Error('All Gemini models failed');
    }

    // ═══ GROQ CALL ═══
    async callGroq(messages) {
        if (!this.groqClient) throw new Error('Groq not configured');
        const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
        let lastError = null;
        for (const model of groqModels) {
            try {
                console.log(`[ChatBot] Groq → ${model}`);
                const completion = await this.groqClient.chat.completions.create({
                    messages, model, temperature: 0.3, max_tokens: 2048,
                });
                return {
                    text: completion.choices[0]?.message?.content || '',
                    model, provider: 'groq'
                };
            } catch (err) {
                lastError = err;
                const isRateLimit = err.status === 429 || err.status === 413;
                console.warn(`[ChatBot] Groq ${model} failed (${err.status}): ${err.message?.substring(0, 80)}`);
                if (isRateLimit && model === groqModels[0]) {
                    // Try smaller model on rate limit / payload too large
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                break;
            }
        }
        throw lastError || new Error('All Groq models failed');
    }

    // ═══ MAIN CHAT ═══
    async chat(message, options = {}) {
        if (!this.geminiModels.length && !this.groqClient) {
            throw new Error('No AI provider configured. Set GEMINI_API_KEY or GROQ_API_KEY.');
        }

        const { conversationHistory = [], documentContext = '', userId } = options;
        const schema = await this.getSchema();
        const systemPrompt = this.buildSystemPrompt(schema, documentContext);

        // Build Gemini-format contents (full schema)
        const geminiContents = [
            { role: 'user', parts: [{ text: systemPrompt + '\n\nAcknowledge briefly.' }] },
            { role: 'model', parts: [{ text: 'Ready. I can query the database, generate charts, and analyze data.' }] },
        ];
        for (const msg of conversationHistory) {
            geminiContents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
        }
        geminiContents.push({ role: 'user', parts: [{ text: message }] });

        // Build Groq-format messages (compact schema, limited history)
        const compactSchema = await this.getCompactSchema();
        const groqSystemPrompt = this.buildSystemPrompt(compactSchema, documentContext ? documentContext.substring(0, 2000) : '');
        const groqHistory = conversationHistory.slice(-4); // only last 4 msgs to save tokens
        const groqMessages = [
            { role: 'system', content: groqSystemPrompt },
            ...groqHistory.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
            { role: 'user', content: message }
        ];

        // Try providers in order
        let aiResult = null;
        const providers = this.geminiModels.length
            ? [() => this.callGemini(geminiContents), () => this.callGroq(groqMessages)]
            : [() => this.callGroq(groqMessages)];

        let lastError = null;
        for (const tryProvider of providers) {
            try {
                aiResult = await tryProvider();
                break;
            } catch (err) {
                lastError = err;
                console.warn(`[ChatBot] Provider failed, trying next: ${err.message?.substring(0, 60)}`);
            }
        }

        if (!aiResult) {
            const is429 = lastError?.message?.includes('429') || lastError?.message?.includes('quota');
            throw new Error(is429
                ? 'All AI models are rate-limited. Please wait a minute and try again.'
                : `AI failed: ${lastError?.message || 'Unknown error'}`);
        }

        let aiText = aiResult.text;

        // Extract auto-exec SQL
        const sqlMatch = aiText.match(/<!--EXEC_SQL:([\s\S]*?):END_SQL-->/);
        let queryResult = null, executedSQL = null;
        if (sqlMatch) {
            executedSQL = sqlMatch[1].trim();
            const norm = executedSQL.toLowerCase().trim();
            if (norm.startsWith('select') || norm.startsWith('with')) {
                try { queryResult = await this.executeSQL(executedSQL); } catch (e) { queryResult = { success: false, error: e.message }; }
            }
            aiText = aiText.replace(/<!--EXEC_SQL:[\s\S]*?:END_SQL-->/g, '').trim();
        }

        // Extract chart data
        let chartData = null;
        const chartMatch = aiText.match(/```chart\n?([\s\S]*?)```/);
        if (chartMatch) {
            try { chartData = JSON.parse(chartMatch[1].trim()); } catch (e) { console.warn('[ChatBot] Chart parse failed:', e.message); }
            aiText = aiText.replace(/```chart\n?[\s\S]*?```/g, '').trim();
        }

        // If we have query results and no chart yet, auto-generate chart for visualizable data
        if (queryResult?.success && queryResult.rows?.length >= 2 && !chartData) {
            chartData = this.autoGenerateChart(queryResult);
        }

        return {
            message: aiText, sql: executedSQL, queryResult, chartData,
            model: aiResult.model, provider: aiResult.provider,
            timestamp: new Date().toISOString()
        };
    }

    // ═══ AUTO CHART GENERATION ═══
    autoGenerateChart(result) {
        if (!result.rows || result.rows.length < 2) return null;
        const fields = result.fields?.map(f => f.name) || Object.keys(result.rows[0]);
        if (fields.length < 2) return null;

        // Find a text/label column and a numeric column
        const labelCol = fields.find(f => typeof result.rows[0][f] === 'string') || fields[0];
        const valueCol = fields.find(f => {
            const v = result.rows[0][f];
            return typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)));
        });
        if (!valueCol || labelCol === valueCol) return null;

        const data = result.rows.slice(0, 15).map(row => ({
            label: String(row[labelCol] || '').substring(0, 30),
            value: Number(row[valueCol]) || 0
        }));

        const type = data.length <= 6 ? 'doughnut' : 'bar';
        return {
            type, title: `${valueCol} by ${labelCol}`, data,
            colors: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4']
        };
    }

    // ═══ DOCUMENT EXTRACTION ═══
    extractDocumentText(buffer, mimeType, fileName) {
        try {
            if (mimeType === 'text/plain' || mimeType === 'text/csv') return buffer.toString('utf-8');
            if (mimeType === 'application/json') return JSON.stringify(JSON.parse(buffer.toString('utf-8')), null, 2);
            if (mimeType === 'application/pdf') {
                const readable = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').trim();
                return readable.length > 100 ? readable.substring(0, 10000) : `[PDF: ${fileName}, ${buffer.length}B - text extraction limited]`;
            }
            return `[Binary file: ${fileName}, ${buffer.length}B, ${mimeType}]`;
        } catch (err) { return `[Failed: ${fileName}: ${err.message}]`; }
    }
}

module.exports = new ChatbotService();
