'use client';

import { cn, getText } from '@/lib/utils';
import { useAuthStore, useExamStore } from '@/lib/store';

interface Option {
    id: string;
    text: Record<string, string>;
}

interface QuestionDisplayProps {
    question: {
        id: string;
        type: string;
        text: Record<string, string>;
        options: Option[] | null;
        imageUrl?: string;
        order: number;
    };
    totalQuestions: number;
}

export default function QuestionDisplay({ question, totalQuestions }: QuestionDisplayProps) {
    const { language } = useAuthStore();
    const { responses, setResponse } = useExamStore();

    const currentResponse = responses[question.id];
    const selectedAnswer = currentResponse?.answer;

    const handleOptionSelect = (optionId: string) => {
        if (question.type === 'mcq_single') {
            setResponse(question.id, [optionId], currentResponse?.markedForReview || false);
        } else if (question.type === 'mcq_multiple') {
            const current = (selectedAnswer as string[]) || [];
            const updated = current.includes(optionId)
                ? current.filter((id) => id !== optionId)
                : [...current, optionId];
            setResponse(question.id, updated, currentResponse?.markedForReview || false);
        }
    };

    const isSelected = (optionId: string) => {
        if (!selectedAnswer) return false;
        return (selectedAnswer as string[]).includes(optionId);
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            {/* Question Header */}
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-blue-600">
                    Question {question.order} of {totalQuestions}
                </h2>
                {question.type === 'mcq_multiple' && (
                    <p className="text-sm text-gray-500 mt-1">
                        (Multiple correct answers)
                    </p>
                )}
            </div>

            {/* Question Text */}
            <div className="mb-6">
                <p className="text-gray-800 text-lg leading-relaxed">
                    {getText(question.text, language)}
                </p>

                {question.imageUrl && (
                    <div className="mt-4">
                        <img
                            src={question.imageUrl}
                            alt="Question diagram"
                            className="max-w-full h-auto rounded-lg border"
                        />
                    </div>
                )}
            </div>

            {/* Options */}
            {question.options && (
                <div className="space-y-3">
                    {question.options.map((option, index) => {
                        const optionLabel = String.fromCharCode(65 + index); // A, B, C, D
                        const selected = isSelected(option.id);

                        return (
                            <button
                                key={option.id}
                                onClick={() => handleOptionSelect(option.id)}
                                className={cn(
                                    'w-full flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all',
                                    selected
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                )}
                            >
                                {/* Option Circle */}
                                <span
                                    className={cn(
                                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2',
                                        selected
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'border-gray-300 text-gray-500'
                                    )}
                                >
                                    {optionLabel}
                                </span>

                                {/* Option Text */}
                                <span className="flex-1 text-gray-700">
                                    {getText(option.text, language)}
                                </span>

                                {/* Radio/Checkbox indicator */}
                                {question.type === 'mcq_single' ? (
                                    <span
                                        className={cn(
                                            'w-5 h-5 rounded-full border-2',
                                            selected
                                                ? 'border-blue-500 bg-blue-500'
                                                : 'border-gray-300'
                                        )}
                                    >
                                        {selected && (
                                            <span className="block w-2.5 h-2.5 rounded-full bg-white m-auto mt-0.5" />
                                        )}
                                    </span>
                                ) : (
                                    <span
                                        className={cn(
                                            'w-5 h-5 rounded border-2 flex items-center justify-center',
                                            selected
                                                ? 'border-blue-500 bg-blue-500 text-white'
                                                : 'border-gray-300'
                                        )}
                                    >
                                        {selected && (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
