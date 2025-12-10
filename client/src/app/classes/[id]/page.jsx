'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Users, GraduationCap, ArrowLeft, UserPlus, UsersRound, Plus, Search, Mail, Phone } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { classesAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function ClassDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [classData, setClassData] = useState(null);
    const [students, setStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('students');

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
        s.admissionNumber?.includes(searchQuery) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isAdmin = user?.role === 'admin' || user?.role === 'principal';
    const isInstructor = user?.role === 'instructor' || user?.role === 'lab_assistant';

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
                                    placeholder="Search by name, admission number, or email..."
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
                                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Admission No.</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Email</th>
                                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Contact</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredStudents.map((student, index) => (
                                            <tr key={student.id} className="hover:bg-slate-50 transition">
                                                <td className="px-6 py-4 font-medium text-slate-900">
                                                    {student.rollNumber || index + 1}
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
                                                        {student.admissionNumber || '-'}
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
                                            <span className="text-sm text-slate-500">
                                                {group.members?.length || 0} members
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-1">{group.name}</h3>
                                        {group.nameHindi && (
                                            <p className="text-sm text-slate-600 mb-3">{group.nameHindi}</p>
                                        )}
                                        {group.description && (
                                            <p className="text-sm text-slate-500 mb-4">{group.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {group.members?.slice(0, 5).map((member) => (
                                                <span
                                                    key={member.student.id}
                                                    className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full"
                                                >
                                                    {member.student.firstName} {member.student.lastName?.[0]}.
                                                </span>
                                            ))}
                                            {group.members?.length > 5 && (
                                                <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">
                                                    +{group.members.length - 5} more
                                                </span>
                                            )}
                                        </div>
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
