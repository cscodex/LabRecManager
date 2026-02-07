'use client';

import { useExamStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Flag, ArrowRight, ArrowLeft, Eraser, Send, Check } from 'lucide-react';

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
        // Removed auto-next so user can toggle mark on/off
    };

    const handleMarkAndNext = () => {
        setResponse(
            currentQuestionId,
            currentResponse?.answer || null,
            true
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
        <div className="bg-white rounded-lg shadow-md p-3">
            <div className="flex flex-wrap gap-2 justify-between items-center">
                {/* Left side buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={handleMarkForReview}
                        title={currentResponse?.markedForReview ? 'Unmark' : 'Mark for Review'}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                            currentResponse?.markedForReview
                                ? 'bg-purple-500 text-white'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        )}
                    >
                        <Flag className="w-4 h-4" />
                        <span className="hidden sm:inline">{currentResponse?.markedForReview ? 'Unmark' : 'Mark'}</span>
                    </button>

                    <button
                        onClick={handleClearResponse}
                        title="Clear Response"
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
                    >
                        <Eraser className="w-4 h-4" />
                        <span className="hidden sm:inline">Clear</span>
                    </button>
                </div>

                {/* Right side buttons */}
                <div className="flex gap-2">
                    {!isFirst && (
                        <button
                            onClick={onPrevious}
                            title="Previous Question"
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Prev</span>
                        </button>
                    )}

                    <button
                        onClick={handleSaveAndNext}
                        title="Save & Next"
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all"
                    >
                        <Check className="w-4 h-4" />
                        <span className="hidden sm:inline">Save</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onSubmit}
                        title="Submit Exam"
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-all"
                    >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Submit</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
