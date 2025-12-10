'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PageHeader({ title, titleHindi, backLink, children }) {
    return (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 lg:px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {backLink && (
                        <Link
                            href={backLink}
                            className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                    )}
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
                        {titleHindi && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">{titleHindi}</p>
                        )}
                    </div>
                </div>
                {children && (
                    <div className="flex items-center gap-3">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
