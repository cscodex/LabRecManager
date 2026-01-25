'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, Clock, FileText, BookOpen, Globe,
    CheckCircle, Edit, Eye, ChevronDown, ChevronUp
} from 'lucide-react';

interface Option {
    id: string;
    text: Record<string, string>;
    image_url?: string;
}

interface Question {
    id: string;
    type: string;
    text: Record<string, string>;
    options: Option[] | null;
    correct_answer: string[];
    explanation: Record<string, string> | null;
    marks: number;
    negative_marks: number | null;
    order: number;
    image_url?: string;
    paragraph_text?: Record<string, string> | null;
    parent_id?: string | null;
}

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
    duration: number | null;
    questions: Question[];
}

interface Exam {
    id: string;
    title: Record<string, string>;
    description: Record<string, string> | null;
    instructions: Record<string, string> | null;
    duration: number;
    total_marks: number;
    passing_marks: number | null;
    negative_marking: number | null;
    shuffle_questions: boolean;
    status: string;
    sections: Section[];
}

export default function ViewExamPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.id as string;
    const { language, setLanguage } = useAuthStore();

    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadExam();
    }, [examId]);

    const loadExam = async () => {
        try {
            const examRes = await fetch(`/api/admin/exams/${examId}`);
            const examData = await examRes.json();

            if (!examData.success) {
                throw new Error('Failed to load exam');
            }

            // Load questions for each section
            const sectionsWithQuestions = await Promise.all(
                examData.exam.sections.map(async (section: any) => {
                    const qRes = await fetch(`/api/admin/exams/${examId}/sections/${section.id}/questions`);
                    const qData = await qRes.json();
                    return {
                        ...section,
                        questions: qData.success ? qData.questions : [],
                    };
                })
            );

            setExam({
                ...examData.exam,
                sections: sectionsWithQuestions,
            });

            // Expand first section by default
            if (sectionsWithQuestions.length > 0) {
                setExpandedSections(new Set([sectionsWithQuestions[0].id]));
            }
        } catch (error) {
            console.error('Error loading exam:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };

    const toggleExplanation = (questionId: string) => {
        setExpandedExplanations(prev => {
            const next = new Set(prev);
            if (next.has(questionId)) {
                next.delete(questionId);
            } else {
                next.add(questionId);
            }
            return next;
        });
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-600',
            published: 'bg-green-100 text-green-600',
            archived: 'bg-red-100 text-red-600',
        };
        return (
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status] || styles.draft}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const getQuestionTypeBadge = (type: string) => {
        const labels: Record<string, { label: string; class: string }> = {
            mcq_single: { label: 'Single Choice', class: 'bg-blue-100 text-blue-700' },
            mcq_multiple: { label: 'Multiple Choice', class: 'bg-purple-100 text-purple-700' },
            fill_blank: { label: 'Fill in Blank', class: 'bg-orange-100 text-orange-700' },
        };
        const info = labels[type] || { label: type, class: 'bg-gray-100 text-gray-700' };
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${info.class}`}>
                {info.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Exam not found</p>
            </div>
        );
    }

    const totalQuestions = exam.sections.reduce((sum, s) => sum + s.questions.length, 0);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/admin/exams" className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-bold text-gray-900">
                                        {getText(exam.title, language)}
                                    </h1>
                                    {getStatusBadge(exam.status)}
                                </div>
                                <p className="text-sm text-gray-500">
                                    {exam.sections.length} sections • {totalQuestions} questions • {exam.duration} min
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                            >
                                <Globe className="w-4 h-4" />
                                {language === 'en' ? 'EN' : 'ਪੰ'}
                            </button>
                            <Link
                                href={`/admin/exams/${examId}/preview`}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                <Eye className="w-4 h-4" />
                                Student Preview
                            </Link>
                            <Link
                                href={`/admin/exams/${examId}`}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                <Edit className="w-4 h-4" />
                                Edit
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Exam Details Card */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                        Exam Details
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 rounded-lg p-4">
                            <p className="text-sm text-blue-600">Duration</p>
                            <p className="text-2xl font-bold text-blue-900">{exam.duration} min</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                            <p className="text-sm text-green-600">Total Marks</p>
                            <p className="text-2xl font-bold text-green-900">{exam.total_marks}</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                            <p className="text-sm text-purple-600">Passing Marks</p>
                            <p className="text-2xl font-bold text-purple-900">{exam.passing_marks || '-'}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg p-4">
                            <p className="text-sm text-red-600">Negative Marking</p>
                            <p className="text-2xl font-bold text-red-900">{exam.negative_marking || 'No'}</p>
                        </div>
                    </div>

                    {exam.description && (
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
                            <p className="text-gray-600">{getText(exam.description, language)}</p>
                        </div>
                    )}

                    {exam.instructions && (exam.instructions.en || exam.instructions.pa) && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-1">Instructions</h3>
                            <div
                                className="text-gray-600 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: getText(exam.instructions, language) }}
                            />
                        </div>
                    )}

                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                        <span className={`w-3 h-3 rounded-full ${exam.shuffle_questions ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        {exam.shuffle_questions ? 'Questions will be shuffled' : 'Questions in fixed order'}
                    </div>
                </div>

                {/* Sections and Questions */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Sections & Questions
                    </h2>

                    {exam.sections.sort((a, b) => a.order - b.order).map((section) => (
                        <div key={section.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                            {/* Section Header */}
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                                        {section.order}
                                    </span>
                                    <div className="text-left">
                                        <h3 className="font-semibold text-gray-900">{getText(section.name, language)}</h3>
                                        <p className="text-sm text-gray-500">
                                            {section.questions.length} questions
                                            {section.duration && ` • ${section.duration} min`}
                                        </p>
                                    </div>
                                </div>
                                {expandedSections.has(section.id) ? (
                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                            </button>

                            {/* Questions */}
                            {expandedSections.has(section.id) && (
                                <div className="divide-y">
                                    {section.questions.sort((a, b) => a.order - b.order).map((question, qIdx) => (
                                        <div key={question.id} className="p-6">
                                            {/* Question Header */}
                                            <div className="flex items-start gap-4 mb-4">
                                                <span className="w-8 h-8 bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                    {qIdx + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {getQuestionTypeBadge(question.type)}
                                                        <span className="text-sm text-gray-500">
                                                            +{question.marks} marks
                                                            {question.negative_marks && (
                                                                <span className="text-red-500 ml-1">-{question.negative_marks}</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-900">{getText(question.text, language)}</p>

                                                    {/* Paragraph content for paragraph-type questions */}
                                                    {question.type === 'paragraph' && question.paragraph_text && (
                                                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                            <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wider">📖 Passage Content</p>
                                                            <div
                                                                className="text-gray-700 prose prose-sm max-w-none"
                                                                dangerouslySetInnerHTML={{ __html: getText(question.paragraph_text, language) }}
                                                            />
                                                        </div>
                                                    )}

                                                    {question.image_url && (
                                                        <img
                                                            src={question.image_url}
                                                            alt="Question"
                                                            className="mt-2 max-w-md rounded-lg border"
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Options or Fill Blank Answer */}
                                            {question.type === 'fill_blank' ? (
                                                <div className="ml-12 bg-green-50 border border-green-200 rounded-lg p-3">
                                                    <p className="text-sm text-green-700">
                                                        <strong>Correct Answer(s):</strong> {question.correct_answer.join(', ')}
                                                    </p>
                                                </div>
                                            ) : question.options && (
                                                <div className="ml-12 space-y-2">
                                                    {question.options.map((opt) => {
                                                        const isCorrect = question.correct_answer.includes(opt.id);
                                                        return (
                                                            <div
                                                                key={opt.id}
                                                                className={`flex items-center gap-3 p-3 rounded-lg border ${isCorrect
                                                                    ? 'bg-green-50 border-green-300'
                                                                    : 'bg-white border-gray-200'
                                                                    }`}
                                                            >
                                                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${isCorrect
                                                                    ? 'bg-green-500 text-white'
                                                                    : 'bg-gray-200 text-gray-600'
                                                                    }`}>
                                                                    {opt.id.toUpperCase()}
                                                                </span>
                                                                <span className="flex-1 text-gray-800">
                                                                    {getText(opt.text, language)}
                                                                </span>
                                                                {opt.image_url && (
                                                                    <img src={opt.image_url} alt="" className="max-h-12 rounded" />
                                                                )}
                                                                {isCorrect && (
                                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Explanation */}
                                            {question.explanation && (question.explanation.en || question.explanation.pa) && (
                                                <div className="ml-12 mt-3">
                                                    <button
                                                        onClick={() => toggleExplanation(question.id)}
                                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        {expandedExplanations.has(question.id) ? 'Hide' : 'Show'} Explanation
                                                        {expandedExplanations.has(question.id) ? (
                                                            <ChevronUp className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    {expandedExplanations.has(question.id) && (
                                                        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                            <p className="text-sm text-blue-800 italic whitespace-pre-wrap">
                                                                {getText(question.explanation, language)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {section.questions.length === 0 && (
                                        <div className="p-6 text-center text-gray-400">
                                            No questions in this section
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
