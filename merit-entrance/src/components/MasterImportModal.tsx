'use client';

import { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

interface MasterImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    examId: string;
    sections: { id: string; name: Record<string, string> }[];
    onSuccess: () => void;
}

interface ImportedQuestion {
    row: number;
    section: string;
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
    parentRow?: number; // Row number of the parent paragraph
    error?: string;
}

export default function MasterImportModal({ isOpen, onClose, examId, sections, onSuccess }: MasterImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState(1);
    const [importing, setImporting] = useState(false);
    const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[]>([]);
    const [importLanguage, setImportLanguage] = useState<'both' | 'en' | 'pa'>('both');

    if (!isOpen) return null;

    const sectionsList = sections.map(s => s.name?.en || 'Section').join(', ');

    const downloadTemplate = () => {
        const headers = [
            'Section Name (Must match exactly)',
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
            'ParentRow'
        ];

        const sampleRow = [
            sections[0]?.name?.en || 'Physics',
            'mcq_single',
            'What is the speed of light?',
            'ਪ੍ਰਕਾਸ਼ ਦੀ ਗਤੀ ਕੀ ਹੈ?',
            '3x10^8 m/s', '3x10^8 m/s',
            '3x10^6 m/s', '3x10^6 m/s',
            '3x10^5 km/s', '3x10^5 km/s',
            'Infinite', 'ਅਨੰਤ',
            'a', '4', '1',
            'Speed of light in vacuum', 'ਵੈਕਿਊਮ ਵਿੱਚ ਪ੍ਰਕਾਸ਼ ਦੀ ਗਤੀ',
            ''
        ];

        // Quote all cells
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            sampleRow.map(c => `"${c}"`).join(',')
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'master_import_template.csv';
        link.click();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            parseCSV(text);
        };
        reader.readAsText(file);
    };

    // Helper to format math text (superscripts/subscripts)
    const formatMathText = (text: string | undefined): string => {
        if (!text) return '';
        return text
            .replace(/\^{([^}]+)}/g, '<sup>$1</sup>')
            .replace(/_{([^}]+)}/g, '<sub>$1</sub>')
            .replace(/\^\(([^)]+)\)/g, '<sup>$1</sup>')
            .replace(/_\(([^)]+)\)/g, '<sub>$1</sub>')
            .replace(/\^(\d+)/g, '<sup>$1</sup>')
            .replace(/_(\d+)/g, '<sub>$1</sub>');
    };

    const parseCSV = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            toast.error('File is empty');
            return;
        }

        // Detect delimiter (Tab vs Comma)
        const firstLine = lines[0];
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        const delimiter = tabCount > commaCount ? '\t' : ',';

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
                    if (char === '"') inQuotes = !inQuotes;
                    else if (char === ',' && !inQuotes) {
                        cells.push(currentCell.trim());
                        currentCell = '';
                    } else currentCell += char;
                }
                cells.push(currentCell.trim());
            }

            // Handle potential extra empty column offset
            let offset = 0;
            // Check if marks column (index 13) is strictly numeric? 
            // Better heuristic: if cells[13] is empty but cells[14] is number?
            // Since we added 'Section' at index 0, everything shifts by +1 compared to old template
            // Old: Type=0. New: Section=0, Type=1.

            // Expected indices with Section at 0:
            // 0: Section, 1: Type, 2: Q_EN, 3: Q_PA ... 
            // 12: D_PA, 13: Correct, 14: Marks, 15: NegMarks, 16: Expl_EN, 17: Expl_PA, 18: Parent

            // Check if there's an extra empty col after expected last option?
            if (cells[13] === '' && cells.length > 19) {
                offset = 1;
            }

            const sectionName = cells[0]?.trim() || '';
            const matchedSection = sections.find(s =>
                s.name.en?.toLowerCase() === sectionName.toLowerCase() ||
                s.name.pa === sectionName // exact match for Punjabi?
            );

            const question: ImportedQuestion = {
                row: index + 2,
                section: matchedSection ? matchedSection.id : '', // Store ID if found
                type: (cells[1] || 'mcq_single').toLowerCase(),
                textEn: formatMathText(cells[2]),
                textPa: formatMathText(cells[3]),
                optionAEn: formatMathText(cells[4]),
                optionAPa: formatMathText(cells[5]),
                optionBEn: formatMathText(cells[6]),
                optionBPa: formatMathText(cells[7]),
                optionCEn: formatMathText(cells[8]),
                optionCPa: formatMathText(cells[9]),
                optionDEn: formatMathText(cells[10]),
                optionDPa: formatMathText(cells[11]),
                correctAnswer: (cells[12] || '').toLowerCase(),
                marks: parseInt(cells[13 + offset]) || 0,
                negativeMarks: parseInt(cells[14 + offset]) || 0,
                explanationEn: formatMathText(cells[15 + offset]),
                explanationPa: formatMathText(cells[16 + offset]),
                parentRow: cells[17 + offset] ? parseInt(cells[17 + offset]) : undefined,
            };

            // Validation
            if (!sectionName) question.error = 'Section name missing';
            else if (!matchedSection) question.error = `Invalid Section: "${sectionName}"`;
            else if (!question.textEn && !question.textPa) question.error = 'Question text missing';
            else if (!['mcq_single', 'mcq_multiple', 'fill_blank', 'paragraph'].includes(question.type)) question.error = 'Invalid type';
            else if (question.type !== 'paragraph' && question.type !== 'fill_blank' && !question.correctAnswer) question.error = 'Answer missing';

            questions.push(question);
        });

        setParsedQuestions(questions);
        setStep(2); // Move to preview
    };

    const handleImport = async () => {
        const validQuestions = parsedQuestions.filter(q => !q.error);
        if (validQuestions.length === 0) {
            toast.error('No valid questions');
            return;
        }

        setImporting(true);
        try {
            const response = await fetch(`/api/admin/exams/${examId}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questions: validQuestions,
                    language: importLanguage
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(`Imported ${data.imported} questions!`);
                onSuccess();
                onClose();
            } else {
                toast.error(data.error || 'Import failed');
            }
        } catch (error) {
            toast.error('Failed to import');
        } finally {
            setImporting(false);
        }
    };

    const reset = () => {
        setParsedQuestions([]);
        setStep(1);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Master Import Questions</h2>
                        <p className="text-sm text-gray-500">Import questions for multiple sections at once</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 ? (
                        <div className="space-y-8">
                            {/* Template Guide */}
                            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                                <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-2">
                                    <FileSpreadsheet className="w-5 h-5" />
                                    Step 1: Download Template
                                </h3>
                                <p className="text-sm text-blue-700 mb-4">
                                    Use the template exactly as provided. The first column <strong>Section Name</strong> must match exactly one of your existing sections:
                                    <br />
                                    <code className="bg-white px-2 py-0.5 rounded border mt-1 inline-block text-gray-700">{sectionsList}</code>
                                </p>
                                <button
                                    onClick={downloadTemplate}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                >
                                    <Download className="w-4 h-4" /> Download CSV Template
                                </button>
                            </div>

                            {/* Upload */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <Upload className="w-5 h-5" />
                                    Step 2: Upload CSV
                                </h3>

                                {/* Language Selection */}
                                <div className="flex items-center gap-3 mb-4">
                                    <Globe className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-700">Import Language:</span>
                                    <select
                                        value={importLanguage}
                                        onChange={(e) => setImportLanguage(e.target.value as any)}
                                        className="text-sm border rounded-lg px-2 py-1 bg-white"
                                    >
                                        <option value="both">Both (EN & PA)</option>
                                        <option value="en">English Only</option>
                                        <option value="pa">Punjabi Only</option>
                                    </select>
                                </div>

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
                                >
                                    <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-600 font-medium">Click to upload or drag & drop</p>
                                    <p className="text-xs text-gray-400 mt-1">CSV files only</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900">Preview Data</h3>
                                <div className="flex gap-4 text-sm">
                                    <span className="text-green-600 flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" />
                                        {parsedQuestions.filter(q => !q.error).length} Valid
                                    </span>
                                    {parsedQuestions.some(q => q.error) && (
                                        <span className="text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            {parsedQuestions.filter(q => q.error).length} Errors
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="border rounded-xl overflow-hidden max-h-[500px] overflow-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2 border-b">#</th>
                                            <th className="px-3 py-2 border-b">Section</th>
                                            <th className="px-3 py-2 border-b">Type</th>
                                            <th className="px-3 py-2 border-b">Question (EN)</th>
                                            <th className="px-3 py-2 border-b">Answer</th>
                                            <th className="px-3 py-2 border-b">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {parsedQuestions.map((q, i) => (
                                            <tr key={i} className={q.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                                <td className="px-3 py-2 text-gray-500">{q.row}</td>
                                                <td className="px-3 py-2 font-medium text-gray-700">
                                                    {sections.find(s => s.id === q.section)?.name?.en || q.section}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                                        {q.type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 max-w-[200px] truncate" title={q.textEn}>{q.textEn}</td>
                                                <td className="px-3 py-2 font-mono text-gray-600">{q.correctAnswer}</td>
                                                <td className="px-3 py-2">
                                                    {q.error ? (
                                                        <span className="text-red-600 flex items-center gap-1" title={q.error}>
                                                            <AlertCircle className="w-3 h-3" /> Error
                                                        </span>
                                                    ) : (
                                                        <span className="text-green-600 flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" /> Ready
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-between">
                    {step === 2 ? (
                        <button
                            onClick={reset}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium"
                        >
                            Back to Upload
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border bg-white rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        {step === 2 && (
                            <button
                                onClick={handleImport}
                                disabled={importing || parsedQuestions.filter(q => !q.error).length === 0}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                                {importing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Importing...
                                    </>
                                ) : (
                                    <>Import Questions</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
