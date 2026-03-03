import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // Use raw queries to avoid Prisma client cache issues with new models
        const boards = await prisma.$queryRawUnsafe<any[]>(`
            SELECT id, code, name, full_name as "fullName", category, state
            FROM education_boards
            WHERE is_active = true
            ORDER BY display_order ASC
        `);

        const classes = await prisma.$queryRawUnsafe<any[]>(`
            SELECT id, code, name, category
            FROM class_levels
            WHERE is_active = true
            ORDER BY display_order ASC
        `);

        const subjects = await prisma.$queryRawUnsafe<any[]>(`
            SELECT id, code, name, category
            FROM subjects
            WHERE is_active = true
            ORDER BY display_order ASC
        `);

        // Group by category for easier UI rendering
        const groupedBoards: Record<string, any[]> = {};
        boards.forEach((b: any) => {
            const cat = b.category;
            if (!groupedBoards[cat]) groupedBoards[cat] = [];
            groupedBoards[cat].push(b);
        });

        const groupedSubjects: Record<string, any[]> = {};
        subjects.forEach((s: any) => {
            const cat = s.category;
            if (!groupedSubjects[cat]) groupedSubjects[cat] = [];
            groupedSubjects[cat].push(s);
        });

        const groupedClasses: Record<string, any[]> = {};
        classes.forEach((c: any) => {
            const cat = c.category;
            if (!groupedClasses[cat]) groupedClasses[cat] = [];
            groupedClasses[cat].push(c);
        });

        return NextResponse.json({
            success: true,
            data: {
                boards,
                classes,
                subjects,
                grouped: {
                    boards: groupedBoards,
                    classes: groupedClasses,
                    subjects: groupedSubjects
                }
            }
        });
    } catch (error: any) {
        console.error('Error fetching reference data:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch reference data' }, { status: 500 });
    }
}
