'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Upload, Code, Image, FileText, Send } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { assignmentsAPI, submissionsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SubmitAssignmentPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingSubmission, setExistingSubmission] = useState(null);

    const { register, handleSubmit, formState: { errors }, setValue } = useForm();

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadData();
    }, [isAuthenticated, params.id]);

    const loadData = async () => {
        try {
            // First try to load the assignment
            let assignmentData = null;
            try {
                const assignmentRes = await assignmentsAPI.getById(params.id);
                assignmentData = assignmentRes.data.data.assignment;
                setAssignment(assignmentData);
            } catch (assignmentError) {
                console.error('Assignment load error:', assignmentError);
                const status = assignmentError.response?.status;
                const message = assignmentError.response?.data?.message;

                if (status === 403) {
                    toast.error('You are not assigned to this assignment');
                } else if (status === 404) {
                    toast.error('Assignment not found');
                } else {
                    toast.error(message || 'Failed to load assignment details');
                }
                router.push('/assignments');
                return;
            }

            // Then try to load existing submissions (this is optional, failure shouldn't block)
            try {
                const submissionsRes = await submissionsAPI.getMySubmissions({ assignmentId: params.id });
                const submissions = submissionsRes.data.data.submissions || [];
                if (submissions.length > 0) {
                    setExistingSubmission(submissions[0]);
                    setValue('codeContent', submissions[0].codeContent || '');
                    setValue('outputContent', submissions[0].outputContent || '');
                    setValue('observations', submissions[0].observations || '');
                    setValue('conclusion', submissions[0].conclusion || '');
                }
            } catch (submissionError) {
                // Don't block on submission load failure, just log it
                console.warn('Could not load existing submissions:', submissionError);
            }
        } catch (error) {
            console.error('Unexpected error loading data:', error);
            toast.error('An unexpected error occurred');
            router.push('/assignments');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data) => {
        setSubmitting(true);
        try {
            if (existingSubmission) {
                await submissionsAPI.update(existingSubmission.id, {
                    ...data,
                    status: 'submitted'
                });
                toast.success('Submission updated!');
            } else {
                await submissionsAPI.create({
                    assignmentId: params.id,
                    ...data,
                    status: 'submitted'
                });
                toast.success('Assignment submitted successfully!');
            }
            router.push('/assignments');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href={`/assignments/${params.id}`} className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl font-semibold text-slate-900">
                            {existingSubmission ? 'Update Submission' : 'Submit Assignment'}
                        </h1>
                        <p className="text-sm text-slate-500">{assignment?.title}</p>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6">
                {existingSubmission && (
                    <div className="alert alert-info mb-6">
                        <p>You have already submitted this assignment. You can update your submission below.</p>
                        <p className="text-sm mt-1">
                            Submission #{existingSubmission.submissionNumber} •
                            Status: <span className="font-medium capitalize">{existingSubmission.status}</span>
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Code Content */}
                    <div className="card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Code className="w-5 h-5 text-primary-600" />
                            <h2 className="text-lg font-semibold text-slate-900">Code / Program</h2>
                        </div>
                        <textarea
                            className="input font-mono text-sm min-h-[300px]"
                            placeholder="Paste your code here..."
                            {...register('codeContent', { required: assignment?.assignmentType === 'program' ? 'Code is required' : false })}
                        />
                        {errors.codeContent && (
                            <p className="text-red-500 text-sm mt-1">{errors.codeContent.message}</p>
                        )}
                    </div>

                    {/* Output */}
                    <div className="card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-emerald-600" />
                            <h2 className="text-lg font-semibold text-slate-900">Output</h2>
                        </div>
                        <textarea
                            className="input font-mono text-sm min-h-[150px]"
                            placeholder="Paste your program output here..."
                            {...register('outputContent')}
                        />
                    </div>

                    {/* Observations */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Observations</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Observations (English)</label>
                                <textarea
                                    className="input min-h-[120px]"
                                    placeholder="What did you observe during the experiment?"
                                    {...register('observations')}
                                />
                            </div>
                            <div>
                                <label className="label">Observations (Hindi)</label>
                                <textarea
                                    className="input min-h-[120px]"
                                    placeholder="प्रयोग के दौरान आपने क्या देखा?"
                                    {...register('observationsHindi')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Conclusion */}
                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Conclusion</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Conclusion (English)</label>
                                <textarea
                                    className="input min-h-[100px]"
                                    placeholder="What did you learn from this experiment?"
                                    {...register('conclusion')}
                                />
                            </div>
                            <div>
                                <label className="label">Conclusion (Hindi)</label>
                                <textarea
                                    className="input min-h-[100px]"
                                    placeholder="इस प्रयोग से आपने क्या सीखा?"
                                    {...register('conclusionHindi')}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex justify-end gap-3">
                        <Link href={`/assignments/${params.id}`} className="btn btn-secondary">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Submitting...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Send className="w-4 h-4" />
                                    {existingSubmission ? 'Update Submission' : 'Submit Assignment'}
                                </span>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
