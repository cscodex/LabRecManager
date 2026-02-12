'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

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
    const [importResult, setImportResult] = useState<{ imported: number; errors: { row: number; error: string }[] } | null>(null);
    const [fileName, setFileName] = useState('');

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
        try {
            const res = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questions: parsedQuestions,
                    language: importLanguage,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setImportResult({ imported: data.imported, errors: data.errors || [] });
                toast.success(`Imported ${data.imported} questions`);
            } else {
                toast.error(data.error || 'Import failed');
            }
        } catch {
            toast.error('Import failed');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto p-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link href={`/admin/exams/${examId}`} className="p-2 rounded-lg hover:bg-gray-200">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Import Questions via CSV/TSV</h1>
                        <p className="text-sm text-gray-500 mt-1">Upload a CSV or TSV file to bulk import questions into this section.</p>
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
                            <h2 className="text-lg font-semibold">Preview ({parsedQuestions.length} questions)</h2>
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                            >
                                {importing ? 'Importing...' : `Import ${parsedQuestions.length} Questions`}
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50">
                                        <th className="text-left p-2">#</th>
                                        <th className="text-left p-2">Type</th>
                                        <th className="text-left p-2">Text (EN)</th>
                                        <th className="text-left p-2">Options</th>
                                        <th className="text-left p-2">Answer</th>
                                        <th className="text-left p-2">Marks</th>
                                        <th className="text-left p-2">Tags</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedQuestions.slice(0, 50).map((q, i) => (
                                        <tr key={i} className="border-b hover:bg-gray-50">
                                            <td className="p-2 text-gray-500">{q.row}</td>
                                            <td className="p-2">
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                    {q.type}
                                                </span>
                                            </td>
                                            <td className="p-2 max-w-xs truncate">{q.textEn || q.textPa}</td>
                                            <td className="p-2 text-xs text-gray-500">
                                                {q.type.startsWith('mcq') ? [q.optionAEn, q.optionBEn, q.optionCEn, q.optionDEn].filter(Boolean).length + ' opts' : '-'}
                                            </td>
                                            <td className="p-2 font-mono text-xs">{q.correctAnswer}</td>
                                            <td className="p-2">{q.marks}</td>
                                            <td className="p-2 text-xs">{q.tags?.join(', ') || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {parsedQuestions.length > 50 && (
                                <p className="text-sm text-gray-500 mt-2 text-center">Showing first 50 of {parsedQuestions.length} questions</p>
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
                                Successfully imported {importResult.imported} questions
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
    );
}
