import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = session.id;

        // Get exams assigned to this student
        const assignments = await prisma.examAssignment.findMany({
            where: { studentId },
            include: {
                exam: {
                    include: {
                        schedules: {
                            orderBy: { startTime: 'asc' },
                            take: 1,
                        },
                    },
                },
            },
        });

        // Check if student has attempted each exam
        const attempts = await prisma.examAttempt.findMany({
            where: { studentId },
            select: { examId: true, status: true },
        });

        const attemptedExamIds = new Set(
            attempts.filter((a) => a.status === 'submitted').map((a) => a.examId)
        );

        const exams = assignments
            .filter((a) => a.exam.status === 'published')
            .map((assignment) => ({
                id: assignment.exam.id,
                title: assignment.exam.title as Record<string, string>,
                duration: assignment.exam.duration,
                totalMarks: assignment.exam.totalMarks,
                schedule: assignment.exam.schedules[0]
                    ? {
                        startTime: assignment.exam.schedules[0].startTime.toISOString(),
                        endTime: assignment.exam.schedules[0].endTime.toISOString(),
                    }
                    : null,
                hasAttempted: attemptedExamIds.has(assignment.exam.id),
            }))
            .filter((e) => e.schedule !== null);

        return NextResponse.json({
            success: true,
            exams,
        });
    } catch (error) {
        console.error('Error fetching student exams:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
