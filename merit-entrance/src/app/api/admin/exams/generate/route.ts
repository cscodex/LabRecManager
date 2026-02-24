import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { blueprintId, title, description, duration, createdById } = body;

        if (!blueprintId || !title || !duration || !createdById) {
            return NextResponse.json({ success: false, error: 'Missing required exam details (blueprintId, title, duration, createdById).' }, { status: 400 });
        }

        // 1. Fetch the blueprint and rules
        // @ts-ignore - Prisma type cache issue
        const blueprint = await prisma.examBlueprint.findUnique({
            where: { id: blueprintId },
            include: {
                sections: {
                    include: {
                        rules: {
                            include: { topicTags: true }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!blueprint) {
            return NextResponse.json({ success: false, error: 'Blueprint not found' }, { status: 404 });
        }

        // 2. Collect Questions for Each Rule
        let totalMarks = 0;
        const examSectionsToCreate: any[] = [];

        for (const blueprintSection of blueprint.sections) {
            let sectionMarks = 0;
            const collectedQuestions: any[] = [];

            for (const rule of blueprintSection.rules) {
                const { topicTags, questionType, numberOfQuestions, difficulty, marksPerQuestion, negativeMarks } = rule;

                const selectedIds: string[] = [];

                const whereClause: any = {
                    sectionId: null, // From question bank
                    type: questionType,
                };

                if (topicTags && topicTags.length > 0) {
                    whereClause.tags = { some: { tagId: { in: topicTags.map((t: any) => t.id) } } };
                }
                if (difficulty) {
                    whereClause.difficulty = difficulty;
                }

                const matchingIds = await prisma.question.findMany({
                    where: whereClause,
                    select: { id: true }
                });

                if (matchingIds.length < numberOfQuestions) {
                    const tagNames = topicTags && topicTags.length > 0 ? topicTags.map((t: any) => t.name).join(', ') : 'Any';
                    return NextResponse.json({
                        success: false,
                        error: `Not enough unique questions available for Rule (Type: ${questionType}, Tags: ${tagNames}). Needed ${numberOfQuestions}, Found ${matchingIds.length} in section '${(blueprintSection.name as any)?.en || 'Unknown'}'.`
                    }, { status: 400 });
                }

                // Shuffle in JS
                const shuffled = matchingIds.sort(() => 0.5 - Math.random());
                selectedIds.push(...shuffled.slice(0, numberOfQuestions).map(q => q.id));

                // Fetch full questions to copy
                const questions = await prisma.question.findMany({
                    where: { id: { in: selectedIds } },
                    include: { tags: true }
                });

                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    sectionMarks += Number(marksPerQuestion);
                    collectedQuestions.push({
                        original: q,
                        marks: Number(marksPerQuestion),
                        negativeMarks: negativeMarks ? Number(negativeMarks) : null
                    });
                }
            }

            totalMarks += sectionMarks;
            examSectionsToCreate.push({
                name: blueprintSection.name,
                order: blueprintSection.order,
                questions: collectedQuestions
            });
        }

        // 3. Create the Exam
        const exam = await prisma.exam.create({
            data: {
                title,
                description,
                duration: parseInt(duration),
                totalMarks,
                createdById,
                status: 'draft',
                sections: {
                    create: examSectionsToCreate.map(sec => ({
                        name: sec.name,
                        order: sec.order
                    }))
                }
            },
            include: {
                sections: true
            }
        });

        // 4. Duplicate questions into the new sections
        for (const secData of examSectionsToCreate) {
            const createdSection = exam.sections.find((s: any) => s.order === secData.order);
            if (!createdSection) continue;

            let orderCounter = 1;
            for (const cq of secData.questions) {
                const og = cq.original;

                await prisma.question.create({
                    data: {
                        sectionId: createdSection.id,
                        type: og.type,
                        text: og.text,
                        options: og.options || null,
                        correctAnswer: og.correctAnswer,
                        explanation: og.explanation || null,
                        marks: cq.marks,
                        difficulty: og.difficulty,
                        negativeMarks: cq.negativeMarks,
                        imageUrl: og.imageUrl || null,
                        paragraphId: og.paragraphId || null,
                        order: orderCounter++,
                        tags: {
                            create: og.tags.map((t: any) => ({ tagId: t.tagId }))
                        }
                    }
                });
            }
        }

        return NextResponse.json({ success: true, examId: exam.id, message: 'Exam generated successfully.' });
    } catch (error: any) {
        console.error('Failed to generate exam:', error);
        return NextResponse.json({ success: false, error: 'Failed to generate exam: ' + error.message }, { status: 500 });
    }
}
