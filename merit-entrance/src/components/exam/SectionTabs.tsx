'use client';

import { cn, getText } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
}

interface SectionTabsProps {
    sections: Section[];
    currentSectionId: string;
    onSectionChange: (sectionId: string) => void;
}

export default function SectionTabs({ sections, currentSectionId, onSectionChange }: SectionTabsProps) {
    const { language } = useAuthStore();

    return (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            {sections.map((section) => (
                <button
                    key={section.id}
                    onClick={() => onSectionChange(section.id)}
                    className={cn(
                        'px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all',
                        currentSectionId === section.id
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                >
                    {getText(section.name, language)}
                </button>
            ))}
        </div>
    );
}
