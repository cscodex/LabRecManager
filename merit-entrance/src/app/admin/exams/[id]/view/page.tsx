'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, Clock, FileText, BookOpen, Globe,
    CheckCircle, Edit, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import Image from 'next/image';
import { MathText } from '@/components/MathText';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';

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
    difficulty: number;
    order: number;
    image_url?: string;
    paragraph_text?: Record<string, string> | null;
    parent_id?: string | null;
    tags?: { id: string; name: string }[];
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
    source_pdf_url?: string;
}

export default function ViewExamPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.id as string;
    const { language, setLanguage } = useAuthStore();

    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [instructionsOpen, setInstructionsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'sections' | 'original_pdf'>('sections');

    const loadExam = useCallback(async () => {
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

            // Select first section by default
            if (sectionsWithQuestions.length > 0) {
                setActiveSectionId(sectionsWithQuestions[0].id);
            }
        } catch (error) {
            console.error('Error loading exam:', error);
        } finally {
            setLoading(false);
        }
    }, [examId]);

    useEffect(() => {
        loadExam();
    }, [loadExam]);

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
            paragraph: { label: 'Paragraph', class: 'bg-teal-100 text-teal-700' },
        };
        const info = labels[type] || { label: type, class: 'bg-gray-100 text-gray-700' };
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${info.class}`}>
                {info.label}
            </span>
        );
    };

    const getDifficultyBadge = (difficulty: number) => {
        const styles: Record<number, string> = {
            1: 'bg-green-100 text-green-700',
            2: 'bg-green-50 text-green-600',
            3: 'bg-yellow-100 text-yellow-700',
            4: 'bg-orange-100 text-orange-700',
            5: 'bg-red-100 text-red-700',
        };
        return (
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[difficulty] || 'bg-gray-100 text-gray-700'}`}>
                Level {difficulty}
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
        <MathJaxProvider>
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
                                <p className="text-gray-600">
                                    <MathText text={getText(exam.description, language)} />
                                </p>
                            </div>
                        )}

                        {/* Collapsible Instructions */}
                        {exam.instructions && (exam.instructions.en || exam.instructions.pa) && (
                            <div className="border rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setInstructionsOpen(!instructionsOpen)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                >
                                    <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-gray-500" />
                                        Instructions
                                    </h3>
                                    {instructionsOpen ? (
                                        <ChevronUp className="w-4 h-4 text-gray-500" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                    )}
                                </button>
                                {instructionsOpen && (
                                    <div className="px-4 py-3 border-t">
                                        <div
                                            className="text-gray-600 prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: getText(exam.instructions, language) }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                            <span className={`w-3 h-3 rounded-full ${exam.shuffle_questions ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            {exam.shuffle_questions ? 'Questions will be shuffled' : 'Questions in fixed order'}
                        </div>
                    </div>

                    {/* Main Tabs */}
                    {exam.source_pdf_url && (
                        <div className="flex gap-1 border-b border-gray-200">
                            <button
                                onClick={() => setActiveTab('sections')}
                                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sections' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                Sections & Questions
                            </button>
                            <button
                                onClick={() => setActiveTab('original_pdf')}
                                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'original_pdf' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                <FileText className="w-4 h-4" /> Original PDF
                            </button>
                        </div>
                    )}

                    {activeTab === 'sections' ? (
                        <div className="space-y-4">
                            {!exam.source_pdf_url && (
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    Sections & Questions
                                </h2>
                            )}

                            {/* Tab Bar */}
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {exam.sections.sort((a, b) => a.order - b.order).map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => setActiveSectionId(section.id)}
                                        className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${activeSectionId === section.id
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        {getText(section.name, language)}
                                        <span className="ml-2 px-1.5 py-0.5 bg-black/10 rounded text-xs opacity-80">
                                            {section.questions.length}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Active Section Content */}
                            {(() => {
                                const activeSection = exam.sections.find(s => s.id === activeSectionId);
                                if (!activeSection) return null;
                                return (
                                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                        {/* Section Info Bar */}
                                        <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                                                    {activeSection.order}
                                                </span>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{getText(activeSection.name, language)}</h3>
                                                    <p className="text-xs text-gray-500">
                                                        {activeSection.questions.length} questions
                                                        {activeSection.duration && ` • ${activeSection.duration} min`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Questions List */}
                                        <div className="divide-y">
                                            {activeSection.questions.sort((a, b) => a.order - b.order).map((question, qIdx) => (
                                                <div key={question.id} className="p-6">
                                                    {/* Question Header */}
                                                    <div className="flex items-start gap-4 mb-4">
                                                        <span className="w-8 h-8 bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                            {qIdx + 1}
                                                        </span>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                {getQuestionTypeBadge(question.type)}
                                                                {getDifficultyBadge(question.difficulty)}
                                                                <span className="text-sm text-gray-500">
                                                                    +{question.marks} marks
                                                                    {question.negative_marks && (
                                                                        <span className="text-red-500 ml-1">-{question.negative_marks}</span>
                                                                    )}
                                                                </span>
                                                                {question.tags && question.tags.length > 0 && (
                                                                    <div className="flex items-center gap-1 ml-2">
                                                                        {question.tags.map(tag => (
                                                                            <span key={tag.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] border border-gray-200">
                                                                                {tag.name}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-gray-900">
                                                                <MathText text={getText(question.text, language)} />
                                                            </div>

                                                            {/* Paragraph content */}
                                                            {question.type === 'paragraph' && question.paragraph_text && (
                                                                <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg max-h-80 overflow-y-auto">
                                                                    <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wider sticky top-0 bg-blue-50 pb-1">📖 Passage Content</p>
                                                                    <div className="text-gray-700 prose prose-sm max-w-none whitespace-pre-wrap break-words">
                                                                        <MathText text={getText(question.paragraph_text, language)} />
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {question.image_url && (
                                                                <div className="relative h-40 w-full mb-4">
                                                                    <Image
                                                                        src={question.image_url}
                                                                        alt="Question"
                                                                        fill
                                                                        className="object-contain rounded border"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Options or Fill Blank Answer */}
                                                    {question.type === 'fill_blank' ? (
                                                        <div className="ml-12 bg-green-50 border border-green-200 rounded-lg p-3">
                                                            <p className="text-sm text-green-700">
                                                                <strong>Correct Answer(s):</strong>{' '}
                                                                <MathText text={question.correct_answer.join(', ')} inline />
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
                                                                            <MathText text={getText(opt.text, language)} inline />
                                                                        </span>
                                                                        {opt.image_url && (
                                                                            <div className="relative h-12 w-auto">
                                                                                <Image
                                                                                    src={opt.image_url}
                                                                                    alt=""
                                                                                    width={100}
                                                                                    height={48}
                                                                                    className="max-h-12 w-auto rounded object-contain"
                                                                                />
                                                                            </div>
                                                                        )}
                                                                        {isCorrect && (
                                                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Explanation - Always Visible */}
                                                    {question.explanation && (question.explanation.en || question.explanation.pa) && (
                                                        <div className="ml-12 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                            <p className="text-xs font-semibold text-blue-600 mb-1">Explanation</p>
                                                            <div className="text-sm text-blue-800 whitespace-pre-wrap">
                                                                <MathText text={getText(question.explanation, language)} />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {activeSection.questions.length === 0 && (
                                                <div className="p-6 text-center text-gray-400">
                                                    No questions in this section
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm p-4 w-full h-[800px]">
                            <iframe src={exam.source_pdf_url} className="w-full h-full rounded-lg" title="Original PDF" />
                        </div>
                    )}
                </main>
            </div>
        </MathJaxProvider>
    );
}
