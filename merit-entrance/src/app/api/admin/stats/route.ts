import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [totalExams, totalStudents, totalQuestions, activeExams] = await Promise.all([
            prisma.exam.count(),
            prisma.student.count(),
            prisma.question.count(),
            prisma.exam.count({
                where: {
                    status: 'published',
                    schedules: {
                        some: {
                            startTime: { lte: new Date() },
                            endTime: { gte: new Date() },
                        },
                    },
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            stats: {
                totalExams,
                totalStudents,
                totalQuestions,
                activeExams,
            },
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
