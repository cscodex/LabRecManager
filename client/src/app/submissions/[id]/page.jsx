'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import {
    ArrowLeft, Code, FileText, User, Calendar,
    CheckCircle, XCircle, Award, Send, MessageSquare
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { submissionsAPI, gradesAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SubmissionDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [grading, setGrading] = useState(false);
    const [showGradeForm, setShowGradeForm] = useState(false);

    const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
        defaultValues: {
            practicalMarks: 0,
            outputMarks: 0,
            vivaMarks: 0
        }
    });

    const watchMarks = watch(['practicalMarks', 'outputMarks', 'vivaMarks']);
    const totalMarks = (Number(watchMarks[0]) || 0) + (Number(watchMarks[1]) || 0) + (Number(watchMarks[2]) || 0);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadSubmission();
    }, [isAuthenticated, params.id]);

    const loadSubmission = async () => {
        try {
            const res = await submissionsAPI.getById(params.id);
            setSubmission(res.data.data.submission);

            if (res.data.data.submission.grade) {
                const grade = res.data.data.submission.grade;
                setValue('practicalMarks', grade.practicalMarks);
                setValue('outputMarks', grade.outputMarks);
                setValue('vivaMarks', grade.vivaMarks);
                setValue('codeFeedback', grade.codeFeedback);
                setValue('outputFeedback', grade.outputFeedback);
                setValue('generalRemarks', grade.generalRemarks);
            }
        } catch (error) {
            toast.error('Failed to load submission');
            router.push('/submissions');
        } finally {
            setLoading(false);
        }
    };

    const onGradeSubmit = async (data) => {
        setGrading(true);
        try {
            await gradesAPI.grade(submission.id, {
                ...data,
                practicalMarks: Number(data.practicalMarks),
                outputMarks: Number(data.outputMarks),
                vivaMarks: Number(data.vivaMarks)
            });
            toast.success('Submission graded successfully!');
            loadSubmission();
            setShowGradeForm(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to grade submission');
        } finally {
            setGrading(false);
        }
    };

    const handlePublishGrade = async () => {
        try {
            await gradesAPI.publish(submission.grade.id);
            toast.success('Grade published to student!');
            loadSubmission();
        } catch (error) {
            toast.error('Failed to publish grade');
        }
    };

    const handleRequestRevision = async () => {
        try {
            await submissionsAPI.updateStatus(submission.id, 'needs_revision');
            toast.success('Revision requested');
            loadSubmission();
        } catch (error) {
            toast.error('Failed to request revision');
        }
    };

    if (loading || !submission) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const isInstructor = user?.role === 'instructor' || user?.role === 'admin' || user?.role === 'lab_assistant';
    const canGrade = isInstructor && (submission.status === 'submitted' || submission.status === 'under_review');

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/submissions" className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-semibold text-slate-900">
                            {submission.assignment?.title || 'Submission'}
                        </h1>
                        <p className="text-sm text-slate-500">
                            {submission.student?.firstName} {submission.student?.lastName}
                            {submission.student?.admissionNumber && ` (${submission.student.admissionNumber})`}
                        </p>
                    </div>
                    <span className={`badge ${submission.status === 'graded' ? 'badge-success' :
                            submission.status === 'needs_revision' ? 'badge-danger' : 'badge-primary'
                        }`}>
                        {submission.status.replace('_', ' ')}
                    </span>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Code */}
                        {submission.codeContent && (
                            <div className="card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Code className="w-5 h-5 text-primary-600" />
                                    <h2 className="text-lg font-semibold text-slate-900">Submitted Code</h2>
                                </div>
                                <pre className="code-block overflow-x-auto">{submission.codeContent}</pre>
                            </div>
                        )}

                        {/* Output */}
                        {submission.outputContent && (
                            <div className="card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="w-5 h-5 text-emerald-600" />
                                    <h2 className="text-lg font-semibold text-slate-900">Output</h2>
                                </div>
                                <pre className="code-block bg-slate-800 text-green-400">{submission.outputContent}</pre>
                            </div>
                        )}

                        {/* Observations */}
                        {(submission.observations || submission.conclusion) && (
                            <div className="card p-6">
                                {submission.observations && (
                                    <div className="mb-4">
                                        <h3 className="font-semibold text-slate-900 mb-2">Observations</h3>
                                        <p className="text-slate-600">{submission.observations}</p>
                                        {submission.observationsHindi && (
                                            <p className="text-slate-500 text-sm mt-1">{submission.observationsHindi}</p>
                                        )}
                                    </div>
                                )}
                                {submission.conclusion && (
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-2">Conclusion</h3>
                                        <p className="text-slate-600">{submission.conclusion}</p>
                                        {submission.conclusionHindi && (
                                            <p className="text-slate-500 text-sm mt-1">{submission.conclusionHindi}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Grading Form (for instructors) */}
                        {canGrade && (
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-slate-900">Grade Submission</h2>
                                    {!showGradeForm && (
                                        <button
                                            onClick={() => setShowGradeForm(true)}
                                            className="btn btn-primary"
                                        >
                                            <Award className="w-4 h-4" />
                                            Grade Now
                                        </button>
                                    )}
                                </div>

                                {showGradeForm && (
                                    <form onSubmit={handleSubmit(onGradeSubmit)} className="space-y-4">
                                        <div className="grid md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="label">Practical Marks (/{submission.assignment?.practicalMarks || 60})</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    min="0"
                                                    max={submission.assignment?.practicalMarks || 60}
                                                    {...register('practicalMarks', { required: true, valueAsNumber: true })}
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Output Marks (/{submission.assignment?.outputMarks || 20})</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    min="0"
                                                    max={submission.assignment?.outputMarks || 20}
                                                    {...register('outputMarks', { required: true, valueAsNumber: true })}
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Viva Marks (/{submission.assignment?.vivaMarks || 20})</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    min="0"
                                                    max={submission.assignment?.vivaMarks || 20}
                                                    {...register('vivaMarks', { required: true, valueAsNumber: true })}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-3 bg-primary-50 rounded-lg">
                                            <p className="text-primary-700 font-medium">
                                                Total: {totalMarks} / {submission.assignment?.maxMarks || 100}
                                            </p>
                                        </div>

                                        <div>
                                            <label className="label">Code Feedback</label>
                                            <textarea
                                                className="input min-h-[80px]"
                                                placeholder="Feedback on the code quality, logic, etc."
                                                {...register('codeFeedback')}
                                            />
                                        </div>

                                        <div>
                                            <label className="label">Output Feedback</label>
                                            <textarea
                                                className="input min-h-[80px]"
                                                placeholder="Feedback on the output correctness"
                                                {...register('outputFeedback')}
                                            />
                                        </div>

                                        <div>
                                            <label className="label">General Remarks</label>
                                            <textarea
                                                className="input min-h-[80px]"
                                                placeholder="Overall comments and suggestions"
                                                {...register('generalRemarks')}
                                            />
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowGradeForm(false)}
                                                className="btn btn-secondary"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={grading}
                                            >
                                                {grading ? 'Saving...' : 'Save Grade'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRequestRevision}
                                                className="btn btn-danger"
                                            >
                                                Request Revision
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Submission Info */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-slate-900 mb-4">Submission Details</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <p className="text-sm text-slate-500">Submitted</p>
                                        <p className="font-medium">{new Date(submission.submittedAt).toLocaleString()}</p>
                                    </div>
                                </div>
                                {submission.isLate && (
                                    <div className="p-3 bg-red-50 rounded-lg">
                                        <p className="text-red-700 text-sm font-medium">
                                            Late by {submission.lateDays} days
                                        </p>
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <p className="text-sm text-slate-500">Revision</p>
                                        <p className="font-medium">#{submission.submissionNumber}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grade Card */}
                        {submission.grade && (
                            <div className="card p-6">
                                <h3 className="font-semibold text-slate-900 mb-4">Grade</h3>
                                <div className="text-center mb-4">
                                    <div className="text-4xl font-bold text-primary-600">
                                        {submission.grade.finalMarks}
                                    </div>
                                    <p className="text-slate-500">out of {submission.grade.maxMarks}</p>
                                    {submission.grade.gradeLetter && (
                                        <span className="inline-block mt-2 px-3 py-1 bg-primary-100 text-primary-700 rounded-full font-semibold">
                                            Grade: {submission.grade.gradeLetter}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2 text-sm border-t border-slate-100 pt-4">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Practical</span>
                                        <span className="font-medium">{submission.grade.practicalMarks}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Output</span>
                                        <span className="font-medium">{submission.grade.outputMarks}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Viva</span>
                                        <span className="font-medium">{submission.grade.vivaMarks}</span>
                                    </div>
                                    {submission.grade.latePenaltyMarks > 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>Late Penalty</span>
                                            <span>-{submission.grade.latePenaltyMarks}</span>
                                        </div>
                                    )}
                                </div>

                                {isInstructor && !submission.grade.isPublished && (
                                    <button
                                        onClick={handlePublishGrade}
                                        className="btn btn-success w-full mt-4"
                                    >
                                        <Send className="w-4 h-4" />
                                        Publish Grade
                                    </button>
                                )}

                                {submission.grade.isPublished && (
                                    <div className="mt-4 p-2 bg-emerald-50 rounded text-center">
                                        <span className="text-emerald-700 text-sm">✓ Published to student</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Feedback */}
                        {submission.grade && (submission.grade.codeFeedback || submission.grade.generalRemarks) && (
                            <div className="card p-6">
                                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5" />
                                    Feedback
                                </h3>
                                {submission.grade.codeFeedback && (
                                    <div className="mb-3">
                                        <p className="text-sm text-slate-500 mb-1">Code Feedback</p>
                                        <p className="text-slate-700">{submission.grade.codeFeedback}</p>
                                    </div>
                                )}
                                {submission.grade.generalRemarks && (
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">General Remarks</p>
                                        <p className="text-slate-700">{submission.grade.generalRemarks}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
