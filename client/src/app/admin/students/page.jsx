'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Upload, Download, FileText, Users, UserPlus, FileSpreadsheet,
    CheckCircle, XCircle, AlertCircle, RefreshCw, School, UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { adminAPI, classesAPI, usersAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function AdminStudentsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated, selectedSessionId } = useAuthStore();
    const fileInputRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalStudents: 0, activeStudents: 0, totalClasses: 0 });
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [filterClass, setFilterClass] = useState('');

    // Import state
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [showImportDialog, setShowImportDialog] = useState(false);

    // Assign state
    const [showAssignDialog, setShowAssignDialog] = useState(false);
    const [assigning, setAssigning] = useState(false);

    const isAdmin = user?.role === 'admin' || user?.role === 'principal';

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (!isAdmin) { router.push('/dashboard'); return; }
        loadData();
    }, [isAuthenticated, _hasHydrated, isAdmin, selectedSessionId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, classesRes, studentsRes] = await Promise.all([
                adminAPI.getStats(),
                classesAPI.getAll(),
                usersAPI.getAll({ role: 'student', limit: 100 })
            ]);
            setStats(statsRes.data.data);
            setClasses(classesRes.data.data.classes || []);
            setStudents(studentsRes.data.data.users || []);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast.error('Please select a CSV file');
            return;
        }

        setImporting(true);
        setImportResult(null);

        try {
            const res = await adminAPI.importStudents(file);
            setImportResult(res.data.data);
            setShowImportDialog(true);
            if (res.data.data.imported > 0) {
                loadData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Import failed');
        } finally {
            setImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const res = await adminAPI.downloadTemplate();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'student_import_template.csv';
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Template downloaded');
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    const handleExportCSV = async () => {
        try {
            const res = await adminAPI.exportStudentsCSV({ classId: filterClass || undefined });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('CSV exported successfully');
        } catch (error) {
            toast.error('Failed to export CSV');
        }
    };

    const handleExportPDF = async () => {
        try {
            const res = await adminAPI.exportStudentsPDF({ classId: filterClass || undefined });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `students_export_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF exported successfully');
        } catch (error) {
            toast.error('Failed to export PDF');
        }
    };

    const handleSelectStudent = (studentId) => {
        setSelectedStudents(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    const handleSelectAll = () => {
        if (selectedStudents.length === filteredStudents.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(filteredStudents.map(s => s.id));
        }
    };

    const handleBulkAssign = async () => {
        if (selectedStudents.length === 0) {
            toast.error('Please select students first');
            return;
        }
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }

        setAssigning(true);
        try {
            const res = await adminAPI.bulkAssignStudents(selectedStudents, selectedClass);
            toast.success(res.data.message);
            setSelectedStudents([]);
            setSelectedClass('');
            setShowAssignDialog(false);
            loadData();
        } catch (error) {
            toast.error('Failed to assign students');
        } finally {
            setAssigning(false);
        }
    };

    // Filter students by class
    const filteredStudents = filterClass
        ? students.filter(s => s.classEnrollments?.some(e => e.classId === filterClass))
        : students;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Student Management" />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{stats.totalStudents}</p>
                                <p className="text-sm text-slate-500">Total Students</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <UserCheck className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{stats.activeStudents}</p>
                                <p className="text-sm text-slate-500">Active Students</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                                <School className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{stats.totalClasses}</p>
                                <p className="text-sm text-slate-500">Classes</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Users className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{stats.totalInstructors}</p>
                                <p className="text-sm text-slate-500">Instructors</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Import/Export Actions */}
                <div className="card p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Import & Export Students</h2>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Import Section */}
                        <div className="border border-slate-200 rounded-xl p-4">
                            <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-primary-500" />
                                Import Students
                            </h3>
                            <p className="text-sm text-slate-500 mb-4">
                                Upload a CSV file to bulk import students. They will be automatically created with a default password.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".csv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={importing}
                                    className="btn btn-primary"
                                >
                                    {importing ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Upload CSV
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="btn btn-secondary"
                                >
                                    <FileText className="w-4 h-4" />
                                    Download Template
                                </button>
                                <Link
                                    href="/admin/students/import"
                                    className="btn btn-ghost text-sm"
                                >
                                    Advanced Import →
                                </Link>
                            </div>
                        </div>

                        {/* Export Section */}
                        <div className="border border-slate-200 rounded-xl p-4">
                            <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                                <Download className="w-5 h-5 text-emerald-500" />
                                Export Students
                            </h3>
                            <p className="text-sm text-slate-500 mb-4">
                                Download the student list in CSV or PDF format for records or printing.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={handleExportCSV}
                                    className="btn btn-secondary"
                                >
                                    <FileSpreadsheet className="w-4 h-4" />
                                    Export CSV
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    className="btn btn-secondary"
                                >
                                    <FileText className="w-4 h-4" />
                                    Export PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Students List with Bulk Actions */}
                <div className="card overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <h2 className="text-lg font-semibold text-slate-900">Students List</h2>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Class Filter */}
                            <select
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                                className="input text-sm py-2 w-48"
                            >
                                <option value="">All Classes</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name || `Class ${c.gradeLevel}-${c.section}`}
                                    </option>
                                ))}
                            </select>

                            {/* Bulk Assign Button */}
                            {selectedStudents.length > 0 && (
                                <button
                                    onClick={() => setShowAssignDialog(true)}
                                    className="btn btn-primary"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Assign to Class ({selectedStudents.length})
                                </button>
                            )}

                            <button
                                onClick={loadData}
                                className="btn btn-secondary"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded border-slate-300"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Student ID</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Email</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Class</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                                            No students found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map(student => {
                                        const enrollment = student.classEnrollments?.[0];
                                        const className = enrollment?.class?.name ||
                                            (enrollment?.class?.gradeLevel ? `Class ${enrollment.class.gradeLevel}-${enrollment.class.section}` : 'Not assigned');

                                        return (
                                            <tr key={student.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStudents.includes(student.id)}
                                                        onChange={() => handleSelectStudent(student.id)}
                                                        className="w-4 h-4 rounded border-slate-300"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700 font-mono">
                                                    {student.studentId || student.admissionNumber || '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                                                            {student.firstName?.[0]}{student.lastName?.[0]}
                                                        </div>
                                                        <span className="font-medium text-slate-900">
                                                            {student.firstName} {student.lastName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{student.email}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600">{className}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.isActive
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {student.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Import Result Dialog */}
            {showImportDialog && importResult && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-xl font-semibold text-slate-900">Import Results</h3>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-96">
                            <div className="flex gap-4 mb-6">
                                <div className="flex-1 bg-emerald-50 rounded-xl p-4 text-center">
                                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-emerald-700">{importResult.imported}</p>
                                    <p className="text-sm text-emerald-600">Imported</p>
                                </div>
                                <div className="flex-1 bg-red-50 rounded-xl p-4 text-center">
                                    <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
                                    <p className="text-sm text-red-600">Failed</p>
                                </div>
                            </div>

                            {importResult.imported > 0 && (
                                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-blue-700">
                                        <strong>Default Password:</strong> {importResult.defaultPassword}
                                    </p>
                                </div>
                            )}

                            {importResult.errors.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-slate-900 mb-2">Errors:</h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {importResult.errors.map((err, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <span>Row {err.row}: {err.error}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200">
                            <button
                                onClick={() => setShowImportDialog(false)}
                                className="btn btn-primary w-full"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Assign Dialog */}
            {showAssignDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-xl font-semibold text-slate-900">Assign Students to Class</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 mb-4">
                                Assign {selectedStudents.length} selected student(s) to a class:
                            </p>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="input w-full"
                            >
                                <option value="">Select a class</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name || `Class ${c.gradeLevel}-${c.section}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="p-4 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAssignDialog(false);
                                    setSelectedClass('');
                                }}
                                className="btn btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkAssign}
                                disabled={!selectedClass || assigning}
                                className="btn btn-primary flex-1"
                            >
                                {assigning ? 'Assigning...' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
