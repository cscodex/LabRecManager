
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QuestionEditor, { QuestionFormData } from '@/components/admin/QuestionEditor';
import toast from 'react-hot-toast';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewQuestionPage() {
    const router = useRouter();
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadTags = async () => {
            try {
                const res = await fetch('/api/admin/tags');
                const data = await res.json();
                if (data.success) {
                    setTags(data.tags);
                }
            } catch (error) {
                console.error('Error loading tags:', error);
            } finally {
                setLoading(false);
            }
        };
        loadTags();
    }, []);

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
                tags: data.tags,
                order: 0
            };

            if (data.type === 'paragraph') {
                body.paragraph = {
                    paragraphText: { en: data.paragraphTextEn, pa: data.paragraphTextPa || data.paragraphTextEn }
                };
                body.subQuestions = data.subQuestions?.map(sq => ({
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
                    imageUrl: null // Add if QuestionEditor supports sub-question images
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

            const res = await fetch('/api/admin/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const resData = await res.json();
            if (resData.success) {
                toast.success('Question saved');
                router.push('/admin/questions');
            } else {
                toast.error(resData.error || 'Failed to save');
            }

        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="mb-6 flex items-center gap-2">
                <Link href="/admin/questions" className="p-2 hover:bg-gray-100 rounded-full">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold">Add New Question</h1>
            </div>

            <QuestionEditor
                tags={tags}
                onSave={handleSave}
                onCancel={() => router.back()}
                isSaving={saving}
            />
        </div>
    );
}
