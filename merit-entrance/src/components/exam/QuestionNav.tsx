'use client';

import { useExamStore } from '@/lib/store';
import { cn, questionStatusColors } from '@/lib/utils';

interface Question {
    id: string;
    order: number;
}

interface QuestionNavProps {
    questions: Question[];
    onQuestionClick: (index: number) => void;
}

export default function QuestionNav({ questions, onQuestionClick }: QuestionNavProps) {
    const { currentQuestionIndex, responses } = useExamStore();

    const getQuestionStatus = (questionId: string, index: number) => {
        const response = responses[questionId];

        if (!response) {
            return index === currentQuestionIndex ? 'notAnswered' : 'notVisited';
        }

        const hasAnswer = response.answer !== null && response.answer !== undefined;
        const isMarked = response.markedForReview;

        if (hasAnswer && isMarked) return 'answeredAndMarked';
        if (isMarked) return 'markedForReview';
        if (hasAnswer) return 'answered';
        return 'notAnswered';
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-4">
            {/* Question Grid */}
            <div className="grid grid-cols-5 gap-2 mb-4">
                {questions.map((q, index) => {
                    const status = getQuestionStatus(q.id, index);
                    return (
                        <button
                            key={q.id}
                            onClick={() => onQuestionClick(index)}
                            className={cn(
                                'w-10 h-10 rounded-lg font-semibold text-sm transition-all',
                                'hover:ring-2 hover:ring-blue-400',
                                currentQuestionIndex === index && 'ring-2 ring-blue-600',
                                questionStatusColors[status]
                            )}
                        >
                            {index + 1}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                    <span className={cn('w-4 h-4 rounded', questionStatusColors.answered)}></span>
                    <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn('w-4 h-4 rounded', questionStatusColors.notAnswered)}></span>
                    <span>Not Answered</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn('w-4 h-4 rounded', questionStatusColors.markedForReview)}></span>
                    <span>Marked for Review</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn('w-4 h-4 rounded', questionStatusColors.notVisited)}></span>
                    <span>Not Visited</span>
                </div>
            </div>
        </div>
    );
}
