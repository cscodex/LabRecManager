import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get assigned students
        const assignments = await sql`
      SELECT 
        ea.id,
        ea.student_id,
        ea.assigned_at,
        ea.max_attempts,
        ea.schedule_id,
        s.roll_number,
        s.name,
        es.start_time,
        es.end_time
      FROM exam_assignments ea
      JOIN students s ON ea.student_id = s.id
      LEFT JOIN exam_schedules es ON es.id = ea.schedule_id
      WHERE ea.exam_id = ${params.id}
      ORDER BY s.roll_number
    `;

        // Get all students for selection
        const allStudents = await sql`
      SELECT id, roll_number, name, class
      FROM students
      WHERE is_active = true
      ORDER BY roll_number
    `;

        // Get distinct classes and schools for filters
        const classesResult = await sql`SELECT DISTINCT class FROM students WHERE is_active = true AND class IS NOT NULL ORDER BY class`;
        const schoolsResult = await sql`SELECT DISTINCT school FROM students WHERE is_active = true AND school IS NOT NULL ORDER BY school`;

        return NextResponse.json({
            success: true,
            assignments,
            allStudents,
            filters: {
                classes: classesResult.map(r => r.class),
                schools: schoolsResult.map(r => r.school)
            }
        });
    } catch (error) {
        console.error('Error fetching assignments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            studentIds,
            mode = 'append', // 'replace' | 'append'
            maxAttempts = 1,
            scheduleType = 'none', // 'none' | 'existing' | 'new'
            scheduleId: providedScheduleId,
            startTime,
            endTime
        } = body;

        if (!studentIds || !Array.isArray(studentIds)) {
            return NextResponse.json({ error: 'Student IDs are required' }, { status: 400 });
        }

        // 1. Handle Schedule
        let finalScheduleId: string | null = null;

        if (scheduleType === 'existing' && providedScheduleId) {
            finalScheduleId = providedScheduleId;
        } else if (scheduleType === 'new' && startTime && endTime) {
            // Create new schedule
            const [newSchedule] = await sql`
                INSERT INTO exam_schedules (exam_id, start_time, end_time)
                VALUES (${params.id}, ${startTime}, ${endTime})
                RETURNING id
            `;
            finalScheduleId = newSchedule.id;
        }

        // 2. Handle Assignments based on Mode
        if (mode === 'replace') {
            // Delete ALL existing assignments for this exam
            await sql`DELETE FROM exam_assignments WHERE exam_id = ${params.id}`;
        }

        let addedCount = 0;
        let updatedCount = 0;

        // 3. Process each student
        for (const studentId of studentIds) {
            try {
                // Upsert logic
                // If mode is 'replace', we already wiped, so it's fresh insert.
                // If mode is 'append', we want to insert if not exists, OR update keys if exists?
                // The user said "Add to existing" (Append).
                // Usually append means "Add new ones, leave old ones alone" OR "Update conflicting ones"?
                // Let's assume we Update configuration (attempts/schedule) for selected students regardless.

                const result = await sql`
                    INSERT INTO exam_assignments (exam_id, student_id, max_attempts, schedule_id)
                    VALUES (${params.id}, ${studentId}, ${maxAttempts}, ${finalScheduleId})
                    ON CONFLICT (exam_id, student_id, schedule_id) 
                    DO UPDATE SET 
                        max_attempts = ${maxAttempts},
                        schedule_id = ${finalScheduleId}
                    RETURNING id
                `;
                // Note: The constraint is typically unique([exam_id, student_id]).
                // The schema says: @@unique([examId, studentId, scheduleId]) -> This is weird if a student can be assigned multiple schedules for same exam?
                // Let's check schema...
                // Schema: @@unique([examId, studentId, scheduleId])
                // Wait, if the constraint includes scheduleId, a student can have MULTIPLE assignments for same exam if schedules differ.
                // Re-reading Schema: 
                // model ExamAssignment { ... @@unique([examId, studentId, scheduleId]) }
                // This implies a student can be assigned multiple times to the same exam under DIFFERENT schedules.
                // BUT usually we want one assignment per exam per student.
                // Let's check if there's a simpler constraint.
                // If the user wants to "Assign Exam" usually it means "Assign this student to this exam".
                // If the constraint allows multiple, 'ON CONFLICT' might fail to trigger if we interpret "same student, same exam" as conflict 
                // but the DB sees "same student, same exam, DIFFERENT schedule" as unique.

                // CRITICAL: We should check if we want to update ANY assignment for this student/exam or insert new.
                // For simplicity in this upgrade, let's try to maintain one active assignment or update existing.
                // However, without changing schema constraint, we might create duplicates.
                // Let's check if we can wipe previous assignments for this specific student if we are in 'append' mode to ensure 'latest' config applies?
                // OR we just use the Insert.

                // Let's assume for this specific exam/student, we delete old and insert new to enforce "current config".
                // This avoids the complex unique key issue.

                if (mode === 'append') {
                    // Check if already assigned?
                    // Ideally we want to UPDATE the existing assignment to the new settings.
                    // But if unique key includes scheduleId, we can't easily "target" the row without knowing the old scheduleId.
                    // So, safer approach for 'Append' (Update Selected):
                    // 1. Delete any existing assignment for this student/exam
                    // 2. Insert new
                    await sql`DELETE FROM exam_assignments WHERE exam_id = ${params.id} AND student_id = ${studentId}`;
                }

                await sql`
                    INSERT INTO exam_assignments (exam_id, student_id, max_attempts, schedule_id)
                    VALUES (${params.id}, ${studentId}, ${maxAttempts}, ${finalScheduleId})
                `;

                // Log Assignment
                await sql`
                     INSERT INTO exam_assignment_logs (
                        exam_id, student_id, schedule_id, max_attempts, 
                        action, assigned_by
                    ) VALUES (
                        ${params.id}, ${studentId}, ${finalScheduleId}, ${maxAttempts},
                        ${mode === 'replace' ? 'ASSIGNED_REPLACE' : 'ASSIGNED_APPEND'},
                        ${session.id}
                    )
                `;

                addedCount++;
            } catch (e) {
                console.error('Assignment error for student', studentId, e);
            }
        }

        return NextResponse.json({ success: true, count: addedCount, scheduleId: finalScheduleId });
    } catch (error) {
        console.error('Error creating assignments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get('studentId');

        if (studentId) {
            await sql`DELETE FROM exam_assignments WHERE exam_id = ${params.id} AND student_id = ${studentId}`;
            // Log Removal
            await sql`
                INSERT INTO exam_assignment_logs (
                   exam_id, student_id, action, assigned_by
               ) VALUES (
                   ${params.id}, ${studentId}, 'REMOVED', ${session.id}
               )
           `;
        } else {
            // This was the old "Wipe All" behavior, preventing accidental usage without param
            // But sometimes useful. Let's keep it but maybe frontend won't use it for 'bulk remove'
            // For bulk wipe logic, logging every student might be expensive, so we log generic or single event?
            // The Log table expects student_id. If we wipe all, we lose individual tracking unless we select first.
            // For now, let's just delete. Bulk wipe is rare/dangerous.
            await sql`DELETE FROM exam_assignments WHERE exam_id = ${params.id}`;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting assignment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
