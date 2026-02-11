'use client';

import LoadingSpinner from './LoadingSpinner';

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
}

export default function LoadingOverlay({ isVisible, message = 'Processing...' }: LoadingOverlayProps) {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-4 min-w-[200px] animate-in fade-in zoom-in duration-200">
                <LoadingSpinner size="lg" />
                <p className="text-gray-700 font-medium text-lg animate-pulse">
                    {message}
                </p>
            </div>
        </div>
    );
}
