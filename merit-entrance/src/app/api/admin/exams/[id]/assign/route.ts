import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

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
            endTime,
            updateAttemptsOnly = false // When true, skip overlap check and just update max_attempts for existing assignments
        } = body;

        if (!studentIds || !Array.isArray(studentIds)) {
            return NextResponse.json({ error: 'Student IDs are required' }, { status: 400 });
        }

        // 1. Resolve New Schedule details for validation
        let newScheduleStart: Date | null = null;
        let newScheduleEnd: Date | null = null;
        let finalScheduleId: string | null = null;

        if (scheduleType === 'new' && startTime && endTime) {
            newScheduleStart = new Date(startTime);
            newScheduleEnd = new Date(endTime);
            // Create schedule LATER after validation passed
        } else if (scheduleType === 'existing' && providedScheduleId) {
            finalScheduleId = providedScheduleId;
            const existingParams = await sql`SELECT start_time, end_time FROM exam_schedules WHERE id = ${providedScheduleId}`;
            if (existingParams.length > 0) {
                newScheduleStart = new Date(existingParams[0].start_time);
                newScheduleEnd = new Date(existingParams[0].end_time);
            }
        }
        // If scheduleType is 'none', both are null (Always Open)

        // 2. Validation for 'append' mode (skip if updateAttemptsOnly is true)
        if (mode === 'append' && !updateAttemptsOnly) {
            const existingAssignments = await sql`
                SELECT ea.student_id, ea.schedule_id, es.start_time, es.end_time, s.name, s.roll_number
                FROM exam_assignments ea
                JOIN students s ON ea.student_id = s.id
                LEFT JOIN exam_schedules es ON ea.schedule_id = es.id
                WHERE ea.exam_id = ${params.id}
                AND ea.student_id = ANY(${studentIds}::uuid[])
            `;

            for (const studentId of studentIds) {
                const assigned = existingAssignments.filter(a => a.student_id === studentId);

                for (const exist of assigned) {
                    // Conflict Type 1: Always Open clash
                    // If NEW is Always Open OR EXISITING is Always Open -> Conflict
                    const newIsAlwaysOpen = !newScheduleStart && !newScheduleEnd;
                    const existIsAlwaysOpen = !exist.schedule_id; // If schedule_id is null, it's always open.

                    if (newIsAlwaysOpen || existIsAlwaysOpen) {
                        return NextResponse.json({
                            error: `Schedule Conflict: Student ${exist.name} (${exist.roll_number}) already has an assignment. \"Always Open\" exams cannot strictly overlap with other schedules.`
                        }, { status: 409 });
                    }

                    // Conflict Type 2: Time Overlap
                    // (StartA < EndB) and (EndA > StartB)
                    if (newScheduleStart && newScheduleEnd && exist.start_time && exist.end_time) {
                        const existStart = new Date(exist.start_time);
                        const existEnd = new Date(exist.end_time);

                        if (newScheduleStart < existEnd && newScheduleEnd > existStart) {
                            return NextResponse.json({
                                error: `Schedule Overlap: Student ${exist.name} (${exist.roll_number}) has a conflicting schedule (${existStart.toLocaleString()} - ${existEnd.toLocaleString()}).`
                            }, { status: 409 });
                        }
                    }
                }
            }
        }

        // 3. Create Schedule if needed (Post-Validation)
        if (scheduleType === 'new' && !finalScheduleId && newScheduleStart && newScheduleEnd) {
            const [newSchedule] = await sql`
                INSERT INTO exam_schedules (exam_id, start_time, end_time)
                VALUES (${params.id}, ${startTime}, ${endTime})
                RETURNING id
            `;
            finalScheduleId = newSchedule.id;
        }

        // 4. Handle Assignments
        if (mode === 'replace') {
            await sql`DELETE FROM exam_assignments WHERE exam_id = ${params.id}`;
        }

        let addedCount = 0;

        for (const studentId of studentIds) {
            try {
                if (updateAttemptsOnly) {
                    // For updateAttemptsOnly, directly UPDATE existing assignments
                    // This handles NULL schedule_id properly
                    await sql`
                        UPDATE exam_assignments 
                        SET max_attempts = ${maxAttempts}
                        WHERE exam_id = ${params.id} AND student_id = ${studentId}
                    `;

                    // Log the update
                    await sql`
                         INSERT INTO exam_assignment_logs (
                            exam_id, student_id, schedule_id, max_attempts, 
                            action, assigned_by
                        ) VALUES (
                            ${params.id}, ${studentId}, ${finalScheduleId}, ${maxAttempts},
                            'ATTEMPTS_UPDATED',
                            ${session.id}
                        )
                    `;
                } else {
                    // For regular append/insert, use INSERT with ON CONFLICT
                    await sql`
                        INSERT INTO exam_assignments (exam_id, student_id, max_attempts, schedule_id)
                        VALUES (${params.id}, ${studentId}, ${maxAttempts}, ${finalScheduleId})
                        ON CONFLICT (exam_id, student_id, schedule_id) 
                        DO UPDATE SET max_attempts = ${maxAttempts}
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
                }

                addedCount++;
            } catch (e) {
                console.error('Assignment error for student', studentId, e);
            }
        }

        await logActivity('assign_exam', `Assigned exam to ${addedCount} students`, { examId: params.id, count: addedCount, mode });

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
