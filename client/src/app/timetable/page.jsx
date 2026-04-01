'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Clock, Bell, Play, Pause, ChevronRight, BookOpen,
    User, MapPin, Calendar, Sun, AlertCircle, Timer
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { timetableAPI, calendarAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };

const SLOT_COLORS = {
    lecture: 'from-blue-500 to-blue-600',
    lab: 'from-purple-500 to-purple-600',
    break_period: 'from-amber-400 to-amber-500',
    assembly: 'from-teal-500 to-teal-600',
    free: 'from-slate-400 to-slate-500',
    sports: 'from-green-500 to-green-600',
    library: 'from-indigo-500 to-indigo-600',
};

export default function TimetablePage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const timerRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [liveData, setLiveData] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [upcomingHolidays, setUpcomingHolidays] = useState([]);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        loadLiveData();
        loadUpcomingHolidays();

        // Refresh live data every 30 seconds
        const interval = setInterval(loadLiveData, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, _hasHydrated]);

    // Live timer tick
    useEffect(() => {
        if (liveData?.currentPeriod) {
            timerRef.current = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
            return () => clearInterval(timerRef.current);
        }
    }, [liveData?.currentPeriod]);

    const loadLiveData = async () => {
        try {
            const res = await timetableAPI.getLive();
            setLiveData(res.data.data);
            if (res.data.data?.currentPeriod) {
                setElapsedSeconds(res.data.data.currentPeriod.elapsed * 60);
            }
        } catch (error) {
            console.error('Error loading live data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUpcomingHolidays = async () => {
        try {
            const now = new Date();
            const res = await calendarAPI.getEvents({
                month: now.getMonth() + 1,
                year: now.getFullYear()
            });
            const upcoming = (res.data.data.events || [])
                .filter(e => e.isHoliday && new Date(e.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
                .slice(0, 3);
            setUpcomingHolidays(upcoming);
        } catch { /* quiet */ }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const isHoliday = liveData?.isHoliday;
    const currentPeriod = liveData?.currentPeriod;
    const nextPeriod = liveData?.nextPeriod;
    const allSlots = liveData?.allSlots || [];

    // Calculate live progress
    let progressPercent = 0;
    let remainingMinutes = 0;
    let remainingSeconds = 0;

    if (currentPeriod) {
        const startMinutes = parseInt(currentPeriod.startTime.split(':')[0]) * 60 + parseInt(currentPeriod.startTime.split(':')[1]);
        const endMinutes = parseInt(currentPeriod.endTime.split(':')[0]) * 60 + parseInt(currentPeriod.endTime.split(':')[1]);
        const totalSeconds = (endMinutes - startMinutes) * 60;
        const elapsed = Math.min(elapsedSeconds, totalSeconds);
        progressPercent = Math.round((elapsed / totalSeconds) * 100);
        const remSec = totalSeconds - elapsed;
        remainingMinutes = Math.floor(remSec / 60);
        remainingSeconds = remSec % 60;
    }

    // Next period countdown
    let nextCountdown = '';
    if (nextPeriod?.minutesUntilStart) {
        const mins = nextPeriod.minutesUntilStart;
        nextCountdown = mins <= 5 ? `⚠️ Starts in ${mins} min!` : `Starts in ${mins} min`;
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <PageHeader title="My Timetable" titleHindi="मेरा समय सारणी" />

            <main className="max-w-4xl mx-auto px-4 lg:px-6 py-6">
                {/* Holiday Banner */}
                {isHoliday && (
                    <div className="card p-6 mb-6 bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                <Sun className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Holiday Today!</h2>
                                <p className="text-white/90 text-lg">{liveData.holiday?.title}</p>
                                {liveData.holiday?.titleHindi && (
                                    <p className="text-white/70 text-sm">{liveData.holiday.titleHindi}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Live Period Card */}
                {currentPeriod && !isHoliday && (
                    <div className="card overflow-hidden mb-6">
                        <div className={`bg-gradient-to-r ${SLOT_COLORS[currentPeriod.slotType] || SLOT_COLORS.lecture} p-6 text-white`}>
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                                        <span className="text-sm font-medium text-white/80">LIVE — Period {currentPeriod.periodNumber}</span>
                                    </div>
                                    <h2 className="text-2xl font-bold">
                                        {currentPeriod.slotType === 'break_period' ? '☕ Break Time' :
                                         currentPeriod.subject?.name || 'Free Period'}
                                    </h2>
                                    {currentPeriod.subject?.nameHindi && (
                                        <p className="text-white/70 text-sm">{currentPeriod.subject.nameHindi}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-mono font-bold">
                                        {String(remainingMinutes).padStart(2, '0')}:{String(remainingSeconds).padStart(2, '0')}
                                    </div>
                                    <div className="text-xs text-white/60">remaining</div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="relative h-3 bg-white/20 rounded-full overflow-hidden mb-3">
                                <div
                                    className="absolute left-0 top-0 h-full bg-white/80 rounded-full transition-all duration-1000"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between text-sm text-white/70">
                                <span>{currentPeriod.startTime}</span>
                                <span>{progressPercent}% elapsed</span>
                                <span>{currentPeriod.endTime}</span>
                            </div>

                            {/* Teacher + Room */}
                            <div className="flex flex-wrap gap-4 mt-4 text-sm">
                                {currentPeriod.instructor && (
                                    <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full backdrop-blur-sm">
                                        <User className="w-3.5 h-3.5" />
                                        {currentPeriod.instructor.firstName} {currentPeriod.instructor.lastName}
                                    </span>
                                )}
                                {currentPeriod.timetable?.class && (
                                    <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full backdrop-blur-sm">
                                        <BookOpen className="w-3.5 h-3.5" />
                                        {currentPeriod.timetable.class.name}
                                    </span>
                                )}
                                {currentPeriod.roomNumber && (
                                    <span className="flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full backdrop-blur-sm">
                                        <MapPin className="w-3.5 h-3.5" />
                                        Room {currentPeriod.roomNumber}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Next Period Peek */}
                        {nextPeriod && (
                            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <ChevronRight className="w-4 h-4" />
                                    <span>Next: <strong>{nextPeriod.subject?.name || 'Free'}</strong></span>
                                    {nextPeriod.instructor && (
                                        <span className="text-slate-400">• {nextPeriod.instructor.firstName}</span>
                                    )}
                                </div>
                                <span className="text-xs text-slate-500">{nextPeriod.startTime}–{nextPeriod.endTime}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Next Period Alert (when no current period) */}
                {!currentPeriod && nextPeriod && !isHoliday && (
                    <div className={`card p-5 mb-6 ${nextPeriod.minutesUntilStart <= 5
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20'
                        : 'bg-white dark:bg-slate-900'
                    }`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                nextPeriod.minutesUntilStart <= 5
                                    ? 'bg-amber-100 text-amber-600'
                                    : 'bg-primary-100 text-primary-600'
                            }`}>
                                {nextPeriod.minutesUntilStart <= 5 ? <Bell className="w-6 h-6 animate-bounce" /> : <Timer className="w-6 h-6" />}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                    Next: {nextPeriod.subject?.name || 'Period ' + nextPeriod.periodNumber}
                                </h3>
                                <p className="text-sm text-slate-500">{nextCountdown}</p>
                            </div>
                            <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{nextPeriod.startTime}</span>
                        </div>
                    </div>
                )}

                {/* Today's Full Schedule */}
                {!isHoliday && allSlots.length > 0 && (
                    <div className="card overflow-hidden mb-6">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                Today's Schedule — {DAY_LABELS[liveData?.dayOfWeek] || 'Today'}
                            </h3>
                            <p className="text-xs text-slate-500">{allSlots.length} periods</p>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {allSlots.map((slot, i) => {
                                const isCurrent = currentPeriod && slot.periodNumber === currentPeriod.periodNumber;
                                const isPast = liveData?.currentTime > slot.endTime;
                                return (
                                    <div
                                        key={slot.id || i}
                                        className={`flex items-center gap-4 px-4 py-3 transition ${
                                            isCurrent
                                                ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500'
                                                : isPast
                                                    ? 'opacity-50'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        }`}
                                    >
                                        <div className="w-14 text-center flex-shrink-0">
                                            <div className="text-xs font-mono text-slate-500">{slot.startTime}</div>
                                            <div className="text-[10px] text-slate-400">to</div>
                                            <div className="text-xs font-mono text-slate-500">{slot.endTime}</div>
                                        </div>
                                        <div className={`w-1 h-10 rounded-full bg-gradient-to-b ${SLOT_COLORS[slot.slotType] || SLOT_COLORS.lecture}`} />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                                {slot.slotType === 'break_period' ? '☕ Break' :
                                                 slot.slotType === 'assembly' ? '🏫 Assembly' :
                                                 slot.slotType === 'sports' ? '⚽ Sports' :
                                                 slot.slotType === 'library' ? '📚 Library' :
                                                 slot.subject?.name || 'Free Period'}
                                            </h4>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                {slot.instructor && <span>{slot.instructor.firstName} {slot.instructor.lastName}</span>}
                                                {slot.roomNumber && <span>Room {slot.roomNumber}</span>}
                                                {slot.timetable?.class?.name && <span>{slot.timetable.class.name}</span>}
                                            </div>
                                        </div>
                                        {isCurrent && (
                                            <span className="flex items-center gap-1 px-2 py-1 bg-primary-500 text-white text-xs rounded-full">
                                                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                                Now
                                            </span>
                                        )}
                                        {isPast && (
                                            <span className="text-xs text-slate-400">Done</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Upcoming Holidays */}
                {upcomingHolidays.length > 0 && (
                    <div className="card p-4">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary-500" /> Upcoming Holidays
                        </h3>
                        <div className="space-y-2">
                            {upcomingHolidays.map(h => (
                                <div key={h.id} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                                    <div>
                                        <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{h.title}</span>
                                        {h.titleHindi && <span className="text-xs text-slate-500 ml-2">{h.titleHindi}</span>}
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* No timetable */}
                {!isHoliday && allSlots.length === 0 && !loading && (
                    <div className="card p-12 text-center">
                        <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Schedule for Today</h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            {liveData?.message || 'Your timetable has not been set up yet. Contact your administrator.'}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
