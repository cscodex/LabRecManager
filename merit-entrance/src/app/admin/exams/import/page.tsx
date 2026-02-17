'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Upload, FileText, Check, Loader2, ChevronRight, ChevronLeft, Save, AlertCircle, X, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { MathText } from '@/components/MathText';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import RichTextEditor from '@/components/RichTextEditor';

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
    title: string;
    content: string;
    text?: string;
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
    const [processingStatus, setProcessingStatus] = useState('Initializing...');
    const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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
            pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;

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
        setProcessingStatus('Preparing images for analysis...');
        // Simulate "processing" then send to AI
        setTimeout(() => {
            analyzeWithAI(selectedImages);
        }, 500);
    };

    // Helper: Delay function
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Send to AI API with Batching
    const analyzeWithAI = async (allImages: string[]) => {
        setIsAnalyzing(true);
        setProgress(0);

        const BATCH_SIZE = 3;
        const totalBatches = Math.ceil(allImages.length / BATCH_SIZE);

        const allQuestions: ExtractedQuestion[] = [];
        const allInstructions: string[] = [];
        const allParagraphs: ExtractedParagraph[] = [];

        try {
            for (let i = 0; i < totalBatches; i++) {
                const start = i * BATCH_SIZE;
                const end = start + BATCH_SIZE;
                const batchImages = allImages.slice(start, end);

                // Update progress to show which batch is processing

                const currentProgress = Math.round((i / totalBatches) * 100);
                setProgress(currentProgress);
                const batchStart = start + 1;
                const batchEnd = Math.min(end, allImages.length);
                const statusMsg = `Analyzing Batch ${i + 1}/${totalBatches} (Pages ${batchStart}-${batchEnd})...`;
                setProcessingStatus(statusMsg);
                // toast.loading(statusMsg, { id: 'batch-toast' }); // Redundant with status text

                const response = await fetch('/api/ai/extract-questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images: batchImages, customPrompt, model: selectedModel }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `Failed to analyze batch ${i + 1}`);
                }

                if (data.success) {
                    if (data.questions) allQuestions.push(...data.questions);
                    if (data.instructions) allInstructions.push(...data.instructions);
                    if (data.paragraphs) allParagraphs.push(...data.paragraphs);
                }

                // Delay between batches if not the last one (avoid rate limits)
                if (i < totalBatches - 1) {
                    await delay(3000); // 3 seconds delay
                }
            }

            toast.dismiss('batch-toast');
            setProcessingStatus('Finalizing extraction...');
            setProgress(100);

            if (allQuestions.length > 0) {
                // Ensure unique IDs for questions to avoid React key issues
                const uniqueQuestions = allQuestions.map((q, idx) => ({ ...q, id: `q_${Date.now()}_${idx}` }));

                setQuestions(uniqueQuestions);
                setExtractedInstructions(prev => Array.from(new Set([...prev, ...allInstructions]))); // Dedup instructions
                setExtractedParagraphs(allParagraphs);
                setImportInstructions(allInstructions.length > 0);

                // Select all
                setSelectedQuestionIndices(uniqueQuestions.map((_, i) => i));

                // Auto-calculate total marks
                const total = uniqueQuestions.reduce((sum: number, q: ExtractedQuestion) => sum + (q.marks || 0), 0);
                setExamDetails(prev => ({ ...prev, totalMarks: total }));

                setStep('review');
                toast.success('Analysis complete! Please review the questions.');

                checkForDuplicates(uniqueQuestions);
            } else {
                toast.error('No questions extracted from any batch.');
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'AI Analysis failed');
            toast.dismiss('batch-toast');
            setStep('upload');
        } finally {
            setIsAnalyzing(false);
            setProgress(0);
            setProcessingStatus('Idle');
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
            setIsSaving(true);
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
        } finally {
            setIsSaving(false);
        }
    };

    // Helper for Inline Paragraph Rendering
    // We use a Set to track rendered paragraphs within the render loop.
    // Since we can't easily use a Set inside the JSX map callback that preserves state across iterations in a pure way (though mutation of a local Set works),
    // we'll define the Set right before the map.

    const renderQuestionsWithParagraphs = () => {
        const renderedParagraphIds = new Set<string>();

        return questions.map((q, idx) => {
            const isSelected = selectedQuestionIndices.includes(idx);
            const isDuplicate = duplicateIndices.includes(idx);
            const isEditing = editingQuestionIndex === idx;

            let paragraphElement = null;
            if (q.paragraphId && !renderedParagraphIds.has(q.paragraphId)) {
                const paragraph = extractedParagraphs.find(p => p.id === q.paragraphId);
                if (paragraph) {
                    renderedParagraphIds.add(q.paragraphId);
                    const title = paragraph.title || paragraph.text || 'Untitled Passage';
                    const content = paragraph.content || paragraph.text || '';

                    paragraphElement = (
                        <div key={`para-${paragraph.id}-${idx}`} className="bg-orange-50 border border-orange-200 rounded-lg p-5 mb-4 shadow-sm">
                            <h4 className="font-bold text-orange-900 text-base mb-3 flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                {title} <span className="text-xs font-normal opacity-70">(ID: {paragraph.id})</span>
                            </h4>
                            <div className="text-sm text-gray-800 bg-white p-4 rounded border border-orange-100 leading-relaxed font-serif">
                                <MathText text={content} />
                            </div>
                        </div>
                    );
                }
            }

            return (
                <div key={q.id || idx} className={q.paragraphId ? "ml-6 border-l-4 border-orange-200 pl-4" : ""}>
                    {paragraphElement}
                    <div className={`border rounded-lg p-4 mb-6 transition-colors ${isSelected ? (isDuplicate ? 'border-yellow-500 bg-yellow-50/50' : 'border-blue-500 bg-blue-50/50') : 'border-gray-200 opacity-70'}`}>
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



                        {/* Question Content - Read vs Edit Mode */}
                        {
                            isEditing ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    {/* Question Text Editor */}
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Question Text</label>
                                        <RichTextEditor
                                            value={q.text}
                                            onChange={(val) => {
                                                const newQ = [...questions];
                                                newQ[idx].text = val;
                                                setQuestions(newQ);
                                            }}
                                            placeholder="Question text (Supports HTML & LaTeX)..."
                                        />
                                    </div>

                                    <div className="space-y-3 pl-4 border-l-2 border-gray-100">
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
                                                            <textarea
                                                                value={opt}
                                                                onChange={(e) => {
                                                                    const newQ = [...questions];
                                                                    newQ[idx].options[oIdx] = e.target.value;
                                                                    setQuestions(newQ);
                                                                }}
                                                                rows={2}
                                                                className={`w-full px-3 py-2 border rounded text-sm mb-1 font-mono whitespace-pre-wrap focus:ring-2 focus:ring-blue-500 transition-colors ${isCorrect ? 'border-green-200 bg-green-50/30' : 'border-gray-200 text-gray-600'}`}
                                                                placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                                            />
                                                            <div className="text-sm">
                                                                <MathText text={opt} inline />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            // Non-MCQ Types - Rich Text for Model Answer
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
                                                    <RichTextEditor
                                                        value={q.correctAnswer || ''}
                                                        onChange={(val) => {
                                                            const newQ = [...questions];
                                                            newQ[idx].correctAnswer = val;
                                                            setQuestions(newQ);
                                                        }}
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
                                            <RichTextEditor
                                                value={q.explanation || ''}
                                                onChange={(val) => {
                                                    const newQ = [...questions];
                                                    newQ[idx].explanation = val;
                                                    setQuestions(newQ);
                                                }}
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

                                    <div className="flex justify-end pt-2 border-t mt-4">
                                        <button
                                            onClick={() => setEditingQuestionIndex(null)}
                                            className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                                        >
                                            <Check className="w-3 h-3" /> Done Editing
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Read-Only Preview Mode
                                <div className="group relative">
                                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm border rounded-lg p-1 flex gap-1 z-10">
                                        <button
                                            onClick={() => setEditingQuestionIndex(idx)}
                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                            title="Edit Question"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div className="mb-3">
                                        <div className="text-sm font-medium text-gray-900 bg-gray-50/50 p-2 rounded">
                                            <MathText text={q.text} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {(!q.type || q.type === 'mcq') ? (
                                            <div className="grid grid-cols-1 gap-1">
                                                {q.options.map((opt, oIdx) => {
                                                    const isCorrect = q.correctAnswer === opt || q.correctAnswer === String.fromCharCode(65 + oIdx);
                                                    return (
                                                        <div key={oIdx} className={`flex items-start gap-2 text-xs p-1.5 rounded ${isCorrect ? 'bg-green-50 border border-green-100' : 'hover:bg-gray-50'}`}>
                                                            <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full font-bold ${isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                                {String.fromCharCode(65 + oIdx)}
                                                            </span>
                                                            <div className="pt-0.5">
                                                                <MathText text={opt} inline />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-xs">
                                                <span className="font-semibold text-gray-500 uppercase">Correct Answer:</span>
                                                <div className="mt-1 p-2 bg-green-50 border border-green-100 rounded text-green-900">
                                                    <MathText text={q.correctAnswer} />
                                                </div>
                                            </div>
                                        )}

                                        {q.explanation && (
                                            <div className="text-xs pt-2 border-t border-gray-100">
                                                <span className="font-semibold text-gray-500 uppercase">Explanation:</span>
                                                <div className="mt-1 text-gray-600">
                                                    <MathText text={q.explanation} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        }
                    </div >
                </div >
            );
        });
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

            ** GOAL **: Extract all questions, instructions, and paragraphs from the page.

            ** INSTRUCTIONS EXTRACTION **:
                        -   If exam - level instructions exist, extract them.
            ** QUESTION EXTRACTION RULES **:
                        1. ** Multiple Choice Questions(MCW) **:
                        -   Extract all questions with options.
                -   ** True / False Questions **: Treat as MCQs with two options: "True" and "False".
                - Remove question numbering.
                - Identify the correct answer(Option letter or "True" / "False").

            2. ** Short & Long Answer Questions **:
                    -   Extract the full question text.
                -   ** Model Answer **: Generate a concise "Model Answer" or "Key Points".

            ** FIELDS TO EXTRACT **:
            -   ** text **: Full question text.
            -   ** type **: "mcq", "fill_blank", "short_answer", "long_answer".
            -   ** options **: Array of strings(Empty for non - MCQ).
            -   ** correctAnswer **: Correct option or Model Answer.
            -   ** explanation **: Detailed explanation.
            -   ** marks **: Default: MCQ(1), Short(3), Long(6).

            ** FORMATTING RULES **:
            -   ** Math / Science **: Convert ALL expressions to ** LaTeX **.
            -   ** Images **: Insert placeholder: \`[IMAGE]\`.
            -   **Instructions**: Extract exam-level instructions.

            **PARAGRAPHS/COMPREHENSION / LINKED QUESTIONS**:
            -   **Action**: Extract common text (passage, case study, problem statement) into \`paragraphs\` array.
            -   **Linked Questions**: Treat follow-up parts (i, ii, iii) as separate questions linked to the paragraph via \`paragraphId\`.`}
                                            </div >
                                        </div >

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
                                    </div >
                                )
                                }
                            </div >
                        </div >
                    </div >
                )}

                {/* Step 2: Selection */}
                {
                    step === 'selection' && (
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
                                                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Standard)</option>
                                                <option value="gemini-2.0-flash-lite-preview-02-05">Gemini 2.0 Flash Lite (High Speed)</option>
                                                <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro (Experimental)</option>
                                                <option value="gemini-2.0-flash-thinking-exp-01-21">Gemini 2.0 Flash Thinking (Reasoning)</option>
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
                                            selectedModel.includes('gemini-2.0') ?
                                                "Gemini 2.0 models are currently free in public preview." :
                                                "Tip: Gemini 1.5 Flash allows ~1,500 pages/day. Use Pro only for complex reasoning (50/day)."
                                    }
                                </div>
                            </div>

                            <div className="h-[60vh] overflow-y-auto border rounded-xl p-4 bg-gray-50">
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
                        </div>
                    )
                }



                {/* Step 3: Processing */}
                {
                    step === 'processing' && (
                        <div className="max-w-xl mx-auto mt-20 text-center">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Analyzing Document...</h2>
                            <p className="text-gray-500 mb-8">Converting PDF and extracting questions with AI.</p>

                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                            <p className="text-sm text-gray-500 mt-2 font-medium">{processingStatus}</p>
                            <p className="text-xs text-gray-400 mt-1">{progress}% Complete</p>
                        </div>
                    )
                }

                {/* Step 4: Review */}
                {
                    step === 'review' && (
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


                                    {renderQuestionsWithParagraphs()}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Step 5: Details */}
                {
                    step === 'details' && (
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
                    )
                }

            </main>

            {/* Image Preview Modal */}
            {
                previewPage && (
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
                )
            }

            {/* Blocking Import Overlay */}
            {isSaving && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 flex flex-col items-center max-w-sm w-full animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 relative">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <div className="absolute inset-0 border-4 border-blue-100 rounded-full animate-ping opacity-20"></div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Importing Questions...</h3>
                        <p className="text-gray-500 text-center text-sm mb-6">
                            Please wait while we save the exam and questions to the database. Do not close this window.
                        </p>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-blue-600 animate-progress-indeterminate"></div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
