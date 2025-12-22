'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Upload, Zap, Calendar, FileText, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { assignmentsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import axios from 'axios';
import PageHeader from '@/components/PageHeader';

export default function CreateAssignmentPage() {
    const router = useRouter();
    const { user, isAuthenticated, accessToken, _hasHydrated } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [publishNow, setPublishNow] = useState(false);
    const [subjects, setSubjects] = useState([]);
    const [labs, setLabs] = useState([]);
    const [classes, setClasses] = useState([]);
    const [pdfFile, setPdfFile] = useState(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
        defaultValues: {
            assignmentType: 'program',
            maxMarks: 100,
            passingMarks: 35,
            vivaMarks: 20,
            practicalMarks: 60,
            outputMarks: 20,
            latePenaltyPercent: 10,
            lateSubmissionAllowed: true,
            status: 'draft'
        }
    });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadFormData();
    }, [isAuthenticated, _hasHydrated]);

    const loadFormData = async () => {
        try {
            const [subjectsRes, classesRes] = await Promise.all([
                axios.get('/api/subjects', { headers: { Authorization: `Bearer ${accessToken}` } }),
                axios.get('/api/classes', { headers: { Authorization: `Bearer ${accessToken}` } })
            ]);
            setSubjects(subjectsRes.data.data.subjects || []);
            setClasses(classesRes.data.data.classes || []);
        } catch (error) {
            console.error('Failed to load form data:', error);
        }
    };

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            const submitData = {
                ...data,
                dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
                publishDate: publishNow ? new Date().toISOString() : (data.publishDate ? new Date(data.publishDate).toISOString() : null),
                status: publishNow ? 'published' : 'draft'
            };

            const response = await assignmentsAPI.create(submitData);
            const assignmentId = response.data.data.assignment.id;

            // Upload PDF if selected
            if (pdfFile) {
                setUploadingPdf(true);
                try {
                    await assignmentsAPI.uploadPdf(assignmentId, pdfFile);
                } catch (pdfError) {
                    console.error('Failed to upload PDF:', pdfError);
                    toast.error('Assignment created but PDF upload failed');
                }
                setUploadingPdf(false);
            }

            if (publishNow) {
                toast.success('Assignment created and published!');
            } else {
                toast.success('Assignment created as draft!');
            }
            router.push(`/assignments/${assignmentId}`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create assignment');
        } finally {
            setLoading(false);
        }
    };

    const handlePdfSelect = (e) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
        } else {
            toast.error('Please select a PDF file');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Create Assignment" titleHindi="असाइनमेंट बनाएं" backLink="/assignments" />

            <main className="max-w-4xl mx-auto px-4 py-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Basic Info */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
                        <div className="grid gap-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Title (English) *</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Python: Hello World Program"
                                        {...register('title', { required: 'Title is required' })}
                                    />
                                    {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
                                </div>
                                <div>
                                    <label className="label">Title (Hindi)</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="पायथन: हैलो वर्ल्ड प्रोग्राम"
                                        {...register('titleHindi')}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Description</label>
                                <textarea
                                    className="input min-h-[100px]"
                                    placeholder="Describe the assignment..."
                                    {...register('description')}
                                />
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <label className="label">Subject *</label>
                                    <select className="input" {...register('subjectId', { required: 'Subject is required' })}>
                                        <option value="">Select Subject</option>
                                        {subjects.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Experiment Number</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="EXP-01"
                                        {...register('experimentNumber')}
                                    />
                                </div>
                                <div>
                                    <label className="label">Assignment Type *</label>
                                    <select className="input" {...register('assignmentType')}>
                                        <option value="program">Program</option>
                                        <option value="experiment">Experiment</option>
                                        <option value="project">Project</option>
                                        <option value="observation">Observation</option>
                                        <option value="viva_only">Viva Only</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Programming Language</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Python, C++, Java..."
                                        {...register('programmingLanguage')}
                                    />
                                </div>
                                <div>
                                    <label className="label">Aim</label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Learning objective"
                                        {...register('aim')}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Marks Configuration */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Marks Configuration</h2>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="label">Max Marks</label>
                                <input type="number" className="input" {...register('maxMarks', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <label className="label">Passing Marks</label>
                                <input type="number" className="input" {...register('passingMarks', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <label className="label">Viva Marks</label>
                                <input type="number" className="input" {...register('vivaMarks', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <label className="label">Practical Marks</label>
                                <input type="number" className="input" {...register('practicalMarks', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <label className="label">Output Marks</label>
                                <input type="number" className="input" {...register('outputMarks', { valueAsNumber: true })} />
                            </div>
                            <div>
                                <label className="label">Late Penalty %</label>
                                <input type="number" className="input" {...register('latePenaltyPercent', { valueAsNumber: true })} />
                            </div>
                        </div>
                    </div>

                    {/* PDF Attachment */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">PDF Attachment (Optional)</h2>
                        <p className="text-sm text-slate-500 mb-4">Attach a PDF file that students can preview and download for reference.</p>

                        <div
                            className={`border-2 border-dashed rounded-xl p-6 text-center ${pdfFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); handlePdfSelect({ target: { files: e.dataTransfer.files } }); }}
                        >
                            {pdfFile ? (
                                <div className="flex items-center gap-3 justify-center">
                                    <FileText className="w-8 h-8 text-emerald-600" />
                                    <div className="text-left">
                                        <p className="font-medium text-slate-900">{pdfFile.name}</p>
                                        <p className="text-sm text-slate-500">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <button type="button" onClick={() => setPdfFile(null)} className="text-red-500 hover:text-red-700">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer">
                                    <Upload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                                    <p className="text-slate-600">Drag & drop or click to select PDF</p>
                                    <p className="text-xs text-slate-400 mt-1">PDF files only • Max 50MB</p>
                                    <input type="file" className="hidden" accept=".pdf,application/pdf" onChange={handlePdfSelect} />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Schedule */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Schedule & Publishing</h2>

                        {/* Publish Now Toggle */}
                        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={publishNow}
                                    onChange={(e) => setPublishNow(e.target.checked)}
                                    className="w-5 h-5 rounded text-primary-600"
                                />
                                <div className="flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-primary-600" />
                                    <span className="font-medium text-slate-900">Publish Now</span>
                                </div>
                                <span className="text-sm text-slate-500">- Make assignment immediately visible to students</span>
                            </label>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="label flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Schedule Publish DateTime
                                </label>
                                <input
                                    type="datetime-local"
                                    className="input"
                                    disabled={publishNow}
                                    {...register('publishDate')}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    {publishNow ? 'Disabled when "Publish Now" is selected' : 'Leave empty to save as draft'}
                                </p>
                            </div>
                            <div>
                                <label className="label flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Submission Due Date
                                </label>
                                <input type="datetime-local" className="input" {...register('dueDate')} />
                                <p className="text-xs text-slate-500 mt-1">When students must submit by</p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded" {...register('lateSubmissionAllowed')} />
                                <span className="text-sm text-slate-700">Allow late submissions (with penalty)</span>
                            </label>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex justify-end gap-3">
                        <Link href="/assignments" className="btn btn-secondary">Cancel</Link>
                        <button
                            type="submit"
                            className={`btn ${publishNow ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:shadow-lg' : 'btn-primary'}`}
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Creating...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    {publishNow ? <Zap className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                    {publishNow ? 'Create & Publish Now' : 'Save as Draft'}
                                </span>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
