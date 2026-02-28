import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const promptId = params.id;

        if (!promptId) {
            return NextResponse.json({ success: false, error: 'Prompt ID is required' }, { status: 400 });
        }

        await prisma.savedAIPrompt.delete({
            where: { id: promptId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to delete AI prompt:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
