import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const body = await request.json();
        const { name, description, sections, generationMethod } = body;
        const blueprintId = params.id;

        if (!blueprintId) {
            return NextResponse.json({ success: false, error: 'Blueprint ID is required' }, { status: 400 });
        }

        if (!name || !sections || !Array.isArray(sections)) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 0. Validate available questions for all rules before mutating the database
        // Skip validation if we are going to generate them dynamically via AI
        if (generationMethod !== 'generate_novel') {
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
                                requiresAiConfirmation: true,
                                error: `Not enough questions with section rule and confirm to create using AI based on rule and available textbook RAG.\n\n(Section ${idx + 1}, Rule ${rIdx + 1} requests ${requested} questions, but only ${availableQuestions} exist in bank.)`
                            }, { status: 200 });
                        }
                    }
                }
            }
        }

        // 1. Update basic blueprint info
        const bp = await prisma.examBlueprint.update({
            where: { id: blueprintId },
            data: { name, description, generationMethod }
        });

        // 2. Identify all old rules to clean up associative implicit M2M relations safely
        const oldRules = await prisma.blueprintRule.findMany({
            where: { blueprintId: blueprintId },
            select: { id: true }
        });

        if (oldRules.length > 0) {
            const ruleIds = oldRules.map(r => `'${r.id}'`).join(',');
            await prisma.$executeRawUnsafe(`DELETE FROM "_BlueprintRuleToTag" WHERE "A" IN (${ruleIds});`);
        }

        // Delete existing sections (Db Cascade deletion takes care of blueprint rules inside)
        await prisma.blueprintSection.deleteMany({
            where: { blueprintId }
        });

        // 3. Re-insert Sections and Rules (identical to POST logic but explicitly for this existing ID)
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
                            await prisma.$executeRawUnsafe(
                                `INSERT INTO "_BlueprintRuleToTag" ("A", "B") VALUES ('${createdRule.id}', '${tId}') ON CONFLICT DO NOTHING;`
                            );
                        }
                    }
                }
            }
        }

        // 4. Fetch the refreshed blueprint
        const updatedBlueprint = await prisma.examBlueprint.findUnique({
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

        return NextResponse.json({ success: true, data: updatedBlueprint });
    } catch (error: any) {
        console.error('Failed to update blueprint:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const blueprintId = params.id;
        if (!blueprintId) {
            return NextResponse.json({ success: false, error: 'Blueprint ID is required' }, { status: 400 });
        }

        // 1. Manually clean up M2M relational junction constraints to prevent transaction triggers
        const rules = await prisma.blueprintRule.findMany({
            where: { blueprintId },
            select: { id: true }
        });

        if (rules.length > 0) {
            const ruleIds = rules.map(r => `'${r.id}'`).join(',');
            await prisma.$executeRawUnsafe(`DELETE FROM "_BlueprintRuleToTag" WHERE "A" IN (${ruleIds});`);
        }

        // 2. Cascade delete blueprint and nested objects
        await prisma.examBlueprint.delete({
            where: { id: blueprintId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to delete blueprint:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
