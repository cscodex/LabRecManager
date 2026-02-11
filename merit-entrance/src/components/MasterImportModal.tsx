'use client';

import { useState, useRef } from 'react';
import { MathText } from '@/components/MathText';
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
    tags?: string[];
    error?: string;
}

interface RowError {
    row: number;
    error: string;
}

export default function MasterImportModal({ isOpen, onClose, examId, sections, onSuccess }: MasterImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState(1);
    const [importing, setImporting] = useState(false);
    const [parsedQuestions, setParsedQuestions] = useState<ImportedQuestion[]>([]);
    const [importLanguage, setImportLanguage] = useState<'both' | 'en' | 'pa'>('both');
    const [importErrors, setImportErrors] = useState<RowError[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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
            'ParentRow',
            'Tags'
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
            '',
            'Physics,Light,2024'
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
        try {
            // Remove BOM if present
            const cleanText = text.replace(/^\ufeff/, '');
            const lines = cleanText.split(/\r\n|\n|\r/).filter(line => line.trim());
            if (lines.length < 2) {
                toast.error('File is empty');
                return;
            }

            // Detect delimiter (Tab vs Comma vs Semicolon)
            const firstLine = lines[0];
            const tabCount = (firstLine.match(/\t/g) || []).length;
            const commaCount = (firstLine.match(/,/g) || []).length;
            const semiCount = (firstLine.match(/;/g) || []).length;

            let delimiter = ',';
            if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
            else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

            // Helper to parse a line respecting quotes
            const parseLine = (line: string): string[] => {
                if (delimiter === '\t') return line.split('\t').map(c => c.trim());

                const cells: string[] = [];
                let currentCell = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === delimiter && !inQuotes) {
                        cells.push(currentCell.trim());
                        currentCell = '';
                    } else {
                        currentCell += char;
                    }
                }
                cells.push(currentCell.trim());
                return cells.map(c => c.replace(/^"|"$/g, '').trim()); // Unquote
            };

            // Normalize headers
            const headers = parseLine(lines[0].toLowerCase());

            // Map headers to field names
            const columnMap: Record<string, number> = {
                section: headers.findIndex(h => h.includes('section')),
                type: headers.findIndex(h => h.includes('type')),
                textEn: headers.findIndex(h => h.includes('question_en') || h === 'question'),
                textPa: headers.findIndex(h => h.includes('question_pa')),
                optionAEn: headers.findIndex(h => h.includes('optiona_en') || h === 'optiona'),
                optionAPa: headers.findIndex(h => h.includes('optiona_pa')),
                optionBEn: headers.findIndex(h => h.includes('optionb_en') || h === 'optionb'),
                optionBPa: headers.findIndex(h => h.includes('optionb_pa')),
                optionCEn: headers.findIndex(h => h.includes('optionc_en') || h === 'optionc'),
                optionCPa: headers.findIndex(h => h.includes('optionc_pa')),
                optionDEn: headers.findIndex(h => h.includes('optiond_en') || h === 'optiond'),
                optionDPa: headers.findIndex(h => h.includes('optiond_pa')),
                correctAnswer: headers.findIndex(h => h.includes('correct') || h.includes('answer')),
                marks: headers.findIndex(h => h.includes('marks') && !h.includes('negative')),
                negativeMarks: headers.findIndex(h => h.includes('negative')),
                explanationEn: headers.findIndex(h => h.includes('explanation_en') || h === 'explanation'),
                explanationPa: headers.findIndex(h => h.includes('explanation_pa')),
                parentRow: headers.findIndex(h => h.includes('parent')),
                tags: headers.findIndex(h => h.includes('tag'))
            };

            // Validate required columns
            if (columnMap.section === -1 || columnMap.type === -1) {
                toast.error('Missing required columns: Section Name, Type');
                return;
            }

            const dataRows = lines.slice(1);
            const questions: ImportedQuestion[] = [];

            dataRows.forEach((line, index) => {
                let cells = parseLine(line);

                // Clean quotes from cells
                cells = cells.map(c => c.replace(/^"|"$/g, '').trim());

                const sectionName = (columnMap.section > -1 ? cells[columnMap.section] : '') || '';
                const matchedSection = sections.find(s =>
                    s.name.en?.toLowerCase() === sectionName.toLowerCase() ||
                    s.name.pa === sectionName
                );

                // Helper to safe get
                const getCell = (idx: number) => (idx > -1 && cells[idx]) ? cells[idx] : '';

                const question: ImportedQuestion = {
                    row: index + 2,
                    section: matchedSection ? matchedSection.id : sectionName,
                    type: (getCell(columnMap.type) || 'mcq_single').toLowerCase(),
                    textEn: formatMathText(getCell(columnMap.textEn)),
                    textPa: formatMathText(getCell(columnMap.textPa)),
                    optionAEn: formatMathText(getCell(columnMap.optionAEn)),
                    optionAPa: formatMathText(getCell(columnMap.optionAPa)),
                    optionBEn: formatMathText(getCell(columnMap.optionBEn)),
                    optionBPa: formatMathText(getCell(columnMap.optionBPa)),
                    optionCEn: formatMathText(getCell(columnMap.optionCEn)),
                    optionCPa: formatMathText(getCell(columnMap.optionCPa)),
                    optionDEn: formatMathText(getCell(columnMap.optionDEn)),
                    optionDPa: formatMathText(getCell(columnMap.optionDPa)),
                    correctAnswer: getCell(columnMap.correctAnswer).toLowerCase(),
                    marks: parseInt(getCell(columnMap.marks)) || 0,
                    negativeMarks: parseInt(getCell(columnMap.negativeMarks)) || 0,
                    explanationEn: formatMathText(getCell(columnMap.explanationEn)),
                    explanationPa: formatMathText(getCell(columnMap.explanationPa)),
                    parentRow: getCell(columnMap.parentRow) ? parseInt(getCell(columnMap.parentRow)) : undefined,
                    tags: getCell(columnMap.tags) ? getCell(columnMap.tags).split(',').map(t => t.trim()).filter(Boolean) : []
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
            setStep(2);
        } catch (e: any) {
            console.error('CSV Parsing Error:', e);
            toast.error('Error parsing data: ' + e.message);
        }
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
                if (data.errors && data.errors.length > 0) {
                    setImportErrors(data.errors);
                    toast('Some rows failed to import', { icon: '⚠️' });
                } else {
                    onSuccess();
                    onClose();
                }
            } else {
                if (data.errors && Array.isArray(data.errors)) {
                    setImportErrors(data.errors);
                    toast.error('Import failed with errors');
                } else {
                    toast.error(data.error || 'Import failed');
                }
            }
        } catch (error: any) {
            console.error('Import API Error:', error);
            toast.error('Failed to import: ' + (error.message || 'Unknown error'));
        } finally {
            setImporting(false);
        }
    };

    const reset = () => {
        setParsedQuestions([]);
        setImportErrors([]);
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
                                <div className="relative mt-4">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-300" />
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="bg-white px-2 text-gray-500">OR</span>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Paste Data (from Apple Numbers / Excel)
                                    </label>
                                    <textarea
                                        className="w-full h-32 p-3 border rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Copy data from your spreadsheet and paste here..."
                                        onChange={(e) => {
                                            const text = e.target.value;
                                            if (text.trim().length > 0) {
                                                parseCSV(text);
                                            }
                                        }}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Auto-detects Tab (Apple Numbers/Excel) or Comma delimiters.
                                    </p>
                                </div>

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

                            <div className="border rounded-xl w-full h-[500px] overflow-scroll relative">
                                <table className="w-full text-xs text-left min-w-[2500px] table-fixed">
                                    <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                                        <tr>
                                            <th className="px-3 py-2 border-b w-12">#</th>
                                            <th className="px-3 py-2 border-b w-32">Section</th>
                                            <th className="px-3 py-2 border-b w-24">Type</th>
                                            <th className="px-3 py-2 border-b w-64">Question (EN)</th>
                                            <th className="px-3 py-2 border-b w-64">Question (PA)</th>
                                            <th className="px-3 py-2 border-b w-24">Correct</th>
                                            <th className="px-3 py-2 border-b w-48">Option A</th>
                                            <th className="px-3 py-2 border-b w-48">Option B</th>
                                            <th className="px-3 py-2 border-b w-48">Option C</th>
                                            <th className="px-3 py-2 border-b w-48">Option D</th>
                                            <th className="px-3 py-2 border-b w-16">Marks</th>
                                            <th className="px-3 py-2 border-b w-16">Neg.</th>
                                            <th className="px-3 py-2 border-b w-64">Explanation</th>
                                            <th className="px-3 py-2 border-b w-16">Parent</th>
                                            <th className="px-3 py-2 border-b w-32">Tags</th>
                                            <th className="px-3 py-2 border-b w-40 sticky right-0 bg-gray-50 shadow-l">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {parsedQuestions
                                            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                            .map((q, i) => (
                                                <tr key={i} className={q.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                                    <td className="px-3 py-2 text-gray-500">{q.row}</td>
                                                    <td className="px-3 py-2 font-medium text-gray-700">
                                                        {sections.find(s => s.id === q.section)?.name?.en || q.section}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 block w-max">
                                                            {q.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-normal break-words">
                                                        <MathText text={q.textEn} />
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-normal break-words">
                                                        <MathText text={q.textPa} />
                                                    </td>
                                                    <td className="px-3 py-2 font-mono break-all">{q.correctAnswer}</td>
                                                    <td className="px-3 py-2 whitespace-normal break-words">
                                                        <MathText text={q.optionAEn || ''} />
                                                        {q.optionAPa && <MathText className="text-gray-500 mt-1 border-t pt-1 border-gray-100 italic" text={q.optionAPa} />}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-normal break-words">
                                                        <MathText text={q.optionBEn || ''} />
                                                        {q.optionBPa && <MathText className="text-gray-500 mt-1 border-t pt-1 border-gray-100 italic" text={q.optionBPa} />}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-normal break-words">
                                                        <MathText text={q.optionCEn || ''} />
                                                        {q.optionCPa && <MathText className="text-gray-500 mt-1 border-t pt-1 border-gray-100 italic" text={q.optionCPa} />}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-normal break-words">
                                                        <MathText text={q.optionDEn || ''} />
                                                        {q.optionDPa && <MathText className="text-gray-500 mt-1 border-t pt-1 border-gray-100 italic" text={q.optionDPa} />}
                                                    </td>
                                                    <td className="px-3 py-2">{q.marks}</td>
                                                    <td className="px-3 py-2">{q.negativeMarks}</td>
                                                    <td className="px-3 py-2 whitespace-normal break-words">
                                                        <MathText text={q.explanationEn || ''} />
                                                        {q.explanationPa && <MathText className="text-gray-500 mt-1 border-t pt-1 border-gray-100 italic" text={q.explanationPa} />}
                                                    </td>

                                                    <td className="px-3 py-2">{q.parentRow}</td>
                                                    <td className="px-3 py-2">
                                                        {q.tags && q.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {q.tags.map(tag => (
                                                                    <span key={tag} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] border">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 sticky right-0 bg-inherit shadow-l">
                                                        {q.error ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-red-600 flex items-center gap-1 font-medium">
                                                                    <AlertCircle className="w-3 h-3" /> Error
                                                                </span>
                                                                <span className="text-[10px] text-red-500 font-medium leading-tight max-w-[150px] whitespace-normal">
                                                                    {q.error}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-green-600 flex items-center gap-1 font-medium">
                                                                <CheckCircle className="w-3 h-3" /> OK
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {parsedQuestions.length > itemsPerPage && (
                                <div className="flex items-center justify-between border-t pt-4">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        Page {currentPage} of {Math.ceil(parsedQuestions.length / itemsPerPage)}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(parsedQuestions.length / itemsPerPage), p + 1))}
                                        disabled={currentPage === Math.ceil(parsedQuestions.length / itemsPerPage)}
                                        className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
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
            </div >
        </div >
    );
}
