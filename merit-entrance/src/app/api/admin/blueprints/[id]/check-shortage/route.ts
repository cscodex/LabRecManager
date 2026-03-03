import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const url = new URL(request.url);
        const examId = url.searchParams.get('examId');
        const targetSectionId = url.searchParams.get('sectionId');

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
                    },
                    orderBy: { order: 'asc' }
                }
            }
        }) as any;

        if (!blueprint) {
            return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 });
        }

        const bpSections = blueprint.sections as any[];

        let totalRequired = 0;
        let totalFound = 0;
        let totalShortage = 0;
        const shortages: any[] = [];

        // If an examId is provided, fetch its sections sorted by order
        let examSections: any[] = [];
        if (examId) {
            examSections = await prisma.section.findMany({
                where: { examId },
                orderBy: { order: 'asc' }
            });
        }

        for (let i = 0; i < bpSections.length; i++) {
            const bpSection = bpSections[i];

            // Match by index position (both arrays sorted by order)
            // Also try direct order match and name match as fallbacks
            const matchedExamSection = examSections[i]
                || examSections.find(s => String(s.order) === String(bpSection.order));

            const actualExamSectionId = matchedExamSection?.id;

            // If targeting a specific section, ONLY process that section
            if (targetSectionId && actualExamSectionId !== targetSectionId) {
                continue;
            }

            const rules = bpSection.rules || [];

            // For this section, get ALL questions currently assigned to it
            // so we can do proper cumulative counting
            let sectionQuestionIds: string[] = [];
            if (actualExamSectionId) {
                const sectionQuestions = await prisma.sectionQuestion.findMany({
                    where: { sectionId: actualExamSectionId },
                    include: {
                        question: {
                            include: { tags: { select: { tagId: true } } }
                        }
                    }
                }) as any[];

                // Track which question IDs have been "claimed" by earlier rules
                const claimedIds = new Set<string>();

                for (const rule of rules) {
                    const numberOfQuestions = Number(rule.numberOfQuestions);
                    const questionType = rule.questionType;
                    const difficulty = rule.difficulty ? Number(rule.difficulty) : null;
                    const topicTags = rule.topicTags || [];
                    const tagIds = topicTags.map((t: any) => t.id).filter(Boolean);

                    totalRequired += numberOfQuestions;

                    // Find unclaimed questions that match this rule
                    let matchCount = 0;
                    for (const sq of sectionQuestions) {
                        const q = sq.question;
                        if (claimedIds.has(q.id)) continue; // Already used by a previous rule

                        // Check type match
                        if (q.type !== questionType) continue;

                        // Check difficulty match
                        if (difficulty && Number(q.difficulty) !== difficulty) continue;

                        // Check tag match (question must have at least one matching tag)
                        if (tagIds.length > 0) {
                            const qTagIds = q.tags?.map((t: any) => t.tagId) || [];
                            const hasMatchingTag = tagIds.some((tid: string) => qTagIds.includes(tid));
                            if (!hasMatchingTag) continue;
                        }

                        // This question matches and is unclaimed
                        matchCount++;
                        claimedIds.add(q.id);

                        if (matchCount >= numberOfQuestions) break; // Enough for this rule
                    }

                    totalFound += matchCount;

                    if (matchCount < numberOfQuestions) {
                        const delta = numberOfQuestions - matchCount;
                        totalShortage += delta;
                        shortages.push({
                            section: typeof bpSection.name === 'object' ? bpSection.name.en : bpSection.name,
                            type: questionType,
                            tags: topicTags.map((t: any) => t.name).join(', ') || 'Any',
                            difficulty: difficulty || 'Any',
                            required: numberOfQuestions,
                            found: matchCount,
                            missing: delta
                        });
                    }
                }
            } else if (examId) {
                // No matching exam section found — everything is missing
                for (const rule of rules) {
                    const numberOfQuestions = Number(rule.numberOfQuestions);
                    totalRequired += numberOfQuestions;
                    totalShortage += numberOfQuestions;
                    shortages.push({
                        section: typeof bpSection.name === 'object' ? bpSection.name.en : bpSection.name,
                        type: rule.questionType,
                        tags: (rule.topicTags || []).map((t: any) => t.name).join(', ') || 'Any',
                        difficulty: rule.difficulty || 'Any',
                        required: numberOfQuestions,
                        found: 0,
                        missing: numberOfQuestions
                    });
                }
            } else {
                // No examId: count from global pool (legacy behavior)
                for (const rule of rules) {
                    const numberOfQuestions = Number(rule.numberOfQuestions);
                    const whereClause: any = { type: rule.questionType };
                    if (rule.difficulty) whereClause.difficulty = Number(rule.difficulty);
                    const topicTags = rule.topicTags || [];
                    if (topicTags.length > 0) {
                        const tagIds = topicTags.map((t: any) => t.id).filter(Boolean);
                        if (tagIds.length > 0) {
                            whereClause.tags = { some: { tagId: { in: tagIds } } };
                        }
                    }
                    totalRequired += numberOfQuestions;
                    const count = await prisma.question.count({ where: whereClause });
                    totalFound += Math.min(count, numberOfQuestions);
                    if (count < numberOfQuestions) {
                        const delta = numberOfQuestions - count;
                        totalShortage += delta;
                        shortages.push({
                            section: typeof bpSection.name === 'object' ? bpSection.name.en : bpSection.name,
                            type: rule.questionType,
                            tags: topicTags.map((t: any) => t.name).join(', ') || 'Any',
                            difficulty: rule.difficulty || 'Any',
                            required: numberOfQuestions,
                            found: count,
                            missing: delta
                        });
                    }
                }
            }
        }

        const hasShortage = totalShortage > 0;

        return NextResponse.json({
            success: true,
            hasShortage,
            totalRequired,
            totalFound,
            totalShortage,
            shortages
        });

    } catch (error: any) {
        console.error('Check shortage error:', error);
        return NextResponse.json({ error: error.message || 'Failed to check shortage' }, { status: 500 });
    }
}
