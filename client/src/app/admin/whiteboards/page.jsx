'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Pencil, Users, Clock, Radio, Square, StopCircle, Video,
    Eye, MessageSquare, UserPlus, RefreshCw, ArrowLeft
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function AdminWhiteboardsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('active');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'principal'].includes(user?.role)) {
            router.push('/dashboard');
            return;
        }
        loadSessions();
    }, [_hasHydrated, isAuthenticated, user, filter]);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/whiteboard/sessions?status=${filter}`);
            setSessions(res.data.data.sessions || []);
        } catch (err) {
            console.error('Failed to load sessions:', err);
            toast.error('Failed to load whiteboard sessions');
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) return `${hrs}h ${mins}m`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    const handleEndSession = async (sessionId) => {
        if (!confirm('Are you sure you want to end this session?')) return;
        try {
            await api.put(`/whiteboard/sessions/${sessionId}/end`);
            toast.success('Session ended');
            loadSessions();
        } catch (err) {
            toast.error('Failed to end session');
        }
    };

    const handleToggleRecording = async (sessionId, isRecording) => {
        try {
            await api.put(`/whiteboard/sessions/${sessionId}/record`, { isRecording: !isRecording });
            toast.success(isRecording ? 'Recording stopped' : 'Recording started');
            loadSessions();
        } catch (err) {
            toast.error('Failed to toggle recording');
        }
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <PageHeader
                title="Live Whiteboard Sessions"
                subtitle="Monitor and control active whiteboard sessions"
                icon={Pencil}
            />

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
                    {['active', 'ended', 'all'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${filter === f
                                ? 'bg-primary-500 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
                <button
                    onClick={loadSessions}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    title="Refresh"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Sessions Grid */}
            {sessions.length === 0 ? (
                <div className="card p-12 text-center">
                    <Pencil className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                        No {filter === 'all' ? '' : filter} sessions
                    </h3>
                    <p className="text-slate-500">
                        {filter === 'active'
                            ? 'No instructors are currently sharing whiteboards'
                            : 'No whiteboard sessions found'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            className={`card p-5 ${session.status === 'active' ? 'ring-2 ring-green-500' : ''}`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${session.status === 'active' ? 'bg-green-100' : 'bg-slate-100'
                                        }`}>
                                        <Pencil className={`w-5 h-5 ${session.status === 'active' ? 'text-green-600' : 'text-slate-500'
                                            }`} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900">
                                            {session.title || 'Whiteboard Session'}
                                        </h4>
                                        <p className="text-sm text-slate-500">
                                            {session.host?.firstName} {session.host?.lastName}
                                        </p>
                                    </div>
                                </div>
                                {session.status === 'active' && (
                                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                        <Radio className="w-3 h-3" />
                                        Live
                                    </span>
                                )}
                                {session.isRecording && (
                                    <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        Recording
                                    </span>
                                )}
                            </div>

                            {/* Target Info */}
                            <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                                {session.targetClass && (
                                    <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        Class {session.targetClass.gradeLevel}-{session.targetClass.section}
                                    </span>
                                )}
                                {session.targetGroup && (
                                    <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {session.targetGroup.name}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Eye className="w-4 h-4" />
                                    {session.participantCount || 0} viewers
                                </span>
                                {session.duration && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {formatDuration(session.duration)}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            {session.status === 'active' && (
                                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                    <Link
                                        href={`/admin/whiteboards/${session.id}`}
                                        className="btn-secondary flex-1 text-center text-sm py-2"
                                    >
                                        <Eye className="w-4 h-4 inline mr-1" />
                                        View
                                    </Link>
                                    <button
                                        onClick={() => handleToggleRecording(session.id, session.isRecording)}
                                        className={`p-2 rounded-lg transition ${session.isRecording
                                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        title={session.isRecording ? 'Stop Recording' : 'Start Recording'}
                                    >
                                        <Video className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleEndSession(session.id)}
                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                                        title="End Session"
                                    >
                                        <StopCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
