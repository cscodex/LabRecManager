/**
 * Admin AI Chatbot Service
 * - Full database schema awareness (auto-introspected from Prisma)
 * - SQL generation, execution, and explanation
 * - Document reading support (text extraction from uploaded files)
 * - Schema change detection and auto-refresh
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = require('../config/database');

class ChatbotService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.cachedSchema = null;
        this.schemaCachedAt = null;
        this.SCHEMA_TTL_MS = 30 * 60 * 1000; // 30 min cache
        this.initialize();
    }

    initialize() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('[ChatBot] GEMINI_API_KEY not set. AI chatbot will not work.');
            return;
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        console.log('[ChatBot] Gemini AI initialized');
    }

    /**
     * Introspect the live database to build a fresh schema context string
     */
    async introspectSchema() {
        try {
            // Get all tables and columns from information_schema
            const tables = await prisma.$queryRawUnsafe(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `);

            let schemaText = '';

            for (const { table_name } of tables) {
                const columns = await prisma.$queryRawUnsafe(`
                    SELECT column_name, data_type, is_nullable, column_default,
                           character_maximum_length
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = $1
                    ORDER BY ordinal_position
                `, table_name);

                const colDefs = columns.map(c => {
                    let def = `  ${c.column_name} ${c.data_type}`;
                    if (c.character_maximum_length) def += `(${c.character_maximum_length})`;
                    if (c.is_nullable === 'NO') def += ' NOT NULL';
                    if (c.column_default) def += ` DEFAULT ${c.column_default.substring(0, 50)}`;
                    return def;
                }).join('\n');

                schemaText += `\nTABLE ${table_name}:\n${colDefs}\n`;
            }

            // Get foreign keys
            const fks = await prisma.$queryRawUnsafe(`
                SELECT
                    tc.table_name AS source_table,
                    kcu.column_name AS source_column,
                    ccu.table_name AS target_table,
                    ccu.column_name AS target_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                  ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                ORDER BY tc.table_name
            `);

            if (fks.length > 0) {
                schemaText += '\nFOREIGN KEYS:\n';
                fks.forEach(fk => {
                    schemaText += `  ${fk.source_table}.${fk.source_column} → ${fk.target_table}.${fk.target_column}\n`;
                });
            }

            // Get enum types
            const enums = await prisma.$queryRawUnsafe(`
                SELECT t.typname AS enum_name,
                       array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                GROUP BY t.typname
                ORDER BY t.typname
            `);

            if (enums.length > 0) {
                schemaText += '\nENUM TYPES:\n';
                enums.forEach(en => {
                    schemaText += `  ${en.enum_name}: [${en.values.join(', ')}]\n`;
                });
            }

            return schemaText;
        } catch (error) {
            console.error('[ChatBot] Schema introspection failed:', error.message);
            return this.getFallbackSchema();
        }
    }

    /**
     * Get schema (cached with TTL)
     */
    async getSchema() {
        const now = Date.now();
        if (this.cachedSchema && this.schemaCachedAt && (now - this.schemaCachedAt) < this.SCHEMA_TTL_MS) {
            return this.cachedSchema;
        }
        console.log('[ChatBot] Refreshing schema cache...');
        this.cachedSchema = await this.introspectSchema();
        this.schemaCachedAt = now;
        return this.cachedSchema;
    }

    /**
     * Force refresh the cached schema (e.g. after a migration)
     */
    async refreshSchema() {
        this.cachedSchema = null;
        this.schemaCachedAt = null;
        return await this.getSchema();
    }

    /**
     * Fallback schema if introspection fails
     */
    getFallbackSchema() {
        return `
CORE TABLES:
  users (id uuid PK, school_id, email, first_name, last_name, role[admin/principal/instructor/student/lab_assistant], student_id, admission_number, employee_id, phone, is_active, created_at)
  schools (id uuid PK, name, code, address, state, district, logo_url, email, phone1)
  academic_years (id uuid PK, school_id, year_label, start_date, end_date, is_current)
  classes (id uuid PK, school_id, academic_year_id, name, grade_level, section, stream, class_teacher_id, max_students)
  class_enrollments (id uuid PK, student_id, class_id, roll_number, status[active/transferred/dropped/graduated])
  subjects (id uuid PK, school_id, code, name, has_lab, lab_hours_per_week, theory_hours_per_week)
  class_subjects (id uuid PK, class_id, subject_id, instructor_id, lab_instructor_id)
  assignments (id uuid PK, school_id, subject_id, title, description, assignment_type, max_marks, status[draft/published/archived], due_date, academic_year_id, created_by)
  submissions (id uuid PK, assignment_id, student_id, code_content, output_content, status[submitted/under_review/graded], submitted_at, is_late)
  grades (id uuid PK, submission_id, practical_marks, output_marks, viva_marks, total_marks, percentage, grade_letter, is_published, graded_by)
  labs (id uuid PK, school_id, name, room_number, capacity, subject_id, incharge_id, status)
  lab_items (id uuid PK, lab_id, school_id, item_type, item_number, brand, model_no, serial_no, status, quantity)
  documents (id uuid PK, school_id, name, file_name, file_type, file_size, url, uploaded_by, created_at)
  activity_logs (id uuid PK, user_id, action_type, description, entity_type, entity_id, created_at)
  tickets (id uuid PK, ticket_number, title, description, category, priority, status, created_by_id, assigned_to_id)
  procurement_requests (id uuid PK, title, status, estimated_total, school_id, created_by_id)
  notifications (id uuid PK, user_id, title, message, type, is_read, created_at)
  timetables (id uuid PK, school_id, class_id, academic_year_id, name, is_active)
  training_modules (id uuid PK, title, language, is_published)
        `;
    }

    /**
     * Execute a SQL query safely (read-only for safety, unless explicitly allowed)
     */
    async executeSQL(sql) {
        const { Client } = require('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
        });

        await client.connect();
        try {
            const result = await client.query(sql);
            return {
                success: true,
                rows: result.rows || [],
                rowCount: result.rowCount,
                fields: result.fields?.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })) || [],
                command: result.command
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                detail: error.detail,
                hint: error.hint
            };
        } finally {
            await client.end();
        }
    }

    /**
     * Process a chat message from the admin
     */
    async chat(message, options = {}) {
        if (!this.model) {
            throw new Error('Gemini API not configured. Please set GEMINI_API_KEY.');
        }

        const { conversationHistory = [], documentContext = '', userId } = options;
        const schema = await this.getSchema();

        const systemPrompt = `You are an intelligent AI assistant for the "Lab Record Management System" — a school management platform. You help administrators query data, understand the system, and manage operations.

YOUR CAPABILITIES:
1. **Database Queries**: You can generate and execute SQL queries on the PostgreSQL database. When a user asks for data, generate SQL, execute it, and present the results clearly.
2. **Document Reading**: When documents are uploaded, you can read their content and answer questions about them.
3. **Schema Knowledge**: You have full awareness of the database schema (shown below). Use it to write accurate queries.
4. **Data Analysis**: You can analyze trends, generate summaries, counts, and statistics from the data.
5. **System Help**: You can explain how the system works, what tables store what data, and guide admins.

DATABASE SCHEMA:
${schema}

RESPONSE FORMAT RULES:
1. When the user asks for data, ALWAYS generate a SQL query to fetch it.
2. Wrap SQL queries in \`\`\`sql ... \`\`\` blocks.
3. If you generate a SQL query, add a special marker: <!--EXEC_SQL:your_query_here:END_SQL--> at the end. The server will execute it automatically.
4. Present results in clear, readable format with tables if appropriate.
5. If the query returns many rows, summarize the key findings.
6. For destructive operations (INSERT/UPDATE/DELETE), ALWAYS warn the user and ask for confirmation first. Do NOT auto-execute destructive queries — only include <!--EXEC_SQL--> for SELECT/WITH queries.
7. Be concise, professional, and helpful. Use markdown formatting.
8. If you're unsure about a table or column, say so rather than guessing.
9. When showing numbers, format them nicely (e.g., commas for thousands).

${documentContext ? `\nUPLOADED DOCUMENT CONTEXT:\n${documentContext}\n` : ''}`;

        // Build the conversation for Gemini
        const contents = [];

        // Add system instruction as first user message context
        contents.push({
            role: 'user',
            parts: [{ text: systemPrompt + '\n\nPlease acknowledge that you understand your role. Just say "Ready" briefly.' }]
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'Ready. I have access to the full database schema and can help you query data, analyze trends, and manage the system. What would you like to know?' }]
        });

        // Add conversation history
        for (const msg of conversationHistory) {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }

        // Add current message
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        try {
            const result = await this.model.generateContent({ contents });
            const response = await result.response;
            let aiText = response.text();

            // Check for auto-executable SQL
            const sqlMatch = aiText.match(/<!--EXEC_SQL:([\s\S]*?):END_SQL-->/);
            let queryResult = null;
            let executedSQL = null;

            if (sqlMatch) {
                executedSQL = sqlMatch[1].trim();
                // Only auto-execute SELECT/WITH queries
                const normalizedSQL = executedSQL.toLowerCase().trim();
                if (normalizedSQL.startsWith('select') || normalizedSQL.startsWith('with')) {
                    try {
                        queryResult = await this.executeSQL(executedSQL);
                    } catch (err) {
                        queryResult = { success: false, error: err.message };
                    }
                }
                // Remove the marker from displayed text
                aiText = aiText.replace(/<!--EXEC_SQL:[\s\S]*?:END_SQL-->/g, '').trim();
            }

            return {
                message: aiText,
                sql: executedSQL,
                queryResult,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('[ChatBot] Gemini error:', error.message);
            throw new Error(`AI processing failed: ${error.message}`);
        }
    }

    /**
     * Extract text from uploaded documents (PDF, CSV, TXT, etc.)
     */
    extractDocumentText(buffer, mimeType, fileName) {
        try {
            if (mimeType === 'text/plain' || mimeType === 'text/csv') {
                return buffer.toString('utf-8');
            }
            if (mimeType === 'application/json') {
                const json = JSON.parse(buffer.toString('utf-8'));
                return JSON.stringify(json, null, 2);
            }
            // For PDFs and other binary formats, return basic info
            if (mimeType === 'application/pdf') {
                // Basic text extraction from PDF (line-by-line)
                const text = buffer.toString('utf-8');
                // Extract readable ASCII portions
                const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                    .replace(/\s{3,}/g, ' ')
                    .trim();
                if (readable.length > 100) {
                    return readable.substring(0, 10000); // Limit to 10k chars
                }
                return `[PDF file: ${fileName}, ${buffer.length} bytes - Could not extract text. The file may be scanned/image-based.]`;
            }
            return `[Binary file: ${fileName}, ${buffer.length} bytes, type: ${mimeType}]`;
        } catch (err) {
            return `[Failed to extract text from ${fileName}: ${err.message}]`;
        }
    }
}

module.exports = new ChatbotService();
