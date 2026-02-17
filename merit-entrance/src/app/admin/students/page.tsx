'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST } from '@/lib/utils';
import {
    ChevronLeft, Plus, Users, Search,
    Trash2, Edit, CheckSquare, Square,
    ChevronRight, X, Ban, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Student {
    id: string;
    roll_number: string;
    name: string;
    name_regional: string | null;
    email: string | null;
    phone: string | null;
    class: string | null;
    school: string | null;
    is_active: boolean;
    email_verified: boolean;
    created_at: string;
    attempt_count: number;
}

export default function ManageStudentsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modals
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    const [formData, setFormData] = useState({
        rollNumber: '',
        name: '',
        nameRegional: '',
        email: '',
        phone: '',
        studentClass: '',
        school: '',
        password: '',
        isActive: true
    });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadStudents();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadStudents = async () => {
        try {
            const response = await fetch('/api/admin/students');
            const data = await response.json();
            if (data.success) {
                setStudents(data.students);
            }
        } catch (error) {
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveStudent = async () => {
        if (!formData.rollNumber || !formData.name) {
            toast.error('Roll number and name are required');
            return;
        }
        if (!editingStudent && !formData.password) {
            toast.error('Password is required for new students');
            return;
        }

        try {
            const url = '/api/admin/students';
            const method = editingStudent ? 'PUT' : 'POST';
            const body = editingStudent
                ? { ...formData, id: editingStudent.id }
                : formData;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(editingStudent ? 'Student updated!' : 'Student added!');
                closeModal();
                loadStudents();
            } else {
                toast.error(data.error || 'Operation failed');
            }
        } catch (error) {
            toast.error('An error occurred');
        }
    };

    const handleDelete = async (ids: string[]) => {
        if (!confirm(`Are you sure you want to delete ${ids.length} student(s)? This cannot be undone.`)) return;

        try {
            const response = await fetch('/api/admin/students', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(data.message);
                setSelectedIds(new Set());
                loadStudents();
            } else {
                toast.error(data.error || 'Delete failed');
            }
        } catch (error) {
            toast.error('Error deleting students');
        }
    };

    const handleToggleStatus = async (student: Student) => {
        try {
            const response = await fetch('/api/admin/students', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: student.id,
                    rollNumber: student.roll_number,
                    name: student.name,
                    isActive: !student.is_active
                }),
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`Student ${student.is_active ? 'blocked' : 'activated'}`);
                loadStudents();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleVerify = async (student: Student) => {
        if (!confirm('Mark this student as verified?')) return;
        try {
            const response = await fetch('/api/admin/students', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: student.id,
                    rollNumber: student.roll_number,
                    name: student.name,
                    isActive: student.is_active,
                    emailVerified: true
                }),
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Student verified');
                loadStudents();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error('Failed to verify');
        }
    };

    const openEditModal = (student: Student) => {
        setEditingStudent(student);
        setFormData({
            rollNumber: student.roll_number,
            name: student.name,
            nameRegional: student.name_regional || '',
            email: student.email || '',
            phone: student.phone || '',
            studentClass: student.class || '',
            school: student.school || '',
            password: '', // Don't populate password
            isActive: student.is_active
        });
        setShowAddForm(true);
    };

    const closeModal = () => {
        setShowAddForm(false);
        setEditingStudent(null);
        setFormData({
            rollNumber: '',
            name: '',
            nameRegional: '',
            email: '',
            phone: '',
            studentClass: '',
            school: '',
            password: '',
            isActive: true
        });
    };

    // Filter Logic
    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.roll_number.toLowerCase().includes(search.toLowerCase())
    );

    // Pagination Logic
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const paginatedStudents = filteredStudents.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Selection Logic
    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedStudents.length && paginatedStudents.length > 0) {
            setSelectedIds(new Set());
        } else {
            const newSet = new Set(selectedIds);
            paginatedStudents.forEach(s => newSet.add(s.id));
            setSelectedIds(newSet);
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Manage Students</h1>
                            <p className="text-sm text-gray-500">{students.length} students registered</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {selectedIds.size > 0 && (
                            <button
                                onClick={() => handleDelete(Array.from(selectedIds))}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete ({selectedIds.size})
                            </button>
                        )}
                        <button
                            onClick={() => { setEditingStudent(null); setShowAddForm(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Student
                        </button>
                    </div>
                </div>
            </header>

            {/* Search & Filters */}
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        placeholder="Search by name, roll number..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Students List */}
            <main className="max-w-7xl mx-auto px-4 pb-6">
                {filteredStudents.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center border">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">
                            {search ? 'No students found matching your search.' : 'No students registered yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px]">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 w-10">
                                            <button onClick={toggleSelectAll} className="flex items-center">
                                                {selectedIds.size > 0 && selectedIds.size === paginatedStudents.length
                                                    ? <CheckSquare className="w-5 h-5 text-blue-600" />
                                                    : <Square className="w-5 h-5 text-gray-400" />
                                                }
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class/School</th>

                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {paginatedStudents.map((student) => (
                                        <tr key={student.id} className={`hover:bg-gray-50 ${selectedIds.has(student.id) ? 'bg-blue-50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <button onClick={() => toggleSelect(student.id)}>
                                                    {selectedIds.has(student.id)
                                                        ? <CheckSquare className="w-5 h-5 text-blue-600" />
                                                        : <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                                                    }
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 font-medium font-mono text-sm">{student.roll_number}</td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-gray-900">{student.name}</p>
                                                    {student.name_regional && (
                                                        <p className="text-sm text-gray-500 font-regional">{student.name_regional}</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="text-gray-900">{student.email || '-'}</div>
                                                <div className="text-gray-500 text-xs">{student.phone || ''}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="text-gray-900">{student.class || '-'}</div>
                                                <div className="text-gray-500 text-xs truncate max-w-[150px]" title={student.school || ''}>{student.school || '-'}</div>
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${student.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    {student.is_active ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                {formatDateTimeIST(student.created_at).split(',')[0]}
                                                <div className="text-xs text-gray-400">
                                                    {formatDateTimeIST(student.created_at).split(',')[1]}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!student.email_verified && (
                                                        <button
                                                            onClick={() => handleVerify(student)}
                                                            className="p-1 hover:bg-green-100 rounded text-gray-500 hover:text-green-600 transition-colors"
                                                            title="Manually Verify"
                                                        >
                                                            <CheckSquare className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleToggleStatus(student)}
                                                        className={`p-1 rounded transition-colors ${student.is_active
                                                            ? 'hover:bg-red-100 text-gray-500 hover:text-red-600'
                                                            : 'hover:bg-green-100 text-red-500 hover:text-green-600'}`}
                                                        title={student.is_active ? "Block Access" : "Allow Access"}
                                                    >
                                                        {student.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(student)}
                                                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-blue-600 transition-colors"
                                                        title="Edit Details"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete([student.id])}
                                                        className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600 transition-colors"
                                                        title="Delete Student"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="border-t px-4 py-3 flex items-center justify-between bg-gray-50">
                                <div className="text-sm text-gray-500">
                                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</span> of <span className="font-medium">{filteredStudents.length}</span> students
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-medium px-2">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Add/Edit Student Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">
                                {editingStudent ? 'Edit Student' : 'Add New Student'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number *</label>
                                    <input
                                        type="text"
                                        value={formData.rollNumber}
                                        onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                                        placeholder="SOE2026001"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Password {editingStudent && <span className="text-gray-400 font-normal">(Leave blank to keep)</span>} *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingStudent ? "New password" : "Initial password"}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name (Regional)</label>
                                    <input
                                        type="text"
                                        value={formData.nameRegional}
                                        onChange={(e) => setFormData({ ...formData, nameRegional: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                                    <input
                                        type="text"
                                        value={formData.studentClass}
                                        onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
                                        placeholder="10th"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
                                    <input
                                        type="text"
                                        value={formData.school}
                                        onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            {editingStudent && (
                                <div className="flex items-center gap-2 pt-2">
                                    <label className="flex items-center cursor-pointer gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Account Active</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={closeModal}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveStudent}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                            >
                                {editingStudent ? 'Save Changes' : 'Add Student'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
