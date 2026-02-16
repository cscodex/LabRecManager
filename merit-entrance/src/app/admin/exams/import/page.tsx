'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Upload, FileText, Check, Loader2, ChevronRight, ChevronLeft, Save, AlertCircle, X, Plus, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { MathText } from '@/components/MathText';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';

interface ExtractedQuestion {
    id: string;
    type?: 'mcq' | 'fill_blank' | 'short_answer' | 'long_answer';
    text: string; // Markdown/Lorem
    options: string[];
    correctAnswer: string; // 'A', 'B', etc. OR text answer
    explanation: string;
    tags?: string[];
    marks: number;
    page: number; // Page number in PDF
    paragraphId?: string;
}

interface ExtractedParagraph {
    id: string;
    text: string;
}

interface ExamDetails {
    title: string;
    duration: number;
    totalMarks: number;
}

export default function ImportExamPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();

    // Steps: upload -> selection -> processing -> review -> details -> saving
    const [step, setStep] = useState<'upload' | 'selection' | 'processing' | 'review' | 'details'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [pdfPages, setPdfPages] = useState<string[]>([]); // Base64 images for all pages
    const [selectedPageIndices, setSelectedPageIndices] = useState<number[]>([]); // 0-based indices
    const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
    const [extractedInstructions, setExtractedInstructions] = useState<string[]>([]);
    const [extractedParagraphs, setExtractedParagraphs] = useState<ExtractedParagraph[]>([]);
    const [importInstructions, setImportInstructions] = useState(true);
    const [examDetails, setExamDetails] = useState<ExamDetails>({ title: '', duration: 180, totalMarks: 0 });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [customPrompt, setCustomPrompt] = useState('');
    const [maxPages, setMaxPages] = useState(1);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<number[]>([]); // Indices of questions to keep
    const [duplicateIndices, setDuplicateIndices] = useState<number[]>([]); // Indices of questions that already exist
    const [previewPage, setPreviewPage] = useState<string | null>(null); // Page to show in overlay
    const [importMode, setImportMode] = useState<'new' | 'existing'>('new');
    const [exams, setExams] = useState<any[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [sections, setSections] = useState<any[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('gemini-flash-latest');

    // Auth check
    useEffect(() => {
        if (_hasHydrated && (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || ''))) {
            router.push('/');
        }
    }, [_hasHydrated, isAuthenticated, user, router]);

    // Fetch exams for dropdown
    useEffect(() => {
        const fetchExams = async () => {
            try {
                const res = await fetch('/api/admin/exams');
                const data = await res.json();
                if (data.success) {
                    setExams(data.exams);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchExams();
    }, []);

    // Fetch sections when exam selected
    useEffect(() => {
        if (!selectedExamId) {
            setSections([]);
            return;
        }
        const fetchSections = async () => {
            try {
                const res = await fetch(`/api/admin/exams/${selectedExamId}`);
                const data = await res.json();
                if (data.success && data.exam) {
                    setSections(data.exam.sections || []);
                }
            } catch (e) {
                console.error(e);
            }
        }
        fetchSections();
    }, [selectedExamId]);

    // Handle File Drop
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== 'application/pdf') {
                toast.error('Please upload a PDF file');
                return;
            }
            setFile(selectedFile);
        }
    };

    // Load PDF -> Thumbnails for Selection
    const loadPDFPreview = async () => {
        if (!file) return;
        setStep('processing'); // Temporarily show loader while generating thumbnails
        setProgress(10);

        console.log('Loading PDF preview...');
        try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`;

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            const images: string[] = [];

            for (let i = 1; i <= numPages; i++) {
                setProgress(Math.round((i / numPages) * 100));
                const page = await pdf.getPage(i);
                // Render thumbnail (lower scale for speed)
                const viewport = page.getViewport({ scale: 1.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (context) {
                    const renderContext: any = {
                        canvasContext: context,
                        viewport: viewport
                    };
                    await page.render(renderContext).promise;
                    images.push(canvas.toDataURL('image/jpeg', 0.8));
                }
            }
            setPdfPages(images);
            // Select all by default or just first one? Let's select first.
            setSelectedPageIndices([0]);
            setStep('selection');
        } catch (error: any) {
            console.error('PDF Preview Error:', error);
            toast.error(`Failed to load PDF: ${error.message}`);
            setStep('upload');
        }
    };

    const startAIAnalysis = () => {
        if (selectedPageIndices.length === 0) {
            toast.error('Please select at least one page.');
            return;
        }
        // Filter images based on selection
        const selectedImages = pdfPages.filter((_, idx) => selectedPageIndices.includes(idx));
        // Proceed to processing step (visual mostly, as we already have images)
        setStep('processing');
        setProgress(0);
        // Simulate "processing" then send to AI
        setTimeout(() => {
            analyzeWithAI(selectedImages);
        }, 500);
    };

    // Send to AI API
    const analyzeWithAI = async (images: string[]) => {
        setIsAnalyzing(true);
        try {
            const response = await fetch('/api/ai/extract-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images, customPrompt, model: selectedModel }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to analyze PDF');
            }

            if (data.success && data.questions) {
                setQuestions(data.questions);
                setExtractedInstructions(data.instructions || []);
                setExtractedParagraphs(data.paragraphs || []);
                setImportInstructions((data.instructions || []).length > 0);

                // Select all by default
                setSelectedQuestionIndices(data.questions.map((_: any, i: number) => i));

                // Auto-calculate total marks
                const total = data.questions.reduce((sum: number, q: ExtractedQuestion) => sum + (q.marks || 0), 0);
                setExamDetails(prev => ({ ...prev, totalMarks: total }));

                setStep('review');
                toast.success('Analysis complete! Please review the questions.');

                // Trigger duplicate check in background
                checkForDuplicates(data.questions);
            } else {
                toast.error('No questions extracted.');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'AI Analysis failed');
            setStep('upload');
        } finally {
            setIsAnalyzing(false);
            setProgress(0);
        }
    };

    const checkForDuplicates = async (questionsToCheck: ExtractedQuestion[]) => {
        try {
            const response = await fetch('/api/admin/questions/check-duplicates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: questionsToCheck })
            });
            const data = await response.json();
            if (data.success && data.duplicateIndices) {
                setDuplicateIndices(data.duplicateIndices);
                if (data.duplicateIndices.length > 0) {
                    toast('Found duplicate questions!', {
                        icon: '⚠️',
                        duration: 4000
                    });
                    // Optional: Deselect duplicates automatically? 
                    // Let's keep them selected but marked, user can decide.
                }
            }
        } catch (error) {
            console.error('Failed to check duplicates', error);
        }
    };

    const handleSaveExam = async () => {
        if (importMode === 'existing' && (!selectedExamId || !selectedSectionId)) {
            toast.error('Please select an exam and section');
            return;
        }

        try {
            const loadingToast = toast.loading(importMode === 'new' ? 'Creating exam...' : 'Adding questions...');

            const payload = {
                mode: importMode,
                questions: questions
                    .filter((_, idx) => selectedQuestionIndices.includes(idx))
                    .map(q => ({
                        type: q.type || 'mcq', // Default to mcq
                        text: q.text,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                        marks: q.marks,
                        explanation: q.explanation,
                        tags: q.tags // Add tags
                    })),
                ...(importMode === 'new' ? {
                    title: examDetails.title,
                    duration: examDetails.duration,
                    totalMarks: examDetails.totalMarks,
                    instructions: importInstructions ? extractedInstructions : []
                } : {
                    examId: selectedExamId,
                    sectionId: selectedSectionId,
                    instructions: importInstructions ? extractedInstructions : []
                }),
                paragraphs: extractedParagraphs
            };

            const response = await fetch('/api/admin/exams/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            toast.dismiss(loadingToast);

            if (response.ok && data.success) {
                toast.success('Import successful!');
                router.push(`/admin/exams/${data.examId || selectedExamId}`);
            } else {
                toast.error(data.error || 'Failed to save');
            }
        } catch (error) {
            toast.error('An error occurred while saving');
        }
    };

    if (!_hasHydrated) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <Link href="/admin/exams" className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Import Exam from PDF</h1>
                        <p className="text-xs text-gray-500">Step: {step.toUpperCase()}</p>
                    </div>
                </div>
                {step === 'review' && (
                    <button
                        onClick={() => setStep('details')}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Next: Exam Details <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </header>

            <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="max-w-xl mx-auto mt-20">
                        <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-300 p-12 text-center hover:border-blue-500 transition-colors">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Upload className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Question Paper</h2>
                            <p className="text-gray-500 mb-8">Drag and drop a PDF file here, or click to browse.</p>

                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="hidden"
                                id="pdf-upload"
                            />
                            <label
                                htmlFor="pdf-upload"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 cursor-pointer font-medium"
                            >
                                <FileText className="w-4 h-4" />
                                Select PDF
                            </label>

                            {file && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-lg flex items-center justify-between text-left">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-5 h-5 text-red-500" />
                                        <span className="font-medium text-gray-700">{file.name}</span>
                                    </div>
                                    <button
                                        onClick={loadPDFPreview}
                                        className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700"
                                    >
                                        Load Preview
                                    </button>
                                </div>
                            )}

                            {/* Advanced Settings */}
                            <div className="mt-8 text-left border-t pt-6">
                                <button
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium mb-4"
                                >
                                    {showAdvanced ? 'Hide' : 'Show'} AI Configuration
                                </button>

                                {showAdvanced && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">


                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                                Base System Prompt (Read Only)
                                            </label>
                                            <div className="bg-gray-100 p-3 rounded-md border text-xs text-gray-600 font-mono h-32 overflow-y-auto whitespace-pre-wrap">
                                                {`Analyze this image of a question paper page.
Extract all multiple-choice questions found on this page.

For each question, extract:
- The full question text (preserve formatting).
- All options.
- The correct answer if marked or visible.
- Marks (default 4).

IMPORTANT:
- Output valid JSON array.
- Format all mathematical expressions using LaTeX.
- Insert [IMAGE] placeholder for diagrams.`}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                                Additional Instructions (Optional)
                                            </label>
                                            <textarea
                                                value={customPrompt}
                                                onChange={(e) => setCustomPrompt(e.target.value)}
                                                className="w-full p-3 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                rows={4}
                                                placeholder="e.g., 'Ignore header and footer text', 'Extract subject name', 'All questions carry 2 marks'."
                                            />
                                            <p className="text-xs text-gray-400 mt-1">These instructions will be appended to the system prompt.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Selection */}
                {step === 'selection' && (
                    <div className="max-w-6xl mx-auto mt-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Select Pages to Process</h2>
                                <p className="text-gray-500 text-sm">Select the pages containing questions.</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedPageIndices(pdfPages.map((_, i) => i))}
                                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={() => setSelectedPageIndices([])}
                                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={startAIAnalysis}
                                    disabled={selectedPageIndices.length === 0}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    Analyze {selectedPageIndices.length} Page{selectedPageIndices.length !== 1 ? 's' : ''} <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* AI Model Selection Bar */}
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
                                        AI Model
                                    </label>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="bg-white border-blue-200 text-sm rounded-md px-3 py-1.5 focus:border-blue-500 focus:ring-blue-500 text-gray-700"
                                    >
                                        <optgroup label="Google Gemini 2.0 (Preview)">
                                            <option value="gemini-2.0-flash">Gemini 2.0 Flash (New & Fast)</option>
                                            <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro (Experimental)</option>
                                        </optgroup>
                                        <optgroup label="Google Gemini 1.5 (Stable)">
                                            <option value="gemini-flash-latest">Gemini 1.5 Flash (Recommended)</option>
                                            <option value="gemini-pro-latest">Gemini 1.5 Pro (Stable High Quality)</option>
                                            <option value="gemini-flash-lite-latest">Gemini 1.5 Flash Lite (Fastest)</option>
                                        </optgroup>
                                        <optgroup label="OpenAI">
                                            <option value="gpt-4o">GPT-4o (Best Quality)</option>
                                            <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
                                        </optgroup>
                                        <optgroup label="Groq (Llama 4 Vision)">
                                            <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B (Fast Vision)</option>
                                            <option value="meta-llama/llama-4-maverick-17b-128e-instruct">Llama 4 Maverick 17B (High Context)</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div className="h-8 w-px bg-blue-200 hidden sm:block"></div>
                                <div className="text-sm text-blue-700">
                                    <span className="font-medium">Quota Status:</span>{' '}
                                    <a
                                        href={
                                            selectedModel.startsWith('gpt') ? "https://platform.openai.com/usage" :
                                                (selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral') || selectedModel.startsWith('meta-llama')) ? "https://console.groq.com/settings/limits" :
                                                    "https://aistudio.google.com/app/plan_information"
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:text-blue-900"
                                    >
                                        Check Usage
                                    </a>
                                </div>
                            </div>
                            <div className="text-xs text-blue-600 max-w-md">
                                {selectedModel.startsWith('gpt') ?
                                    "OpenAI usage is billed. Check your meaningful credit balance." :
                                    (selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral') || selectedModel.startsWith('meta-llama')) ?
                                        "Groq offers free tiers for Llama models. Check rate limits." :
                                        "Tip: Gemini 1.5 Flash allows ~1,500 pages/day. Use Pro only for complex reasoning (50/day)."
                                }
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-20">
                            {pdfPages.map((img, idx) => {
                                const isSelected = selectedPageIndices.includes(idx);
                                return (
                                    <div
                                        key={idx}
                                        className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-200 ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <div
                                            className="aspect-[3/4] bg-gray-100 relative cursor-pointer"
                                            onClick={() => {
                                                setSelectedPageIndices(prev =>
                                                    isSelected ? prev.filter(i => i !== idx) : [...prev, idx]
                                                );
                                            }}
                                        >
                                            <img src={img} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />

                                            {/* Overlay */}
                                            <div className={`absolute inset-0 bg-blue-600/10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

                                            {/* Checkbox */}
                                            <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                            </div>

                                            {/* Page Number */}
                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                                                Page {idx + 1}
                                            </div>
                                        </div>

                                        {/* Eye Icon for Preview */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewPage(img);
                                            }}
                                            className="absolute bottom-2 right-2 p-1.5 bg-white text-gray-600 rounded-full shadow hover:bg-blue-50 hover:text-blue-600 transition-colors z-10 opacity-0 group-hover:opacity-100"
                                            title="View Enlarged"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}



                {/* Step 3: Processing */}
                {step === 'processing' && (
                    <div className="max-w-xl mx-auto mt-20 text-center">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Analyzing Document...</h2>
                        <p className="text-gray-500 mb-8">Converting PDF and extracting questions with AI.</p>

                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-sm text-gray-500">{progress}% Complete</p>
                    </div>
                )}

                {/* Step 4: Review */}
                {step === 'review' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
                        {/* PDF View (Left) */}
                        <div className="bg-gray-800 rounded-xl overflow-y-auto p-4 flex flex-col gap-4 shadow-inner">
                            {pdfPages.map((img, idx) => {
                                if (!selectedPageIndices.includes(idx)) return null;
                                return (
                                    <div key={idx} className="relative">
                                        <img src={img} alt={`Page ${idx + 1}`} className="w-full h-auto rounded shadow-lg bg-white" />
                                        <span className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">Page {idx + 1}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Questions Editor (Right) */}
                        <div className="bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden">
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-900">Extracted Questions ({questions.length})</h3>
                                <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                    <Plus className="w-4 h-4" /> Add Manual
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                {/* Instructions Section */}
                                {extractedInstructions.length > 0 && (
                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={importInstructions}
                                                onChange={(e) => setImportInstructions(e.target.checked)}
                                                className="mt-1 w-4 h-4 text-purple-600 rounded cursor-pointer"
                                            />
                                            <div>
                                                <h4 className="font-semibold text-purple-900 text-sm mb-2">Import Exam Instructions</h4>
                                                <ul className="list-disc list-inside text-xs text-purple-800 space-y-1">
                                                    {extractedInstructions.map((inst, i) => (
                                                        <li key={i}>{inst}</li>
                                                    ))}
                                                </ul>
                                                <p className="text-[10px] text-purple-600 mt-2 italic">
                                                    These will be appended to the exam&apos;s existing instructions.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Paragraphs Section */}
                                {extractedParagraphs.length > 0 && (
                                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-orange-900 text-sm mb-2">Extracted Passages ({extractedParagraphs.length})</h4>
                                        <div className="space-y-4">
                                            {extractedParagraphs.map(p => (
                                                <div key={p.id} className="text-xs text-gray-700 bg-white p-3 rounded border border-orange-100 italic">
                                                    <span className="font-bold text-orange-600 block mb-1">Passage ID: {p.id}</span>
                                                    {p.text?.substring(0, 150)}...
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {questions.map((q, idx) => {
                                    const isSelected = selectedQuestionIndices.includes(idx);
                                    const isDuplicate = duplicateIndices.includes(idx);
                                    return (
                                        <div key={q.id} className={`border rounded-lg p-4 transition-colors ${isSelected ? (isDuplicate ? 'border-yellow-500 bg-yellow-50/50' : 'border-blue-500 bg-blue-50/50') : 'border-gray-200 opacity-70'}`}>
                                            <div className="flex justify-between mb-2">
                                                {q.paragraphId && (
                                                    <div className="absolute top-0 right-0 bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-bl font-medium border-l border-b border-orange-200">
                                                        Linked to {q.paragraphId}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedQuestionIndices([...selectedQuestionIndices, idx]);
                                                            } else {
                                                                setSelectedQuestionIndices(selectedQuestionIndices.filter(i => i !== idx));
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-blue-600 rounded hover:cursor-pointer"
                                                    />
                                                    <span className="font-bold text-gray-500">Q{idx + 1}</span>
                                                    {isDuplicate && (
                                                        <span className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full border border-yellow-200">
                                                            <AlertCircle className="w-3 h-3" /> Duplicate
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={q.marks}
                                                        onChange={(e) => {
                                                            const newQ = [...questions];
                                                            newQ[idx].marks = Number(e.target.value);
                                                            setQuestions(newQ);
                                                        }}
                                                        className="w-16 px-2 py-1 border rounded text-xs"
                                                        placeholder="Marks"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            // Remove question entirely
                                                            const newQ = questions.filter((_, i) => i !== idx);
                                                            setQuestions(newQ);
                                                            setSelectedQuestionIndices(selectedQuestionIndices.filter(i => i !== idx));
                                                            // Update duplicate indices - simplistic approach: re-run check or leave as is (indices might shift, but this is rare case in review)
                                                            // For now, if we remove 1, all subsequent indices shift. 
                                                            // Ideally we should use IDs. But let's stick to this for now as "Remove" is edge case.
                                                        }}
                                                        className="text-gray-400 hover:text-red-500"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Question Text Editor & Render */}
                                            <div className="mb-3 space-y-2">
                                                <textarea
                                                    value={q.text}
                                                    onChange={(e) => {
                                                        const newQ = [...questions];
                                                        newQ[idx].text = e.target.value;
                                                        setQuestions(newQ);
                                                    }}
                                                    className="w-full p-2 border rounded-lg text-sm min-h-[60px] font-mono text-xs text-gray-500 focus:text-gray-900 focus:font-sans transition-all"
                                                    placeholder="Question text (LaTeX supported)..."
                                                />
                                                <div className="p-3 bg-white border rounded-lg text-sm prose prose-sm max-w-none">
                                                    <MathText text={q.text || 'Question Preview'} />
                                                </div>
                                            </div>

                                            <div className="space-y-2 pl-4 border-l-2 border-gray-100">
                                                {/* Question Type Badge */}
                                                <div className="mb-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${!q.type || q.type === 'mcq' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                        q.type === 'fill_blank' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                            'bg-orange-100 text-orange-700 border-orange-200'
                                                        }`}>
                                                        {!q.type || q.type === 'mcq' ? 'Multiple Choice' : q.type === 'fill_blank' ? 'Fill in Blank' : q.type === 'short_answer' ? 'Short Answer' : 'Long Answer'}
                                                    </span>
                                                </div>

                                                {/* Logic for Different Types */}
                                                {(!q.type || q.type === 'mcq') ? (
                                                    q.options.map((opt, oIdx) => {
                                                        const isCorrect = q.correctAnswer === opt || q.correctAnswer === String.fromCharCode(65 + oIdx);
                                                        return (
                                                            <div key={oIdx} className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        const newQ = [...questions];
                                                                        newQ[idx].correctAnswer = String.fromCharCode(65 + oIdx);
                                                                        setQuestions(newQ);
                                                                    }}
                                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCorrect ? 'bg-green-500 text-white shadow-md scale-110' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                                                    title="Mark as correct"
                                                                >
                                                                    {String.fromCharCode(65 + oIdx)}
                                                                </button>
                                                                <div className="flex-1">
                                                                    <input
                                                                        value={opt}
                                                                        onChange={(e) => {
                                                                            const newQ = [...questions];
                                                                            newQ[idx].options[oIdx] = e.target.value;
                                                                            setQuestions(newQ);
                                                                        }}
                                                                        className={`w-full px-2 py-1 border rounded text-sm mb-1 font-mono text-xs focus:text-gray-900 focus:font-sans transition-colors ${isCorrect ? 'border-green-200 bg-green-50/30' : 'border-gray-200 text-gray-500'}`}
                                                                    />
                                                                    <div className="text-sm">
                                                                        <MathText text={opt} inline />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    // Non-MCQ Types
                                                    <div className="mt-2">
                                                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                                                            {q.type === 'fill_blank' ? 'Correct Answer (Exact Text)' : 'Model Answer / Key Points'}
                                                        </label>
                                                        {q.type === 'fill_blank' ? (
                                                            <input
                                                                value={q.correctAnswer}
                                                                onChange={(e) => {
                                                                    const newQ = [...questions];
                                                                    newQ[idx].correctAnswer = e.target.value;
                                                                    setQuestions(newQ);
                                                                }}
                                                                className="w-full px-3 py-2 border rounded-lg text-sm bg-green-50/30 border-green-200 focus:border-green-500 font-medium text-green-800"
                                                                placeholder="Enter the correct answer..."
                                                            />
                                                        ) : (
                                                            <textarea
                                                                value={q.correctAnswer}
                                                                onChange={(e) => {
                                                                    const newQ = [...questions];
                                                                    newQ[idx].correctAnswer = e.target.value;
                                                                    setQuestions(newQ);
                                                                }}
                                                                rows={3}
                                                                className="w-full p-2 border rounded-lg text-sm bg-orange-50/30 border-orange-200 focus:border-orange-500 text-gray-800"
                                                                placeholder="Enter model answer or key points for grading..."
                                                            />
                                                        )}
                                                        <div className="text-[10px] text-gray-400 mt-1">
                                                            {q.type === 'fill_blank' ? 'This text will be used for exact matching.' : 'AI will use this model answer to grade student responses.'}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Explanation and Tags */}
                                            <div className="mt-4 grid grid-cols-1 gap-3">
                                                <div>
                                                    <label className="text-xs font-semibold text-gray-500 uppercase">Explanation</label>
                                                    <textarea
                                                        value={q.explanation || ''}
                                                        onChange={(e) => {
                                                            const newQ = [...questions];
                                                            newQ[idx].explanation = e.target.value;
                                                            setQuestions(newQ);
                                                        }}
                                                        className="w-full mt-1 p-2 border rounded text-xs text-gray-600 focus:text-gray-900"
                                                        rows={2}
                                                        placeholder="Explanation for the answer..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-gray-500 uppercase">Tags</label>
                                                    <input
                                                        value={q.tags?.join(', ') || ''}
                                                        onChange={(e) => {
                                                            const newQ = [...questions];
                                                            newQ[idx].tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                                                            setQuestions(newQ);
                                                        }}
                                                        className="w-full mt-1 px-2 py-1.5 border rounded text-xs text-gray-600 focus:text-gray-900"
                                                        placeholder="e.g. Algebra, Calculus (comma separated)"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 5: Details */}
                {step === 'details' && (
                    <div className="max-w-2xl mx-auto mt-10">
                        <div className="bg-white rounded-xl shadow-sm border p-8">
                            <h2 className="text-xl font-bold text-gray-900 mb-6">Finalize Exam Details</h2>

                            {/* Mode Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Import Destination</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setImportMode('new')}
                                        className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${importMode === 'new' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        Create New Exam
                                    </button>
                                    <button
                                        onClick={() => setImportMode('existing')}
                                        className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${importMode === 'existing' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        Add to Existing
                                    </button>
                                </div>
                            </div>

                            {importMode === 'new' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Exam Title</label>
                                        <input
                                            type="text"
                                            value={examDetails.title}
                                            onChange={(e) => setExamDetails({ ...examDetails, title: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg"
                                            placeholder="e.g. JEE Mains 2024 Mock 1"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
                                            <input
                                                type="number"
                                                value={examDetails.duration}
                                                onChange={(e) => setExamDetails({ ...examDetails, duration: Number(e.target.value) })}
                                                className="w-full px-4 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
                                            <input
                                                type="number"
                                                value={examDetails.totalMarks}
                                                readOnly
                                                className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Exam</label>
                                        <select
                                            value={selectedExamId}
                                            onChange={(e) => setSelectedExamId(e.target.value)}
                                            className="w-full px-4 py-2 border rounded-lg"
                                        >
                                            <option value="">-- Select Exam --</option>
                                            {exams.map(ex => (
                                                <option key={ex.id} value={ex.id}>
                                                    {ex.title?.en || ex.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedExamId && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Section</label>
                                            <select
                                                value={selectedSectionId}
                                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                                className="w-full px-4 py-2 border rounded-lg"
                                            >
                                                <option value="">-- Select Section --</option>
                                                {sections.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name?.en || s.name || `Section ${s.order}`}
                                                    </option>
                                                ))}
                                            </select>
                                            {sections.length === 0 && <p className="text-xs text-red-500 mt-1">No sections found in this exam.</p>}
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks to Add</label>
                                        <input
                                            type="number"
                                            value={examDetails.totalMarks}
                                            readOnly
                                            className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="mt-8 flex gap-3">
                                <button onClick={() => setStep('review')} className="px-6 py-2 border rounded-lg text-gray-600">Back</button>
                                <button
                                    onClick={handleSaveExam}
                                    className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Save & Create Exam
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Image Preview Modal */}
            {previewPage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewPage(null)}
                >
                    <button
                        onClick={() => setPreviewPage(null)}
                        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={previewPage}
                        alt="Page Preview"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
