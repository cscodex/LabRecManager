import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Format date in Indian format (DD-MM-YYYY)
export function formatDateIST(date: Date | string): string {
    const d = new Date(date);
    return format(d, 'dd-MM-yyyy');
}

// Format time in Indian format (hh:mm AM/PM IST)
export function formatTimeIST(date: Date | string): string {
    const d = new Date(date);
    return format(d, 'hh:mm a');
}

// Format full datetime
export function formatDateTimeIST(date: Date | string): string {
    const d = new Date(date);
    return format(d, 'dd-MM-yyyy hh:mm a');
}

// Format timer display (HH:MM:SS)
export function formatTimer(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Get multilingual text
export function getText(json: Record<string, string> | null | undefined, lang: 'en' | 'pa' = 'en'): string {
    if (!json) return '';
    return json[lang] || json['en'] || '';
}

// Check if exam is currently active
export function isExamActive(startTime: string | Date, endTime: string | Date): boolean {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    return now >= start && now <= end;
}

// Check if exam has ended
export function hasExamEnded(endTime: string | Date): boolean {
    return new Date() > new Date(endTime);
}

// Question status colors for JEE-style UI
export const questionStatusColors = {
    notVisited: 'bg-gray-200 text-gray-600',
    notAnswered: 'bg-red-500 text-white',
    answered: 'bg-green-500 text-white',
    markedForReview: 'bg-purple-500 text-white',
    answeredAndMarked: 'bg-purple-500 text-white ring-2 ring-green-400',
};
