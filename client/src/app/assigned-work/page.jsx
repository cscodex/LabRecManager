'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ListChecks, Search, Users, UsersRound, User, BookOpen, Calendar,
    CheckCircle, ChevronRight, Filter, Eye, MoreVertical, Trash2, Edit2, Lock, Unlock, X, Save, FileText, Award, Code, Download
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function AssignedWorkPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated, selectedSessionId } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [assignedWork, setAssignedWork] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    const [assignments, setAssignments] = useState([]);

    // Filters
    const [filterClass, setFilterClass] = useState('');
    const [filterType, setFilterType] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Delete confirmation dialog
    const [deleteDialog, setDeleteDialog] = useState({ open: false, targetId: null, targetName: '', assignmentTitle: '' });
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Edit modal state
    const [editModal, setEditModal] = useState({ open: false, target: null });
    const [editForm, setEditForm] = useState({ assignmentId: '', targetType: '', targetId: '', dueDate: '' });
    const [editLoading, setEditLoading] = useState(false);

    // View modal state
    const [viewModal, setViewModal] = useState({ open: false, target: null });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadData();
    }, [isAuthenticated, _hasHydrated, selectedSessionId]);

    const loadData = async () => {
        try {
            const [assignmentsRes, classesRes, usersRes] = await Promise.all([
                api.get('/assignments', { params: { includeTargets: 'true' } }),
                api.get('/classes'),
                api.get('/users', { params: { role: 'student' } })
            ]);

            const assignmentsData = assignmentsRes.data.data.assignments || [];
            const classesData = classesRes.data.data.classes || [];
            const studentsData = usersRes.data.data.users || [];

            setAssignments(assignmentsData);
            setClasses(classesData);
            setStudents(studentsData);

            // Load groups from all classes
            const allGroups = [];
            for (const cls of classesData) {
                try {
                    const groupRes = await api.get(`/classes/${cls.id}/groups`);
                    const grps = groupRes.data.data.groups || [];
                    grps.forEach(g => allGroups.push({ ...g, className: cls.name || `Grade ${cls.gradeLevel}-${cls.section}` }));
                } catch (e) { /* ignore */ }
            }
            setGroups(allGroups);

            // Create lookup maps
            const classMap = {};
            classesData.forEach(c => { classMap[c.id] = c; });

            const studentMap = {};
            studentsData.forEach(s => { studentMap[s.id] = s; });

            const groupMap = {};
            allGroups.forEach(g => { groupMap[g.id] = g; });

            // Flatten to show each assignment-target pair
            const targets = [];
            assignmentsData.forEach(assignment => {
                if (assignment.targets && assignment.targets.length > 0) {
                    assignment.targets.forEach(target => {
                        const targetClass = target.targetClassId ? classMap[target.targetClassId] : null;
                        const targetStudent = target.targetStudentId ? studentMap[target.targetStudentId] : null;
                        const targetGroup = target.targetGroupId ? groupMap[target.targetGroupId] : target.targetGroup;

                        targets.push({
                            id: target.id,
                            assignment: assignment,
                            targetType: target.targetType,
                            targetClassId: target.targetClassId,
                            targetClass: targetClass,
                            targetGroup: targetGroup,
                            targetGroupId: target.targetGroupId,
                            targetStudentId: target.targetStudentId,
                            targetStudent: targetStudent,
                            assignedAt: target.assignedAt,
                            assignedBy: target.assignedBy,
                            dueDate: target.dueDate,
                            isLocked: target.isLocked || false
                        });
                    });
                }
            });

            setAssignedWork(targets);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load assigned work');
        } finally {
            setLoading(false);
        }
    };

    const getTargetName = (item) => {
        if (item.targetType === 'class') {
            if (item.targetClass) {
                return item.targetClass.name || `Grade ${item.targetClass.gradeLevel}-${item.targetClass.section}`;
            }
            return 'Class';
        }
        if (item.targetType === 'group') {
            return item.targetGroup?.name || 'Group';
        }
        if (item.targetType === 'student') {
            if (item.targetStudent) {
                return `${item.targetStudent.firstName} ${item.targetStudent.lastName}`;
            }
            return 'Student';
        }
        return 'Unknown';
    };

    const getTargetIcon = (type) => {
        switch (type) {
            case 'class': return <Users className="w-5 h-5 text-blue-500" />;
            case 'group': return <UsersRound className="w-5 h-5 text-purple-500" />;
            case 'student': return <User className="w-5 h-5 text-green-500" />;
            default: return <Users className="w-5 h-5 text-slate-400" />;
        }
    };

    const handleRemoveClick = (target) => {
        setDeleteDialog({
            open: true,
            targetId: target.id,
            targetName: getTargetName(target),
            assignmentTitle: target.assignment.title
        });
    };

    const handleRemoveConfirm = async () => {
        if (!deleteDialog.targetId) return;
        setDeleteLoading(true);
        try {
            await api.delete(`/assignments/targets/${deleteDialog.targetId}`);
            toast.success('Target removed successfully');
            setAssignedWork(prev => prev.filter(t => t.id !== deleteDialog.targetId));
            setDeleteDialog({ open: false, targetId: null, targetName: '', assignmentTitle: '' });
        } catch (error) {
            toast.error('Failed to remove target');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Edit handlers
    const handleEditClick = (target) => {
        setEditForm({
            assignmentId: target.assignment.id,
            targetType: target.targetType,
            targetId: target.targetType === 'class' ? target.targetClassId :
                target.targetType === 'group' ? target.targetGroupId : target.targetStudentId,
            dueDate: target.dueDate ? new Date(target.dueDate).toISOString().slice(0, 16) : ''
        });
        setEditModal({ open: true, target });
    };

    const handleEditSave = async () => {
        if (!editModal.target) return;
        setEditLoading(true);
        try {
            await api.put(`/assignments/targets/${editModal.target.id}`, {
                targetType: editForm.targetType,
                targetClassId: editForm.targetType === 'class' ? editForm.targetId : null,
                targetGroupId: editForm.targetType === 'group' ? editForm.targetId : null,
                targetStudentId: editForm.targetType === 'student' ? editForm.targetId : null,
                dueDate: editForm.dueDate || null
            });
            toast.success('Target updated successfully');
            setEditModal({ open: false, target: null });
            loadData(); // Reload to refresh
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update target');
        } finally {
            setEditLoading(false);
        }
    };

    // Lock/Unlock handlers
    const handleToggleLock = async (target) => {
        try {
            await api.put(`/assignments/targets/${target.id}`, {
                isLocked: !target.isLocked
            });
            toast.success(target.isLocked ? 'Target unlocked' : 'Target locked');
            setAssignedWork(prev => prev.map(t =>
                t.id === target.id ? { ...t, isLocked: !t.isLocked } : t
            ));
        } catch (error) {
            toast.error('Failed to update lock status');
        }
    };

    // View handlers
    const handleViewClick = (target) => {
        setViewModal({ open: true, target });
    };

    // Filter and search
    let filteredWork = assignedWork;

    if (filterClass) {
        filteredWork = filteredWork.filter(item =>
            item.targetType === 'class' && item.targetClassId === filterClass
        );
    }

    if (filterType) {
        filteredWork = filteredWork.filter(item => item.targetType === filterType);
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredWork = filteredWork.filter(item =>
            item.assignment.title.toLowerCase().includes(query) ||
            getTargetName(item).toLowerCase().includes(query)
        );
    }

    // Group by assignment for better display
    const groupedByAssignment = {};
    filteredWork.forEach(item => {
        if (!groupedByAssignment[item.assignment.id]) {
            groupedByAssignment[item.assignment.id] = {
                assignment: item.assignment,
                targets: []
            };
        }
        groupedByAssignment[item.assignment.id].targets.push(item);
    });

    const stats = {
        total: assignedWork.length,
        classes: assignedWork.filter(t => t.targetType === 'class').length,
        groups: assignedWork.filter(t => t.targetType === 'group').length,
        students: assignedWork.filter(t => t.targetType === 'student').length
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Assigned Work" titleHindi="सौंपा गया कार्य">
                <Link href="/assignments/assign" className="btn btn-primary">
                    <ListChecks className="w-4 h-4" />
                    Assign New Work
                </Link>
            </PageHeader>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                        <p className="text-sm text-slate-500">Total Targets</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{stats.classes}</p>
                        <p className="text-sm text-slate-500">To Classes</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">{stats.groups}</p>
                        <p className="text-sm text-slate-500">To Groups</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{stats.students}</p>
                        <p className="text-sm text-slate-500">To Individuals</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="card p-4 mb-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search assignments or targets..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="input pl-10"
                                />
                            </div>
                        </div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="input w-40"
                        >
                            <option value="">All Types</option>
                            <option value="class">Classes</option>
                            <option value="group">Groups</option>
                            <option value="student">Students</option>
                        </select>
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="input w-48"
                        >
                            <option value="">All Classes</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name || `Grade ${c.gradeLevel}-${c.section}`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Assigned Work List */}
                {Object.keys(groupedByAssignment).length === 0 ? (
                    <div className="card p-12 text-center">
                        <ListChecks className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No assigned work found</h3>
                        <p className="text-slate-500 mb-4">
                            {searchQuery || filterType || filterClass
                                ? 'Try adjusting your filters'
                                : 'Start by assigning assignments to classes, groups, or students'}
                        </p>
                        <Link href="/assignments/assign" className="btn btn-primary inline-flex">
                            Assign Work
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.values(groupedByAssignment).map(({ assignment, targets }) => (
                            <div key={assignment.id} className="card overflow-hidden">
                                {/* Assignment Header */}
                                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                                            <BookOpen className="w-5 h-5 text-primary-600" />
                                        </div>
                                        <div>
                                            <button
                                                onClick={() => handleViewClick(targets[0])}
                                                className="font-semibold text-slate-900 hover:text-primary-600 text-left"
                                            >
                                                {assignment.experimentNumber && (
                                                    <span className="text-primary-600">{assignment.experimentNumber}: </span>
                                                )}
                                                {assignment.title}
                                            </button>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                <span className={`px-2 py-0.5 rounded ${assignment.status === 'published'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {assignment.status}
                                                </span>
                                                <span>Max: {assignment.maxMarks} marks</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-sm text-slate-500">
                                        {targets.length} target{targets.length !== 1 && 's'}
                                    </span>
                                </div>

                                {/* Targets List */}
                                <div className="divide-y divide-slate-100">
                                    {targets.map(target => (
                                        <div key={target.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                {getTargetIcon(target.targetType)}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-slate-900">
                                                            {getTargetName(target)}
                                                        </p>
                                                        {target.isLocked && (
                                                            <Lock className="w-3.5 h-3.5 text-amber-500" title="Locked" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        {target.targetType.charAt(0).toUpperCase() + target.targetType.slice(1)}
                                                        {target.dueDate && (
                                                            <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                                                                <Calendar className="w-3 h-3" />
                                                                Due: {new Date(target.dueDate).toLocaleString('en-IN', {
                                                                    dateStyle: 'medium',
                                                                    timeStyle: 'short'
                                                                })}
                                                            </span>
                                                        )}
                                                        {target.assignedAt && (
                                                            <span> • Assigned {new Date(target.assignedAt).toLocaleDateString()}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {/* View Icon */}
                                                <button
                                                    onClick={() => handleViewClick(target)}
                                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {/* Edit Icon */}
                                                <button
                                                    onClick={() => handleEditClick(target)}
                                                    className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition"
                                                    title="Edit Target"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {/* Lock/Unlock Icon */}
                                                <button
                                                    onClick={() => handleToggleLock(target)}
                                                    className={`p-2 rounded-lg transition ${target.isLocked
                                                        ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                                                        : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                                                        }`}
                                                    title={target.isLocked ? 'Unlock' : 'Lock'}
                                                >
                                                    {target.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                </button>
                                                {/* Delete Icon */}
                                                <button
                                                    onClick={() => handleRemoveClick(target)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                    title="Remove target"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* View Modal - Shows assignment + target details */}
            {viewModal.open && viewModal.target && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewModal({ open: false, target: null })}>
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-primary-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">
                                        {viewModal.target.assignment.experimentNumber && (
                                            <span className="text-primary-600">{viewModal.target.assignment.experimentNumber}: </span>
                                        )}
                                        {viewModal.target.assignment.title}
                                    </h3>
                                    <p className="text-sm text-slate-500">{viewModal.target.assignment.assignmentType}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewModal({ open: false, target: null })} className="p-2 hover:bg-slate-200 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {/* Target Info */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <h4 className="font-medium text-slate-700 mb-3">Assigned To</h4>
                                <div className="flex items-center gap-3">
                                    {getTargetIcon(viewModal.target.targetType)}
                                    <div>
                                        <p className="font-medium text-slate-900">{getTargetName(viewModal.target)}</p>
                                        <p className="text-sm text-slate-500 capitalize">{viewModal.target.targetType}</p>
                                    </div>
                                    {viewModal.target.isLocked && (
                                        <span className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs">
                                            <Lock className="w-3 h-3" /> Locked
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                    {viewModal.target.dueDate && (
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-amber-500" />
                                            <span>Due: {new Date(viewModal.target.dueDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                        </div>
                                    )}
                                    {viewModal.target.assignedAt && (
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span>Assigned: {new Date(viewModal.target.assignedAt).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Assignment Details */}
                            <div className="grid md:grid-cols-3 gap-3">
                                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                                    <Award className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                                    <p className="text-xs text-slate-500">Max Marks</p>
                                    <p className="font-semibold text-slate-900">{viewModal.target.assignment.maxMarks}</p>
                                </div>
                                <div className="bg-amber-50 rounded-lg p-3 text-center">
                                    <FileText className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                                    <p className="text-xs text-slate-500">Type</p>
                                    <p className="font-semibold text-slate-900 capitalize">{viewModal.target.assignment.assignmentType}</p>
                                </div>
                                {viewModal.target.assignment.programmingLanguage && (
                                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                                        <Code className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                                        <p className="text-xs text-slate-500">Language</p>
                                        <p className="font-semibold text-slate-900">{viewModal.target.assignment.programmingLanguage}</p>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            {viewModal.target.assignment.description && (
                                <div>
                                    <h4 className="font-medium text-slate-700 mb-2">Description</h4>
                                    <p className="text-slate-600 text-sm whitespace-pre-wrap">{viewModal.target.assignment.description}</p>
                                </div>
                            )}

                            {/* Aim */}
                            {viewModal.target.assignment.aim && (
                                <div>
                                    <h4 className="font-medium text-slate-700 mb-2">Aim / Objective</h4>
                                    <p className="text-slate-600 text-sm">{viewModal.target.assignment.aim}</p>
                                </div>
                            )}

                            {/* PDF Attachment */}
                            {viewModal.target.assignment.pdfAttachmentUrl && (
                                <div className="bg-red-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-6 h-6 text-red-600" />
                                            <div>
                                                <p className="font-medium text-slate-900">{viewModal.target.assignment.pdfAttachmentName || 'PDF Attachment'}</p>
                                                <p className="text-xs text-slate-500">PDF Document</p>
                                            </div>
                                        </div>
                                        <a
                                            href={viewModal.target.assignment.pdfAttachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-secondary text-sm py-1.5"
                                        >
                                            <Download className="w-4 h-4" /> Download
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Marks Breakdown */}
                            <div>
                                <h4 className="font-medium text-slate-700 mb-2">Marks Breakdown</h4>
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                    <div className="bg-slate-100 rounded p-2 text-center">
                                        <p className="text-slate-500 text-xs">Practical</p>
                                        <p className="font-semibold">{viewModal.target.assignment.practicalMarks}</p>
                                    </div>
                                    <div className="bg-slate-100 rounded p-2 text-center">
                                        <p className="text-slate-500 text-xs">Output</p>
                                        <p className="font-semibold">{viewModal.target.assignment.outputMarks}</p>
                                    </div>
                                    <div className="bg-slate-100 rounded p-2 text-center">
                                        <p className="text-slate-500 text-xs">Passing</p>
                                        <p className="font-semibold">{viewModal.target.assignment.passingMarks}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                            <button
                                onClick={() => { setViewModal({ open: false, target: null }); handleEditClick(viewModal.target); }}
                                className="btn btn-secondary"
                            >
                                <Edit2 className="w-4 h-4" /> Edit Target
                            </button>
                            <button
                                onClick={() => setViewModal({ open: false, target: null })}
                                className="btn btn-primary"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModal.open && editModal.target && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditModal({ open: false, target: null })}>
                    <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Edit Assignment Target</h3>
                            <button onClick={() => setEditModal({ open: false, target: null })} className="p-1 hover:bg-slate-100 rounded">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <p className="text-sm text-slate-500 mb-4">
                            Editing: <strong>{editModal.target.assignment.title}</strong>
                        </p>

                        <div className="space-y-4">
                            {/* Target Type */}
                            <div>
                                <label className="label">Target Type</label>
                                <select
                                    value={editForm.targetType}
                                    onChange={(e) => setEditForm({ ...editForm, targetType: e.target.value, targetId: '' })}
                                    className="input"
                                >
                                    <option value="class">Class</option>
                                    <option value="group">Group</option>
                                    <option value="student">Student</option>
                                </select>
                            </div>

                            {/* Target Selection */}
                            <div>
                                <label className="label">
                                    {editForm.targetType === 'class' ? 'Select Class' :
                                        editForm.targetType === 'group' ? 'Select Group' : 'Select Student'}
                                </label>
                                <select
                                    value={editForm.targetId}
                                    onChange={(e) => setEditForm({ ...editForm, targetId: e.target.value })}
                                    className="input"
                                >
                                    <option value="">Select...</option>
                                    {editForm.targetType === 'class' && classes.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name || `Grade ${c.gradeLevel}-${c.section}`}
                                        </option>
                                    ))}
                                    {editForm.targetType === 'group' && groups.map(g => (
                                        <option key={g.id} value={g.id}>
                                            {g.name} ({g.className})
                                        </option>
                                    ))}
                                    {editForm.targetType === 'student' && students.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.firstName} {s.lastName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="label">Due Date (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.dueDate}
                                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                                    className="input"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setEditModal({ open: false, target: null })}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={editLoading || !editForm.targetId}
                                className="btn btn-primary"
                            >
                                {editLoading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, targetId: null, targetName: '', assignmentTitle: '' })}
                onConfirm={handleRemoveConfirm}
                title="Remove Assigned Work"
                message={`Are you sure you want to remove "${deleteDialog.assignmentTitle}" from "${deleteDialog.targetName}"? Students in this target will no longer see this assignment.`}
                confirmText="Remove"
                type="danger"
                loading={deleteLoading}
            />
        </div>
    );
}
