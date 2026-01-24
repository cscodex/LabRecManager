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
        paragraphText?: Record<string, string> | null;
        parentId?: string | null;
    };
    totalQuestions: number;
    parentParagraphText?: Record<string, string> | null;
    allQuestions?: Array<{ id: string; parentId?: string | null; order: number }>;
}

export default function QuestionDisplay({ question, totalQuestions, parentParagraphText, allQuestions = [] }: QuestionDisplayProps) {
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

    const handleFillBlankChange = (value: string) => {
        setResponse(question.id, value ? [value] : [], currentResponse?.markedForReview || false);
    };

    const isSelected = (optionId: string) => {
        if (!selectedAnswer) return false;
        return (selectedAnswer as string[]).includes(optionId);
    };

    // For paragraph type questions, just display the passage content
    if (question.type === 'paragraph') {
        // Find linked sub-questions
        const linkedQuestions = allQuestions.filter(q => q.parentId === question.id);
        const linkedNums = linkedQuestions.map(lq => lq.order).sort((a, b) => a - b).join(', ');

        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                {/* Question Header */}
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-blue-600">
                        📖 Passage {question.order} of {totalQuestions}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Read the following passage carefully
                    </p>
                </div>

                {/* Paragraph Title */}
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                    {getText(question.text, language)}
                </h3>

                {/* Paragraph/Passage Text */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
                        {question.paragraphText ? getText(question.paragraphText, language) : ''}
                    </p>
                </div>

                {question.imageUrl && (
                    <div className="mt-4">
                        <img
                            src={question.imageUrl}
                            alt="Passage diagram"
                            className="max-w-full h-auto rounded-lg border"
                        />
                    </div>
                )}

                {/* Show linked questions info */}
                {linkedQuestions.length > 0 ? (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm text-green-700">
                            📝 <strong>Questions based on this passage:</strong> Q{linkedNums}
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                            Navigate to these questions to answer based on this passage.
                        </p>
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-gray-500 italic">
                        Navigate to the next question to answer questions based on this passage.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            {/* Parent Paragraph Text (if this is a sub-question) */}
            {parentParagraphText && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-blue-600 mb-2">📄 Related Passage:</p>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                        {getText(parentParagraphText, language)}
                    </p>
                </div>
            )}

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
                {question.type === 'fill_blank' && (
                    <p className="text-sm text-gray-500 mt-1">
                        (Fill in the blank)
                    </p>
                )}
            </div>

            {/* Question Text */}
            <div className="mb-6">
                <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
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

            {/* Fill in the Blank Input */}
            {question.type === 'fill_blank' && (
                <div className="mb-4">
                    <input
                        type="text"
                        value={(selectedAnswer as string[])?.[0] || ''}
                        onChange={(e) => handleFillBlankChange(e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-lg focus:border-blue-500 focus:outline-none"
                    />
                </div>
            )}

            {/* MCQ Options */}
            {question.options && (question.type === 'mcq_single' || question.type === 'mcq_multiple') && (
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
                                <span className={cn("flex-1 text-gray-700", language === 'pa' && "text-lg")}>
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
