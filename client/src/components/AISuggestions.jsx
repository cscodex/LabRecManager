'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Wand2, ChevronDown, ChevronUp, Code, Beaker, Loader2, Check } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AISuggestions({ subjectId, onSelectSuggestion }) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [languages, setLanguages] = useState([]);
    const [selectedLanguage, setSelectedLanguage] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState('');
    const [selectedSuggestion, setSelectedSuggestion] = useState(null);

    useEffect(() => {
        loadLanguages();
    }, []);

    useEffect(() => {
        if (isOpen && !suggestions.length) {
            loadSuggestions();
        }
    }, [isOpen, selectedLanguage, selectedDifficulty, subjectId]);

    const loadLanguages = async () => {
        try {
            const res = await api.get('/ai/programming-languages');
            setLanguages(res.data.data.languages || []);
        } catch (error) {
            console.error('Failed to load languages:', error);
        }
    };

    const loadSuggestions = async () => {
        setLoading(true);
        try {
            const params = {
                count: 10,
                ...(subjectId && { subjectId }),
                ...(selectedLanguage && { programmingLanguage: selectedLanguage }),
                ...(selectedDifficulty && { difficulty: selectedDifficulty })
            };
            const res = await api.get('/ai/practical-suggestions', { params });
            setSuggestions(res.data.data.suggestions || []);
        } catch (error) {
            console.error('Failed to load suggestions:', error);
            toast.error('Failed to load AI suggestions');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSuggestion = async (suggestion) => {
        setSelectedSuggestion(suggestion);

        // Optionally generate more details
        try {
            const res = await api.post('/ai/generate-aim', {
                title: suggestion.title,
                programmingLanguage: suggestion.programmingLanguage,
                description: suggestion.description
            });

            const enhanced = {
                title: suggestion.title,
                description: suggestion.description,
                experimentNumber: suggestion.experimentNumber,
                programmingLanguage: suggestion.programmingLanguage,
                ...res.data.data
            };

            onSelectSuggestion?.(enhanced);
            toast.success('AI suggestion applied!');
        } catch (error) {
            // Use basic suggestion if AI generation fails
            onSelectSuggestion?.(suggestion);
        }
    };

    const getDifficultyBadge = (difficulty) => {
        const badges = {
            easy: 'bg-emerald-100 text-emerald-700',
            medium: 'bg-amber-100 text-amber-700',
            hard: 'bg-red-100 text-red-700'
        };
        return badges[difficulty] || 'bg-slate-100 text-slate-700';
    };

    const getCategoryIcon = (category) => {
        if (['physics', 'chemistry', 'biology'].includes(category)) {
            return <Beaker className="w-4 h-4" />;
        }
        return <Code className="w-4 h-4" />;
    };

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Header Toggle */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 transition"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                        <h4 className="font-semibold text-slate-900">AI Practical Suggestions</h4>
                        <p className="text-sm text-slate-500">Get AI-powered recommendations for practicals</p>
                    </div>
                </div>
                {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
            </button>

            {/* Content */}
            {isOpen && (
                <div className="p-4 border-t border-slate-200 bg-white">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <select
                            value={selectedLanguage}
                            onChange={(e) => {
                                setSelectedLanguage(e.target.value);
                                setSuggestions([]);
                            }}
                            className="input py-2 text-sm flex-1 min-w-[150px]"
                        >
                            <option value="">All Languages/Subjects</option>
                            {languages.map(lang => (
                                <option key={lang.value} value={lang.value}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedDifficulty}
                            onChange={(e) => {
                                setSelectedDifficulty(e.target.value);
                                setSuggestions([]);
                            }}
                            className="input py-2 text-sm w-32"
                        >
                            <option value="">All Levels</option>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>

                        <button
                            type="button"
                            onClick={loadSuggestions}
                            disabled={loading}
                            className="btn btn-ghost text-sm"
                        >
                            <Wand2 className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>

                    {/* Suggestions List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <Sparkles className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p>No suggestions available. Try selecting a different subject or language.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 max-h-80 overflow-y-auto">
                            {suggestions.map((suggestion, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                    className={`p-4 border rounded-xl cursor-pointer transition hover:border-violet-300 hover:bg-violet-50
                                        ${selectedSuggestion?.title === suggestion.title ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono text-slate-400">
                                                    {suggestion.experimentNumber}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyBadge(suggestion.difficulty)}`}>
                                                    {suggestion.difficulty}
                                                </span>
                                            </div>
                                            <h5 className="font-medium text-slate-900">{suggestion.title}</h5>
                                            <p className="text-sm text-slate-500 mt-1">{suggestion.description}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {getCategoryIcon(suggestion.programmingLanguage)}
                                                <span className="text-xs text-slate-400">
                                                    {suggestion.programmingLanguage?.toUpperCase()} • {suggestion.estimatedTime}
                                                </span>
                                            </div>
                                        </div>
                                        {selectedSuggestion?.title === suggestion.title && (
                                            <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        Suggestions are based on subject and programming language. Click to apply.
                    </div>
                </div>
            )}
        </div>
    );
}
