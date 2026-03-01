import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');

        const whereClause: any = {};
        if (adminId) {
            whereClause.createdById = adminId;
        }

        const blueprints = await prisma.examBlueprint.findMany({
            where: whereClause,
            include: {
                sections: {
                    include: {
                        rules: {
                            include: {
                                topicTags: true
                            }
                        },
                        orderBy: {
                            order: 'asc'
                        }
                    }
                },
                createdBy: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, data: blueprints });
    } catch (error: any) {
        console.error('Error fetching blueprints:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch blueprints' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, description, sections, createdById } = body;

        if (!name || !sections || !Array.isArray(sections) || !createdById) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const generationMethod = body.generationMethod || 'fetch_existing';

        // 1. Create basic blueprint info
        try {
            // @ts-ignore - Prisma type cache issue
            const bp = await prisma.examBlueprint.create({
                data: {
                    name,
                    description,
                    createdById,
                    generationMethod
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

                        // Explicitly associate tags using separate queries to bypass HTTP driver Transaction constraints
                        if (r.topicTags && Array.isArray(r.topicTags) && r.topicTags.length > 0) {
                            for (const tId of r.topicTags) {
                                const q = 'INSERT INTO "_BlueprintRuleToTag" ("A", "B") VALUES (\'' + createdRule.id + '\', \'' + tId + '\') ON CONFLICT DO NOTHING;';
                                await prisma.$executeRawUnsafe(q);
                            }
                        }
                    }
                }
            }

            // 2. Fetch the newly completely constructed blueprint
            const completeBlueprint = await prisma.examBlueprint.findUnique({
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

            return NextResponse.json({ success: true, data: completeBlueprint });
        } catch (error: any) {
            if (error.code === 'P2002') {
                return NextResponse.json({ success: false, error: 'A blueprint with this exact name already exists. Please choose a unique name.' }, { status: 400 });
            }
            throw error;
        }

    } catch (error: any) {
        console.error('Error creating blueprint:', error);
        return NextResponse.json({ success: false, error: 'Failed to save blueprint. Ensure the name is unique and tags are valid.' }, { status: 500 });
    }
}
