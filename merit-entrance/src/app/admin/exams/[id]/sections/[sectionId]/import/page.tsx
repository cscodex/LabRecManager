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
    parentRow?: number;
    tags?: string[];
    error?: string;
}

interface RowError {
    row: number;
    error: string;
}

export default function ImportQuestionsPage() {
    const params = useParams();
    const examId = params.id as string;
    const sectionId = params.sectionId as string;
    const { language } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [section, setSection] = useState<Section | null>(null);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [importLanguage, setImportLanguage] = useState<'both' | 'en' | 'pa'>('both');
    const [importErrors, setImportErrors] = useState<RowError[]>([]);

    useEffect(() => {
        loadSection();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [examId, sectionId]);

    const loadSection = async () => {
        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections`);
            const data = await response.json();
            if (data.success) {
                const sec = data.sections.find((s: Section) => s.id === sectionId);
                setSection(sec || null);
            }
        } catch (error) {
            toast.error('Failed to load section');
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const headers = [
            'Type',
            'Question_EN',
            'Question_PA',
            'OptionA_EN',
            'OptionA_PA',
            'OptionB_EN',
            'OptionB_PA',
            'OptionC_EN',
            'OptionC_PA',
            'OptionD_EN',
            'OptionD_PA',
            'CorrectAnswer',
            'Marks',
            'NegativeMarks',
            'Explanation_EN',
            'Explanation_PA',
            'ParentRow',
            'Tags (comma separated)'
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
            '2 ਅਤੇ 2 ਦਾ ਜੋੜ 4 ਹੈ',
            '', // ParentRow
            'Math,Addition,Basic'
        ];

        const sampleParagraph = [
            'paragraph',
            'Read the following passage and answer the questions below...',
            'ਹੇਠਾਂ ਦਿੱਤੇ ਪੈਰੇ ਨੂੰ ਪੜ੍ਹੋ ਅਤੇ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿਓ...',
            '', '', '', '', '', '', '', '',
            '', '0', '0', '', '',
            '', // ParentRow
            'Reading,Comprehension'
        ];

        const sampleSubQuestion = [
            'mcq_single',
            'Based on the passage, what is correct?',
            'ਪੈਰੇ ਦੇ ਆਧਾਰ ਤੇ, ਕੀ ਸਹੀ ਹੈ?',
            'Option A', 'ਵਿਕਲਪ A',
            'Option B', 'ਵਿਕਲਪ B',
            'Option C', 'ਵਿਕਲਪ C',
            'Option D', 'ਵਿਕਲਪ D',
            'a', '4', '1', '', '',
            '3', // ParentRow
            ''
        ];

        // Quote all cells to avoid comma issues
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            sampleRow.map(cell => `"${cell}"`).join(','),
            sampleParagraph.map(cell => `"${cell}"`).join(','),
            sampleSubQuestion.map(cell => `"${cell}"`).join(',')
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

    // Convert math notation: a^2 → a<sup>2</sup>, a^{10} → a<sup>10</sup>
    const formatMathText = (text: string | undefined): string => {
        if (!text) return '';

        let result = text
            .replace(/\^{([^}]+)}/g, '<sup>$1</sup>')
            .replace(/_{([^}]+)}/g, '<sub>$1</sub>')
            .replace(/\^\(([^)]+)\)/g, '<sup>$1</sup>')
            .replace(/_\(([^)]+)\)/g, '<sub>$1</sub>')
            .replace(/\^(\d+)/g, '<sup>$1</sup>')
            .replace(/\^([a-zA-Z])/g, '<sup>$1</sup>')
            .replace(/_(\d+)/g, '<sub>$1</sub>')
            .replace(/_([a-zA-Z])/g, '<sub>$1</sub>');

        return result;
    };

    const parseCSV = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            toast.error('File is empty or has no data rows');
            return;
        }

        const firstLine = lines[0];
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = tabCount > commaCount ? '\t' : ',';

        console.log(`Detected delimiter: ${delimiter === '\t' ? 'TAB' : 'COMMA'}`);

        const dataRows = lines.slice(1);
        const questions: ImportedQuestion[] = [];

        dataRows.forEach((line, index) => {
            let cells: string[] = [];

            if (delimiter === '\t') {
                cells = line.split('\t').map(c => c.trim());
            } else {
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
            }

            let offset = 0;
            if (cells[12] === '' && cells.length > 16) {
                offset = 1;
                console.log(`Row ${index + 2}: Detected extra empty column, applying offset`);
            }

            const question: ImportedQuestion = {
                row: index + 2,
                type: (cells[0] || 'mcq_single').toLowerCase(),
                textEn: formatMathText(cells[1]),
                textPa: formatMathText(cells[2]),
                optionAEn: formatMathText(cells[3]),
                optionAPa: formatMathText(cells[4]),
                optionBEn: formatMathText(cells[5]),
                optionBPa: formatMathText(cells[6]),
                optionCEn: formatMathText(cells[7]),
                optionCPa: formatMathText(cells[8]),
                optionDEn: formatMathText(cells[9]),
                optionDPa: formatMathText(cells[10]),
                correctAnswer: (cells[11] || '').toLowerCase(),
                marks: parseInt(cells[12 + offset]) || 1,
                negativeMarks: parseInt(cells[13 + offset]) || 0,
                explanationEn: formatMathText(cells[14 + offset]),
                explanationPa: formatMathText(cells[15 + offset]),
                parentRow: cells[16 + offset] ? parseInt(cells[16 + offset]) : undefined,
                tags: cells[17 + offset] ? cells[17 + offset].split(',').map(t => t.trim()).filter(Boolean) : []
            };

            if (!question.textEn && !question.textPa) {
                question.error = 'Question text is required';
            } else if (!['mcq_single', 'mcq_multiple', 'fill_blank', 'paragraph'].includes(question.type)) {
                question.error = 'Invalid question type';
            } else if (question.type !== 'fill_blank' && question.type !== 'paragraph' && !question.correctAnswer) {
                question.error = 'Correct answer is required';
            }

            questions.push(question);
        });

        setParsedQuestions(questions);
        setShowPreview(true);
    };

    const handleImport = async () => {
        const validQuestions = parsedQuestions.filter(q => !q.error);
        if (validQuestions.length === 0) {
            toast.error('No valid questions to import');
            return;
        }

        setImporting(true);
        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/import`, {
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
                if (data.errors && data.errors.length > 0) {
                    setImportErrors(data.errors);
                    toast('Some rows failed to import', { icon: '⚠️' });
                } else {
                    setParsedQuestions([]);
                    setImportErrors([]);
                    setShowPreview(false);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                }
            } else {
                if (data.errors && Array.isArray(data.errors)) {
                    setImportErrors(data.errors);
                    toast.error('Import failed with errors');
                } else {
                    toast.error(data.error || 'Import failed');
                }
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
            <header className="bg-white shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href={`/admin/exams/${examId}`} className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Import Questions</h1>
                                <p className="text-sm text-gray-500">
                                    Section: {section ? getText(section.name, language) : 'Unknown'}
                                </p>
                            </div>
                        </div>
                        <Link
                            href={`/admin/exams/${examId}/sections/${sectionId}/questions`}
                            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                        >
                            View Questions
                        </Link>
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
                                Download the CSV template and fill in your questions with English and Punjabi content.
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

                {/* Step 2: Language Selection */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-blue-600 font-bold">2</span>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Import Language</h2>
                            <div className="max-w-xs">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Globe className="w-4 h-4 inline mr-1" />
                                    Which language columns to import?
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

                        {importErrors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                                <h4 className="text-red-800 font-semibold mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Import Errors
                                </h4>
                                <div className="max-h-32 overflow-y-auto text-sm text-red-700 space-y-1">
                                    {importErrors.map((err, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <span className="font-mono bg-red-100 px-1 rounded">Row {err.row}</span>
                                            <span>{err.error}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-2 py-2 text-left">#</th>
                                        <th className="px-2 py-2 text-left">Type</th>
                                        <th className="px-2 py-2 text-left">Question_EN</th>
                                        <th className="px-2 py-2 text-left">Question_PA</th>
                                        <th className="px-2 py-2 text-left">A_EN</th>
                                        <th className="px-2 py-2 text-left">A_PA</th>
                                        <th className="px-2 py-2 text-left">B_EN</th>
                                        <th className="px-2 py-2 text-left">B_PA</th>
                                        <th className="px-2 py-2 text-left">C_EN</th>
                                        <th className="px-2 py-2 text-left">C_PA</th>
                                        <th className="px-2 py-2 text-left">D_EN</th>
                                        <th className="px-2 py-2 text-left">D_PA</th>
                                        <th className="px-2 py-2 text-left">Ans</th>
                                        <th className="px-2 py-2 text-left">Mrk</th>
                                        <th className="px-2 py-2 text-left">-Mrk</th>
                                        <th className="px-2 py-2 text-left">Expl_EN</th>
                                        <th className="px-2 py-2 text-left">Expl_PA</th>
                                        <th className="px-2 py-2 text-left">Tags</th>
                                        <th className="px-2 py-2 text-left">Status</th>
                                        <th className="px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {parsedQuestions.map((q, idx) => (
                                        <tr key={idx} className={q.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                            <td className="px-2 py-1">{q.row}</td>
                                            <td className="px-2 py-1">
                                                <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                    {q.type.replace('mcq_', '')}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1 max-w-[120px] truncate" title={q.textEn}>{q.textEn}</td>
                                            <td className="px-2 py-1 max-w-[120px] truncate" title={q.textPa}>{q.textPa}</td>
                                            <td className="px-2 py-1 max-w-[60px] truncate" title={q.optionAEn}>{q.optionAEn}</td>
                                            <td className="px-2 py-1 max-w-[60px] truncate" title={q.optionAPa}>{q.optionAPa}</td>
                                            <td className="px-2 py-1 max-w-[60px] truncate" title={q.optionBEn}>{q.optionBEn}</td>
                                            <td className="px-2 py-1 max-w-[60px] truncate" title={q.optionBPa}>{q.optionBPa}</td>
                                            <td className="px-2 py-1 max-w-[60px] truncate" title={q.optionCEn}>{q.optionCEn}</td>
                                            <td className="px-2 py-1 max-w-[60px] truncate" title={q.optionCPa}>{q.optionCPa}</td>
                                            <td className="px-2 py-1 max-w-[60px] truncate" title={q.optionDEn}>{q.optionDEn}</td>
                                            <td className="px-2 py-1 max-w-[60px] truncate" title={q.optionDPa}>{q.optionDPa}</td>
                                            <td className="px-2 py-1 font-mono">{q.correctAnswer}</td>
                                            <td className="px-2 py-1">{q.marks}</td>
                                            <td className="px-2 py-1">{q.negativeMarks}</td>
                                            <td className="px-2 py-1 max-w-[100px] truncate" title={q.explanationEn}>{q.explanationEn || '-'}</td>
                                            <td className="px-2 py-1 max-w-[100px] truncate" title={q.explanationPa}>{q.explanationPa || '-'}</td>
                                            <td className="px-2 py-1 max-w-[80px]">
                                                {q.tags && q.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {q.tags.slice(0, 2).map(tag => (
                                                            <span key={tag} className="px-1 py-0.5 bg-gray-100 rounded text-[10px] border">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {q.tags.length > 2 && <span className="text-[10px] text-gray-500">+{q.tags.length - 2}</span>}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-2 py-1">
                                                {q.error ? (
                                                    <span className="text-red-600 text-xs" title={q.error}>❌</span>
                                                ) : (
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                )}
                                            </td>
                                            <td className="px-2 py-1">
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
                                    setImportErrors([]);
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
                                <li><code className="bg-blue-100 px-1 rounded">paragraph</code> - Passage with sub-questions</li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-medium mb-1">Correct Answer Format:</p>
                            <ul className="list-disc list-inside space-y-1 text-blue-700">
                                <li>Single: <code className="bg-blue-100 px-1 rounded">a</code>, <code className="bg-blue-100 px-1 rounded">b</code>, <code className="bg-blue-100 px-1 rounded">c</code>, or <code className="bg-blue-100 px-1 rounded">d</code></li>
                                <li>Multiple: <code className="bg-blue-100 px-1 rounded">a,b</code> or <code className="bg-blue-100 px-1 rounded">a,c,d</code></li>
                                <li>Fill blank: The exact answer text</li>
                                <li>Paragraph: No answer needed (marks = 0)</li>
                            </ul>
                        </div>
                        <div className="md:col-span-2 border-t pt-3 mt-1">
                            <p className="font-medium mb-1">Paragraph with Sub-Questions:</p>
                            <ul className="list-disc list-inside space-y-1 text-blue-700">
                                <li>Add paragraph passage with type <code className="bg-blue-100 px-1 rounded">paragraph</code></li>
                                <li>For sub-questions, set <code className="bg-blue-100 px-1 rounded">ParentRow</code> to the row number of the paragraph</li>
                                <li>Example: Paragraph in row 5, sub-questions have ParentRow = 5</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
