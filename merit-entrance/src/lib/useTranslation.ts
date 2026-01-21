'use client';

import { useAuthStore } from '@/lib/store';
import { useCallback, useEffect, useState } from 'react';

// Type definitions for translations
type TranslationValue = string | TranslationObject;
interface TranslationObject {
    [key: string]: TranslationValue;
}
type Translations = TranslationObject;

// Cache for loaded translations
const translationCache: Record<string, Translations> = {};

// Load translations for a given language
async function loadTranslations(lang: 'en' | 'pa'): Promise<Translations> {
    if (translationCache[lang]) {
        return translationCache[lang];
    }

    try {
        const response = await fetch(`/locales/${lang}/common.json`);
        if (!response.ok) {
            console.error(`Failed to load translations for ${lang}`);
            return {};
        }
        const translations = await response.json();
        translationCache[lang] = translations;
        return translations;
    } catch (error) {
        console.error(`Error loading translations for ${lang}:`, error);
        return {};
    }
}

// Get nested value from object using dot notation
function getNestedValue(obj: TranslationObject, path: string): string {
    const keys = path.split('.');
    let current: TranslationValue = obj;

    for (const key of keys) {
        if (typeof current !== 'object' || current === null) {
            return path; // Return the key if path is invalid
        }
        current = (current as TranslationObject)[key];
        if (current === undefined) {
            return path; // Return the key if not found
        }
    }

    return typeof current === 'string' ? current : path;
}

// Hook for using translations
export function useTranslation() {
    const { language, setLanguage } = useAuthStore();
    const [translations, setTranslations] = useState<Translations>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        loadTranslations(language).then((t) => {
            setTranslations(t);
            setIsLoading(false);
        });
    }, [language]);

    // Translation function
    const t = useCallback(
        (key: string, fallback?: string): string => {
            if (Object.keys(translations).length === 0) {
                return fallback || key;
            }
            const value = getNestedValue(translations, key);
            return value === key && fallback ? fallback : value;
        },
        [translations]
    );

    // Toggle between languages
    const toggleLanguage = useCallback(() => {
        setLanguage(language === 'en' ? 'pa' : 'en');
    }, [language, setLanguage]);

    return {
        t,
        language,
        setLanguage,
        toggleLanguage,
        isLoading,
    };
}

// Helper to get localized content from JSON fields in database
export function getLocalizedContent(
    content: Record<string, string> | string | null | undefined,
    language: 'en' | 'pa'
): string {
    if (!content) return '';
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            return parsed[language] || parsed['en'] || '';
        } catch {
            return content;
        }
    }
    return content[language] || content['en'] || '';
}
