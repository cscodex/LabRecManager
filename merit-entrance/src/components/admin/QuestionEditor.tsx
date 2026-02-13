
'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
    Plus, X, Trash2, CheckCircle, Save, FileText,
    Image as ImageIcon, Upload, Hash, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import Image from 'next/image';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

export interface QuestionFormData {
    id?: string;
    textEn: string;
    textPa: string;
    type: string;
    options: FormOption[];
    correctAnswer: string[];
    explanationEn: string;
    explanationPa: string;
    marks: number;
    difficulty: number;
    negativeMarks: number;
    fillBlankAnswers: string;
    imageUrl: string;
    paragraphTextEn: string;
    paragraphTextPa: string;
    parentId: string;
    tags: string[];
    // Paragraph Sub-questions
    subQuestions?: SubQuestionForm[];
}

export interface FormOption {
    id: string;
    textEn: string;
    textPa: string;
    imageUrl?: string;
}

export type SubQuestionForm = {
    id?: string;
    textEn: string;
    textPa: string;
    type: 'mcq_single' | 'mcq_multiple' | 'fill_blank';
    options: FormOption[];
    correctAnswer: string[];
    explanationEn: string;
    explanationPa: string;
    marks: number;
    negativeMarks: number;
    difficulty: number;
    imageUrl?: string;
    fillBlankAnswers?: string;
};

interface QuestionEditorProps {
    initialData?: QuestionFormData;
    tags: { id: string; name: string }[];
    onSave: (data: QuestionFormData) => Promise<void>;
    onCancel: () => void;
    isSaving?: boolean;
}

export default function QuestionEditor({
    initialData,
    tags,
    onSave,
    onCancel,
    isSaving = false
}: QuestionEditorProps) {

    const createEmptyQuestion = (): QuestionFormData => ({
        textEn: '',
        textPa: '',
        type: 'mcq_single',
        options: [
            { id: 'a', textEn: '', textPa: '' },
            { id: 'b', textEn: '', textPa: '' },
        ],
        correctAnswer: [],
        explanationEn: '',
        explanationPa: '',
        marks: 1,
        difficulty: 1,
        negativeMarks: 0,
        fillBlankAnswers: '',
        imageUrl: '',
        paragraphTextEn: '',
        paragraphTextPa: '',
        parentId: '',
        tags: [],
        subQuestions: []
    });

    const [formData, setFormData] = useState<QuestionFormData>(initialData || createEmptyQuestion());
    const [uploading, setUploading] = useState(false);

    // For Paragraph Mode
    const [isParaMode, setIsParaMode] = useState(initialData?.type === 'paragraph');
    const [paraSubQuestions, setParaSubQuestions] = useState<SubQuestionForm[]>(initialData?.subQuestions || []);

    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'image'],
            ['clean']
        ],
    };

    // --- Handlers ---

    const handleImageUpload = async (file: File, type: 'question' | 'option', optionIndex?: number) => {
        setUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            formDataUpload.append('folder', 'merit-entrance/questions');

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formDataUpload,
            });

            const data = await response.json();

            if (data.success) {
                if (type === 'question') {
                    setFormData({ ...formData, imageUrl: data.url });
                } else if (type === 'option' && optionIndex !== undefined) {
                    const newOptions = [...formData.options];
                    newOptions[optionIndex].imageUrl = data.url;
                    setFormData({ ...formData, options: newOptions });
                }
                toast.success('Image uploaded!');
            } else {
                toast.error(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const addOption = () => {
        const nextId = String.fromCharCode(97 + formData.options.length);
        setFormData({
            ...formData,
            options: [...formData.options, { id: nextId, textEn: '', textPa: '' }],
        });
    };

    const removeOption = (optionId: string) => {
        if (formData.options.length <= 1) {
            toast.error('At least one option is required');
            return;
        }
        const filtered = formData.options.filter(o => o.id !== optionId);
        const reIndexed = filtered.map((opt, i) => ({
            ...opt,
            id: String.fromCharCode(97 + i),
        }));

        // Remap correct answers
        const idMap: Record<string, string> = {};
        filtered.forEach((opt, i) => {
            idMap[opt.id] = String.fromCharCode(97 + i);
        });

        setFormData({
            ...formData,
            options: reIndexed,
            correctAnswer: formData.correctAnswer
                .filter(id => id !== optionId)
                .map(id => idMap[id] || id),
        });
    };

    const toggleCorrectAnswer = (optionId: string) => {
        if (formData.type === 'mcq_single') {
            setFormData({ ...formData, correctAnswer: [optionId] });
        } else {
            const current = formData.correctAnswer;
            if (current.includes(optionId)) {
                setFormData({ ...formData, correctAnswer: current.filter(id => id !== optionId) });
            } else {
                setFormData({ ...formData, correctAnswer: [...current, optionId] });
            }
        }
    };

    const handleSubmit = () => {
        // Validation
        if (formData.type !== 'paragraph' && !formData.textEn) {
            toast.error('Question text is required');
            return;
        }
        if (formData.type === 'paragraph' && !formData.paragraphTextEn) {
            toast.error('Paragraph text is required');
            return;
        }

        const dataToSave = { ...formData };
        if (isParaMode) {
            dataToSave.type = 'paragraph';
            dataToSave.subQuestions = paraSubQuestions;
        }

        onSave(dataToSave);
    };

    // --- Paragraph Helpers ---
    const addParaSubQuestion = () => {
        setParaSubQuestions([...paraSubQuestions, {
            textEn: '',
            textPa: '',
            type: 'mcq_single',
            options: [
                { id: 'a', textEn: '', textPa: '' },
                { id: 'b', textEn: '', textPa: '' },
                { id: 'c', textEn: '', textPa: '' },
                { id: 'd', textEn: '', textPa: '' },
            ],
            correctAnswer: [],
            explanationEn: '',
            explanationPa: '',
            marks: 1,
            negativeMarks: 0,
            difficulty: 1,
            imageUrl: '',
            fillBlankAnswers: '',
        }]);
    };

    const removeParaSubQuestion = (index: number) => {
        setParaSubQuestions(paraSubQuestions.filter((_, i) => i !== index));
    };

    const updateParaSubQuestion = (index: number, updates: Partial<SubQuestionForm>) => {
        const newSubQuestions = [...paraSubQuestions];
        newSubQuestions[index] = { ...newSubQuestions[index], ...updates };
        setParaSubQuestions(newSubQuestions);
    };

    const toggleSubQuestionCorrectAnswer = (qIndex: number, optionId: string) => {
        const sq = paraSubQuestions[qIndex];
        let newCorrect: string[];
        if (sq.type === 'mcq_single') {
            newCorrect = [optionId];
        } else {
            newCorrect = sq.correctAnswer.includes(optionId)
                ? sq.correctAnswer.filter(id => id !== optionId)
                : [...sq.correctAnswer, optionId];
        }
        updateParaSubQuestion(qIndex, { correctAnswer: newCorrect });
    };

    const updateSubQuestionOption = (qIndex: number, oIndex: number, updates: Partial<FormOption>) => {
        const newSubQuestions = [...paraSubQuestions];
        const newOptions = [...newSubQuestions[qIndex].options];
        newOptions[oIndex] = { ...newOptions[oIndex], ...updates };
        newSubQuestions[qIndex].options = newOptions;
        setParaSubQuestions(newSubQuestions);
    };

    // --- Render ---

    if (isParaMode) {
        // Render Paragraph Form (Simplified from original)
        return (
            <div className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
                <div className="flex justify-between items-center bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <h2 className="text-lg font-bold text-purple-800">Paragraph Question</h2>
                    <button onClick={onCancel} className="p-2 hover:bg-white rounded-full"><X className="w-5 h-5" /></button>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Passage Title (En)</label>
                        <input
                            value={formData.textEn}
                            onChange={e => setFormData({ ...formData, textEn: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Passage Title (Pa)</label>
                        <input
                            value={formData.textPa}
                            onChange={e => setFormData({ ...formData, textPa: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Passage Content</label>
                    <ReactQuill
                        theme="snow"
                        value={formData.paragraphTextEn}
                        onChange={(val) => setFormData({ ...formData, paragraphTextEn: val })}
                        modules={quillModules}
                        className="bg-white rounded-xl overflow-hidden border h-64 mb-12"
                    />
                </div>

                {/* Tags */}
                <div>
                    <label className="block text-sm font-medium mb-1">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {formData.tags.map(tagId => {
                            const tag = tags.find(t => t.id === tagId);
                            return (
                                <span key={tagId} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs flex items-center gap-1">
                                    {tag?.name}
                                    <button onClick={() => setFormData({ ...formData, tags: formData.tags.filter(id => id !== tagId) })}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                    <select
                        value=""
                        onChange={(e) => {
                            if (e.target.value && !formData.tags.includes(e.target.value)) {
                                setFormData({ ...formData, tags: [...formData.tags, e.target.value] });
                            }
                        }}
                        className="w-full px-3 py-2 border rounded-lg"
                    >
                        <option value="">+ Add Tag</option>
                        {tags.filter(t => !formData.tags.includes(t.id)).map(tag => (
                            <option key={tag.id} value={tag.id}>{tag.name}</option>
                        ))}
                    </select>
                </div>

                {/* Sub Questions */}
                <div className="space-y-6 border-t pt-6">
                    <h3 className="font-bold text-gray-700">Sub-Questions</h3>
                    {paraSubQuestions.map((sq, idx) => (
                        <div key={idx} className="bg-gray-50 p-4 rounded-xl border relative">
                            <button
                                onClick={() => removeParaSubQuestion(idx)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                            <span className="absolute top-4 left-4 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">{idx + 1}</span>

                            <div className="ml-10 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        placeholder="Question Text (En)"
                                        value={sq.textEn}
                                        onChange={e => updateParaSubQuestion(idx, { textEn: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                    <input
                                        placeholder="Question Text (Pa)"
                                        value={sq.textPa}
                                        onChange={e => updateParaSubQuestion(idx, { textPa: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>

                                <div className="grid grid-cols-4 gap-4">
                                    <select
                                        value={sq.type}
                                        onChange={e => updateParaSubQuestion(idx, { type: e.target.value as any, correctAnswer: [] })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        <option value="mcq_single">Single Choice</option>
                                        <option value="mcq_multiple">Multiple Choice</option>
                                        <option value="fill_blank">Fill in Blank</option>
                                    </select>
                                    <input
                                        type="number" placeholder="Marks"
                                        value={sq.marks}
                                        onChange={e => updateParaSubQuestion(idx, { marks: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                    <input
                                        type="number" placeholder="Neg. Marks"
                                        value={sq.negativeMarks}
                                        onChange={e => updateParaSubQuestion(idx, { negativeMarks: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                    <select
                                        value={sq.difficulty}
                                        onChange={e => updateParaSubQuestion(idx, { difficulty: parseInt(e.target.value) || 1 })}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>

                                {/* SubQ Options or Fill Blank */}
                                {sq.type === 'fill_blank' ? (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Correct Answer(s) (comma separated)</label>
                                        <input
                                            value={sq.fillBlankAnswers || sq.correctAnswer?.join(', ') || ''}
                                            onChange={e => {
                                                const answers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                updateParaSubQuestion(idx, { fillBlankAnswers: e.target.value, correctAnswer: answers });
                                            }}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                            placeholder="answer1, answer2"
                                        />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        {sq.options.map((opt, oIdx) => (
                                            <div key={opt.id} className="flex gap-2 items-center">
                                                <button
                                                    onClick={() => toggleSubQuestionCorrectAnswer(idx, opt.id)}
                                                    className={`w-5 h-5 rounded border flex items-center justify-center ${sq.correctAnswer.includes(opt.id) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}
                                                >
                                                    {sq.correctAnswer.includes(opt.id) && <CheckCircle className="w-3 h-3" />}
                                                </button>
                                                <input
                                                    value={opt.textEn}
                                                    onChange={e => updateSubQuestionOption(idx, oIdx, { textEn: e.target.value })}
                                                    className="flex-1 px-2 py-1 border rounded text-sm"
                                                    placeholder={`Option ${opt.id}`}
                                                />
                                                <input
                                                    value={opt.textPa}
                                                    onChange={e => updateSubQuestionOption(idx, oIdx, { textPa: e.target.value })}
                                                    className="flex-1 px-2 py-1 border rounded text-xs text-gray-500"
                                                    placeholder="Punjabi"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* SubQ Explanation */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Explanation (En)</label>
                                        <textarea
                                            value={sq.explanationEn}
                                            onChange={e => updateParaSubQuestion(idx, { explanationEn: e.target.value })}
                                            rows={2}
                                            className="w-full px-2 py-1 border rounded text-sm"
                                            placeholder="Explanation in English"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Explanation (Pa)</label>
                                        <textarea
                                            value={sq.explanationPa}
                                            onChange={e => updateParaSubQuestion(idx, { explanationPa: e.target.value })}
                                            rows={2}
                                            className="w-full px-2 py-1 border rounded text-sm"
                                            placeholder="Explanation in Punjabi"
                                        />
                                    </div>
                                </div>

                                {/* SubQ Image */}
                                <div>
                                    {sq.imageUrl && (
                                        <div className="relative w-full h-20 bg-gray-100 rounded flex items-center justify-center overflow-hidden mb-2">
                                            <img src={sq.imageUrl} alt="" className="max-h-20 w-auto object-contain" />
                                            <button onClick={() => updateParaSubQuestion(idx, { imageUrl: '' })} className="absolute top-1 right-1 bg-white p-0.5 rounded-full shadow">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                    <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-50 text-xs text-gray-500">
                                        <ImageIcon className="w-3 h-3" />
                                        {sq.imageUrl ? 'Change Image' : 'Add Image'}
                                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                            if (e.target.files?.[0]) {
                                                const file = e.target.files[0];
                                                const fd = new FormData();
                                                fd.append('file', file);
                                                try {
                                                    const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                                    const data = await res.json();
                                                    if (data.url) updateParaSubQuestion(idx, { imageUrl: data.url });
                                                } catch (err) { toast.error('Image upload failed'); }
                                            }
                                        }} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button onClick={addParaSubQuestion} className="w-full py-3 border-2 border-dashed rounded-xl text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" /> Add Question
                    </button>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                    <button onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSubmit} disabled={isSaving} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save Paragraph'}
                    </button>
                </div>
            </div>
        );
    }

    // Normal Form
    return (
        <div className="bg-white border rounded-xl shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
                <h2 className="text-lg font-bold text-gray-800">
                    {initialData?.id ? 'Edit Question' : 'New Question'}
                </h2>
                <div className="flex items-center gap-2">
                    <select
                        value={formData.type}
                        onChange={e => {
                            const newType = e.target.value;
                            if (newType === 'paragraph') {
                                setIsParaMode(true);
                            }
                            setFormData({ ...formData, type: newType, correctAnswer: [] });
                        }}
                        className="px-3 py-1 border rounded-lg text-sm"
                    >
                        <option value="mcq_single">Single Choice</option>
                        <option value="mcq_multiple">Multiple Choice</option>
                        <option value="fill_blank">Fill in Blank</option>
                        <option value="paragraph">Paragraph</option>
                    </select>
                    <button onClick={onCancel} className="p-2 hover:bg-white rounded-full"><X className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Question Text (English)</label>
                        <textarea
                            value={formData.textEn}
                            onChange={e => setFormData({ ...formData, textEn: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Question Text (Punjabi)</label>
                        <textarea
                            value={formData.textPa}
                            onChange={e => setFormData({ ...formData, textPa: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Image</label>
                        {formData.imageUrl && (
                            <div className="relative w-full h-32 mb-2 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                                <Image src={formData.imageUrl} alt="Question" layout="fill" objectFit="contain" />
                                <button onClick={() => setFormData({ ...formData, imageUrl: '' })} className="absolute top-1 right-1 bg-white p-1 rounded-full shadow"><X className="w-4 h-4" /></button>
                            </div>
                        )}
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm">
                            <Upload className="w-4 h-4" /> Upload Image
                            <input type="file" className="hidden" accept="image/*" onChange={e => {
                                if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'question');
                            }} />
                        </label>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Marks</label>
                            <input type="number" value={formData.marks} onChange={e => setFormData({ ...formData, marks: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Negative</label>
                            <input type="number" step="0.25" value={formData.negativeMarks} onChange={e => setFormData({ ...formData, negativeMarks: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Difficulty</label>
                            <select value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg">
                                {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Tags</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {formData.tags.map(tagId => {
                                const tag = tags.find(t => t.id === tagId);
                                return <span key={tagId} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1">{tag?.name} <button onClick={() => setFormData({ ...formData, tags: formData.tags.filter(id => id !== tagId) })}><X className="w-3 h-3" /></button></span>
                            })}
                        </div>
                        <select
                            value=""
                            onChange={(e) => {
                                if (e.target.value && !formData.tags.includes(e.target.value)) {
                                    setFormData({ ...formData, tags: [...formData.tags, e.target.value] });
                                }
                            }}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="">+ Add Tag</option>
                            {tags.filter(t => !formData.tags.includes(t.id)).map(tag => (
                                <option key={tag.id} value={tag.id}>{tag.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Options */}
            {formData.type === 'fill_blank' ? (
                <div>
                    <label className="block text-sm font-medium mb-2">Correct Answer(s) (comma separated)</label>
                    <input
                        value={formData.fillBlankAnswers}
                        onChange={e => setFormData({ ...formData, fillBlankAnswers: e.target.value, correctAnswer: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="answer1, answer2"
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-medium">Options</label>
                        <button onClick={addOption} className="text-sm text-blue-600 hover:underline">+ Add Option</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.options.map((opt, idx) => (
                            <div key={opt.id} className={`flex items-start gap-3 p-3 border rounded-lg ${formData.correctAnswer.includes(opt.id) ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => toggleCorrectAnswer(opt.id)}
                                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.correctAnswer.includes(opt.id) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}
                                    >
                                        {formData.correctAnswer.includes(opt.id) && <CheckCircle className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => removeOption(opt.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input
                                        value={opt.textEn}
                                        onChange={e => {
                                            const newOpts = [...formData.options];
                                            newOpts[idx].textEn = e.target.value;
                                            setFormData({ ...formData, options: newOpts });
                                        }}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                        placeholder={`Option ${opt.id.toUpperCase()}`}
                                    />
                                    <input
                                        value={opt.textPa}
                                        onChange={e => {
                                            const newOpts = [...formData.options];
                                            newOpts[idx].textPa = e.target.value;
                                            setFormData({ ...formData, options: newOpts });
                                        }}
                                        className="w-full px-2 py-1 border rounded text-xs text-gray-500"
                                        placeholder="Punjabi"
                                    />
                                    {/* Option Image Upload */}
                                    {opt.imageUrl && (
                                        <div className="relative w-full h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                                            <Image src={opt.imageUrl} alt="" width={120} height={64} className="max-h-16 w-auto object-contain" />
                                            <button
                                                onClick={() => {
                                                    const newOpts = [...formData.options];
                                                    newOpts[idx].imageUrl = undefined;
                                                    setFormData({ ...formData, options: newOpts });
                                                }}
                                                className="absolute top-0.5 right-0.5 bg-white p-0.5 rounded-full shadow"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                    <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 border rounded hover:bg-gray-50 text-xs text-gray-500">
                                        <ImageIcon className="w-3 h-3" />
                                        {opt.imageUrl ? 'Change' : 'Image'}
                                        <input type="file" className="hidden" accept="image/*" onChange={e => {
                                            if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'option', idx);
                                        }} />
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Explanation (En)</label>
                    <textarea
                        value={formData.explanationEn}
                        onChange={e => setFormData({ ...formData, explanationEn: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Explanation (Pa)</label>
                    <textarea
                        value={formData.explanationPa}
                        onChange={e => setFormData({ ...formData, explanationPa: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
                <button onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleSubmit} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save Question'}
                </button>
            </div>
        </div>
    );
}
