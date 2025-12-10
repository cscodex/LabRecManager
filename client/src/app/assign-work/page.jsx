'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Send, Search, Users, UsersRound, User, BookOpen, Calendar,
    CheckCircle, ChevronRight, Filter, Loader2, X
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function AssignWorkPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState([]);
    const [classes, setClasses] = useState([]);
    const [groups, setGroups] = useState([]);
    const [students, setStudents] = useState([]);

    const [selectedAssignment, setSelectedAssignment] = useState('');
    const [targetType, setTargetType] = useState('class');
    const [selectedTargets, setSelectedTargets] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Multi-select classes for filtering
    const [selectedClassFilters, setSelectedClassFilters] = useState([]);
    const [loadingTargets, setLoadingTargets] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadData();
    }, [isAuthenticated, _hasHydrated]);

    const loadData = async () => {
        try {
            const [assignmentsRes, classesRes] = await Promise.all([
                api.get('/assignments'),
                api.get('/classes')
            ]);
            setAssignments(assignmentsRes.data.data.assignments || []);
            setClasses(classesRes.data.data.classes || []);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTargets = async (type) => {
        setTargetType(type);
        setSelectedTargets([]);
        setSelectedClassFilters([]);
        setGroups([]);
        setStudents([]);
    };

    // Load groups from multiple classes
    const loadGroupsFromClasses = async (classIds) => {
        if (classIds.length === 0) {
            setGroups([]);
            return;
        }

        setLoadingTargets(true);
        try {
            const allGroups = [];
            for (const classId of classIds) {
                const res = await api.get(`/classes/${classId}/groups`);
                const classGroups = (res.data.data.groups || []).map(g => ({
                    ...g,
                    classId,
                    className: getClassName(classId)
                }));
                allGroups.push(...classGroups);
            }
            setGroups(allGroups);
        } catch (error) {
            console.error('Failed to load groups:', error);
            toast.error('Failed to load groups');
            setGroups([]);
        } finally {
            setLoadingTargets(false);
        }
    };

    const loadStudentsFromClasses = async (classIds) => {
        if (classIds.length === 0) {
            // Load all students
            setLoadingTargets(true);
            try {
                const res = await api.get('/users', { params: { role: 'student' } });
                setStudents(res.data.data.users || []);
            } catch (error) {
                console.error('Failed to load students:', error);
                setStudents([]);
            } finally {
                setLoadingTargets(false);
            }
            return;
        }

        setLoadingTargets(true);
        try {
            const allStudents = [];
            const studentIds = new Set();

            for (const classId of classIds) {
                const res = await api.get(`/classes/${classId}/students`);
                const classStudents = (res.data.data.students || []).map(s => ({
                    ...s,
                    classId,
                    className: getClassName(classId)
                }));
                // Avoid duplicates
                classStudents.forEach(s => {
                    if (!studentIds.has(s.id)) {
                        studentIds.add(s.id);
                        allStudents.push(s);
                    }
                });
            }
            setStudents(allStudents);
        } catch (error) {
            console.error('Failed to load students:', error);
            setStudents([]);
        } finally {
            setLoadingTargets(false);
        }
    };

    const toggleClassFilter = (classId) => {
        let newFilters;
        if (selectedClassFilters.includes(classId)) {
            newFilters = selectedClassFilters.filter(id => id !== classId);
        } else {
            newFilters = [...selectedClassFilters, classId];
        }
        setSelectedClassFilters(newFilters);
        setSelectedTargets([]);

        if (targetType === 'group') {
            loadGroupsFromClasses(newFilters);
        } else if (targetType === 'student') {
            loadStudentsFromClasses(newFilters);
        }
    };

    const clearClassFilters = () => {
        setSelectedClassFilters([]);
        setSelectedTargets([]);
        setGroups([]);
        if (targetType === 'student') {
            loadStudentsFromClasses([]);
        }
    };

    const toggleTarget = (id) => {
        setSelectedTargets(prev =>
            prev.includes(id)
                ? prev.filter(t => t !== id)
                : [...prev, id]
        );
    };

    const selectAll = () => {
        const list = getTargetList();
        setSelectedTargets(list.map(item => item.id));
    };

    const clearAll = () => {
        setSelectedTargets([]);
    };

    const handleAssign = async () => {
        if (!selectedAssignment) {
            toast.error('Please select an assignment');
            return;
        }
        if (selectedTargets.length === 0) {
            toast.error('Please select at least one target');
            return;
        }

        setSubmitting(true);
        try {
            let successCount = 0;
            let errorCount = 0;

            for (const targetId of selectedTargets) {
                try {
                    await api.post(`/assignments/${selectedAssignment}/targets`, {
                        targetType,
                        targetId
                    });
                    successCount++;
                } catch (error) {
                    console.error('Failed to assign:', error);
                    errorCount++;
                }
            }

            if (successCount > 0) {
                toast.success(`Assigned to ${successCount} ${targetType}(s)`);
            }
            if (errorCount > 0) {
                toast.error(`Failed to assign to ${errorCount} target(s)`);
            }

            setSelectedTargets([]);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign');
        } finally {
            setSubmitting(false);
        }
    };

    const getTargetList = () => {
        switch (targetType) {
            case 'class': return classes;
            case 'group': return groups;
            case 'student': return students;
            default: return [];
        }
    };

    const getClassName = (classId) => {
        const cls = classes.find(c => c.id === classId);
        return cls ? (cls.name || `Grade ${cls.gradeLevel}-${cls.section}`) : '';
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
            <PageHeader title="Assign Work" titleHindi="कार्य सौंपें">
                <Link href="/assignments/create" className="btn btn-primary">
                    <BookOpen className="w-4 h-4" />
                    New Assignment
                </Link>
            </PageHeader>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Step 1: Select Assignment */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm">1</span>
                        Select Assignment
                    </h2>
                    <select
                        value={selectedAssignment}
                        onChange={(e) => setSelectedAssignment(e.target.value)}
                        className="input"
                    >
                        <option value="">Choose an assignment...</option>
                        {assignments.map(a => (
                            <option key={a.id} value={a.id}>
                                {a.experimentNumber ? `${a.experimentNumber}: ` : ''}{a.title}
                                {a.status === 'draft' ? ' (Draft)' : ''}
                            </option>
                        ))}
                    </select>
                    {assignments.length === 0 && (
                        <p className="text-sm text-slate-500 mt-2">
                            No assignments found. <Link href="/assignments/create" className="text-primary-600 hover:underline">Create one first</Link>.
                        </p>
                    )}
                </div>

                {/* Step 2: Select Target Type */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm">2</span>
                        Assign To
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                        <button
                            type="button"
                            onClick={() => loadTargets('class')}
                            className={`p-4 rounded-xl border-2 text-center transition ${targetType === 'class'
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <Users className={`w-8 h-8 mx-auto mb-2 ${targetType === 'class' ? 'text-primary-600' : 'text-slate-500'}`} />
                            <p className="font-medium">Class</p>
                            <p className="text-xs text-slate-500">Entire class</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => loadTargets('group')}
                            className={`p-4 rounded-xl border-2 text-center transition ${targetType === 'group'
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <UsersRound className={`w-8 h-8 mx-auto mb-2 ${targetType === 'group' ? 'text-primary-600' : 'text-slate-500'}`} />
                            <p className="font-medium">Group</p>
                            <p className="text-xs text-slate-500">Student groups</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => loadTargets('student')}
                            className={`p-4 rounded-xl border-2 text-center transition ${targetType === 'student'
                                    ? 'border-primary-500 bg-primary-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <User className={`w-8 h-8 mx-auto mb-2 ${targetType === 'student' ? 'text-primary-600' : 'text-slate-500'}`} />
                            <p className="font-medium">Individual</p>
                            <p className="text-xs text-slate-500">Specific students</p>
                        </button>
                    </div>
                </div>

                {/* Step 3: Select Targets */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm">3</span>
                        Select {targetType === 'class' ? 'Classes' : targetType === 'group' ? 'Groups' : 'Students'}
                    </h2>

                    {/* Multi-select class filter for groups and students */}
                    {(targetType === 'group' || targetType === 'student') && (
                        <div className="mb-4 p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <Filter className="w-4 h-4" />
                                    Filter by Classes (select one or more)
                                </label>
                                {selectedClassFilters.length > 0 && (
                                    <button
                                        onClick={clearClassFilters}
                                        className="text-xs text-slate-500 hover:text-slate-700"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>

                            {/* Selected class tags */}
                            {selectedClassFilters.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {selectedClassFilters.map(classId => (
                                        <span
                                            key={classId}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                                        >
                                            {getClassName(classId)}
                                            <button
                                                onClick={() => toggleClassFilter(classId)}
                                                className="hover:bg-primary-200 rounded-full p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Class checkboxes */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                                {classes.map(c => (
                                    <label
                                        key={c.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition text-sm ${selectedClassFilters.includes(c.id)
                                                ? 'bg-primary-100 border border-primary-300'
                                                : 'bg-white border border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedClassFilters.includes(c.id)}
                                            onChange={() => toggleClassFilter(c.id)}
                                            className="w-4 h-4 rounded text-primary-600"
                                        />
                                        <span className="truncate">
                                            {c.name || `${c.gradeLevel}-${c.section}`}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {targetType === 'group' && selectedClassFilters.length === 0 && (
                                <p className="text-xs text-slate-500 mt-3">
                                    Select one or more classes to view their groups
                                </p>
                            )}
                        </div>
                    )}

                    {/* Selection controls */}
                    {getTargetList().length > 0 && (
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-slate-500">
                                {selectedTargets.length} of {getTargetList().length} selected
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={selectAll}
                                    className="text-sm text-primary-600 hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    type="button"
                                    onClick={clearAll}
                                    className="text-sm text-slate-500 hover:underline"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {loadingTargets ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                            </div>
                        ) : getTargetList().length === 0 ? (
                            <div className="text-center py-12">
                                {targetType === 'group' && selectedClassFilters.length === 0 ? (
                                    <>
                                        <UsersRound className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                        <p className="text-slate-500">Select classes above to view their groups</p>
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                        <p className="text-slate-500">
                                            No {targetType === 'class' ? 'classes' : targetType === 'group' ? 'groups' : 'students'} found
                                            {selectedClassFilters.length > 0 && ' in selected classes'}
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            getTargetList().map(item => (
                                <label
                                    key={item.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${selectedTargets.includes(item.id)
                                            ? 'bg-primary-50 border-2 border-primary-200'
                                            : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTargets.includes(item.id)}
                                        onChange={() => toggleTarget(item.id)}
                                        className="w-5 h-5 rounded text-primary-600"
                                    />
                                    {targetType === 'class' && (
                                        <>
                                            <Users className="w-5 h-5 text-slate-500" />
                                            <div className="flex-1">
                                                <p className="font-medium">{item.name || `Grade ${item.gradeLevel}-${item.section}`}</p>
                                                {item._count?.enrollments !== undefined && (
                                                    <p className="text-xs text-slate-500">{item._count.enrollments} students</p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                    {targetType === 'group' && (
                                        <>
                                            <UsersRound className="w-5 h-5 text-purple-500" />
                                            <div className="flex-1">
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {item.className && <span className="text-primary-600">{item.className} • </span>}
                                                    {item._count?.members !== undefined
                                                        ? `${item._count.members} members`
                                                        : item.members?.length !== undefined
                                                            ? `${item.members.length} members`
                                                            : 'Group'
                                                    }
                                                </p>
                                            </div>
                                        </>
                                    )}
                                    {targetType === 'student' && (
                                        <>
                                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-medium">
                                                {item.firstName?.[0]}{item.lastName?.[0]}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{item.firstName} {item.lastName}</p>
                                                <p className="text-xs text-slate-500">
                                                    {item.className && <span className="text-primary-600">{item.className} • </span>}
                                                    {item.admissionNumber || item.email}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </label>
                            ))
                        )}
                    </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end gap-3">
                    <Link href="/assignments" className="btn btn-secondary">Cancel</Link>
                    <button
                        onClick={handleAssign}
                        disabled={submitting || !selectedAssignment || selectedTargets.length === 0}
                        className="btn btn-primary disabled:opacity-50"
                    >
                        {submitting ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Assigning...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Send className="w-4 h-4" />
                                Assign to {selectedTargets.length || '...'} {targetType}(s)
                            </span>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
