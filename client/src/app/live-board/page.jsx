'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Pencil, ArrowLeft, AlertCircle, Radio } from 'lucide-react';
import SharedWhiteboardViewer from '@/components/SharedWhiteboardViewer';
import io from 'socket.io-client';

export default function LiveBoardPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [sharedSession, setSharedSession] = useState(null);
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/login');
            return;
        }

        // Check for saved session in localStorage
        try {
            const saved = localStorage.getItem('active_whiteboard_session');
            if (saved) {
                const session = JSON.parse(saved);
                if (session && session.timestamp && (Date.now() - session.timestamp < 2 * 60 * 60 * 1000)) {
                    setSharedSession(session);
                }
            }
        } catch (e) {
            console.error('Error loading session:', e);
        }

        // Initialize socket
        const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const newSocket = io(socketUrl, {
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            setIsConnected(true);
            if (user?.id) newSocket.emit('join-user', user.id);
            if (user?.classId) newSocket.emit('join-class', user.classId);
        });

        newSocket.on('disconnect', () => setIsConnected(false));

        newSocket.on('whiteboard:shared-with-you', (data) => {
            setSharedSession(data);
            localStorage.setItem('active_whiteboard_session', JSON.stringify({
                ...data,
                timestamp: Date.now()
            }));
        });

        newSocket.on('whiteboard:ended', (data) => {
            if (sharedSession?.sessionId === data.sessionId) {
                setSharedSession(null);
                localStorage.removeItem('active_whiteboard_session');
            }
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) newSocket.disconnect();
        };
    }, [_hasHydrated, isAuthenticated, user, router]);

    if (!_hasHydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Pencil className="w-5 h-5 text-amber-500" />
                            <h1 className="text-xl font-semibold text-slate-900">Live Whiteboard</h1>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${isConnected ? 'text-green-600' : 'text-slate-400'}`}>
                        <Radio className="w-4 h-4" />
                        {isConnected ? 'Connected' : 'Connecting...'}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {sharedSession ? (
                    <div>
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <div>
                                <p className="font-medium text-amber-900">Live Session Active</p>
                                <p className="text-sm text-amber-700">
                                    Shared by {sharedSession.instructorName}
                                </p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 280px)' }}>
                            <SharedWhiteboardViewer
                                isOpen={true}
                                onClose={() => { }}
                                instructorName={sharedSession.instructorName}
                                socket={socket}
                                sessionId={sharedSession.sessionId}
                                isFullPage={true}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="card p-12 text-center">
                        <AlertCircle className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h2 className="text-xl font-semibold text-slate-700 mb-2">No Active Whiteboard</h2>
                        <p className="text-slate-500 mb-6">
                            Your instructor hasn't shared a whiteboard yet.<br />
                            When they do, it will appear here automatically.
                        </p>
                        <div className="text-sm text-slate-400">
                            <div className={`inline-flex items-center gap-2 ${isConnected ? 'text-green-600' : 'text-amber-500'}`}>
                                <Radio className="w-4 h-4" />
                                {isConnected ? 'Listening for updates...' : 'Connecting to server...'}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
