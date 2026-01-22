'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, Download, Upload, FileSpreadsheet, Globe,
    CheckCircle, AlertCircle, X, FileText, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
}

interface ImportedQuestion {
    row: number;
    type: string;
    textEn: string;
    textPa: string;
    optionAEn?: string;
    optionAPa?: string;
    optionBEn?: string;
    optionBPa?: string;
    optionCEn?: string;
    optionCPa?: string;
    optionDEn?: string;
    optionDPa?: string;
    correctAnswer: string;
    marks: number;
    negativeMarks: number;
    explanationEn?: string;
    explanationPa?: string;
    error?: string;
}

export default function ImportQuestionsPage() {
    const params = useParams();
    const examId = params.id as string;
    const { language } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [sections, setSections] = useState<Section[]>([]);
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [importLanguage, setImportLanguage] = useState<'both' | 'en' | 'pa'>('both');

    useEffect(() => {
        loadSections();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [examId]);

    const loadSections = async () => {
        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections`);
            const data = await response.json();
            if (data.success) {
                setSections(data.sections);
                if (data.sections.length > 0) {
                    setSelectedSection(data.sections[0].id);
                }
            }
        } catch (error) {
            toast.error('Failed to load sections');
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        // Create CSV template
        const headers = [
            'Type (mcq_single/mcq_multiple/fill_blank)',
            'Question (English)',
            'Question (Punjabi)',
            'Option A (English)',
            'Option A (Punjabi)',
            'Option B (English)',
            'Option B (Punjabi)',
            'Option C (English)',
            'Option C (Punjabi)',
            'Option D (English)',
            'Option D (Punjabi)',
            'Correct Answer (a/b/c/d or a,b for multiple)',
            'Marks',
            'Negative Marks',
            'Explanation (English)',
            'Explanation (Punjabi)'
        ];

        const sampleRow = [
            'mcq_single',
            'What is 2 + 2?',
            '2 + 2 ਕੀ ਹੈ?',
            '3',
            '3',
            '4',
            '4',
            '5',
            '5',
            '6',
            '6',
            'b',
            '4',
            '1',
            'The sum of 2 and 2 is 4',
            '2 ਅਤੇ 2 ਦਾ ਜੋੜ 4 ਹੈ'
        ];

        const csvContent = [
            headers.join(','),
            sampleRow.map(cell => `"${cell}"`).join(',')
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'question_import_template.csv';
        link.click();
        toast.success('Template downloaded!');
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            parseCSV(text);
        };
        reader.readAsText(file);
    };

    const parseCSV = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            toast.error('File is empty or has no data rows');
            return;
        }

        // Skip header row
        const dataRows = lines.slice(1);
        const questions: ImportedQuestion[] = [];

        dataRows.forEach((line, index) => {
            // Parse CSV properly handling quoted fields
            const cells: string[] = [];
            let currentCell = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    cells.push(currentCell.trim());
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            cells.push(currentCell.trim());

            const question: ImportedQuestion = {
                row: index + 2,
                type: (cells[0] || 'mcq_single').toLowerCase(),
                textEn: cells[1] || '',
                textPa: cells[2] || '',
                optionAEn: cells[3],
                optionAPa: cells[4],
                optionBEn: cells[5],
                optionBPa: cells[6],
                optionCEn: cells[7],
                optionCPa: cells[8],
                optionDEn: cells[9],
                optionDPa: cells[10],
                correctAnswer: (cells[11] || '').toLowerCase(),
                marks: parseInt(cells[12]) || 4,
                negativeMarks: parseInt(cells[13]) || 0,
                explanationEn: cells[14],
                explanationPa: cells[15],
            };

            // Validate
            if (!question.textEn && !question.textPa) {
                question.error = 'Question text is required';
            } else if (!['mcq_single', 'mcq_multiple', 'fill_blank'].includes(question.type)) {
                question.error = 'Invalid question type';
            } else if (question.type !== 'fill_blank' && !question.correctAnswer) {
                question.error = 'Correct answer is required';
            }

            questions.push(question);
        });

        setParsedQuestions(questions);
        setShowPreview(true);
    };

    const handleImport = async () => {
        if (!selectedSection) {
            toast.error('Please select a section');
            return;
        }

        const validQuestions = parsedQuestions.filter(q => !q.error);
        if (validQuestions.length === 0) {
            toast.error('No valid questions to import');
            return;
        }

        setImporting(true);
        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections/${selectedSection}/questions/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questions: validQuestions,
                    language: importLanguage
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(`Successfully imported ${data.imported} questions!`);
                setParsedQuestions([]);
                setShowPreview(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } else {
                toast.error(data.error || 'Import failed');
            }
        } catch (error) {
            toast.error('Failed to import questions');
        } finally {
            setImporting(false);
        }
    };

    const removeQuestion = (index: number) => {
        setParsedQuestions(prev => prev.filter((_, i) => i !== index));
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href={`/admin/exams/${examId}`} className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Import Questions</h1>
                                <p className="text-sm text-gray-500">Bulk import questions from CSV file</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Step 1: Download Template */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-bold">1</span>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">Download Template</h2>
                            <p className="text-gray-600 mb-4">
                                Download the CSV template and fill in your questions. The template includes sample data
                                and supports both English and Punjabi content.
                            </p>
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                <Download className="w-4 h-4" />
                                Download Template
                            </button>
                        </div>
                    </div>
                </div>

                {/* Step 2: Select Section & Language */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-bold">2</span>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Section & Language</h2>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Target Section
                                    </label>
                                    <select
                                        value={selectedSection}
                                        onChange={(e) => setSelectedSection(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        {sections.map(section => (
                                            <option key={section.id} value={section.id}>
                                                {getText(section.name, language)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Globe className="w-4 h-4 inline mr-1" />
                                        Import Language
                                    </label>
                                    <select
                                        value={importLanguage}
                                        onChange={(e) => setImportLanguage(e.target.value as 'both' | 'en' | 'pa')}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        <option value="both">Both English & Punjabi</option>
                                        <option value="en">English Only</option>
                                        <option value="pa">Punjabi Only</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Choose which language columns to import from CSV
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 3: Upload File */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-bold">3</span>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload CSV File</h2>
                            <p className="text-gray-600 mb-4">
                                Select your filled CSV file to preview and import questions.
                            </p>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
                            >
                                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-600 mb-1">Click to upload or drag and drop</p>
                                <p className="text-sm text-gray-400">CSV files only</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>
                    </div>
                </div>

                {/* Preview & Import */}
                {showPreview && parsedQuestions.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">
                                Preview ({parsedQuestions.length} questions)
                            </h2>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-sm text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    {parsedQuestions.filter(q => !q.error).length} valid
                                </span>
                                {parsedQuestions.some(q => q.error) && (
                                    <span className="flex items-center gap-1 text-sm text-red-600">
                                        <AlertCircle className="w-4 h-4" />
                                        {parsedQuestions.filter(q => q.error).length} errors
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left">#</th>
                                        <th className="px-3 py-2 text-left">Type</th>
                                        <th className="px-3 py-2 text-left">Question (EN)</th>
                                        <th className="px-3 py-2 text-left">Answer</th>
                                        <th className="px-3 py-2 text-left">Marks</th>
                                        <th className="px-3 py-2 text-left">Status</th>
                                        <th className="px-3 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {parsedQuestions.map((q, idx) => (
                                        <tr key={idx} className={q.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                            <td className="px-3 py-2">{q.row}</td>
                                            <td className="px-3 py-2">
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                    {q.type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 max-w-xs truncate">{q.textEn}</td>
                                            <td className="px-3 py-2 font-mono">{q.correctAnswer}</td>
                                            <td className="px-3 py-2">{q.marks}</td>
                                            <td className="px-3 py-2">
                                                {q.error ? (
                                                    <span className="text-red-600 text-xs">{q.error}</span>
                                                ) : (
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={() => removeQuestion(idx)}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setParsedQuestions([]);
                                    setShowPreview(false);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={importing || parsedQuestions.filter(q => !q.error).length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4" />
                                        Import {parsedQuestions.filter(q => !q.error).length} Questions
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Help Section */}
                <div className="bg-blue-50 rounded-xl p-6">
                    <h3 className="font-semibold text-blue-900 mb-3">
                        <FileText className="w-5 h-5 inline mr-2" />
                        Template Guide
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
                        <div>
                            <p className="font-medium mb-1">Question Types:</p>
                            <ul className="list-disc list-inside space-y-1 text-blue-700">
                                <li><code className="bg-blue-100 px-1 rounded">mcq_single</code> - Single correct answer</li>
                                <li><code className="bg-blue-100 px-1 rounded">mcq_multiple</code> - Multiple correct answers</li>
                                <li><code className="bg-blue-100 px-1 rounded">fill_blank</code> - Fill in the blank</li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-medium mb-1">Correct Answer Format:</p>
                            <ul className="list-disc list-inside space-y-1 text-blue-700">
                                <li>Single: <code className="bg-blue-100 px-1 rounded">a</code>, <code className="bg-blue-100 px-1 rounded">b</code>, <code className="bg-blue-100 px-1 rounded">c</code>, or <code className="bg-blue-100 px-1 rounded">d</code></li>
                                <li>Multiple: <code className="bg-blue-100 px-1 rounded">a,b</code> or <code className="bg-blue-100 px-1 rounded">a,c,d</code></li>
                                <li>Fill blank: The exact answer text</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
