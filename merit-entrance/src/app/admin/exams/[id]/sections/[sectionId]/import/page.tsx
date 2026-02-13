'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Upload, Download, FileText, AlertCircle, CheckCircle, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { MathText } from '@/components/MathText';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';
import { getText } from '@/lib/utils';

interface ParsedQuestion {
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
}

export default function SectionImportPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.id as string;
    const sectionId = params.sectionId as string;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
    const [importLanguage, setImportLanguage] = useState<'both' | 'en' | 'pa'>('both');
    const [importing, setImporting] = useState(false);
    const [importedCount, setImportedCount] = useState(0);
    const [importResult, setImportResult] = useState<{ imported: number; errors: { row: number; error: string }[] } | null>(null);
    const [fileName, setFileName] = useState('');
    const [sectionName, setSectionName] = useState('');
    const [examTitle, setExamTitle] = useState('');

    // Fetch section and exam info
    useEffect(() => {
        const fetchSectionInfo = async () => {
            try {
                const res = await fetch(`/api/admin/exams/${examId}`);
                const data = await res.json();
                if (data.success) {
                    setExamTitle(getText(data.exam.title, 'en'));
                    const section = data.exam.sections?.find((s: any) => s.id === sectionId);
                    if (section) {
                        setSectionName(getText(section.name, 'en'));
                    }
                }
            } catch (e) {
                console.error('Failed to load section info', e);
            }
        };
        fetchSectionInfo();
    }, [examId, sectionId]);

    const downloadTemplate = () => {
        const headers = [
            'Type', 'Text (EN)', 'Text (PA)',
            'Option A (EN)', 'Option A (PA)',
            'Option B (EN)', 'Option B (PA)',
            'Option C (EN)', 'Option C (PA)',
            'Option D (EN)', 'Option D (PA)',
            'Correct Answer', 'Marks', 'Negative Marks',
            'Explanation (EN)', 'Explanation (PA)',
            'Parent Row', 'Tags'
        ];
        const sampleRows = [
            ['mcq_single', 'What is 2+2?', 'ੳ+ੳ ਕੀ ਹੈ?', '3', '੩', '4', '੪', '5', '੫', '6', '੬', 'b', '1', '0.25', 'Because 2+2=4', 'ਕਿਉਂਕਿ 2+2=4', '', 'Math,Arithmetic'],
            ['mcq_multiple', 'Which are prime?', 'ਕਿਹੜੀਆਂ ਅਭਾਜ ਹਨ?', '2', '੨', '4', '੪', '5', '੫', '9', '੯', 'a,c', '2', '0.5', '', '', '', 'Math,Prime'],
            ['fill_blank', 'Capital of India?', 'ਭਾਰਤ ਦੀ ਰਾਜਧਾਨੀ?', '', '', '', '', '', '', '', '', 'New Delhi', '1', '0', '', '', '', 'GK'],
        ];
        const tsv = [headers.join('\t'), ...sampleRows.map(r => r.join('\t'))].join('\n');
        const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'question_import_template.tsv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const parseFile = (file: File) => {
        setFileName(file.name);
        setImportResult(null);
        setImportedCount(0);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return;

            // Detect delimiter
            const firstLine = text.split('\n')[0];
            const delimiter = firstLine.includes('\t') ? '\t' : ',';
            const lines = text.split('\n').filter(l => l.trim());

            if (lines.length < 2) {
                toast.error('File must have a header row and at least one data row');
                return;
            }

            const questions: ParsedQuestion[] = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length < 12) continue;

                const q: ParsedQuestion = {
                    row: i + 1,
                    type: cols[0]?.toLowerCase() || 'mcq_single',
                    textEn: cols[1] || '',
                    textPa: cols[2] || '',
                    optionAEn: cols[3], optionAPa: cols[4],
                    optionBEn: cols[5], optionBPa: cols[6],
                    optionCEn: cols[7], optionCPa: cols[8],
                    optionDEn: cols[9], optionDPa: cols[10],
                    correctAnswer: cols[11] || '',
                    marks: parseFloat(cols[12]) || 1,
                    negativeMarks: parseFloat(cols[13]) || 0,
                    explanationEn: cols[14] || '',
                    explanationPa: cols[15] || '',
                    parentRow: cols[16] ? parseInt(cols[16]) : undefined,
                    tags: cols[17] ? cols[17].split(',').map(t => t.trim()).filter(Boolean) : [],
                };
                questions.push(q);
            }

            if (questions.length === 0) {
                toast.error('No valid questions found in file');
                return;
            }

            setParsedQuestions(questions);
            toast.success(`Parsed ${questions.length} questions`);
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (parsedQuestions.length === 0) return;
        setImporting(true);
        setImportResult(null);
        setImportedCount(0);

        const errors: { row: number; error: string }[] = [];
        let imported = 0;

        // Import one-by-one to show real-time count
        for (let i = 0; i < parsedQuestions.length; i++) {
            try {
                const res = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questions: [parsedQuestions[i]],
                        language: importLanguage,
                    }),
                });
                const data = await res.json();
                if (res.ok && data.imported > 0) {
                    imported += data.imported;
                    setImportedCount(imported);
                } else {
                    if (data.errors && data.errors.length > 0) {
                        errors.push(...data.errors);
                    } else {
                        errors.push({ row: parsedQuestions[i].row, error: data.error || 'Unknown error' });
                    }
                }
            } catch {
                errors.push({ row: parsedQuestions[i].row, error: 'Network error' });
            }
        }

        setImportResult({ imported, errors });
        setImporting(false);
        if (imported > 0) toast.success(`Imported ${imported} of ${parsedQuestions.length} questions`);
        if (errors.length > 0) toast.error(`${errors.length} question(s) failed`);
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'mcq_single': return 'Single Choice';
            case 'mcq_multiple': return 'Multiple Choice';
            case 'fill_blank': return 'Fill Blank';
            case 'paragraph': return 'Paragraph';
            default: return type;
        }
    };

    const getTypeBadgeClass = (type: string) => {
        switch (type) {
            case 'mcq_single': return 'bg-blue-100 text-blue-700';
            case 'mcq_multiple': return 'bg-purple-100 text-purple-700';
            case 'fill_blank': return 'bg-orange-100 text-orange-700';
            case 'paragraph': return 'bg-teal-100 text-teal-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <MathJaxProvider>
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-6xl mx-auto p-6">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-6">
                        <Link href={`/admin/exams/${examId}`} className="p-2 rounded-lg hover:bg-gray-200">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Import Questions via CSV/TSV</h1>
                            <div className="flex items-center gap-2 mt-1">
                                {examTitle && (
                                    <span className="text-sm text-gray-500">{examTitle}</span>
                                )}
                                {examTitle && sectionName && <span className="text-gray-300">→</span>}
                                {sectionName && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-sm font-medium rounded border border-blue-200">
                                        <BookOpen className="w-3.5 h-3.5" />
                                        {sectionName}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Language Mode</label>
                                <select
                                    value={importLanguage}
                                    onChange={(e) => setImportLanguage(e.target.value as any)}
                                    className="px-3 py-2 border rounded-lg text-sm"
                                >
                                    <option value="both">Both (EN + PA)</option>
                                    <option value="en">English Only</option>
                                    <option value="pa">Punjabi Only</option>
                                </select>
                            </div>
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 border rounded-lg hover:bg-gray-200 text-sm font-medium"
                            >
                                <Download className="w-4 h-4" /> Download Template
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                            >
                                <Upload className="w-4 h-4" /> {fileName ? 'Change File' : 'Upload File'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.tsv,.txt"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
                            />
                            {fileName && <span className="text-sm text-gray-600 flex items-center gap-1"><FileText className="w-4 h-4" /> {fileName}</span>}
                        </div>
                    </div>

                    {/* Preview */}
                    {parsedQuestions.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold">Preview ({parsedQuestions.length} questions)</h2>
                                    {sectionName && (
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            Importing into section: <span className="font-medium text-blue-600">{sectionName}</span>
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    {importing && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                            <span className="text-sm font-medium text-blue-700">
                                                {importedCount} / {parsedQuestions.length} imported
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleImport}
                                        disabled={importing}
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                                    >
                                        {importing ? `Importing ${importedCount}/${parsedQuestions.length}...` : `Import ${parsedQuestions.length} Questions`}
                                    </button>
                                </div>
                            </div>

                            {/* Import Progress Bar */}
                            {importing && (
                                <div className="mb-4">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(importedCount / parsedQuestions.length) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {parsedQuestions.slice(0, 100).map((q, i) => (
                                    <div key={i} className={`border rounded-lg p-4 hover:border-blue-200 transition-colors ${importing && i < importedCount ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                        {/* Question Header */}
                                        <div className="flex items-start gap-3">
                                            <span className="w-7 h-7 bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeBadgeClass(q.type)}`}>
                                                        {getTypeLabel(q.type)}
                                                    </span>
                                                    <span className="text-xs text-gray-500">+{q.marks} marks</span>
                                                    {q.negativeMarks > 0 && <span className="text-xs text-red-500">-{q.negativeMarks}</span>}
                                                    {q.tags && q.tags.length > 0 && (
                                                        <div className="flex gap-1">
                                                            {q.tags.map((tag, ti) => (
                                                                <span key={ti} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] border">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {importing && i < importedCount && (
                                                        <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                                                    )}
                                                </div>

                                                {/* Question Text with MathJax */}
                                                <div className="text-gray-900 text-sm">
                                                    <MathText text={q.textEn || q.textPa} />
                                                </div>
                                                {q.textPa && q.textEn && (
                                                    <div className="text-gray-500 text-xs mt-0.5">
                                                        <MathText text={q.textPa} />
                                                    </div>
                                                )}

                                                {/* Options (for MCQ) */}
                                                {q.type.startsWith('mcq') && (
                                                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                                                        {[
                                                            { id: 'a', en: q.optionAEn, pa: q.optionAPa },
                                                            { id: 'b', en: q.optionBEn, pa: q.optionBPa },
                                                            { id: 'c', en: q.optionCEn, pa: q.optionCPa },
                                                            { id: 'd', en: q.optionDEn, pa: q.optionDPa },
                                                        ].filter(o => o.en || o.pa).map(opt => {
                                                            const isCorrect = q.correctAnswer.toLowerCase().split(',').map(s => s.trim()).includes(opt.id);
                                                            return (
                                                                <div key={opt.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCorrect ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                                                        {opt.id.toUpperCase()}
                                                                    </span>
                                                                    <span className="flex-1">
                                                                        <MathText text={opt.en || opt.pa || ''} inline />
                                                                        {opt.pa && opt.en && <span className="text-gray-400 ml-1">| <MathText text={opt.pa} inline /></span>}
                                                                    </span>
                                                                    {isCorrect && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Fill blank answer */}
                                                {q.type === 'fill_blank' && q.correctAnswer && (
                                                    <div className="mt-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                                                        <strong>Answer:</strong> <MathText text={q.correctAnswer} inline />
                                                    </div>
                                                )}

                                                {/* Explanation */}
                                                {(q.explanationEn || q.explanationPa) && (
                                                    <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                                        <p className="text-[10px] font-semibold text-blue-600 uppercase mb-0.5">Explanation</p>
                                                        <div className="text-xs text-blue-800">
                                                            <MathText text={q.explanationEn || q.explanationPa || ''} />
                                                        </div>
                                                        {q.explanationPa && q.explanationEn && (
                                                            <div className="text-xs text-blue-600 mt-0.5">
                                                                <MathText text={q.explanationPa} />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {parsedQuestions.length > 100 && (
                                    <p className="text-sm text-gray-500 text-center py-2">Showing first 100 of {parsedQuestions.length} questions</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Import Result */}
                    {importResult && (
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <h2 className="text-lg font-semibold text-green-700">
                                    Successfully imported {importResult.imported} of {parsedQuestions.length} questions
                                </h2>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-sm font-semibold text-red-600 flex items-center gap-1 mb-2">
                                        <AlertCircle className="w-4 h-4" /> {importResult.errors.length} Errors
                                    </h3>
                                    <div className="space-y-1">
                                        {importResult.errors.map((err, i) => (
                                            <p key={i} className="text-sm text-red-600">Row {err.row}: {err.error}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="mt-4">
                                <Link
                                    href={`/admin/exams/${examId}`}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium inline-block"
                                >
                                    ← Back to Exam
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </MathJaxProvider>
    );
}
