'use client';

import { useExamStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Flag, ArrowRight, Eraser, Send } from 'lucide-react';

interface ActionButtonsProps {
    currentQuestionId: string;
    onNext: () => void;
    onPrevious: () => void;
    onSubmit: () => void;
    isFirst: boolean;
    isLast: boolean;
}

export default function ActionButtons({
    currentQuestionId,
    onNext,
    onPrevious,
    onSubmit,
    isFirst,
    isLast,
}: ActionButtonsProps) {
    const { responses, setResponse } = useExamStore();
    const currentResponse = responses[currentQuestionId];

    const handleMarkForReview = () => {
        setResponse(
            currentQuestionId,
            currentResponse?.answer || null,
            !currentResponse?.markedForReview
        );
        onNext();
    };

    const handleClearResponse = () => {
        setResponse(currentQuestionId, null, currentResponse?.markedForReview || false);
    };

    const handleSaveAndNext = () => {
        onNext();
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex flex-wrap gap-3 justify-between items-center">
                {/* Left side buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={handleMarkForReview}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                            currentResponse?.markedForReview
                                ? 'bg-purple-500 text-white'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        )}
                    >
                        <Flag className="w-4 h-4" />
                        Mark for Review & Next
                    </button>

                    <button
                        onClick={handleClearResponse}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                    >
                        <Eraser className="w-4 h-4" />
                        Clear Response
                    </button>
                </div>

                {/* Right side buttons */}
                <div className="flex gap-2">
                    {!isFirst && (
                        <button
                            onClick={onPrevious}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                        >
                            Previous
                        </button>
                    )}

                    <button
                        onClick={handleSaveAndNext}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                    >
                        Save & Next
                        <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onSubmit}
                        className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all"
                    >
                        <Send className="w-4 h-4" />
                        Submit
                    </button>
                </div>
            </div>
        </div>
    );
}
