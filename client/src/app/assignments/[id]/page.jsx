'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Calendar, FileText, Clock, CheckCircle,
    Users, Award, Code, Upload, Eye, Trash2, UsersRound, User
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { assignmentsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function AssignmentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [assignment, setAssignment] = useState(null);
    const [loading, setLoading] = useState(true);

    // Remove target confirmation dialog
    const [removeDialog, setRemoveDialog] = useState({ open: false, targetId: null, targetName: '' });
    const [removeLoading, setRemoveLoading] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadAssignment();
    }, [isAuthenticated, params.id]);

    const loadAssignment = async () => {
        try {
            const res = await assignmentsAPI.getById(params.id);
            setAssignment(res.data.data.assignment);
        } catch (error) {
            toast.error('Failed to load assignment');
            router.push('/assignments');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveTargetClick = (targetId, targetName) => {
        setRemoveDialog({ open: true, targetId, targetName });
    };

    const handleRemoveTargetConfirm = async () => {
        if (!removeDialog.targetId) return;
        setRemoveLoading(true);
        try {
            await assignmentsAPI.removeTarget(removeDialog.targetId);
            toast.success('Target removed successfully');
            setRemoveDialog({ open: false, targetId: null, targetName: '' });
            loadAssignment(); // Reload to refresh targets
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove target');
        } finally {
            setRemoveLoading(false);
        }
    };

    const getTargetDisplayName = (target) => {
        if (target.targetType === 'class') {
            return target.targetClass?.name || `Grade ${target.targetClass?.gradeLevel}-${target.targetClass?.section}`;
        } else if (target.targetType === 'group') {
            return target.targetGroup?.name || 'Group';
        } else if (target.targetType === 'student') {
            return target.targetStudent ? `${target.targetStudent.firstName} ${target.targetStudent.lastName}` : 'Student';
        }
        return 'Unknown';
    };

    const getTargetIcon = (targetType) => {
        switch (targetType) {
            case 'class': return <Users className="w-4 h-4" />;
            case 'group': return <UsersRound className="w-4 h-4" />;
            case 'student': return <User className="w-4 h-4" />;
            default: return <Users className="w-4 h-4" />;
        }
    };

    if (loading || !assignment) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const isInstructor = user?.role === 'instructor' || user?.role === 'admin' || user?.role === 'lab_assistant';

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-100">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/assignments" className="text-slate-500 hover:text-slate-700">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <span className={`badge ${assignment.status === 'published' ? 'badge-success' : 'badge-warning'}`}>
                                {assignment.status}
                            </span>
                            {assignment.experimentNumber && (
                                <span className="text-sm text-slate-500">{assignment.experimentNumber}</span>
                            )}
                        </div>
                        <h1 className="text-xl font-semibold text-slate-900 mt-1">{assignment.title}</h1>
                    </div>
                    {user?.role === 'student' && assignment.status === 'published' && (
                        <Link href={`/assignments/${assignment.id}/submit`} className="btn btn-primary">
                            <Upload className="w-4 h-4" />
                            Submit
                        </Link>
                    )}
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Description */}
                        <div className="card p-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Description</h2>
                            <p className="text-slate-600 whitespace-pre-wrap">
                                {assignment.description || 'No description provided.'}
                            </p>
                            {assignment.descriptionHindi && (
                                <p className="text-slate-600 mt-4 pt-4 border-t border-slate-100">
                                    {assignment.descriptionHindi}
                                </p>
                            )}
                        </div>

                        {/* Aim & Procedure */}
                        {(assignment.aim || assignment.procedure) && (
                            <div className="card p-6">
                                {assignment.aim && (
                                    <div className="mb-4">
                                        <h3 className="font-semibold text-slate-900 mb-2">Aim / Objective</h3>
                                        <p className="text-slate-600">{assignment.aim}</p>
                                        {assignment.aimHindi && (
                                            <p className="text-slate-500 text-sm mt-1">{assignment.aimHindi}</p>
                                        )}
                                    </div>
                                )}
                                {assignment.procedure && (
                                    <div>
                                        <h3 className="font-semibold text-slate-900 mb-2">Procedure</h3>
                                        <p className="text-slate-600 whitespace-pre-wrap">{assignment.procedure}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Reference Code */}
                        {assignment.referenceCode && (
                            <div className="card p-6">
                                <h3 className="font-semibold text-slate-900 mb-3">Reference Code</h3>
                                <pre className="code-block">{assignment.referenceCode}</pre>
                            </div>
                        )}

                        {/* Assigned Targets - only for instructors */}
                        {isInstructor && assignment.targets && assignment.targets.length > 0 && (
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-slate-900">Assigned To</h3>
                                    <Link
                                        href={`/assignments/assign?assignmentId=${assignment.id}`}
                                        className="text-sm text-primary-600 hover:underline"
                                    >
                                        + Add More
                                    </Link>
                                </div>
                                <div className="space-y-2">
                                    {assignment.targets.map((target) => (
                                        <div
                                            key={target.id}
                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                                                    {getTargetIcon(target.targetType)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">
                                                        {getTargetDisplayName(target)}
                                                    </p>
                                                    <p className="text-xs text-slate-500 capitalize">{target.targetType}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveTargetClick(target.id, getTargetDisplayName(target))}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                title="Remove assignment from this target"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No targets message */}
                        {isInstructor && (!assignment.targets || assignment.targets.length === 0) && (
                            <div className="card p-6">
                                <div className="text-center py-6">
                                    <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                    <h3 className="font-medium text-slate-700 mb-1">Not Assigned Yet</h3>
                                    <p className="text-sm text-slate-500 mb-4">
                                        This assignment hasn't been assigned to any class, group, or student.
                                    </p>
                                    <Link
                                        href={`/assignments/assign?assignmentId=${assignment.id}`}
                                        className="btn btn-primary"
                                    >
                                        Assign Now
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Attached Files */}
                        {assignment.files?.length > 0 && (
                            <div className="card p-6">
                                <h3 className="font-semibold text-slate-900 mb-3">Attached Files</h3>
                                <div className="space-y-2">
                                    {assignment.files.map((file) => (
                                        <a
                                            key={file.id}
                                            href={file.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                                        >
                                            <FileText className="w-5 h-5 text-slate-500" />
                                            <span className="flex-1 text-slate-700">{file.fileName}</span>
                                            <Eye className="w-4 h-4 text-slate-400" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Info Card */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-slate-900 mb-4">Assignment Details</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Due Date</p>
                                        <p className="font-medium text-slate-900">
                                            {assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : 'No deadline'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <Award className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Max Marks</p>
                                        <p className="font-medium text-slate-900">{assignment.maxMarks}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500">Type</p>
                                        <p className="font-medium text-slate-900 capitalize">{assignment.assignmentType}</p>
                                    </div>
                                </div>

                                {assignment.programmingLanguage && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                            <Code className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500">Language</p>
                                            <p className="font-medium text-slate-900">{assignment.programmingLanguage}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Marks Breakdown */}
                        <div className="card p-6">
                            <h3 className="font-semibold text-slate-900 mb-4">Marks Breakdown</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Practical</span>
                                    <span className="font-medium">{assignment.practicalMarks}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Output</span>
                                    <span className="font-medium">{assignment.outputMarks}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Viva</span>
                                    <span className="font-medium">{assignment.vivaMarks}</span>
                                </div>
                                <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                                    <span className="text-slate-900 font-medium">Total</span>
                                    <span className="font-bold text-primary-600">{assignment.maxMarks}</span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-500 mt-4">
                                Passing: {assignment.passingMarks} marks
                            </p>
                            {assignment.lateSubmissionAllowed && (
                                <p className="text-sm text-amber-600 mt-2">
                                    Late penalty: {assignment.latePenaltyPercent}% per day
                                </p>
                            )}
                        </div>

                        {/* Subject Info */}
                        {assignment.subject && (
                            <div className="card p-6">
                                <h3 className="font-semibold text-slate-900 mb-2">Subject</h3>
                                <p className="text-slate-600">{assignment.subject.name}</p>
                                {assignment.subject.nameHindi && (
                                    <p className="text-slate-500 text-sm">{assignment.subject.nameHindi}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Remove Target Confirmation Dialog */}
            <ConfirmDialog
                isOpen={removeDialog.open}
                onClose={() => setRemoveDialog({ open: false, targetId: null, targetName: '' })}
                onConfirm={handleRemoveTargetConfirm}
                title="Remove Assigned Work"
                message={`Are you sure you want to remove this assignment from "${removeDialog.targetName}"? Students in this target will no longer see this assignment.`}
                confirmText="Remove"
                type="danger"
                loading={removeLoading}
            />
        </div>
    );
}
