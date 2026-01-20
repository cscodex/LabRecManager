'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users, Check, X, Search } from 'lucide-react';
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

export default function ExamAssignPage() {
    const params = useParams();
    const examId = params.id as string;

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const response = await fetch(`/api/admin/exams/${examId}/assign`);
            const data = await response.json();
            if (data.success) {
                setAssignments(data.assignments);
                setAllStudents(data.allStudents);
                setSelectedIds(new Set(data.assignments.map((a: Assignment) => a.student_id)));
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const toggleStudent = (studentId: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(studentId)) {
            newSelected.delete(studentId);
        } else {
            newSelected.add(studentId);
        }
        setSelectedIds(newSelected);
    };

    const selectAll = () => {
        setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleSave = async () => {
        try {
            // First remove all existing
            await fetch(`/api/admin/exams/${examId}/assign`, { method: 'DELETE' });

            // Then add selected
            if (selectedIds.size > 0) {
                await fetch(`/api/admin/exams/${examId}/assign`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ studentIds: Array.from(selectedIds) }),
                });
            }

            toast.success('Assignments saved!');
            loadData();
        } catch (error) {
            toast.error('Failed to save');
        }
    };

    const filteredStudents = allStudents.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.roll_number.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/admin/exams/${examId}`} className="text-gray-500 hover:text-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Assign Students</h1>
                            <p className="text-sm text-gray-500">{selectedIds.size} students selected</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Save Assignments
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6">
                {/* Search and Actions */}
                <div className="flex gap-4 mb-4">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search students..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg"
                        />
                    </div>
                    <button
                        onClick={selectAll}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" /> Select All
                    </button>
                    <button
                        onClick={deselectAll}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                        <X className="w-4 h-4" /> Clear
                    </button>
                </div>

                {/* Students Grid */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                    {filteredStudents.length === 0 ? (
                        <div className="text-center py-8">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">No students found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {filteredStudents.map((student) => (
                                <button
                                    key={student.id}
                                    onClick={() => toggleStudent(student.id)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${selectedIds.has(student.id)
                                            ? 'bg-blue-50 border-blue-300'
                                            : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${selectedIds.has(student.id)
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-gray-300'
                                        }`}>
                                        {selectedIds.has(student.id) && (
                                            <Check className="w-4 h-4 text-white" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{student.name}</p>
                                        <p className="text-sm text-gray-500">{student.roll_number}</p>
                                    </div>
                                    {student.class && (
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{student.class}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
