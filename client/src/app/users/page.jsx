'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Search, Plus, Book, BarChart3, Mail } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function UsersPage() {
    const router = useRouter();
    const { user, isAuthenticated, accessToken, _hasHydrated } = useAuthStore();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        if (user?.role !== 'admin' && user?.role !== 'principal') {
            router.push('/dashboard');
            return;
        }
        loadUsers();
    }, [isAuthenticated, roleFilter]);

    const loadUsers = async () => {
        try {
            const params = roleFilter !== 'all' ? { role: roleFilter } : {};
            const res = await axios.get('/api/users', {
                headers: { Authorization: `Bearer ${accessToken}` },
                params
            });
            setUsers(res.data.data.users || []);
        } catch (error) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleBadge = (role) => {
        const styles = {
            admin: 'bg-purple-100 text-purple-700',
            principal: 'bg-amber-100 text-amber-700',
            instructor: 'bg-blue-100 text-blue-700',
            student: 'bg-emerald-100 text-emerald-700',
            lab_assistant: 'bg-cyan-100 text-cyan-700',
            accountant: 'bg-pink-100 text-pink-700'
        };
        return styles[role] || 'bg-slate-100 text-slate-700';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold text-slate-900">Users</h1>
                    </div>
                    <Link href="/users/create" className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        Add User
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="card p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10"
                            />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="input w-full md:w-48"
                        >
                            <option value="all">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="principal">Principal</option>
                            <option value="instructor">Instructor</option>
                            <option value="student">Student</option>
                            <option value="lab_assistant">Lab Assistant</option>
                            <option value="accountant">Accountant</option>
                        </select>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-primary-600">{users.length}</p>
                        <p className="text-sm text-slate-500">Total Users</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">
                            {users.filter(u => u.role === 'student').length}
                        </p>
                        <p className="text-sm text-slate-500">Students</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">
                            {users.filter(u => u.role === 'instructor').length}
                        </p>
                        <p className="text-sm text-slate-500">Instructors</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">
                            {users.filter(u => u.isActive).length}
                        </p>
                        <p className="text-sm text-slate-500">Active</p>
                    </div>
                </div>

                {/* Users Table */}
                <div className="card overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Name</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Email</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Role</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">ID</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-slate-600">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
                                                {u.firstName?.[0]}{u.lastName?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">
                                                    {u.firstName} {u.lastName}
                                                </p>
                                                {u.firstNameHindi && (
                                                    <p className="text-sm text-slate-500">{u.firstNameHindi} {u.lastNameHindi}</p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{u.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(u.role)}`}>
                                            {u.role.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">
                                        {u.studentId || u.admissionNumber || u.employeeId || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`flex items-center gap-1 text-sm ${u.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
                                            <span className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-12 text-center text-slate-500">
                            No users found matching your criteria
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
