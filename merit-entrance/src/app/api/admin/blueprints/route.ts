import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        // @ts-ignore - Prisma type cache issue
        const blueprints = await prisma.examBlueprint.findMany({
            include: {
                sections: {
                    include: {
                        rules: {
                            include: {
                                topicTags: true,
                            }
                        }
                    },
                    orderBy: {
                        order: 'asc'
                    }
                },
                createdBy: {
                    select: {
                        name: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json({ success: true, data: blueprints });
    } catch (error: any) {
        console.error('Failed to fetch blueprints:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, description, createdById, sections } = body;

        if (!name || !createdById || !sections || !Array.isArray(sections)) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 0. Validate available questions for all rules before mutating the database
        for (let idx = 0; idx < sections.length; idx++) {
            const sec = sections[idx];
            if (sec.rules && sec.rules.length > 0) {
                for (let rIdx = 0; rIdx < sec.rules.length; rIdx++) {
                    const r = sec.rules[rIdx];
                    const whereClause: any = {
                        sectionId: null, // From question bank
                        type: r.questionType,
                    };

                    if (r.topicTags && Array.isArray(r.topicTags) && r.topicTags.length > 0) {
                        whereClause.tags = { some: { tagId: { in: r.topicTags } } };
                    }
                    if (r.difficulty) {
                        whereClause.difficulty = parseInt(r.difficulty);
                    }

                    const availableQuestions = await prisma.question.count({ where: whereClause });
                    const requested = parseInt(r.numberOfQuestions);

                    if (requested > availableQuestions) {
                        return NextResponse.json({
                            success: false,
                            error: `Validation failed: Section ${idx + 1}, Rule ${rIdx + 1} requests ${requested} questions, but only ${availableQuestions} unique questions are available for the selected tags and type.`
                        }, { status: 400 });
                    }
                }
            }
        }

        // 1. Create basic blueprint info

        // @ts-ignore - Prisma type cache issue
        const bp = await prisma.examBlueprint.create({
            data: {
                name,
                description,
                createdById,
            }
        });

        for (let idx = 0; idx < sections.length; idx++) {
            const sec = sections[idx];
            const newSec = await prisma.blueprintSection.create({
                data: {
                    blueprintId: bp.id,
                    name: sec.name || { en: 'Section', pa: 'ਸੈਕਸ਼ਨ' },
                    order: idx + 1,
                }
            });

            if (sec.rules && sec.rules.length > 0) {
                for (const r of sec.rules) {
                    const createdRule = await prisma.blueprintRule.create({
                        data: {
                            blueprintId: bp.id,
                            sectionId: newSec.id,
                            questionType: r.questionType,
                            numberOfQuestions: parseInt(r.numberOfQuestions),
                            marksPerQuestion: parseFloat(r.marksPerQuestion),
                            negativeMarks: r.negativeMarks ? parseFloat(r.negativeMarks) : null,
                            difficulty: r.difficulty ? parseInt(r.difficulty) : null
                        }
                    });

                    if (r.topicTags && Array.isArray(r.topicTags) && r.topicTags.length > 0) {
                        for (const tId of r.topicTags) {
                            await prisma.$executeRawUnsafe(
                                `INSERT INTO "_BlueprintRuleToTag" ("A", "B") VALUES ('${createdRule.id}', '${tId}') ON CONFLICT DO NOTHING;`
                            );
                        }
                    }
                }
            }
        }

        const blueprintResponse = await prisma.examBlueprint.findUnique({
            where: { id: bp.id },
            include: {
                sections: {
                    include: {
                        rules: {
                            include: {
                                topicTags: true,
                            }
                        }
                    },
                    orderBy: {
                        order: 'asc'
                    }
                }
            }
        });

        return NextResponse.json({ success: true, data: blueprintResponse });
    } catch (error: any) {
        console.error('Failed to create blueprint:', error);
        return NextResponse.json({ success: false, error: 'Failed to create exam blueprint: ' + error.message }, { status: 500 });
    }
}
