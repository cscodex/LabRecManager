'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Video, Play, Calendar, User, Clock, Award,
    Search, Filter, Download, Eye, Shield
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { vivaAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function VivaRecordingsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [recordings, setRecordings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all, with_recording, without_recording
    const [selectedRecording, setSelectedRecording] = useState(null);

    const isAdmin = user?.role === 'admin' || user?.role === 'principal';

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        if (!isAdmin) {
            toast.error('Access denied. Admin only.');
            router.push('/dashboard');
            return;
        }
        loadRecordings();
    }, [isAuthenticated, _hasHydrated, isAdmin]);

    const loadRecordings = async () => {
        setLoading(true);
        try {
            const res = await vivaAPI.getSessions({ limit: 100, status: 'completed' });
            const sessions = res.data.data.sessions || [];
            setRecordings(sessions);
        } catch (error) {
            console.error('Error loading recordings:', error);
            toast.error('Failed to load recordings');
        } finally {
            setLoading(false);
        }
    };

    const filteredRecordings = recordings.filter(session => {
        // Search filter
        const searchMatch = search === '' ||
            session.student?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            session.student?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
            session.examiner?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
            session.examiner?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
            session.submission?.assignment?.title?.toLowerCase().includes(search.toLowerCase());

        // Recording filter
        let recordingMatch = true;
        if (filter === 'with_recording') {
            recordingMatch = !!session.recordingUrl;
        } else if (filter === 'without_recording') {
            recordingMatch = !session.recordingUrl;
        }

        return searchMatch && recordingMatch;
    });

    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return 'N/A';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading recordings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader
                title="Viva Recordings"
                subtitle="Review session recordings for accountability"
            />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="card p-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                        <div className="flex items-center gap-3">
                            <Video className="w-8 h-8 opacity-80" />
                            <div>
                                <p className="text-2xl font-bold">{recordings.length}</p>
                                <p className="text-sm opacity-80">Total Sessions</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                        <div className="flex items-center gap-3">
                            <Play className="w-8 h-8 opacity-80" />
                            <div>
                                <p className="text-2xl font-bold">
                                    {recordings.filter(r => r.recordingUrl).length}
                                </p>
                                <p className="text-sm opacity-80">With Recordings</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                        <div className="flex items-center gap-3">
                            <Shield className="w-8 h-8 opacity-80" />
                            <div>
                                <p className="text-2xl font-bold">
                                    {recordings.filter(r => !r.recordingUrl).length}
                                </p>
                                <p className="text-sm opacity-80">Missing Recordings</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                        <div className="flex items-center gap-3">
                            <Award className="w-8 h-8 opacity-80" />
                            <div>
                                <p className="text-2xl font-bold">
                                    {recordings.length > 0
                                        ? (recordings.reduce((sum, r) => sum + (parseFloat(r.marksObtained) || 0), 0) / recordings.length).toFixed(1)
                                        : 0}
                                </p>
                                <p className="text-sm opacity-80">Avg Marks</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="card p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by student, instructor, or assignment..."
                                className="input pl-10 w-full"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                className="input"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            >
                                <option value="all">All Sessions</option>
                                <option value="with_recording">With Recording</option>
                                <option value="without_recording">Missing Recording</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Recordings List */}
                <div className="space-y-4">
                    {filteredRecordings.length === 0 ? (
                        <div className="card p-12 text-center">
                            <Video className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-700">No recordings found</h3>
                            <p className="text-slate-500">Completed viva sessions with recordings will appear here</p>
                        </div>
                    ) : (
                        filteredRecordings.map((session) => (
                            <div key={session.id} className={`card p-5 hover:shadow-lg transition ${!session.recordingUrl ? 'border-l-4 border-amber-500' : 'border-l-4 border-emerald-500'}`}>
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                    {/* Session Info */}
                                    <div className="flex-1">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${session.recordingUrl ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                <Video className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900">
                                                    {session.submission?.assignment?.title || 'Viva Session'}
                                                </h3>
                                                <div className="flex flex-wrap gap-3 text-sm text-slate-500 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-4 h-4" />
                                                        Student: {session.student?.firstName} {session.student?.lastName}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Shield className="w-4 h-4" />
                                                        Examiner: {session.examiner?.firstName} {session.examiner?.lastName}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(session.actualEndTime || session.updatedAt).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {session.durationMinutes} min
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Award className="w-4 h-4" />
                                                {session.marksObtained}/{session.maxMarks} marks
                                            </span>
                                            {session.recordingSize && (
                                                <span className="text-emerald-600">
                                                    📁 {formatFileSize(session.recordingSize)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-3">
                                        {session.recordingUrl ? (
                                            <button
                                                onClick={() => setSelectedRecording(session)}
                                                className="btn btn-primary flex items-center gap-2"
                                            >
                                                <Play className="w-4 h-4" />
                                                Watch Recording
                                            </button>
                                        ) : (
                                            <span className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium">
                                                No Recording
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>

            {/* Video Player Modal */}
            {selectedRecording && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    Viva Recording - {selectedRecording.student?.firstName} {selectedRecording.student?.lastName}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Examiner: {selectedRecording.examiner?.firstName} {selectedRecording.examiner?.lastName} •
                                    {new Date(selectedRecording.actualEndTime || selectedRecording.updatedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedRecording(null)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4">
                            <video
                                controls
                                autoPlay
                                className="w-full rounded-lg bg-black aspect-video"
                                src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'}/viva/recordings/${selectedRecording.recordingUrl?.split('/').pop()}`}
                            >
                                Your browser does not support video playback.
                            </video>
                            <div className="mt-4 bg-slate-50 rounded-lg p-4">
                                <h3 className="font-medium text-slate-900 mb-2">Session Details</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-500">Assignment</p>
                                        <p className="font-medium">{selectedRecording.submission?.assignment?.title || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Marks</p>
                                        <p className="font-medium">{selectedRecording.marksObtained}/{selectedRecording.maxMarks}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Duration</p>
                                        <p className="font-medium">{selectedRecording.durationMinutes} minutes</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Remarks</p>
                                        <p className="font-medium">{selectedRecording.examinerRemarks || 'No remarks'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
