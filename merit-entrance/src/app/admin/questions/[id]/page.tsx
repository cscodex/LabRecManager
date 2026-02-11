
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QuestionEditor, { QuestionFormData } from '@/components/admin/QuestionEditor';
import toast from 'react-hot-toast';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditQuestionPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [tags, setTags] = useState([]);
    const [initialData, setInitialData] = useState<QuestionFormData | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [tagsRes, qRes] = await Promise.all([
                    fetch('/api/admin/tags'),
                    fetch(`/api/admin/questions/${params.id}`)
                ]);

                const tagsData = await tagsRes.json();
                const qData = await qRes.json();

                if (tagsData.success) setTags(tagsData.tags);

                if (qData.success) {
                    const q = qData.question;
                    // Transform to form data
                    const formData: QuestionFormData = {
                        id: q.id,
                        textEn: q.text?.en || '',
                        textPa: q.text?.pa || '',
                        type: q.type,
                        options: q.options?.map((o: any) => ({
                            id: o.id,
                            textEn: o.text?.en || '',
                            textPa: o.text?.pa || '',
                            imageUrl: o.image_url
                        })) || [],
                        correctAnswer: q.correct_answer || [],
                        explanationEn: q.explanation?.en || '',
                        explanationPa: q.explanation?.pa || '',
                        marks: q.marks,
                        difficulty: q.difficulty,
                        negativeMarks: q.negative_marks || 0,
                        fillBlankAnswers: q.type === 'fill_blank' ? (q.correct_answer?.join(', ') || '') : '',
                        imageUrl: q.image_url || '',
                        paragraphTextEn: q.paragraph_text?.en || '',
                        paragraphTextPa: q.paragraph_text?.pa || '',
                        parentId: q.parent_id || '',
                        tags: q.tags?.map((t: any) => t.id) || [],
                        subQuestions: []
                    };

                    if (q.type === 'paragraph' && q.subQuestions) {
                        formData.subQuestions = q.subQuestions.map((sq: any) => ({
                            id: sq.id,
                            textEn: sq.text?.en || '',
                            textPa: sq.text?.pa || '',
                            type: sq.type,
                            options: sq.options?.map((o: any) => ({
                                id: o.id,
                                textEn: o.text?.en || '',
                                textPa: o.text?.pa || '',
                                imageUrl: o.image_url
                            })) || [],
                            correctAnswer: sq.correct_answer || [],
                            explanationEn: sq.explanation?.en || '',
                            explanationPa: sq.explanation?.pa || '',
                            marks: sq.marks,
                            negativeMarks: sq.negative_marks || 0,
                            difficulty: sq.difficulty
                        }));
                    }

                    setInitialData(formData);
                } else {
                    toast.error('Failed to load question');
                }
            } catch (error) {
                console.error('Error loading data:', error);
                toast.error('Failed to load data');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [params.id]);

    const handleSave = async (data: QuestionFormData) => {
        setSaving(true);
        try {
            const body: any = {
                type: data.type,
                text: { en: data.textEn, pa: data.textPa || data.textEn },
                explanation: data.explanationEn ? { en: data.explanationEn, pa: data.explanationPa } : null,
                marks: data.type === 'paragraph' ? 0 : data.marks,
                negativeMarks: data.type === 'paragraph' ? 0 : data.negativeMarks,
                difficulty: data.difficulty,
                imageUrl: data.imageUrl,
                tags: data.tags
            };

            if (data.type === 'paragraph') {
                body.paragraphText = { en: data.paragraphTextEn, pa: data.paragraphTextPa || data.paragraphTextEn };
                body.subQuestions = data.subQuestions?.map(sq => ({
                    id: sq.id, // Include ID for update logic
                    text: { en: sq.textEn, pa: sq.textPa || sq.textEn },
                    type: sq.type,
                    options: sq.options.map(o => ({
                        id: o.id,
                        text: { en: o.textEn, pa: o.textPa || o.textEn },
                        image_url: o.imageUrl
                    })),
                    correctAnswer: sq.correctAnswer,
                    explanation: sq.explanationEn ? { en: sq.explanationEn, pa: sq.explanationPa } : null,
                    marks: sq.marks,
                    negativeMarks: sq.negativeMarks,
                    difficulty: sq.difficulty,
                    imageUrl: null
                }));
            } else if (data.type === 'fill_blank') {
                body.correct_answer = data.fillBlankAnswers.split(',').map(s => s.trim()).filter(Boolean);
            } else {
                body.options = data.options.map(o => ({
                    id: o.id,
                    text: { en: o.textEn, pa: o.textPa || o.textEn },
                    image_url: o.imageUrl
                }));
                body.correct_answer = data.correctAnswer;
            }

            const res = await fetch(`/api/admin/questions/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const resData = await res.json();
            if (resData.success) {
                toast.success('Question updated');
                router.push('/admin/questions');
            } else {
                toast.error(resData.error || 'Failed to update');
            }

        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!initialData) return <div className="p-8 text-center">Question not found</div>;

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="mb-6 flex items-center gap-2">
                <Link href="/admin/questions" className="p-2 hover:bg-gray-100 rounded-full">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold">Edit Question</h1>
            </div>

            <QuestionEditor
                initialData={initialData}
                tags={tags}
                onSave={handleSave}
                onCancel={() => router.back()}
                isSaving={saving}
            />
        </div>
    );
}
