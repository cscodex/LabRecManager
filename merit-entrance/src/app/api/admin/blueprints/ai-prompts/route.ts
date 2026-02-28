import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');

        if (!adminId) {
            return NextResponse.json({ success: false, error: 'Admin ID is required' }, { status: 400 });
        }

        const prompts = await prisma.savedAIPrompt.findMany({
            where: { createdById: adminId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, data: prompts });
    } catch (error: any) {
        console.error('Failed to fetch AI prompts:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, promptText, createdById } = body;

        if (!name || !promptText || !createdById) {
            return NextResponse.json({ success: false, error: 'Name, promptText, and createdById are required' }, { status: 400 });
        }

        const newPrompt = await prisma.savedAIPrompt.create({
            data: {
                name,
                promptText,
                createdById
            }
        });

        return NextResponse.json({ success: true, data: newPrompt });
    } catch (error: any) {
        console.error('Failed to save AI prompt:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
