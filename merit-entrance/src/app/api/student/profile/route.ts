import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL!);

export async function GET() {
    try {
        const session = await getSession();

        if (!session || session.role !== 'student') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = session.id;

        // Get all student details from database
        const studentInfo = await sql`
            SELECT 
                id, roll_number, name, name_regional, email, phone, 
                photo_url, class, school, is_active, created_at
            FROM students 
            WHERE id = ${studentId}
        `;

        if (studentInfo.length === 0) {
            return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
        }

        const student = studentInfo[0];

        // Get section-wise performance across all exams
        const sectionPerformance = await sql`
            SELECT 
                s.name as section_name,
                COUNT(DISTINCT qr.question_id) as questions_attempted,
                SUM(CASE WHEN qr.is_correct = true THEN 1 ELSE 0 END) as correct_answers,
                SUM(COALESCE(qr.marks_awarded, 0)) as marks_earned,
                SUM(q.marks) as total_possible_marks
            FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            JOIN sections s ON q.section_id = s.id
            JOIN exam_attempts ea ON qr.attempt_id = ea.id
            WHERE ea.student_id = ${studentId}
              AND ea.status = 'submitted'
            GROUP BY s.id, s.name
            ORDER BY 
                CASE WHEN SUM(q.marks) > 0 
                    THEN SUM(COALESCE(qr.marks_awarded, 0))::float / SUM(q.marks) 
                    ELSE 0 
                END DESC
        `;

        // Get exam stats (count only)
        const examStats = await sql`
            SELECT 
                COUNT(*) as total_exams,
                COALESCE(AVG(total_score::float / NULLIF(e.total_marks, 0) * 100), 0) as average_percentage,
                COALESCE(MAX(total_score::float / NULLIF(e.total_marks, 0) * 100), 0) as best_percentage
            FROM exam_attempts ea
            JOIN exams e ON e.id = ea.exam_id
            WHERE ea.student_id = ${studentId}
              AND ea.status = 'submitted'
        `;

        // Get the 2 most recent submitted attempts
        const recentAttempts = await sql`
            SELECT id, exam_id, submitted_at
            FROM exam_attempts 
            WHERE student_id = ${studentId} AND status = 'submitted'
            ORDER BY submitted_at DESC
            LIMIT 2
        `;

        // Calculate section trends if we have at least 2 attempts
        let sectionTrends: Record<string, number> = {};
        if (recentAttempts.length >= 2) {
            const latestAttemptId = recentAttempts[0].id;
            const previousAttemptId = recentAttempts[1].id;

            // Get section performance for latest attempt
            const latestSectionPerf = await sql`
                SELECT 
                    s.name as section_name,
                    SUM(COALESCE(qr.marks_awarded, 0)) as marks_earned,
                    SUM(q.marks) as total_marks
                FROM question_responses qr
                JOIN questions q ON qr.question_id = q.id
                JOIN sections s ON q.section_id = s.id
                WHERE qr.attempt_id = ${latestAttemptId}
                GROUP BY s.id, s.name
            `;

            // Get section performance for previous attempt
            const previousSectionPerf = await sql`
                SELECT 
                    s.name as section_name,
                    SUM(COALESCE(qr.marks_awarded, 0)) as marks_earned,
                    SUM(q.marks) as total_marks
                FROM question_responses qr
                JOIN questions q ON qr.question_id = q.id
                JOIN sections s ON q.section_id = s.id
                WHERE qr.attempt_id = ${previousAttemptId}
                GROUP BY s.id, s.name
            `;

            // Build a map of section name -> previous percentage
            const prevMap: Record<string, number> = {};
            previousSectionPerf.forEach((s: any) => {
                const name = typeof s.section_name === 'string' && s.section_name.startsWith('{')
                    ? JSON.stringify(JSON.parse(s.section_name))
                    : s.section_name;
                const percentage = s.total_marks > 0 ? (parseFloat(s.marks_earned) / parseFloat(s.total_marks)) * 100 : 0;
                prevMap[name] = percentage;
            });

            // Calculate trends for latest sections
            latestSectionPerf.forEach((s: any) => {
                const name = typeof s.section_name === 'string' && s.section_name.startsWith('{')
                    ? JSON.stringify(JSON.parse(s.section_name))
                    : s.section_name;
                const latestPercentage = s.total_marks > 0 ? (parseFloat(s.marks_earned) / parseFloat(s.total_marks)) * 100 : 0;
                const prevPercentage = prevMap[name] ?? null;
                if (prevPercentage !== null) {
                    sectionTrends[name] = latestPercentage - prevPercentage;
                }
            });
        }

        // Format section performance with percentage and trend
        const formattedSectionPerformance = sectionPerformance.map((s: any) => {
            const sectionNameKey = typeof s.section_name === 'string' && s.section_name.startsWith('{')
                ? JSON.stringify(JSON.parse(s.section_name))
                : s.section_name;
            const trend = sectionTrends[sectionNameKey] ?? null;

            return {
                sectionName: typeof s.section_name === 'string' && s.section_name.startsWith('{')
                    ? JSON.parse(s.section_name)
                    : s.section_name,
                questionsAttempted: parseInt(s.questions_attempted),
                correctAnswers: parseInt(s.correct_answers),
                marksEarned: parseFloat(s.marks_earned) || 0,
                totalPossibleMarks: parseFloat(s.total_possible_marks) || 0,
                percentage: s.total_possible_marks > 0
                    ? (parseFloat(s.marks_earned) / parseFloat(s.total_possible_marks)) * 100
                    : 0,
                trend: trend, // Positive = rise, Negative = dip, null = no previous data
                hasTrend: trend !== null
            };
        });

        return NextResponse.json({
            success: true,
            student: {
                id: student.id,
                rollNumber: student.roll_number,
                name: student.name,
                nameRegional: student.name_regional,
                email: student.email,
                phone: student.phone,
                photoUrl: student.photo_url,
                class: student.class,
                school: student.school,
                isActive: student.is_active,
                createdAt: student.created_at
            },
            examStats: {
                totalExams: parseInt(examStats[0]?.total_exams) || 0,
                averagePercentage: parseFloat(examStats[0]?.average_percentage) || 0,
                bestPercentage: parseFloat(examStats[0]?.best_percentage) || 0
            },
            sectionPerformance: formattedSectionPerformance
        });
    } catch (error) {
        console.error('Profile API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();

        if (!session || session.role !== 'student') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = session.id;
        const body = await request.json();
        const { email, phone, class: studentClass, school } = body;

        // Update student profile
        await sql`
            UPDATE students 
            SET 
                email = COALESCE(${email || null}, email),
                phone = COALESCE(${phone || null}, phone),
                class = COALESCE(${studentClass || null}, class),
                school = COALESCE(${school || null}, school)
            WHERE id = ${studentId}
        `;

        // Get updated student data
        const updatedStudent = await sql`
            SELECT 
                id, roll_number, name, name_regional, email, phone, 
                photo_url, class, school, is_active, created_at
            FROM students 
            WHERE id = ${studentId}
        `;

        if (updatedStudent.length === 0) {
            return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
        }

        const student = updatedStudent[0];

        return NextResponse.json({
            success: true,
            message: 'Profile updated successfully',
            student: {
                id: student.id,
                rollNumber: student.roll_number,
                name: student.name,
                nameRegional: student.name_regional,
                email: student.email,
                phone: student.phone,
                photoUrl: student.photo_url,
                class: student.class,
                school: student.school,
                isActive: student.is_active,
                createdAt: student.created_at
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
    }
}
