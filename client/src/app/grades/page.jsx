'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, Search, FileText, TrendingUp, Calendar, CheckCircle, Eye, Clock, X, History, Edit3, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { gradesAPI, gradeScalesAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function GradesPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [grades, setGrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ avg: 0, total: 0, passed: 0 });
    const [filter, setFilter] = useState('all');

    // History modal state
    const [historyModal, setHistoryModal] = useState(false);
    const [historyData, setHistoryData] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Grade scales state
    const [gradeScales, setGradeScales] = useState([]);
    const [showScalePanel, setShowScalePanel] = useState(false);
    const [scaleHistory, setScaleHistory] = useState([]);
    const [scaleRevisions, setScaleRevisions] = useState([]);
    const [currentGradeScales, setCurrentGradeScales] = useState([]);
    const [showScaleHistory, setShowScaleHistory] = useState(false);
    const [loadingScaleHistory, setLoadingScaleHistory] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadGrades();
        loadGradeScales();
    }, [isAuthenticated, _hasHydrated]);

    const loadGradeScales = async () => {
        try {
            const res = await gradeScalesAPI.getAll();
            setGradeScales(res.data.data.gradeScales || []);
        } catch (error) {
            console.error('Failed to load grade scales:', error);
        }
    };

    const loadScaleHistory = async () => {
        setLoadingScaleHistory(true);
        try {
            const res = await gradeScalesAPI.getHistory({ limit: 30 });
            const data = res.data.data;
            setScaleHistory(data.history || []);
            setScaleRevisions(data.revisions || []);
            setCurrentGradeScales(data.currentScales || []);
            setShowScaleHistory(true);
        } catch (error) {
            console.error('Failed to load scale history:', error);
            toast.error('Failed to load grade scale history');
        } finally {
            setLoadingScaleHistory(false);
        }
    };

    const loadGrades = async () => {
        try {
            const params = {};
            if (user?.role === 'student') {
                params.isPublished = 'true';
            }

            const res = await gradesAPI.getAll(params);
            const gradesData = res.data.data.grades || [];
            setGrades(gradesData);

            if (gradesData.length > 0) {
                const total = gradesData.length;
                const sum = gradesData.reduce((acc, g) => acc + (Number(g.percentage) || 0), 0);
                const avg = sum / total;
                const passed = gradesData.filter(g => (Number(g.percentage) || 0) >= 40).length;
                setStats({ avg: Number(avg).toFixed(1), total, passed });
            }
        } catch (error) {
            console.error('Failed to load grades:', error);
            toast.error('Failed to load grades');
        } finally {
            setLoading(false);
        }
    };

    const viewHistory = async (gradeId) => {
        setLoadingHistory(true);
        setHistoryModal(true);
        try {
            const res = await gradesAPI.getHistory(gradeId);
            setHistoryData(res.data.data);
        } catch (error) {
            console.error('Failed to load history:', error);
            toast.error('Failed to load grade history');
            setHistoryModal(false);
        } finally {
            setLoadingHistory(false);
        }
    };

    const getGradeColor = (letter) => {
        const colors = {
            'A+': 'from-emerald-400 to-emerald-600',
            'A': 'from-emerald-400 to-emerald-500',
            'A1': 'from-emerald-400 to-emerald-600',
            'A2': 'from-emerald-400 to-emerald-500',
            'B+': 'from-blue-400 to-blue-600',
            'B': 'from-blue-400 to-blue-500',
            'B1': 'from-blue-400 to-blue-600',
            'B2': 'from-blue-400 to-blue-500',
            'C+': 'from-amber-400 to-amber-600',
            'C': 'from-amber-400 to-amber-500',
            'C1': 'from-amber-400 to-amber-600',
            'C2': 'from-amber-400 to-amber-500',
            'D': 'from-orange-400 to-orange-600',
            'E': 'from-red-400 to-red-500',
            'F': 'from-red-400 to-red-600'
        };
        return colors[letter] || 'from-slate-400 to-slate-600';
    };

    // Filter grades
    let filteredGrades = grades;
    if (filter === 'published') {
        filteredGrades = grades.filter(g => g.isPublished);
    } else if (filter === 'unpublished') {
        filteredGrades = grades.filter(g => !g.isPublished);
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader
                title={user?.role === 'student' ? 'My Grades' : 'Grading'}
                titleHindi={user?.role === 'student' ? 'मेरे ग्रेड' : 'ग्रेडिंग'}
            >
                {user?.role !== 'student' && (
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="input w-40"
                    >
                        <option value="all">All Grades</option>
                        <option value="published">Published</option>
                        <option value="unpublished">Unpublished</option>
                    </select>
                )}
            </PageHeader>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="card p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                                <Award className="w-6 h-6 text-primary-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Average Score</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.avg}%</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Passed</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.passed} / {stats.total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Total Graded</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grade Scale Panel */}
                {gradeScales.length > 0 && (
                    <div className="mb-6">
                        <button
                            onClick={() => setShowScalePanel(!showScalePanel)}
                            className="w-full card p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                                    <Info className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-semibold text-slate-900">Current Grade Scale</h3>
                                    <p className="text-sm text-slate-500">View grading criteria and marks distribution</p>
                                </div>
                            </div>
                            {showScalePanel ? (
                                <ChevronUp className="w-5 h-5 text-slate-400" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-slate-400" />
                            )}
                        </button>

                        {showScalePanel && (
                            <div className="card mt-2 p-6 animate-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-semibold text-slate-900">Grade Distribution</h4>
                                    <button
                                        onClick={loadScaleHistory}
                                        disabled={loadingScaleHistory}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-all"
                                    >
                                        {loadingScaleHistory ? (
                                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                        ) : (
                                            <History className="w-4 h-4" />
                                        )}
                                        View Changes History
                                    </button>
                                </div>
                                {/* Current Grade Scale Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                                                <th className="px-4 py-3 text-left font-semibold rounded-tl-lg">Grade</th>
                                                <th className="px-4 py-3 text-left font-semibold">Range (%)</th>
                                                <th className="px-4 py-3 text-left font-semibold rounded-tr-lg">Grade Points</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gradeScales.map((scale, idx) => (
                                                <tr
                                                    key={scale.id}
                                                    className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                                        }`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-bold text-lg ${scale.minPercentage >= 90 ? 'bg-emerald-100 text-emerald-700' :
                                                            scale.minPercentage >= 75 ? 'bg-green-100 text-green-700' :
                                                                scale.minPercentage >= 60 ? 'bg-blue-100 text-blue-700' :
                                                                    scale.minPercentage >= 45 ? 'bg-amber-100 text-amber-700' :
                                                                        scale.minPercentage >= 33 ? 'bg-orange-100 text-orange-700' :
                                                                            'bg-red-100 text-red-700'
                                                            }`}>
                                                            {scale.letter || scale.gradeLetter}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700 font-medium">
                                                        {scale.minPercentage}% - {scale.maxPercentage}%
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600">
                                                        {scale.gradePoints || scale.gradePoint} pts
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Scale History Section - Grouped by Revisions */}
                                {showScaleHistory && scaleRevisions.length > 0 && (
                                    <div className="mt-6 pt-6 border-t border-slate-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                                    <History className="w-5 h-5 text-orange-500" />
                                                    Grade Scale Revision History
                                                </h4>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {scaleRevisions.length} revision(s) found
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setShowScaleHistory(false)}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="space-y-6 max-h-[500px] overflow-y-auto">
                                            {scaleRevisions.map((revision, revIdx) => (
                                                <div key={revision.id} className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                                                    {/* Revision Header */}
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-medium shadow-sm">
                                                                Revision #{scaleRevisions.length - revIdx}
                                                            </span>
                                                            <span className="px-2 py-1 rounded-md bg-slate-200 text-slate-600 text-xs">
                                                                {revision.changesCount} grade(s) modified
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(revision.timestamp).toLocaleString()}
                                                        </span>
                                                    </div>

                                                    {/* Grade Scale Table for this Revision */}
                                                    <div className="bg-white rounded-lg overflow-hidden shadow-sm mb-3">
                                                        <table className="w-full border-collapse text-sm">
                                                            <thead>
                                                                <tr className="bg-slate-100">
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Grade</th>
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Previous Range</th>
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">New Range</th>
                                                                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Points</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {revision.scalesSummary.map((scale, idx) => (
                                                                    <tr key={idx} className={`border-t border-slate-100 ${scale.action === 'created' ? 'bg-green-50' :
                                                                            scale.action === 'updated' ? 'bg-blue-50' :
                                                                                scale.action === 'deleted' ? 'bg-red-50' :
                                                                                    'bg-white'
                                                                        }`}>
                                                                        <td className="px-3 py-2">
                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${scale.action === 'created' ? 'bg-green-200 text-green-700' :
                                                                                    scale.action === 'updated' ? 'bg-blue-200 text-blue-700' :
                                                                                        scale.action === 'deleted' ? 'bg-red-200 text-red-700' :
                                                                                            'bg-slate-200 text-slate-600'
                                                                                }`}>
                                                                                {scale.action}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2">
                                                                            <span className="font-bold text-slate-800">
                                                                                {scale.newState?.letter || scale.previousState?.letter || '-'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-slate-500">
                                                                            {scale.previousState ? (
                                                                                <span className={scale.action === 'updated' || scale.action === 'deleted' ? 'line-through' : ''}>
                                                                                    {scale.previousState.minPct}% - {scale.previousState.maxPct}%
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-slate-300">—</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-slate-700 font-medium">
                                                                            {scale.newState ? (
                                                                                <span>
                                                                                    {scale.newState.minPct}% - {scale.newState.maxPct}%
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-slate-300">—</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-slate-600">
                                                                            {scale.newState?.points ?? scale.previousState?.points ?? '-'} pts
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Revision Footer */}
                                                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
                                                        {revision.changedBy && (
                                                            <span>
                                                                Modified by <span className="font-medium text-slate-700">{revision.changedBy.firstName} {revision.changedBy.lastName}</span>
                                                            </span>
                                                        )}
                                                        {revision.reason && (
                                                            <span className="italic text-slate-400">"{revision.reason}"</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {showScaleHistory && scaleRevisions.length === 0 && (
                                    <div className="mt-6 pt-6 border-t border-slate-200 text-center text-slate-500 py-4">
                                        No grade scale revisions recorded yet.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Grades List */}
                {filteredGrades.length === 0 ? (
                    <div className="card p-12 text-center">
                        <Award className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No grades yet</h3>
                        <p className="text-slate-500">
                            {user?.role === 'student'
                                ? 'Your grades will appear here once your submissions are graded and published.'
                                : 'Grades you assign will appear here.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredGrades.map((grade) => (
                            <div key={grade.id} className="card card-hover p-6">
                                <div className="flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getGradeColor(grade.gradeLetter)} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                                        {grade.gradeLetter || '--'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-semibold text-slate-900">
                                                {grade.submission?.assignment?.title || 'Assignment'}
                                            </h3>
                                            {!grade.isPublished && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                                                    Unpublished
                                                </span>
                                            )}
                                            {grade.modifiedAt && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-1">
                                                    <Edit3 className="w-3 h-3" /> Modified
                                                </span>
                                            )}
                                        </div>
                                        {grade.submission?.assignment?.titleHindi && (
                                            <p className="text-sm text-slate-500 mb-1">
                                                {grade.submission.assignment.titleHindi}
                                            </p>
                                        )}
                                        {user?.role !== 'student' && grade.submission?.student && (
                                            <p className="text-sm text-slate-600">
                                                Student: {grade.submission.student.firstName} {grade.submission.student.lastName}
                                                {grade.submission.student.admissionNumber && (
                                                    <span className="text-slate-400"> ({grade.submission.student.admissionNumber})</span>
                                                )}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                Graded: {new Date(grade.gradedAt).toLocaleDateString()}
                                            </span>
                                            {grade.gradedBy && (
                                                <span>By: {grade.gradedBy.firstName} {grade.gradedBy.lastName}</span>
                                            )}
                                            {grade.academicYear && (
                                                <span className="text-primary-600">Session: {grade.academicYear.yearLabel}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {/* History Button - Visible for all users */}
                                        <button
                                            onClick={() => viewHistory(grade.id)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium shadow-lg hover:shadow-xl hover:from-orange-600 hover:to-amber-600 transition-all"
                                            title="View modification history"
                                        >
                                            <History className="w-5 h-5" />
                                            <span className="text-sm">History</span>
                                        </button>
                                        <div className="text-right">
                                            <p className="text-3xl font-bold text-slate-900">
                                                {grade.finalMarks}
                                            </p>
                                            <p className="text-sm text-slate-500">out of {grade.maxMarks}</p>
                                            <p className="text-sm font-medium text-primary-600 mt-1">
                                                {Number(grade.percentage) ? Number(grade.percentage).toFixed(1) : '0.0'}%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Marks Breakdown */}
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-sm">
                                        <div className="text-center">
                                            <p className="text-slate-500">Practical</p>
                                            <p className="font-medium">{grade.practicalMarks || 0}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-slate-500">Output</p>
                                            <p className="font-medium">{grade.outputMarks || 0}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-slate-500">Viva</p>
                                            <p className="font-medium">{grade.vivaMarks || 0}</p>
                                        </div>
                                        {Number(grade.latePenaltyMarks) > 0 && (
                                            <div className="text-center">
                                                <p className="text-red-500">Late Penalty</p>
                                                <p className="font-medium text-red-600">-{grade.latePenaltyMarks}</p>
                                            </div>
                                        )}
                                        <div className="text-center">
                                            <p className="text-slate-500">Final</p>
                                            <p className="font-bold text-primary-600">{grade.finalMarks}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Feedback */}
                                {(grade.codeFeedback || grade.generalRemarks) && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        {grade.codeFeedback && (
                                            <div className="mb-2">
                                                <span className="text-sm font-medium text-slate-700">Code Feedback: </span>
                                                <span className="text-sm text-slate-600">{grade.codeFeedback}</span>
                                            </div>
                                        )}
                                        {grade.generalRemarks && (
                                            <div>
                                                <span className="text-sm font-medium text-slate-700">Remarks: </span>
                                                <span className="text-sm text-slate-600">{grade.generalRemarks}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Actions for instructor */}
                                {user?.role !== 'student' && !grade.isPublished && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await gradesAPI.publish(grade.id);
                                                    toast.success('Grade published to student');
                                                    loadGrades();
                                                } catch (error) {
                                                    toast.error('Failed to publish grade');
                                                }
                                            }}
                                            className="btn btn-primary"
                                        >
                                            Publish to Student
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* History Modal */}
            {historyModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoryModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-primary-500 to-primary-600">
                            <div className="text-white">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <History className="w-6 h-6" />
                                    Grade Modification History
                                </h2>
                                {historyData?.grade && (
                                    <p className="text-primary-100 text-sm mt-1">
                                        {historyData.grade.studentName} - {historyData.grade.assignmentTitle}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setHistoryModal(false)} className="text-white/80 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            {loadingHistory ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
                                </div>
                            ) : historyData ? (
                                <>
                                    {/* Current Grade Info */}
                                    <div className="bg-slate-50 rounded-xl p-4 mb-6">
                                        <h3 className="font-semibold text-slate-700 mb-3">Current Grade</h3>
                                        <div className="grid grid-cols-4 gap-4 text-center">
                                            <div>
                                                <p className="text-xs text-slate-500">Practical</p>
                                                <p className="font-bold text-lg">{historyData.grade.currentMarks.practical}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Output</p>
                                                <p className="font-bold text-lg">{historyData.grade.currentMarks.output}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Viva</p>
                                                <p className="font-bold text-lg">{historyData.grade.currentMarks.viva}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">Final</p>
                                                <p className="font-bold text-lg text-primary-600">{historyData.grade.currentMarks.final}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm text-slate-500">
                                            <span>Graded: {new Date(historyData.grade.gradedAt).toLocaleString()}</span>
                                            {historyData.grade.modifiedAt && (
                                                <span className="text-blue-600">
                                                    Last Modified: {new Date(historyData.grade.modifiedAt).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        {historyData.grade.academicYear && (
                                            <p className="mt-2 text-sm text-primary-600">
                                                Session: {historyData.grade.academicYear.yearLabel}
                                            </p>
                                        )}
                                    </div>

                                    {/* Modification History */}
                                    <h3 className="font-semibold text-slate-700 mb-3">
                                        Modification History ({historyData.totalModifications} changes)
                                    </h3>

                                    {historyData.history.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500">
                                            <Clock className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                                            <p>No modifications yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {historyData.history.map((entry, idx) => (
                                                <div key={entry.id} className="border border-slate-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-400">#{historyData.totalModifications - idx}</span>
                                                            <p className="text-sm font-medium text-slate-700">
                                                                {entry.modifiedBy.firstName} {entry.modifiedBy.lastName}
                                                            </p>
                                                        </div>
                                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {new Date(entry.modifiedAt).toLocaleString()}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div className="bg-red-50 rounded-lg p-3">
                                                            <p className="text-xs text-red-600 font-medium mb-1">Before</p>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-lg text-red-700">
                                                                    {entry.previousMarks?.gradeLetter || '-'}
                                                                </span>
                                                                <span className="text-slate-600">
                                                                    {entry.previousMarks?.finalMarks ?? '-'}/{entry.previousMarks?.maxMarks ?? 100} ({Number(entry.previousMarks?.percentage || 0).toFixed(1)}%)
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-3 text-slate-600 text-xs">
                                                                <span>P: {entry.previousMarks?.practicalMarks ?? '-'}</span>
                                                                <span>O: {entry.previousMarks?.outputMarks ?? '-'}</span>
                                                                <span>V: {entry.previousMarks?.vivaMarks ?? '-'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-green-50 rounded-lg p-3">
                                                            <p className="text-xs text-green-600 font-medium mb-1">After</p>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-lg text-green-700">
                                                                    {entry.newMarks?.gradeLetter || '-'}
                                                                </span>
                                                                <span className="text-slate-600">
                                                                    {entry.newMarks?.finalMarks ?? '-'}/{entry.newMarks?.maxMarks ?? 100} ({Number(entry.newMarks?.percentage || 0).toFixed(1)}%)
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-3 text-slate-600 text-xs">
                                                                <span>P: {entry.newMarks?.practicalMarks ?? '-'}</span>
                                                                <span>O: {entry.newMarks?.outputMarks ?? '-'}</span>
                                                                <span>V: {entry.newMarks?.vivaMarks ?? '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {entry.reason && (
                                                        <p className="mt-2 text-sm text-slate-600 italic">
                                                            Reason: {entry.reason}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

