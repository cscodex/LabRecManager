'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, RefreshCw, Loader2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { MathText } from '@/components/MathText';
import { QuestionFormData } from './QuestionEditor';

interface AIExtractionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExtract: (data: Partial<QuestionFormData>) => void;
}

export default function AIExtractionModal({ isOpen, onClose, onExtract }: AIExtractionModalProps) {
    const [step, setStep] = useState<'upload' | 'processing' | 'preview'>('upload');
    const [image, setImage] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [extractedData, setExtractedData] = useState<any>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [defaultModel, setDefaultModel] = useState('gemini-1.5-flash');

    useEffect(() => {
        if (isOpen) {
            // Fetch settings
            fetch('/api/admin/settings')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.settings?.defaultAIModel) {
                        setDefaultModel(data.settings.defaultAIModel);
                    }
                })
                .catch(err => console.error('Failed to load settings:', err));
        }
    }, [isOpen]);

    // Reset state on close
    const handleClose = () => {
        stopCamera();
        setStep('upload');
        setImage(null);
        setExtractedData(null);
        onClose();
    };

    if (!isOpen) return null;

    // --- Camera Handling ---
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            streamRef.current = stream;
            setIsCameraOpen(true);
        } catch (err) {
            toast.error('Could not access camera');
            console.error(err);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setImage(dataUrl);
            stopCamera();
        }
    };

    // --- File Handling ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) setImage(ev.target.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- AI Extraction ---
    const handleExtract = async () => {
        if (!image) return;

        setStep('processing');
        setLoading(true);

        try {
            const response = await fetch('/api/ai/extract-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    images: [image], // Send single image
                    model: defaultModel // Use fetched default model
                })
            });

            const data = await response.json();

            if (data.success && data.questions && data.questions.length > 0) {
                // Determine structure based on response
                // The API returns { questions: [], paragraphs: [], instructions: [] }
                // We'll focus on the first question for now since usually 1 image = 1 question (or main question)
                // If it's a paragraph question, `questions[0]` might have `paragraphId`
                // We need to map this back to QuestionFormData structure

                const q = data.questions[0];
                const para = data.paragraphs?.find((p: any) => p.id === q.paragraphId);

                // Map to Partial<QuestionFormData>
                const mappedData: Partial<QuestionFormData> = {
                    type: q.type || 'mcq_single',
                    textEn: q.text,
                    textPa: '', // AI usually extracts English unless specified
                    options: q.options?.map((opt: string, idx: number) => ({
                        id: String.fromCharCode(97 + idx), // a, b, c
                        textEn: opt,
                        textPa: ''
                    })) || [],
                    correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer].filter(Boolean),
                    explanationEn: q.explanation || '',
                    marks: q.marks || 1,
                    tags: q.tags || [], // Map tags
                    difficulty: (() => {
                        const tags = (q.tags || []).map((t: string) => t.toLowerCase());
                        if (tags.includes('hard') || tags.includes('difficult')) return 5;
                        if (tags.includes('medium') || tags.includes('intermediate')) return 3;
                        return 1; // Default/Easy
                    })(),

                    // Paragraph handling
                    ...(para ? {
                        type: 'paragraph',
                        paragraphTextEn: para.content || para.text,
                        // If it's paragraph, the question itself is typically a sub-question
                        subQuestions: data.questions.filter((sq: any) => sq.paragraphId === para.id).map((sq: any) => ({
                            textEn: sq.text,
                            type: sq.type || 'mcq_single',
                            options: sq.options?.map((o: string, idx: number) => ({
                                id: String.fromCharCode(97 + idx),
                                textEn: o
                            })) || [],
                            correctAnswer: Array.isArray(sq.correctAnswer) ? sq.correctAnswer : [sq.correctAnswer].filter(Boolean),
                            marks: sq.marks || 1,
                            explanationEn: sq.explanation || ''
                        }))
                    } : {})
                };

                // Normalize Correct Answers to Option IDs if needed (similar to Import fix)
                if (mappedData.options && mappedData.correctAnswer) {
                    mappedData.correctAnswer = mappedData.correctAnswer.map((ans: string) => {
                        // Check if it matches an option text
                        const matchedOptIndex = mappedData.options?.findIndex(o => o.textEn === ans);
                        if (matchedOptIndex !== undefined && matchedOptIndex !== -1) {
                            return String.fromCharCode(97 + matchedOptIndex); // 'a', 'b'...
                        }
                        // Check if it's already an ID (A, B... or a, b...)
                        if (/^[A-Za-z]$/.test(ans)) return ans.toLowerCase();
                        return ans;
                    });
                }

                setExtractedData(mappedData);
                setStep('preview');
            } else {
                toast.error('No questions found in image');
                setStep('upload');
            }
        } catch (error) {
            console.error('Extraction error:', error);
            toast.error('Failed to extract question');
            setStep('upload');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (extractedData) {
            onExtract(extractedData);
            handleClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-blue-600" />
                        Extract Question from Image
                        <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border">
                            Using: {defaultModel}
                        </span>
                    </h3>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-200 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Input Methods */}
                            {!image ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Upload Box */}
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                        <p className="font-medium text-gray-700">Upload Image</p>
                                        <p className="text-xs text-gray-500 mt-1">Drag & drop or click to browse</p>
                                    </div>

                                    {/* Camera Box */}
                                    <div
                                        onClick={startCamera}
                                        className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                                    >
                                        <Camera className="w-10 h-10 text-gray-400 mb-3" />
                                        <p className="font-medium text-gray-700">Use Camera</p>
                                        <p className="text-xs text-gray-500 mt-1">Take a photo from device</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <img src={image} alt="Preview" className="max-h-64 object-contain rounded-lg shadow-sm border" />
                                    <button
                                        onClick={() => setImage(null)}
                                        className="mt-4 text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                                    >
                                        <X className="w-4 h-4" /> Remove Image
                                    </button>
                                </div>
                            )}

                            {/* Camera View */}
                            {isCameraOpen && (
                                <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
                                    <video ref={videoRef} autoPlay playsInline className="w-full max-w-md h-auto bg-black" />
                                    <div className="absolute bottom-10 flex gap-4">
                                        <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-blue-500 shadow-lg"></button>
                                        <button onClick={stopCamera} className="absolute -right-16 top-4 bg-gray-800 text-white p-2 rounded-full">
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">Analyzing Image...</h3>
                            <p className="text-gray-500">Extracting text, formulas, and options.</p>
                        </div>
                    )}

                    {step === 'preview' && extractedData && (
                        <div className="space-y-6">
                            {/* Metadata Badge */}
                            <div className="flex gap-2 mb-2 items-center flex-wrap">
                                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded">Marks: {extractedData.marks}</span>
                                <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded">Level: {extractedData.difficulty || 1}/5</span>
                                {extractedData.tags && extractedData.tags.map((tag: string, i: number) => (
                                    <span key={i} className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-gray-200">{tag}</span>
                                ))}
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h4 className="font-semibold text-blue-900 mb-2 text-sm uppercase">Extracted Question</h4>
                                <div className="bg-white p-4 rounded border border-blue-100 text-gray-800">
                                    <MathText text={extractedData.textEn} />
                                </div>
                            </div>

                            {extractedData.type === 'paragraph' && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-purple-900 mb-2 text-sm uppercase">Passage</h4>
                                    <div className="bg-white p-4 rounded border border-purple-100 text-sm">
                                        <MathText text={extractedData.paragraphTextEn} />
                                    </div>
                                </div>
                            )}

                            {extractedData.options && extractedData.options.length > 0 ? (
                                <div className="space-y-2">
                                    {extractedData.options.map((opt: any) => {
                                        const isCorrect = extractedData.correctAnswer?.includes(opt.id) || extractedData.correctAnswer?.includes(opt.textEn);
                                        return (
                                            <div key={opt.id} className={`flex items-start gap-2 p-2 rounded border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                                                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                    {opt.id.toUpperCase()}
                                                </span>
                                                <div className="text-sm flex-1">
                                                    <MathText text={opt.textEn} inline />
                                                </div>
                                                {isCorrect && <Check className="w-4 h-4 text-green-500" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}

                            {/* Non-MCQ Answer Display */}
                            {extractedData.type !== 'mcq_single' && extractedData.type !== 'mcq_multiple' && extractedData.correctAnswer && extractedData.correctAnswer.length > 0 && (
                                <div className="mt-2">
                                    <h4 className="font-semibold text-gray-700 text-xs uppercase mb-1">Model Answer / Key Points</h4>
                                    <div className="bg-green-50 border border-green-100 rounded p-3 text-sm text-gray-800">
                                        <MathText text={extractedData.correctAnswer[0]} />
                                    </div>
                                </div>
                            )}

                            {/* Explanation Display */}
                            {extractedData.explanationEn && (
                                <div className="mt-2">
                                    <h4 className="font-semibold text-gray-700 text-xs uppercase mb-1">Explanation</h4>
                                    <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-600 italic">
                                        <MathText text={extractedData.explanationEn} />
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-gray-500 text-center italic">
                                Review the extracted content. You can edit it fully in the next step.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">
                        Cancel
                    </button>

                    {step === 'upload' && (
                        <button
                            onClick={handleExtract}
                            disabled={!image}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Extract Question
                        </button>
                    )}

                    {step === 'preview' && (
                        <>
                            <button
                                onClick={() => setStep('upload')}
                                className="px-4 py-2 border rounded-lg hover:bg-white text-sm"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" /> Use/Edit This Question
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
