'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users, Check, X, Search, History } from 'lucide-react';
import toast from 'react-hot-toast';

interface Student {
    id: string;
    roll_number: string;
    name: string;
    class: string | null;
}

interface Assignment {
    id: string;
    student_id: string;
    roll_number: string;
    name: string;
}

interface AssignmentLog {
    id: string;
    action: string;
    maxAttempts: number;
    createdAt: string;
    studentName: string;
    rollNumber: string;
    adminName: string;
    startTime?: string;
    endTime?: string;
}

export default function ExamAssignPage() {
    const params = useParams();
    const examId = params.id as string;

    const [activeTab, setActiveTab] = useState<'assign' | 'history'>('assign');

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [historyLogs, setHistoryLogs] = useState<AssignmentLog[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Filters & Options
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterSchool, setFilterSchool] = useState<string>('');
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [availableSchools, setAvailableSchools] = useState<string[]>([]);

    // Configuration
    const [mode, setMode] = useState<'append' | 'replace'>('append');
    const [maxAttempts, setMaxAttempts] = useState(1);
    const [scheduleType, setScheduleType] = useState<'none' | 'existing' | 'new'>('none');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    // Auto-assign settings
    const [autoAssign, setAutoAssign] = useState(false);
    const [autoAssignAttempts, setAutoAssignAttempts] = useState(3);
    const [savingAutoAssign, setSavingAutoAssign] = useState(false);

    // Derived Statistics
    const assignedCount = assignments.length;

    const loadData = useCallback(async () => {
        try {
            const response = await fetch(`/api/admin/exams/${examId}/assign`);
            const data = await response.json();
            if (data.success) {
                setAssignments(data.assignments);
                setAllStudents(data.allStudents);
                setAvailableClasses(data.filters?.classes || []);
                setAvailableSchools(data.filters?.schools || []);
                setSelectedIds(new Set());
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [examId]);

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/admin/exams/${examId}/assign/history`);
            const data = await res.json();
            if (data.success) {
                setHistoryLogs(data.logs);
            }
        } catch (error) {
            toast.error('Failed to load history');
        } finally {
            setLoadingHistory(false);
        }
    }, [examId]);

    const loadAutoAssignSettings = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/exams/${examId}/auto-assign`);
            const data = await res.json();
            if (data.success) {
                setAutoAssign(data.autoAssign);
                setAutoAssignAttempts(data.attempts);
            }
        } catch (error) {
            console.error('Failed to load auto-assign settings:', error);
        }
    }, [examId]);

    const saveAutoAssignSettings = async () => {
        setSavingAutoAssign(true);
        try {
            const res = await fetch(`/api/admin/exams/${examId}/auto-assign`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoAssign, attempts: autoAssignAttempts }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
            } else {
                toast.error(data.error || 'Failed to save');
            }
        } catch (error) {
            toast.error('Failed to save auto-assign settings');
        } finally {
            setSavingAutoAssign(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'assign') {
            loadData();
            loadAutoAssignSettings();
        }
        if (activeTab === 'history') loadHistory();
    }, [activeTab, loadData, loadHistory, loadAutoAssignSettings]);

    const toggleStudent = (studentId: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId);
        } else {
            newSelected.add(studentId);
        }
        setSelectedIds(newSelected);
    };

    const selectAllFiltered = () => {
        const newSelected = new Set(selectedIds);
        filteredStudents.forEach(s => newSelected.add(s.id));
        setSelectedIds(newSelected);
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleAssign = async () => {
        if (selectedIds.size === 0) {
            toast.error('No students selected');
            return;
        }

        if (mode === 'replace' && !confirm('WARNING: "Replace All" will REMOVE assignments for students not currently selected. Are you sure?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/exams/${examId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentIds: Array.from(selectedIds),
                    mode,
                    maxAttempts,
                    scheduleType,
                    startTime: scheduleType === 'new' ? new Date(startTime).toISOString() : null,
                    endTime: scheduleType === 'new' ? new Date(endTime).toISOString() : null,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                toast.success(`Successfully assigned to ${data.count} students`);
                loadData();
                setSelectedIds(new Set());
            } else {
                toast.error(data.error || 'Failed to assign');
            }
        } catch (error) {
            toast.error('Failed to save assignments');
        }
    };

    // Update attempts only - for already assigned students
    const handleUpdateAttempts = async () => {
        if (selectedIds.size === 0) {
            toast.error('No students selected');
            return;
        }

        // Only allow updating for students who are already assigned
        const selectedAssigned = Array.from(selectedIds).filter(id =>
            assignments.some(a => a.student_id === id)
        );

        if (selectedAssigned.length === 0) {
            toast.error('None of the selected students are currently assigned to this exam');
            return;
        }

        try {
            const response = await fetch(`/api/admin/exams/${examId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentIds: selectedAssigned,
                    mode: 'append',
                    maxAttempts,
                    updateAttemptsOnly: true, // This skips the overlap check
                }),
            });

            const data = await response.json();
            if (response.ok) {
                toast.success(`Updated attempts to ${maxAttempts} for ${data.count} students`);
                loadData();
                setSelectedIds(new Set());
            } else {
                toast.error(data.error || 'Failed to update attempts');
            }
        } catch (error) {
            toast.error('Failed to update attempts');
        }
    };

    const filteredStudents = allStudents.filter(s => {
        const matchesSearch =
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.roll_number.toLowerCase().includes(search.toLowerCase());
        const matchesClass = filterClass ? s.class === filterClass : true;
        const matchesSchool = filterSchool ? (s as any).school === filterSchool : true;
        return matchesSearch && matchesClass && matchesSchool;
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white shadow-sm z-10 sticky top-0">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Link href={`/admin/exams/${examId}`} className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Manage Assignments</h1>
                                {activeTab === 'assign' && (
                                    <p className="text-sm text-gray-500">
                                        Total Assigned: {assignedCount} • Selected: {selectedIds.size}
                                    </p>
                                )}
                            </div>
                        </div>
                        {activeTab === 'assign' && (
                            <button
                                onClick={handleAssign}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                            >
                                <Users className="w-4 h-4" />
                                {mode === 'replace' ? 'Replace Assignments' : 'Assign Selected'}
                            </button>
                        )}
                    </div>

                    <div className="flex space-x-1 border-b">
                        <button
                            onClick={() => setActiveTab('assign')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'assign'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            Assign Students
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${activeTab === 'history'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <History className="w-4 h-4" />
                            Assignment History
                        </button>
                    </div>
                </div>
            </header>

            {activeTab === 'assign' ? (
                <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 flex gap-6 items-start">
                    {/* Left Sidebar: Configuration */}
                    <div className="w-80 flex-shrink-0 space-y-6">

                        {/* 1. Exam Schedule (Most Important) */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 ring-1 ring-blue-50">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="p-1 bg-blue-100 rounded text-blue-600"><History className="w-4 h-4" /></span>
                                Exam Schedule
                            </h3>

                            <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div className="relative inline-flex items-center">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={scheduleType === 'new'}
                                            onChange={(e) => setScheduleType(e.target.checked ? 'new' : 'none')}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                        {scheduleType === 'new' ? 'Scheduled Access' : 'Always Open'}
                                    </span>
                                </label>

                                {scheduleType === 'new' && (
                                    <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start Date & Time</label>
                                            <input
                                                type="datetime-local"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">End Date & Time</label>
                                            <input
                                                type="datetime-local"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 italic">
                                            Students can only access the exam between these times.
                                        </p>
                                    </div>
                                )}
                                {scheduleType === 'none' && (
                                    <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                        Students can start the exam at any time after assignment.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 2. Assignment Mode & Limits */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-5">
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Assignment Mode</h3>
                                <div className="space-y-2">
                                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'append' ? 'bg-gray-50 border-gray-300 ring-1 ring-gray-200' : 'hover:bg-gray-50 border-gray-200'}`}>
                                        <input type="radio" name="mode" checked={mode === 'append'} onChange={() => setMode('append')} className="mt-1" />
                                        <div>
                                            <span className="font-medium text-gray-900 text-sm block">Add to Existing</span>
                                            <span className="text-xs text-gray-500">Adds selected students. Does not affect others.</span>
                                        </div>
                                    </label>
                                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'replace' ? 'bg-red-50 border-red-200 ring-1 ring-red-200' : 'hover:bg-gray-50 border-gray-200'}`}>
                                        <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-1" />
                                        <div>
                                            <span className="font-medium text-red-900 text-sm block">Replace All</span>
                                            <span className="text-xs text-red-700">Removes EVERYONE else. Only selected will remain.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts Allowed</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={maxAttempts}
                                        onChange={(e) => setMaxAttempts(parseInt(e.target.value))}
                                        className="w-20 px-3 py-2 border rounded-lg text-center"
                                    />
                                    <span className="text-sm text-gray-500">attempts per student</span>
                                </div>

                                {/* Update Attempts Button - for already assigned students */}
                                {selectedIds.size > 0 && assignments.some(a => selectedIds.has(a.student_id)) && (
                                    <button
                                        onClick={handleUpdateAttempts}
                                        className="w-full mt-3 px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium hover:bg-orange-100 transition"
                                    >
                                        Update Attempts for {Array.from(selectedIds).filter(id => assignments.some(a => a.student_id === id)).length} Assigned
                                    </button>
                                )}
                                <p className="text-xs text-gray-500 mt-2 italic">
                                    Use &quot;Update Attempts&quot; if a student has exhausted their attempts and needs more.
                                </p>
                            </div>
                        </div>

                        {/* 3. Auto-Assign */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-900">Auto-Assign</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoAssign}
                                        onChange={(e) => setAutoAssign(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 mb-4">
                                Automatically assign this exam to new students when they register.
                            </p>

                            {autoAssign && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Default Attempts</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={autoAssignAttempts}
                                            onChange={(e) => setAutoAssignAttempts(parseInt(e.target.value) || 3)}
                                            className="w-full px-3 py-2 border rounded-lg text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={saveAutoAssignSettings}
                                        disabled={savingAutoAssign}
                                        className="w-full px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50"
                                    >
                                        {savingAutoAssign ? 'Saving...' : 'Save Settings'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content: Student List */}
                    <div className="flex-1 space-y-4">
                        {/* Filters Bar */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 flex-wrap">
                            <div className="flex-1 relative min-w-[200px]">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name or roll number..."
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                                />
                            </div>
                            <select
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm bg-white"
                            >
                                <option value="">All Classes</option>
                                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select
                                value={filterSchool}
                                onChange={(e) => setFilterSchool(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm bg-white"
                            >
                                <option value="">All Schools</option>
                                {availableSchools.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div className="flex items-center gap-2 border-l pl-4">
                                <button onClick={selectAllFiltered} className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
                                    Select All Filtered
                                </button>
                                <button onClick={deselectAll} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                                    Clear
                                </button>
                            </div>
                        </div>

                        {/* Students Grid */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-250px)]">
                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                <span className="font-medium text-gray-700">
                                    Students ({filteredStudents.length})
                                </span>
                                <span className="text-xs text-gray-500">
                                    {selectedIds.size} selected for assignment
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {filteredStudents.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No students found matching filters</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                        {filteredStudents.map((student) => {
                                            const isAlreadyAssigned = assignments.some(a => a.student_id === student.id);
                                            const isSelected = selectedIds.has(student.id);

                                            return (
                                                <div
                                                    key={student.id}
                                                    onClick={() => toggleStudent(student.id)}
                                                    className={`
                                                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                                                    ${isSelected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'hover:bg-gray-50 border-gray-200'}
                                                    ${isAlreadyAssigned && !isSelected ? 'bg-gray-50 opacity-75' : ''}
                                                `}
                                                >
                                                    <div className={`
                                                    w-5 h-5 rounded border flex items-center justify-center flex-shrink-0
                                                    ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white'}
                                                `}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900 truncate">{student.name}</span>
                                                            {isAlreadyAssigned && (
                                                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Assigned</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                            <span className="font-mono">{student.roll_number}</span>
                                                            {student.class && (
                                                                <>
                                                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                                    <span>{student.class}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-7xl mx-auto w-full px-4 py-6">
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        {loadingHistory ? (
                            <div className="p-12 text-center" >
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" > </div>
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200" >
                                <thead className="bg-gray-50" >
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Time </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Action </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Student </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Schedule </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Attempts </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" > Admin </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200" >
                                    {
                                        historyLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500" >
                                                    No history records found
                                                </td>
                                            </tr>
                                        ) : (
                                            historyLogs.map((log) => (
                                                <tr key={log.id} >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" >
                                                        {new Date(log.createdAt).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap" >
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.action === 'REMOVED' ? 'bg-red-100 text-red-800' :
                                                            log.action === 'ASSIGNED_REPLACE' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-green-100 text-green-800'
                                                            }`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" >
                                                        {log.studentName} <span className="text-gray-500 font-normal" > ({log.rollNumber})</span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {log.startTime && log.endTime ? (
                                                            <div className="flex flex-col text-xs space-y-0.5">
                                                                <span className="text-gray-900">{new Date(log.startTime).toLocaleString()}</span>
                                                                <span className="text-gray-400 text-[10px] uppercase">to</span>
                                                                <span className="text-gray-900">{new Date(log.endTime).toLocaleString()}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic text-xs">Always Open</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" >
                                                        {log.maxAttempts}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" >
                                                        {log.adminName}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
