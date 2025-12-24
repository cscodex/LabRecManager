'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import SharedWhiteboardViewer from './SharedWhiteboardViewer';
import { Pencil, X, Minimize2 } from 'lucide-react';

const STORAGE_KEY = 'active_whiteboard_session';

export default function WhiteboardNotificationListener() {
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const socketRef = useRef(null);

    // Notification state
    const [sharedSession, setSharedSession] = useState(null);
    const [showViewer, setShowViewer] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const isStudent = user?.role === 'student';

    // Load persisted session on mount
    useEffect(() => {
        if (!_hasHydrated || !isStudent) return;

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const session = JSON.parse(saved);
                // Check if session is still valid (within 2 hours)
                if (session && session.timestamp && (Date.now() - session.timestamp < 2 * 60 * 60 * 1000)) {
                    setSharedSession(session);
                    setIsMinimized(true); // Show minimized badge
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [_hasHydrated, isStudent]);

    // Save session to localStorage when it changes
    useEffect(() => {
        if (sharedSession) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...sharedSession,
                timestamp: Date.now()
            }));
        }
    }, [sharedSession]);

    useEffect(() => {
        if (!_hasHydrated || !isAuthenticated || !isStudent) return;

        // Initialize socket connection
        const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        socketRef.current = io(socketUrl, {
            path: '/socket.io',
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('[WhiteboardListener] Socket connected');

            // Join user room
            if (user?.id) {
                socketRef.current.emit('join-user', user.id);
            }

            // Join class room if available
            if (user?.classId) {
                socketRef.current.emit('join-class', user.classId);
            }

            // Join group rooms if available
            if (user?.groups && Array.isArray(user.groups)) {
                user.groups.forEach(group => {
                    socketRef.current.emit('join-group', group.id);
                });
            }
        });

        // Listen for whiteboard sharing
        socketRef.current.on('whiteboard:shared-with-you', (data) => {
            console.log('[WhiteboardListener] Whiteboard shared:', data);
            setSharedSession(data);
            setIsMinimized(false);
            setShowViewer(true);

            // Show toast notification
            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                    <Pencil className="w-5 h-5 text-amber-600" />
                                </div>
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                    Whiteboard Shared
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {data.instructorName} is sharing a whiteboard with you
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-l border-gray-200">
                        <button
                            onClick={() => {
                                toast.dismiss(t.id);
                                setShowViewer(true);
                                setIsMinimized(false);
                            }}
                            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-amber-600 hover:text-amber-500 focus:outline-none"
                        >
                            View
                        </button>
                    </div>
                </div>
            ), {
                duration: 10000,
                position: 'top-right'
            });
        });

        // Listen for whiteboard ending
        socketRef.current.on('whiteboard:ended', (data) => {
            console.log('[WhiteboardListener] Whiteboard ended:', data);
            if (sharedSession?.sessionId === data.sessionId) {
                toast('Whiteboard session ended', { icon: '✅' });
                setSharedSession(null);
                setShowViewer(false);
                setIsMinimized(false);
                localStorage.removeItem(STORAGE_KEY);
            }
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [isAuthenticated, _hasHydrated, isStudent, user]);

    // Handle minimize (X button minimizes, doesn't close)
    const handleMinimize = () => {
        setShowViewer(false);
        setIsMinimized(true);
    };

    // Handle full close (only when instructor ends sharing)
    const handleClose = () => {
        setShowViewer(false);
        setIsMinimized(false);
        setSharedSession(null);
        localStorage.removeItem(STORAGE_KEY);
    };

    // Only render for students
    if (!isStudent) return null;

    return (
        <>
            {/* Floating notification badge - shows when minimized or session active but viewer closed */}
            {sharedSession && (isMinimized || !showViewer) && (
                <div className="fixed bottom-4 right-4 z-50">
                    <button
                        onClick={() => { setShowViewer(true); setIsMinimized(false); }}
                        className="flex items-center gap-3 px-4 py-3 bg-amber-500 text-white rounded-xl shadow-lg hover:bg-amber-600 transition animate-bounce"
                    >
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                            <Pencil className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                            <p className="font-medium text-sm">Live Whiteboard</p>
                            <p className="text-xs text-white/80">{sharedSession.instructorName}</p>
                        </div>
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    </button>
                </div>
            )}

            {/* Shared whiteboard viewer */}
            <SharedWhiteboardViewer
                isOpen={showViewer}
                onClose={handleMinimize}
                instructorName={sharedSession?.instructorName || 'Instructor'}
                socket={socketRef.current}
                sessionId={sharedSession?.sessionId}
            />
        </>
    );
}

