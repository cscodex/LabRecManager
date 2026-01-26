import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> } // Params as Promise
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await req.json();
        const { questions, language } = body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
        }

        // 1. Fetch all sections for validation
        const sections = await prisma.section.findMany({
            where: { exam_id: id },
            select: { id: true, name: true, order: true }
        });

        const sectionMap = new Map(sections.map(s => [s.id, s]));

        // 2. Process questions transactionally
        let importedCount = 0;

        await prisma.$transaction(async (tx) => {
            // Group questions by section to handle ordering per section
            const questionsBySection: Record<string, any[]> = {};

            for (const q of questions) {
                if (!sectionMap.has(q.section)) continue; // Skip invalid sections
                if (!questionsBySection[q.section]) questionsBySection[q.section] = [];
                questionsBySection[q.section].push(q);
            }

            for (const sectionId of Object.keys(questionsBySection)) {
                const sectionQuestions = questionsBySection[sectionId];

                // Get current max order for this section
                const lastQuestion = await tx.question.findFirst({
                    where: { section_id: sectionId },
                    orderBy: { order: 'desc' },
                });
                let currentOrder = lastQuestion ? lastQuestion.order : 0;

                // Map row number to created question ID (for paragraph linking)
                const rowToIdMap = new Map<number, string>();
                // Also track paragraph order to insert children immediately after
                const paragraphOrders = new Map<number, number>();

                // Sort by row to maintain sequence from CSV
                sectionQuestions.sort((a, b) => a.row - b.row);

                for (const q of sectionQuestions) {
                    currentOrder++; // Increment global order tracker

                    // If it's a child question, try to find parent
                    let parentId: string | null = null;
                    if (q.parentRow && rowToIdMap.has(q.parentRow)) {
                        parentId = rowToIdMap.get(q.parentRow)!;

                        // Strict Ordering Logic:
                        // Children must stay immediately after parent. 
                        // However, since we process sequentially by row, and the CSV usually groups them,
                        // simply incrementing currentOrder works IF the CSV is ordered.
                        // If the CSV has Paragraph at Row 5, and Child at Row 100, we might have issues.
                        // But we assume CSV structure implies order.
                    }

                    // Prepare common data
                    const questionData: any = {
                        section_id: sectionId,
                        type: q.type,
                        text: {
                            en: (language === 'both' || language === 'en') ? q.textEn : '',
                            pa: (language === 'both' || language === 'pa') ? q.textPa : ''
                        },
                        marks: q.marks,
                        negative_marks: q.negativeMarks,
                        order: currentOrder,
                        explanation: (q.explanationEn || q.explanationPa) ? {
                            en: (language === 'both' || language === 'en') ? q.explanationEn : '',
                            pa: (language === 'both' || language === 'pa') ? q.explanationPa : ''
                        } : null,
                        parent_id: parentId
                    };

                    // Handle Para Content
                    if (q.type === 'paragraph') {
                        questionData.paragraph_text = {
                            en: (language === 'both' || language === 'en') ? q.textEn : '',
                            pa: (language === 'both' || language === 'pa') ? q.textPa : ''
                        };
                        // For paragraph type, the main 'text' is often a placeholder or title
                        // We use the same content for both if CSV only has "Question" columns
                    }

                    const created = await tx.question.create({
                        data: questionData
                    });

                    rowToIdMap.set(q.row, created.id);
                    importedCount++;

                    // Handle Options
                    if (['mcq_single', 'mcq_multiple'].includes(q.type)) {
                        const options = [
                            { id: 'a', textEn: q.optionAEn, textPa: q.optionAPa },
                            { id: 'b', textEn: q.optionBEn, textPa: q.optionBPa },
                            { id: 'c', textEn: q.optionCEn, textPa: q.optionCPa },
                            { id: 'd', textEn: q.optionDEn, textPa: q.optionDPa },
                        ].filter(o => o.textEn || o.textPa);

                        if (options.length > 0) {
                            await tx.option.createMany({
                                data: options.map(opt => ({
                                    question_id: created.id,
                                    id: opt.id,
                                    text: {
                                        en: (language === 'both' || language === 'en') ? opt.textEn : '',
                                        pa: (language === 'both' || language === 'pa') ? opt.textPa : ''
                                    }
                                }))
                            });
                        }

                        // Set correct answer
                        if (q.correctAnswer) {
                            let correctArr: string[] = [];
                            if (q.type === 'mcq_multiple') {
                                correctArr = q.correctAnswer.split(',').map((s: string) => s.trim().toLowerCase());
                            } else {
                                correctArr = [q.correctAnswer.trim().toLowerCase()];
                            }
                            await tx.question.update({
                                where: { id: created.id },
                                data: { correct_answer: correctArr }
                            });
                        }
                    } else if (q.type === 'fill_blank') {
                        if (q.correctAnswer) {
                            await tx.question.update({
                                where: { id: created.id },
                                data: { correct_answer: [q.correctAnswer.trim()] }
                            });
                        }
                    }
                }

                // Update section count
                await tx.section.update({
                    where: { id: sectionId },
                    data: { question_count: { increment: sectionQuestions.length } }
                });
            }
        });

        return NextResponse.json({ success: true, imported: importedCount });
    } catch (error) {
        console.error('Master Import error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
