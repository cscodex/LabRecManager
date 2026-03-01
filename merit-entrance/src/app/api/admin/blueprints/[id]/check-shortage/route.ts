import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const blueprint = await prisma.examBlueprint.findUnique({
            where: { id: params.id },
            include: {
                sections: {
                    include: {
                        rules: {
                            include: {
                                topicTags: true
                            }
                        }
                    }
                }
            }
        }) as any;

        if (!blueprint) {
            return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 });
        }

        const sections = blueprint.sections as any[];
        let totalRequired = 0;
        let totalFound = 0;
        const shortages: any[] = [];

        for (const section of sections) {
            const rules = section.rules || [];

            for (const rule of rules) {
                const numberOfQuestions = Number(rule.numberOfQuestions);
                const questionType = rule.questionType;
                const difficulty = rule.difficulty ? Number(rule.difficulty) : null;
                const topicTags = rule.topicTags || [];

                totalRequired += numberOfQuestions;

                // Build where clause similar to generator
                const whereClause: any = { type: questionType };

                if (topicTags.length > 0) {
                    const tagIds = topicTags.map((t: any) => t.id).filter(Boolean);
                    if (tagIds.length > 0) {
                        whereClause.tags = { some: { tagId: { in: tagIds } } };
                    }
                }

                if (difficulty) {
                    whereClause.difficulty = difficulty;
                }

                // Do the count
                const matchingCount = await prisma.question.count({
                    where: whereClause
                });

                totalFound += Math.min(matchingCount, numberOfQuestions);

                if (matchingCount < numberOfQuestions) {
                    shortages.push({
                        section: section.name,
                        type: questionType,
                        tags: topicTags.map((t: any) => t.name).join(', ') || 'Any',
                        difficulty: difficulty || 'Any',
                        required: numberOfQuestions,
                        found: matchingCount,
                        missing: numberOfQuestions - matchingCount
                    });
                }
            }
        }

        const hasShortage = totalFound < totalRequired;

        return NextResponse.json({
            success: true,
            hasShortage,
            totalRequired,
            totalFound,
            missingCount: totalRequired - totalFound,
            shortages
        });

    } catch (error: any) {
        console.error('Check shortage error:', error);
        return NextResponse.json({ error: error.message || 'Failed to check shortage' }, { status: 500 });
    }
}
