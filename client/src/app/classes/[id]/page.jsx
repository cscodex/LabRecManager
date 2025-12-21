'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Users, GraduationCap, ArrowLeft, UserPlus, UsersRound, Plus, Search, Mail, Phone, Calendar, Lock, ChevronLeft, ChevronRight, Shuffle, Trash2, UserMinus, X, ChevronDown, ChevronUp, Monitor } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { classesAPI, labsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function ClassDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isAuthenticated, _hasHydrated, selectedSessionId } = useAuthStore();
    const [classData, setClassData] = useState(null);
    const [students, setStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('students');
    const [initialSessionId, setInitialSessionId] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [autoGrouping, setAutoGrouping] = useState(false);

    // Group management state
    const [expandedGroupId, setExpandedGroupId] = useState(null);
    const [ungroupedStudents, setUngroupedStudents] = useState([]);
    const [addingToGroup, setAddingToGroup] = useState(null);
    const [selectedStudentToAdd, setSelectedStudentToAdd] = useState('');

    // PC assignment state
    const [allPCs, setAllPCs] = useState([]);
    const [assigningPcToGroup, setAssigningPcToGroup] = useState(null);

    // Track initial session and redirect if session changes
    useEffect(() => {
        if (!_hasHydrated || !selectedSessionId) return;

        if (initialSessionId === null) {
            // First load - store the initial session
            setInitialSessionId(selectedSessionId);
        } else if (initialSessionId !== selectedSessionId) {
            // Session changed - redirect to classes list
            router.push('/classes');
        }
    }, [selectedSessionId, initialSessionId, _hasHydrated, router]);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadClassData();
    }, [isAuthenticated, _hasHydrated, params.id]);

    const loadClassData = async () => {
        try {
            const [classRes, studentsRes, groupsRes] = await Promise.all([
                classesAPI.getById(params.id),
                classesAPI.getStudents(params.id),
                classesAPI.getGroups(params.id)
            ]);
            setClassData(classRes.data.data.class);
            setStudents(studentsRes.data.data.students || []);
            setGroups(groupsRes.data.data.groups || []);
        } catch (error) {
            toast.error('Failed to load class data');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(s =>
        s.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentId?.includes(searchQuery) ||
        s.admissionNumber?.includes(searchQuery) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isAdmin = user?.role === 'admin' || user?.role === 'principal';
    const isInstructor = user?.role === 'instructor' || user?.role === 'lab_assistant';

    // Pagination calculations
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // Auto-generate groups handler
    const handleAutoGenerateGroups = async () => {
        if (students.length < 2) {
            toast.error('Need at least 2 students to create groups');
            return;
        }

        setAutoGrouping(true);
        try {
            const res = await classesAPI.autoGenerateGroups(params.id);
            toast.success(res.data.message || 'Groups created successfully!');
            loadClassData();
            setActiveTab('groups');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create groups');
        } finally {
            setAutoGrouping(false);
        }
    };

    // Delete group handler
    const handleDeleteGroup = async (groupId) => {
        if (!confirm('Are you sure you want to delete this group?')) return;
        try {
            await classesAPI.deleteGroup(params.id, groupId);
            toast.success('Group deleted');
            loadClassData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete group');
        }
    };

    // Remove member from group
    const handleRemoveMember = async (groupId, studentId) => {
        try {
            await classesAPI.removeGroupMember(params.id, groupId, studentId);
            toast.success('Student removed from group');
            loadClassData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove student');
        }
    };

    // Load ungrouped students when expanding a group for adding
    const handleShowAddMember = async (groupId) => {
        setAddingToGroup(groupId);
        try {
            const res = await classesAPI.getUngroupedStudents(params.id);
            setUngroupedStudents(res.data.data.students || []);
        } catch (error) {
            toast.error('Failed to load available students');
        }
    };

    // Add member to group
    const handleAddMember = async (groupId) => {
        if (!selectedStudentToAdd) return;
        try {
            await classesAPI.addGroupMember(params.id, groupId, selectedStudentToAdd);
            toast.success('Student added to group');
            setAddingToGroup(null);
            setSelectedStudentToAdd('');
            loadClassData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add student');
        }
    };

    // Load all PCs when showing PC assignment dropdown
    const handleShowAssignPc = async (groupId) => {
        setAssigningPcToGroup(groupId);
        try {
            const res = await labsAPI.getAllPCs();
            setAllPCs(res.data.data.pcs || []);
        } catch (error) {
            toast.error('Failed to load PCs');
        }
    };

    // Assign PC to group
    const handleAssignPc = async (groupId, pcId) => {
        try {
            await labsAPI.assignPcToGroup(groupId, pcId || null);
            toast.success(pcId ? 'PC assigned to group' : 'PC unassigned');
            setAssigningPcToGroup(null);
            loadClassData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign PC');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!classData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-slate-700">Class not found</h2>
                    <Link href="/classes" className="text-primary-600 hover:underline mt-2 inline-block">
                        ← Back to Classes
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title={classData.name} />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Class Info Card */}
                <div className="card p-6 mb-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-2xl">
                                {classData.gradeLevel}
                                {classData.section && <span className="text-lg ml-0.5">{classData.section}</span>}
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">{classData.name}</h2>
                                {classData.nameHindi && (
                                    <p className="text-slate-600">{classData.nameHindi}</p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full font-medium">
                                        {classData.stream || 'General'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {students.length} Students
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <UsersRound className="w-4 h-4" />
                                        {groups.length} Groups
                                    </span>
                                    {classData.academicYear && (
                                        <span className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium ${classData.academicYear.isCurrent
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            <Calendar className="w-3 h-3" />
                                            {classData.academicYear.yearLabel}
                                            {!classData.academicYear.isCurrent && <Lock className="w-3 h-3" />}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {(isAdmin || isInstructor) && (
                                <>
                                    <Link
                                        href={`/classes/${params.id}/groups/create`}
                                        className="btn btn-secondary"
                                    >
                                        <UsersRound className="w-4 h-4" />
                                        Create Group
                                    </Link>
                                    <button
                                        onClick={handleAutoGenerateGroups}
                                        disabled={autoGrouping || students.length < 2}
                                        className="btn btn-secondary"
                                    >
                                        <Shuffle className="w-4 h-4" />
                                        {autoGrouping ? 'Creating...' : 'Auto Groups'}
                                    </button>
                                    <Link
                                        href={`/assignments/assign?classId=${params.id}`}
                                        className="btn btn-primary"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Assign Work
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('students')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'students'
                            ? 'bg-primary-500 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        <Users className="w-4 h-4 inline mr-2" />
                        Students ({students.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === 'groups'
                            ? 'bg-primary-500 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        <UsersRound className="w-4 h-4 inline mr-2" />
                        Groups ({groups.length})
                    </button>
                </div>

                {/* Students Tab */}
                {activeTab === 'students' && (
                    <>
                        {/* Search */}
                        <div className="card p-4 mb-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, student ID, or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="input pl-10"
                                />
                            </div>
                        </div>

                        {/* Students List */}
                        {filteredStudents.length === 0 ? (
                            <div className="card p-12 text-center">
                                <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                                <h3 className="text-lg font-medium text-slate-700 mb-2">No students found</h3>
                                <p className="text-slate-500">
                                    {searchQuery ? 'Try a different search term.' : 'No students enrolled in this class yet.'}
                                </p>
                            </div>
                        ) : (
                            <div className="card overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Roll</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Student</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Student ID</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Email</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Contact</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedStudents.map((student, index) => (
                                            <tr key={student.id} className="hover:bg-slate-50 transition">
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    {student.rollNumber || startIndex + index + 1}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
                                                            {student.firstName?.[0]}{student.lastName?.[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-900">
                                                                {student.firstName} {student.lastName}
                                                            </p>
                                                            {student.firstNameHindi && (
                                                                <p className="text-sm text-slate-500">
                                                                    {student.firstNameHindi} {student.lastNameHindi}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded font-mono text-sm">
                                                        {student.studentId || student.admissionNumber || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <a href={`mailto:${student.email}`} className="flex items-center gap-1 hover:text-primary-600">
                                                        <Mail className="w-4 h-4" />
                                                        {student.email}
                                                    </a>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {student.phone ? (
                                                        <a href={`tel:${student.phone}`} className="flex items-center gap-1 hover:text-primary-600">
                                                            <Phone className="w-4 h-4" />
                                                            {student.phone}
                                                        </a>
                                                    ) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between p-4 border-t border-slate-200">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <span>Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredStudents.length)} of {filteredStudents.length}</span>
                                            <select
                                                value={itemsPerPage}
                                                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                                className="input py-1 px-2 text-sm w-20"
                                            >
                                                <option value={5}>5</option>
                                                <option value={10}>10</option>
                                                <option value={20}>20</option>
                                                <option value={50}>50</option>
                                            </select>
                                            <span>per page</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setCurrentPage(1)}
                                                disabled={currentPage === 1}
                                                className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-50"
                                            >
                                                First
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(p => p - 1)}
                                                disabled={currentPage === 1}
                                                className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded font-medium">
                                                {currentPage} / {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setCurrentPage(p => p + 1)}
                                                disabled={currentPage === totalPages}
                                                className="p-1 rounded hover:bg-slate-100 disabled:opacity-50"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(totalPages)}
                                                disabled={currentPage === totalPages}
                                                className="px-2 py-1 rounded hover:bg-slate-100 disabled:opacity-50"
                                            >
                                                Last
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Groups Tab */}
                {activeTab === 'groups' && (
                    <>
                        {groups.length === 0 ? (
                            <div className="card p-12 text-center">
                                <UsersRound className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                                <h3 className="text-lg font-medium text-slate-700 mb-2">No groups created</h3>
                                <p className="text-slate-500 mb-4">
                                    Create groups to organize students for assignments and projects.
                                </p>
                                {(isAdmin || isInstructor) && (
                                    <Link
                                        href={`/classes/${params.id}/groups/create`}
                                        className="btn btn-primary"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create First Group
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {groups.map((group) => (
                                    <div key={group.id} className="card p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white">
                                                <UsersRound className="w-6 h-6" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-500">
                                                    {group.members?.length || 0} members
                                                </span>
                                                {(isAdmin || isInstructor) && (
                                                    <button
                                                        onClick={() => handleDeleteGroup(group.id)}
                                                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="Delete group"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-lg font-semibold text-slate-900">{group.name}</h3>
                                            <button
                                                onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                                                className="p-1 text-slate-400 hover:text-slate-600"
                                            >
                                                {expandedGroupId === group.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* Assigned PC Display/Assignment */}
                                        <div className="mb-3 p-2 bg-slate-50 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Monitor className="w-4 h-4 text-blue-500" />
                                                    {group.assignedPc ? (
                                                        <span className="text-sm font-medium text-slate-700">
                                                            {group.assignedPc.pcNumber}
                                                            <span className="text-xs text-slate-500 ml-1">({group.assignedPc.lab?.name})</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-slate-400">No PC assigned</span>
                                                    )}
                                                </div>
                                                {(isAdmin || isInstructor) && (
                                                    assigningPcToGroup === group.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <select
                                                                onChange={(e) => handleAssignPc(group.id, e.target.value)}
                                                                className="text-xs py-1 px-2 border rounded"
                                                                defaultValue=""
                                                            >
                                                                <option value="">Select PC...</option>
                                                                <option value="">-- Unassign --</option>
                                                                {allPCs.map(pc => (
                                                                    <option key={pc.id} value={pc.id}>
                                                                        {pc.pcNumber} ({pc.lab?.name})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <button onClick={() => setAssigningPcToGroup(null)} className="text-slate-400 hover:text-slate-600">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleShowAssignPc(group.id)}
                                                            className="text-xs text-blue-600 hover:text-blue-700"
                                                        >
                                                            {group.assignedPc ? 'Change' : 'Assign PC'}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* Collapsed view - member chips */}
                                        {expandedGroupId !== group.id && (
                                            <div className="flex flex-wrap gap-2">
                                                {group.members?.slice(0, 4).map((member) => (
                                                    <span key={member.student.id} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">
                                                        {member.student.firstName} {member.student.lastName?.[0]}.
                                                    </span>
                                                ))}
                                                {group.members?.length > 4 && (
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">
                                                        +{group.members.length - 4}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Expanded view - member list with remove buttons */}
                                        {expandedGroupId === group.id && (
                                            <div className="space-y-2">
                                                {group.members?.map((member) => (
                                                    <div key={member.student.id} className="flex items-center justify-between py-1 px-2 bg-slate-50 rounded">
                                                        <span className="text-sm text-slate-700">
                                                            {member.student.firstName} {member.student.lastName}
                                                            {member.role === 'leader' && <span className="ml-1 text-xs text-amber-600">(Leader)</span>}
                                                        </span>
                                                        {(isAdmin || isInstructor) && (
                                                            <button
                                                                onClick={() => handleRemoveMember(group.id, member.student.id)}
                                                                className="p-1 text-red-400 hover:text-red-600"
                                                                title="Remove from group"
                                                            >
                                                                <UserMinus className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}

                                                {/* Add member section */}
                                                {(isAdmin || isInstructor) && (
                                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                                        {addingToGroup === group.id ? (
                                                            <div className="flex gap-2">
                                                                <select
                                                                    value={selectedStudentToAdd}
                                                                    onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                                                                    className="input text-sm flex-1"
                                                                >
                                                                    <option value="">Select student...</option>
                                                                    {ungroupedStudents.map(s => (
                                                                        <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                                                                    ))}
                                                                </select>
                                                                <button
                                                                    onClick={() => handleAddMember(group.id)}
                                                                    className="btn btn-primary text-xs py-1 px-2"
                                                                    disabled={!selectedStudentToAdd}
                                                                >
                                                                    Add
                                                                </button>
                                                                <button
                                                                    onClick={() => { setAddingToGroup(null); setSelectedStudentToAdd(''); }}
                                                                    className="p-1 text-slate-400 hover:text-slate-600"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleShowAddMember(group.id)}
                                                                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                                                            >
                                                                <UserPlus className="w-4 h-4" /> Add Student
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
