'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Video, Calendar, Clock, User, Play, CheckCircle, XCircle,
    Plus, Search, X, Users, CalendarPlus
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { vivaAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function VivaPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Schedule modal state
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [scheduledDateTime, setScheduledDateTime] = useState('');
    const [duration, setDuration] = useState(15);
    const [sessionTitle, setSessionTitle] = useState('');
    const [scheduling, setScheduling] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadSessions();
    }, [isAuthenticated, _hasHydrated]);

    const loadSessions = async () => {
        try {
            const res = await vivaAPI.getSessions();
            setSessions(res.data.data.sessions || []);
        } catch (error) {
            console.error('Error loading viva sessions:', error);
            // Don't show error if no sessions found
        } finally {
            setLoading(false);
        }
    };

    const searchStudents = async (query) => {
        if (!query || query.length < 2) {
            setStudents([]);
            return;
        }

        setLoadingStudents(true);
        try {
            const res = await vivaAPI.getAvailableStudents({ search: query });
            setStudents(res.data.data.students || []);
        } catch (error) {
            console.error('Error searching students:', error);
            toast.error('Failed to search students');
        } finally {
            setLoadingStudents(false);
        }
    };

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            if (searchQuery) {
                searchStudents(searchQuery);
            }
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [searchQuery]);

    const handleScheduleSession = async () => {
        if (!selectedStudent) {
            toast.error('Please select a student');
            return;
        }
        if (!scheduledDateTime) {
            toast.error('Please select a date and time');
            return;
        }

        const scheduledDate = new Date(scheduledDateTime);
        if (scheduledDate <= new Date()) {
            toast.error('Scheduled time must be in the future');
            return;
        }

        setScheduling(true);
        try {
            const res = await vivaAPI.scheduleStandaloneSession({
                studentId: selectedStudent.id,
                scheduledAt: scheduledDate.toISOString(),
                durationMinutes: duration,
                title: sessionTitle || 'Viva Session',
                mode: 'online'
            });

            toast.success('Viva session scheduled successfully!');
            setShowScheduleModal(false);
            resetModalState();
            loadSessions();
        } catch (error) {
            console.error('Error scheduling viva:', error);
            toast.error(error.response?.data?.message || 'Failed to schedule viva session');
        } finally {
            setScheduling(false);
        }
    };

    const resetModalState = () => {
        setSelectedStudent(null);
        setSearchQuery('');
        setStudents([]);
        setScheduledDateTime('');
        setDuration(15);
        setSessionTitle('');
    };

    const getStatusBadge = (status) => {
        const styles = {
            scheduled: 'badge-primary',
            in_progress: 'badge-warning',
            completed: 'badge-success',
            cancelled: 'badge-danger',
            no_show: 'badge-danger'
        };
        return styles[status] || 'badge-secondary';
    };

    const getStatusIcon = (status) => {
        const icons = {
            scheduled: <Clock className="w-5 h-5 text-blue-500" />,
            in_progress: <Play className="w-5 h-5 text-amber-500" />,
            completed: <CheckCircle className="w-5 h-5 text-emerald-500" />,
            cancelled: <XCircle className="w-5 h-5 text-red-500" />
        };
        return icons[status] || <Video className="w-5 h-5 text-slate-500" />;
    };

    const isInstructor = user?.role === 'instructor' || user?.role === 'admin' || user?.role === 'lab_assistant';

    // Get minimum datetime (now + 5 minutes)
    const getMinDateTime = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        return now.toISOString().slice(0, 16);
    };

    // Helper to check if session time has expired
    const isSessionExpired = (session) => {
        if (!session.scheduledAt) return false;
        const startTime = new Date(session.scheduledAt);
        const endTime = new Date(startTime.getTime() + (session.durationMinutes || 15) * 60 * 1000);
        return new Date() > endTime;
    };

    // Helper to check if session should be live
    const isSessionLive = (session) => {
        if (session.status === 'in_progress') return true;
        if (session.status !== 'scheduled') return false;

        const now = new Date();
        const startTime = new Date(session.scheduledAt);
        const endTime = new Date(startTime.getTime() + (session.durationMinutes || 15) * 60 * 1000);

        // Live if: scheduled time passed but end time not passed
        return now >= startTime && now <= endTime;
    };

    // Categorize sessions
    const upcomingSessions = sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduledAt) > new Date());
    const liveSessions = sessions.filter(s => isSessionLive(s));
    const expiredSessions = sessions.filter(s => s.status === 'scheduled' && isSessionExpired(s));
    const pastSessions = sessions.filter(s => s.status === 'completed' || s.status === 'cancelled');

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
                        <h1 className="text-xl font-semibold text-slate-900">Viva Sessions</h1>
                    </div>

                    {/* Schedule Viva Button for Instructors */}
                    {isInstructor && (
                        <button
                            onClick={() => setShowScheduleModal(true)}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            <CalendarPlus className="w-5 h-5" />
                            Schedule Viva Session
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Info Banner */}
                <div className="card p-6 mb-6 bg-gradient-to-r from-primary-500 to-accent-500 text-white">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            <Video className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-semibold">Online Viva Sessions</h2>
                            <p className="text-white/80 mt-1">
                                {isInstructor
                                    ? 'Schedule and conduct viva sessions with your students. Click "Schedule Viva Session" to create a new session with video/audio call support.'
                                    : 'View your scheduled viva sessions and join when it\'s time. Video and audio are off by default for privacy.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Device Setup Reminder */}
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <Video className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-medium text-amber-800">📱 Before joining a viva session</p>
                            <p className="text-sm text-amber-600">Test your camera and microphone in Settings → Devices</p>
                        </div>
                    </div>
                    <Link href="/settings?tab=devices" className="btn btn-secondary text-sm whitespace-nowrap">
                        Test Devices
                    </Link>
                </div>

                {/* Live Sessions */}
                {liveSessions.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                            Live Now
                        </h2>
                        <div className="grid gap-4">
                            {liveSessions.map((session) => (
                                <SessionCard
                                    key={session.id}
                                    session={session}
                                    isInstructor={isInstructor}
                                    getStatusIcon={getStatusIcon}
                                    getStatusBadge={getStatusBadge}
                                    isLive={true}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Expired Sessions (past duration time) */}
                {expiredSessions.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-amber-700 mb-4 flex items-center gap-2">
                            <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                            Expired Sessions (Time Exceeded)
                        </h2>
                        <div className="grid gap-4">
                            {expiredSessions.map((session) => (
                                <div key={session.id} className="card p-5 border-l-4 border-amber-500 bg-amber-50/50">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                                    EXPIRED
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    Duration: {session.durationMinutes} min
                                                </span>
                                            </div>
                                            <h3 className="font-semibold text-slate-900">
                                                {session.submission?.assignment?.title || 'Viva Session'}
                                            </h3>
                                            <p className="text-sm text-slate-600 mt-1">
                                                Student: {session.student?.firstName} {session.student?.lastName}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Scheduled: {new Date(session.scheduledAt).toLocaleString()} •
                                                Should have ended: {new Date(new Date(session.scheduledAt).getTime() + session.durationMinutes * 60000).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/viva/room/${session.id}`}
                                                className="btn btn-secondary text-sm"
                                            >
                                                Start Late
                                            </Link>
                                            {isInstructor && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await vivaAPI.markMissed(session.id, 'Session time slot expired');
                                                            toast.success('Session marked as missed');
                                                            loadSessions();
                                                        } catch (error) {
                                                            toast.error('Failed to mark session');
                                                        }
                                                    }}
                                                    className="btn text-sm bg-slate-200 text-slate-700 hover:bg-slate-300"
                                                >
                                                    Mark as Missed
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Upcoming Sessions */}
                {upcomingSessions.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Sessions</h2>
                        <div className="grid gap-4">
                            {upcomingSessions.map((session) => (
                                <SessionCard
                                    key={session.id}
                                    session={session}
                                    isInstructor={isInstructor}
                                    getStatusIcon={getStatusIcon}
                                    getStatusBadge={getStatusBadge}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Past Sessions */}
                {pastSessions.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Past Sessions</h2>
                        <div className="grid gap-4">
                            {pastSessions.map((session) => (
                                <SessionCard
                                    key={session.id}
                                    session={session}
                                    isInstructor={isInstructor}
                                    getStatusIcon={getStatusIcon}
                                    getStatusBadge={getStatusBadge}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {sessions.length === 0 && (
                    <div className="card p-12 text-center">
                        <Video className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No viva sessions</h3>
                        <p className="text-slate-500 mb-6">
                            {isInstructor
                                ? 'Get started by scheduling your first viva session with a student.'
                                : 'You don\'t have any scheduled viva sessions at the moment.'}
                        </p>
                        {isInstructor && (
                            <button
                                onClick={() => setShowScheduleModal(true)}
                                className="btn btn-primary inline-flex items-center gap-2"
                            >
                                <CalendarPlus className="w-5 h-5" />
                                Schedule Your First Viva
                            </button>
                        )}
                    </div>
                )}
            </main>

            {/* Schedule Viva Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                                        <CalendarPlus className="w-5 h-5 text-primary-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-slate-900">Schedule Viva Session</h2>
                                        <p className="text-sm text-slate-500">Create a new viva session for a student</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowScheduleModal(false);
                                        resetModalState();
                                    }}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition"
                                >
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">
                            {/* Session Title (Optional) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Session Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={sessionTitle}
                                    onChange={(e) => setSessionTitle(e.target.value)}
                                    placeholder="e.g., Mid-term Viva, Lab Experiment Review"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                                />
                            </div>

                            {/* Student Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Select Student <span className="text-red-500">*</span>
                                </label>

                                {selectedStudent ? (
                                    <div className="flex items-center justify-between p-4 bg-primary-50 border border-primary-200 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-medium">
                                                {selectedStudent.firstName?.[0]}{selectedStudent.lastName?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">
                                                    {selectedStudent.firstName} {selectedStudent.lastName}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    {selectedStudent.admissionNumber || selectedStudent.email}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedStudent(null)}
                                            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search by name, email, or admission number..."
                                                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                                            />
                                        </div>

                                        {/* Student Search Results */}
                                        {loadingStudents && (
                                            <div className="flex items-center justify-center py-4">
                                                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                                            </div>
                                        )}

                                        {!loadingStudents && students.length > 0 && (
                                            <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                                                {students.map((student) => (
                                                    <button
                                                        key={student.id}
                                                        onClick={() => {
                                                            setSelectedStudent(student);
                                                            setSearchQuery('');
                                                            setStudents([]);
                                                        }}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-0"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-medium">
                                                            {student.firstName?.[0]}{student.lastName?.[0]}
                                                        </div>
                                                        <div className="text-left flex-1">
                                                            <p className="font-medium text-slate-900 text-sm">
                                                                {student.firstName} {student.lastName}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {student.admissionNumber || student.email}
                                                                {student.classEnrollments?.[0]?.class && (
                                                                    <span className="ml-2">
                                                                        • {student.classEnrollments[0].class.name}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {!loadingStudents && searchQuery.length >= 2 && students.length === 0 && (
                                            <p className="text-sm text-slate-500 text-center py-4">
                                                No students found matching "{searchQuery}"
                                            </p>
                                        )}

                                        {searchQuery.length > 0 && searchQuery.length < 2 && (
                                            <p className="text-sm text-slate-500 text-center py-2">
                                                Type at least 2 characters to search
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Date and Time */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Date & Time <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={scheduledDateTime}
                                    onChange={(e) => setScheduledDateTime(e.target.value)}
                                    min={getMinDateTime()}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    The session will be live at this scheduled time
                                </p>
                            </div>

                            {/* Duration */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Duration
                                </label>
                                <div className="flex gap-2">
                                    {[10, 15, 20, 30, 45, 60].map((mins) => (
                                        <button
                                            key={mins}
                                            onClick={() => setDuration(mins)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${duration === mins
                                                ? 'bg-primary-500 text-white'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            {mins} min
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Info Note */}
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <p className="text-sm text-blue-700">
                                    <strong>Note:</strong> Video and audio will be off by default when participants join.
                                    They can enable their camera and microphone when they're ready.
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex gap-3">
                            <button
                                onClick={() => {
                                    setShowScheduleModal(false);
                                    resetModalState();
                                }}
                                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-100 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleScheduleSession}
                                disabled={scheduling || !selectedStudent || !scheduledDateTime}
                                className="flex-1 px-4 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {scheduling ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Scheduling...
                                    </>
                                ) : (
                                    <>
                                        <CalendarPlus className="w-4 h-4" />
                                        Schedule Session
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Session Card Component
function SessionCard({ session, isInstructor, getStatusIcon, getStatusBadge, isLive }) {
    return (
        <div className={`card card-hover p-6 ${isLive ? 'ring-2 ring-red-500 ring-opacity-50' : ''}`}>
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${isLive ? 'bg-red-100' : 'bg-slate-100'} flex items-center justify-center`}>
                    {isLive ? (
                        <div className="relative">
                            <Video className="w-5 h-5 text-red-500" />
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                        </div>
                    ) : (
                        getStatusIcon(session.status)
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`badge ${getStatusBadge(session.status)}`}>
                            {session.status.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-slate-500">
                            {session.mode}
                        </span>
                        {isLive && (
                            <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-full">
                                LIVE NOW
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                        {session.questionsAsked?.sessionTitle || session.submission?.assignment?.title || 'Viva Session'}
                    </h3>

                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {session.scheduledAt
                                ? new Date(session.scheduledAt).toLocaleString()
                                : 'Not scheduled'}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {session.durationMinutes} minutes
                        </span>
                        {isInstructor && session.student && (
                            <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {session.student.firstName} {session.student.lastName}
                            </span>
                        )}
                        {!isInstructor && session.examiner && (
                            <span className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                Examiner: {session.examiner.firstName} {session.examiner.lastName}
                            </span>
                        )}
                    </div>

                    {session.status === 'completed' && session.marksObtained && (
                        <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
                            <p className="text-emerald-700">
                                <span className="font-medium">Marks:</span> {session.marksObtained} / {session.maxMarks}
                            </p>
                            {session.examinerRemarks && (
                                <p className="text-sm text-emerald-600 mt-1">
                                    {session.examinerRemarks}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Countdown Timer for in_progress sessions */}
                    {session.status === 'in_progress' && session.actualStartTime && (
                        <CountdownTimer
                            startTime={session.actualStartTime}
                            durationMinutes={session.durationMinutes}
                        />
                    )}
                </div>

                {/* Action buttons based on session status */}
                {session.status === 'scheduled' && (
                    <div className="flex flex-col gap-2">
                        <Link href={`/viva/room/${session.id}`} className="btn btn-primary">
                            <Play className="w-4 h-4" />
                            {isInstructor ? 'Start Viva' : 'Join'}
                        </Link>
                    </div>
                )}

                {session.status === 'in_progress' && (
                    <div className="flex flex-col gap-2">
                        <Link href={`/viva/room/${session.id}`} className="btn btn-danger">
                            <Video className="w-4 h-4" />
                            {isInstructor ? 'Resume & Grade' : 'Rejoin'}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

// Countdown Timer Component
function CountdownTimer({ startTime, durationMinutes }) {
    const [timeRemaining, setTimeRemaining] = useState('');
    const [isOvertime, setIsOvertime] = useState(false);

    useEffect(() => {
        const calculateRemaining = () => {
            const start = new Date(startTime);
            const endTime = new Date(start.getTime() + durationMinutes * 60 * 1000);
            const now = new Date();
            const diff = endTime - now;

            if (diff <= 0) {
                setIsOvertime(true);
                const overDiff = Math.abs(diff);
                const mins = Math.floor(overDiff / 60000);
                const secs = Math.floor((overDiff % 60000) / 1000);
                setTimeRemaining(`+${mins}:${secs.toString().padStart(2, '0')}`);
            } else {
                setIsOvertime(false);
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
            }
        };

        calculateRemaining();
        const interval = setInterval(calculateRemaining, 1000);
        return () => clearInterval(interval);
    }, [startTime, durationMinutes]);

    return (
        <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${isOvertime ? 'bg-red-50' : 'bg-amber-50'}`}>
            <Clock className={`w-4 h-4 ${isOvertime ? 'text-red-500' : 'text-amber-500'}`} />
            <span className={`text-sm font-mono font-medium ${isOvertime ? 'text-red-600' : 'text-amber-600'}`}>
                {isOvertime ? 'Overtime: ' : 'Time Remaining: '}
                {timeRemaining}
            </span>
        </div>
    );
}
