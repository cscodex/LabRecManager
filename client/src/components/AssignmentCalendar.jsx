'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_COLORS = {
    graded: 'bg-emerald-500',
    submitted: 'bg-blue-500',
    pending: 'bg-amber-500',
    overdue: 'bg-red-500',
    needs_revision: 'bg-orange-500',
    in_progress: 'bg-purple-500'
};

export default function AssignmentCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarItems, setCalendarItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    useEffect(() => {
        loadCalendarData();
    }, [month, year]);

    const loadCalendarData = async () => {
        setLoading(true);
        try {
            const res = await dashboardAPI.getCalendar(month, year);
            setCalendarItems(res.data.data.calendarItems || []);
        } catch (err) {
            console.error('Failed to load calendar:', err);
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    // Group items by day
    const itemsByDay = calendarItems.reduce((acc, item) => {
        const day = new Date(item.dueDate).getDate();
        if (!acc[day]) acc[day] = [];
        acc[day].push(item);
        return acc;
    }, {});

    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = getFirstDayOfMonth(month, year);
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    // Build calendar grid
    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) {
        calendarDays.push(null); // Empty cells before month starts
    }
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    const selectedDayItems = selectedDay ? itemsByDay[selectedDay] || [] : [];

    return (
        <div className="card overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-primary-50 to-accent-50">
                <div className="flex items-center gap-3">
                    <CalendarIcon className="w-5 h-5 text-primary-600" />
                    <h3 className="font-semibold text-slate-900">Assignment Calendar</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-white/60 transition">
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <button onClick={goToToday} className="px-3 py-1 text-sm font-medium text-primary-600 hover:bg-white/60 rounded-lg transition">
                        Today
                    </button>
                    <button onClick={goToNextMonth} className="p-1.5 rounded-lg hover:bg-white/60 transition">
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                    </button>
                </div>
            </div>

            <div className="p-4">
                {/* Month/Year */}
                <div className="text-center mb-4">
                    <h4 className="text-lg font-semibold text-slate-800">{MONTHS[month]} {year}</h4>
                </div>

                {/* Days header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAYS.map(day => (
                        <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                        if (day === null) {
                            return <div key={`empty-${idx}`} className="h-16"></div>;
                        }

                        const isToday = isCurrentMonth && day === today.getDate();
                        const dayItems = itemsByDay[day] || [];
                        const hasItems = dayItems.length > 0;
                        const isSelected = selectedDay === day;

                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(isSelected ? null : day)}
                                className={`
                                    h-16 rounded-lg border transition-all text-left p-1 relative
                                    ${isToday ? 'border-primary-500 bg-primary-50' : 'border-slate-100 hover:border-slate-200'}
                                    ${isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : ''}
                                    ${hasItems ? 'cursor-pointer' : 'cursor-default'}
                                `}
                            >
                                <span className={`
                                    text-xs font-medium
                                    ${isToday ? 'text-primary-600' : 'text-slate-600'}
                                `}>
                                    {day}
                                </span>

                                {/* Status dots */}
                                {hasItems && (
                                    <div className="flex flex-wrap gap-0.5 mt-1">
                                        {dayItems.slice(0, 4).map((item, i) => (
                                            <div
                                                key={i}
                                                className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}
                                                title={item.title}
                                            />
                                        ))}
                                        {dayItems.length > 4 && (
                                            <span className="text-[10px] text-slate-400">+{dayItems.length - 4}</span>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3 text-xs">
                    {Object.entries(STATUS_COLORS).map(([status, color]) => (
                        <div key={status} className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                            <span className="text-slate-600 capitalize">{status.replace('_', ' ')}</span>
                        </div>
                    ))}
                </div>

                {/* Selected day details */}
                {selectedDay && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <h5 className="text-sm font-semibold text-slate-700 mb-2">
                            {MONTHS[month]} {selectedDay}, {year}
                        </h5>
                        {selectedDayItems.length === 0 ? (
                            <p className="text-sm text-slate-500">No assignments due this day</p>
                        ) : (
                            <div className="space-y-2">
                                {selectedDayItems.map(item => (
                                    <Link
                                        key={item.id}
                                        href={`/assignments/${item.id}`}
                                        className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-slate-900 text-sm">{item.title}</p>
                                                <p className="text-xs text-slate-500">{item.subject?.name}</p>
                                            </div>
                                            <span className={`
                                                px-2 py-0.5 rounded-full text-xs text-white
                                                ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}
                                            `}>
                                                {item.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                                            <p>📅 Due: {new Date(item.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                            {item.submittedAt && (
                                                <p className="text-blue-600">📤 Submitted: {new Date(item.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                            )}
                                            {item.gradedAt && (
                                                <p className="text-emerald-600">✓ Graded: {new Date(item.gradedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                            )}
                                        </div>
                                        {item.grade?.isPublished && (
                                            <p className="text-xs text-emerald-600 mt-1 font-semibold">
                                                Score: {item.grade.finalMarks}/{item.grade.maxMarks}
                                            </p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {loading && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
            )}
        </div>
    );
}
