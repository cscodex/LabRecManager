'use client';

import { useEffect, useState } from 'react';
import { formatTimer } from '@/lib/utils';

interface TimerProps {
    initialSeconds: number;
    onTimeUp: () => void;
}

export default function Timer({ initialSeconds, onTimeUp }: TimerProps) {
    const [seconds, setSeconds] = useState(initialSeconds);

    // Call onTimeUp when timer reaches 0
    useEffect(() => {
        if (seconds <= 0) {
            onTimeUp();
        }
    }, [seconds, onTimeUp]);

    // Timer countdown - runs only once on mount
    useEffect(() => {

        const interval = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Color changes based on time remaining
    const getColorClass = () => {
        if (seconds <= 60) return 'text-red-600 animate-pulse'; // Last minute
        if (seconds <= 300) return 'text-red-500'; // Last 5 minutes
        if (seconds <= 600) return 'text-orange-500'; // Last 10 minutes
        return 'text-green-600';
    };

    return (
        <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`font-mono text-2xl font-bold ${getColorClass()}`}>
                {formatTimer(seconds)}
            </span>
        </div>
    );
}
