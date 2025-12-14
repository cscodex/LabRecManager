/**
 * Gemini AI Service for SQL Query Generation
 * Uses Google Gemini API to convert natural language to SQL
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Database schema context for SQL generation
const DATABASE_SCHEMA = `
You are a SQL expert. Generate PostgreSQL queries based on natural language requests.

DATABASE SCHEMA:
- users (id, email, first_name, last_name, role[admin/principal/instructor/student/lab_assistant], student_id, admission_number, phone, created_at)
- schools (id, name, code, address, city, state, pincode)
- academic_years (id, school_id, year_label, start_date, end_date, is_current)
- classes (id, school_id, name, grade, section, stream, academic_year_id, teacher_id, max_students)
- class_enrollments (id, student_id, class_id, roll_number, status[active/inactive/transferred], joined_at)
- subjects (id, name, name_hindi, code, has_lab, lab_hours_per_week)
- assignments (id, title, title_hindi, description, subject_id, class_id, academic_year_id, due_date, max_marks, status[draft/published/archived], created_by)
- assignment_targets (id, assignment_id, target_type[class/group/individual], target_id)
- submissions (id, assignment_id, student_id, submitted_at, is_late, late_days, status[submitted/under_review/graded/needs_revision], submission_number)
- grades (id, submission_id, academic_year_id, practical_marks, output_marks, viva_marks, late_penalty_marks, final_marks, max_marks, percentage, grade_letter, is_published, graded_by, graded_at)
- grade_scales (id, school_id, grade_letter, grade_point, min_percentage, max_percentage, is_active)
- viva_sessions (id, submission_id, student_id, examiner_id, status[scheduled/in_progress/completed/cancelled], scheduled_at, actual_start_time, actual_end_time, duration_minutes, marks_obtained, max_marks, mode[online/offline])
- activity_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)

RELATIONSHIPS:
- users.student_id is the student's ID number (string)
- submissions link students to assignments
- grades are tied to submissions
- class_enrollments link students (users with role='student') to classes
- viva_sessions can be linked to submissions or directly to students

RULES:
1. Always use proper JOIN syntax
2. Use table aliases for readability
3. Include LIMIT clause for SELECT queries (default 100)
4. Use snake_case for column names
5. Return ONLY the SQL query, no explanations
6. For user names, use first_name and last_name columns
7. When filtering by role, use: role = 'student', role = 'instructor', etc.
`;

class GeminiService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.initialize();
    }

    initialize() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('GEMINI_API_KEY not set. AI query generation will not work.');
            return;
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Use the latest flash model
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    }

    async generateSQL(naturalLanguageQuery) {
        if (!this.model) {
            throw new Error('Gemini API not configured. Please set GEMINI_API_KEY in environment variables.');
        }

        const prompt = `${DATABASE_SCHEMA}

USER REQUEST: ${naturalLanguageQuery}

Generate a PostgreSQL query for the above request. Return ONLY the SQL query, nothing else.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let sql = response.text().trim();

            // Clean up the response - remove markdown code blocks if present
            sql = sql.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim();

            // Basic validation
            if (!sql.toLowerCase().startsWith('select') &&
                !sql.toLowerCase().startsWith('insert') &&
                !sql.toLowerCase().startsWith('update') &&
                !sql.toLowerCase().startsWith('delete') &&
                !sql.toLowerCase().startsWith('with')) {
                throw new Error('Generated query does not appear to be valid SQL');
            }

            return sql;
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw new Error(`Failed to generate SQL: ${error.message}`);
        }
    }
}

// Export singleton instance
module.exports = new GeminiService();
