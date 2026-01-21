'use client';

import { useTranslation } from '@/lib/useTranslation';
import { Globe } from 'lucide-react';

interface LanguageToggleProps {
    variant?: 'button' | 'dropdown';
    className?: string;
}

export function LanguageToggle({ variant = 'button', className = '' }: LanguageToggleProps) {
    const { language, toggleLanguage } = useTranslation();

    if (variant === 'button') {
        return (
            <button
                onClick={toggleLanguage}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors ${className}`}
                title={language === 'en' ? 'Switch to Punjabi' : 'Switch to English'}
            >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">
                    {language === 'en' ? 'EN' : 'ਪੰ'}
                </span>
            </button>
        );
    }

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                title={language === 'en' ? 'Switch to Punjabi' : 'Switch to English'}
            >
                <Globe className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                    {language === 'en' ? 'English' : 'ਪੰਜਾਬੀ'}
                </span>
            </button>
        </div>
    );
}
