'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Plus, Check, CheckSquare } from 'lucide-react';
import { MathText } from '@/components/MathText';
import { getText } from '@/lib/utils';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';
import toast from 'react-hot-toast';

interface Question {
    id: string;
    type: string;
    text: Record<string, string>;
    marks: number;
    difficulty: number;
    tags: { id: string; name: string }[];
    options?: { id: string; text: Record<string, string> }[];
    correct_answer?: any;
}

interface QuestionBankPickerProps {
    onImport: (selectedIds: string[]) => Promise<void>;
    excludeIds?: string[]; // IDs to exclude (already in exam - fallback)
    excludeQuestions?: Question[]; // Check by content for clones
    onCancel: () => void;
}

export default function QuestionBankPicker({ onImport, excludeIds = [], excludeQuestions = [], onCancel }: QuestionBankPickerProps) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [tags, setTags] = useState<{ id: string, name: string }[]>([]);

    // Filters
    const [search, setSearch] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    // ... loadTags ...
    const loadTags = async () => {
        try {
            const res = await fetch('/api/admin/tags');
            const data = await res.json();
            if (data.success) setTags(data.tags);
        } catch (e) { console.error(e) }
    };

    const loadQuestions = useCallback(async (isLoadMore = false) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                search,
                tagId: selectedTag,
                excludeParegraphSubQuestions: 'true'
            });

            const res = await fetch(`/api/admin/questions?${params.toString()}`);
            const data = await res.json();

            if (data.success) {
                setQuestions(prev => isLoadMore ? [...prev, ...data.questions] : data.questions);
                setHasMore(data.pagination.page < data.pagination.totalPages);
            }
        } catch (error) {
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    }, [page, search, selectedTag]);

    useEffect(() => {
        loadTags();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadQuestions();
        }, 500);
        return () => clearTimeout(timer);
    }, [search, selectedTag, loadQuestions]);

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleImport = async () => {
        if (selectedIds.size === 0) {
            toast.error('Select questions to import');
            return;
        }
        await onImport(Array.from(selectedIds));
    };

    return (
        <div className="flex flex-col h-[70vh]">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        placeholder="Search questions..."
                        className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <select
                    className="px-3 py-2 border rounded-lg text-sm min-w-[150px]"
                    value={selectedTag}
                    onChange={e => { setSelectedTag(e.target.value); setPage(1); }}
                >
                    <option value="">All Tags</option>
                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto border rounded-xl bg-gray-50 p-2 space-y-2">
                {questions.map(q => {
                    const cleanText = (t: string) => t?.replace(/\s+/g, ' ').trim() || '';
                    const qTextEn = cleanText(getText(q.text, 'en'));

                    const isImported = excludeIds.includes(q.id) || excludeQuestions.some(eq => {
                        const eqTextEn = cleanText(getText(eq.text, 'en'));
                        return eq.type === q.type && eqTextEn && qTextEn && eqTextEn === qTextEn;
                    });

                    return (
                        <div
                            key={q.id}
                            onClick={() => !isImported && toggleSelection(q.id)}
                            className={`p-3 bg-white rounded-lg border transition-all ${isImported ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:shadow-sm'} ${selectedIds.has(q.id) ? 'border-l-4 border-l-blue-600 ring-1 ring-blue-100' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900 line-clamp-2">
                                        <MathJaxProvider>
                                            <MathText text={getText(q.text, 'en')} inline />
                                        </MathJaxProvider>
                                    </div>
                                    {/* Punjabi text if available */}
                                    {q.text?.pa && (
                                        <div className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                                            <MathJaxProvider>
                                                <MathText text={getText(q.text, 'pa')} inline />
                                            </MathJaxProvider>
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-2 items-center flex-wrap">
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{q.type}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${q.difficulty <= 2 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>Level {q.difficulty}</span>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{q.marks} marks</span>
                                        {q.tags.map(t => (
                                            <span key={t.id} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">{t.name}</span>
                                        ))}
                                    </div>
                                    {/* Options with both languages */}
                                    {q.options && q.options.length > 0 && (
                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                                            {q.options.map((opt: any, i: number) => {
                                                const isCorrect = Array.isArray(q.correct_answer)
                                                    ? q.correct_answer.includes(opt.id)
                                                    : q.correct_answer === opt.id;
                                                const enText = typeof opt.text === 'object' ? (opt.text.en || '') : String(opt.text || '');
                                                const paText = typeof opt.text === 'object' ? (opt.text.pa || '') : '';
                                                return (
                                                    <div key={opt.id || i} className={`text-xs px-2 py-1 rounded border flex items-center gap-1.5 ${isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                                                        <span className="font-bold opacity-60">{String.fromCharCode(65 + i)}.</span>
                                                        <span className="truncate">{enText}</span>
                                                        {paText && <span className="text-gray-400 truncate">| {paText}</span>}
                                                        {isCorrect && <CheckSquare className="w-3 h-3 ml-auto text-green-600 flex-shrink-0" />}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                    {/* Fill blank answer */}
                                    {q.type === 'fill_blank' && q.correct_answer && (
                                        <div className="mt-2">
                                            <span className="text-xs text-gray-500 mr-1">Answer:</span>
                                            <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded font-medium">
                                                {Array.isArray(q.correct_answer) ? q.correct_answer.join(', ') : String(q.correct_answer)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${selectedIds.has(q.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                    {selectedIds.has(q.id) && <Check className="w-3 h-3 text-white" />}
                                    {isImported && <span className="text-[10px] text-gray-400 font-bold">Added</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {questions.length === 0 && !loading && (
                    <div className="text-center py-10 text-gray-500 text-sm">No questions found</div>
                )}

                {/* Load More Button if needed, or infinite scroll */}
                {hasMore && (
                    <button
                        onClick={() => setPage(p => p + 1)}
                        className="w-full py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Load More'}
                    </button>
                )}
            </div>

            {/* Footer */}
            <div className="pt-4 mt-2 border-t flex justify-between items-center bg-white">
                <span className="text-sm text-gray-600">
                    {selectedIds.size} questions selected
                </span>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                    <button
                        onClick={handleImport}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                        Import Selected
                    </button>
                </div>
            </div>
        </div>
    );
}
