import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail, generateVerificationToken, getVerificationExpiry } from '@/lib/email';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

// Helper function to auto-assign exams to new student
async function autoAssignExamsToStudent(studentId: string) {
    try {
        // Get all exams with auto_assign enabled
        const autoAssignExams = await sql`
            SELECT e.id as exam_id, e.auto_assign_attempts,
                   (SELECT id FROM exam_schedules 
                    WHERE exam_id = e.id 
                    AND end_time > NOW() 
                    ORDER BY start_time ASC 
                    LIMIT 1) as schedule_id
            FROM exams e
            WHERE false /* e.auto_assign = true AND e.is_published = true */
        `;

        if (autoAssignExams.length === 0) {
            console.log('No auto-assign exams found');
            return 0;
        }

        let assignedCount = 0;
        for (const exam of autoAssignExams) {
            // Skip if no active schedule exists
            if (!exam.schedule_id) {
                console.log(`Skipping exam ${exam.exam_id} - no active schedule`);
                continue;
            }

            // Create assignment for this student
            await sql`
                INSERT INTO exam_assignments (exam_id, student_id, max_attempts, schedule_id)
                VALUES (${exam.exam_id}, ${studentId}, ${exam.auto_assign_attempts}, ${exam.schedule_id})
                ON CONFLICT DO NOTHING
            `;
            assignedCount++;
            console.log(`Auto-assigned exam ${exam.exam_id} to student ${studentId}`);
        }

        return assignedCount;
    } catch (error) {
        console.error('Error auto-assigning exams:', error);
        return 0;
    }
}

export async function POST(request: NextRequest) {
    try {
        const { name, email, phone, class: studentClass, school, state, district, password, googleId } = await request.json();

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
        }

        // Password is required for non-Google registrations
        if (!googleId && !password) {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }

        // Check if email already exists
        const existing = await sql`
            SELECT id FROM students WHERE email = ${email}
        `;

        if (existing.length > 0) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
        }

        // Generate roll number and verification token
        const rollNumber = googleId ? `GOOGLE${Date.now().toString().slice(-8)}` : `STU${Date.now().toString().slice(-8)}`;
        // Hash user-provided password, or generate temp for Google users
        const passwordHash = password
            ? await bcrypt.hash(password, 10)
            : await bcrypt.hash(Math.random().toString(36), 10);
        const verificationToken = generateVerificationToken();
        const verificationExpires = getVerificationExpiry();

        // Create student account and get the ID
        const [newStudent] = await sql`
            INSERT INTO students (
                roll_number, 
                name, 
                email, 
                phone,
                "class",
                school,
                state,
                district,
                password_hash, 
                is_active,
                email_verified,
                verification_token,
                verification_expires,
                google_id
            )
            VALUES (
                ${rollNumber}, 
                ${name}, 
                ${email}, 
                ${phone || null},
                ${studentClass || null},
                ${school || null},
                ${state || null},
                ${district || null},
                ${passwordHash}, 
                true,
                ${googleId ? true : false},
                ${verificationToken},
                ${verificationExpires.toISOString()},
                ${googleId || null}
            )
            RETURNING id
        `;

        // Auto-assign exams to the new student
        const autoAssignedCount = await autoAssignExamsToStudent(newStudent.id);
        if (autoAssignedCount > 0) {
            console.log(`Auto-assigned ${autoAssignedCount} exams to new student ${newStudent.id}`);
        }

        // Send verification email only if not google oauth
        let emailSent = true;
        if (!googleId) {
            emailSent = await sendVerificationEmail(email, name, verificationToken);
        }

        if (!emailSent) {
            console.error('Failed to send verification email to:', email);
            // Still return success but note the email issue
            return NextResponse.json({
                success: true,
                message: 'Account created but verification email failed to send. Please try resending.',
                rollNumber,
                emailSent: false,
                autoAssignedExams: autoAssignedCount
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Account created successfully. Please check your email to verify.',
            rollNumber,
            emailSent: true,
            expiresAt: verificationExpires.toISOString(),
            autoAssignedExams: autoAssignedCount
        });
    } catch (error) {
        console.error('Error registering with Google:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
