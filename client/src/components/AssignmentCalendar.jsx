'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    const [hoveredDay, setHoveredDay] = useState(null);
    const [hoveredMonth, setHoveredMonth] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    const month1 = currentDate.getMonth();
    const year1 = currentDate.getFullYear();
    const month2 = month1 === 11 ? 0 : month1 + 1;
    const year2 = month1 === 11 ? year1 + 1 : year1;

    useEffect(() => {
        loadCalendarData();
    }, [month1, year1]);

    const loadCalendarData = async () => {
        setLoading(true);
        try {
            const [res1, res2] = await Promise.all([
                dashboardAPI.getCalendar(month1, year1),
                dashboardAPI.getCalendar(month2, year2)
            ]);
            const items1 = res1.data.data.calendarItems || [];
            const items2 = res2.data.data.calendarItems || [];
            setCalendarItems([...items1, ...items2]);
        } catch (err) {
            console.error('Failed to load calendar:', err);
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const goToPrevMonth = () => setCurrentDate(new Date(year1, month1 - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year1, month1 + 1, 1));
    const goToToday = () => { setCurrentDate(new Date()); setHoveredDay(null); };

    const getItemsForMonth = (month, year) => {
        const gradedByDay = {};
        const dueByDay = {};

        calendarItems.forEach(item => {
            const markDate = item.gradedAt ? new Date(item.gradedAt) :
                item.submittedAt ? new Date(item.submittedAt) : null;

            if (markDate && markDate.getMonth() === month && markDate.getFullYear() === year) {
                const day = markDate.getDate();
                if (!gradedByDay[day]) gradedByDay[day] = [];
                gradedByDay[day].push(item);
            }

            if (item.dueDate) {
                const dueDate = new Date(item.dueDate);
                if (dueDate.getMonth() === month && dueDate.getFullYear() === year) {
                    const day = dueDate.getDate();
                    if (!dueByDay[day]) dueByDay[day] = [];
                    dueByDay[day].push(item);
                }
            }
        });

        return { gradedByDay, dueByDay };
    };

    const today = new Date();

    const handleMouseEnter = (e, day, monthIndex, hasItems) => {
        if (!hasItems) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 8
        });
        setHoveredDay(day);
        setHoveredMonth(monthIndex);
    };

    const handleMouseLeave = () => {
        setHoveredDay(null);
        setHoveredMonth(null);
    };

    const renderMonth = (month, year, monthIndex) => {
        const daysInMonth = getDaysInMonth(month, year);
        const firstDay = getFirstDayOfMonth(month, year);
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
        const { gradedByDay, dueByDay } = getItemsForMonth(month, year);

        const calendarDays = [];
        for (let i = 0; i < firstDay; i++) calendarDays.push(null);
        for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

        return (
            <div className="flex-1 min-w-0">
                <div className="text-center mb-2">
                    <h4 className="text-sm font-semibold text-slate-700">{MONTHS[month]} {year}</h4>
                </div>

                <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {DAYS.map((day, i) => (
                        <div key={i} className="text-center text-[10px] font-medium text-slate-400 py-1">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                    {calendarDays.map((day, idx) => {
                        if (day === null) {
                            return <div key={`empty-${idx}`} className="h-8"></div>;
                        }

                        const isToday = isCurrentMonth && day === today.getDate();
                        const gradedItems = gradedByDay[day] || [];
                        const dueItems = dueByDay[day] || [];
                        const hasGraded = gradedItems.length > 0;
                        const hasDue = dueItems.length > 0;
                        const hasItems = hasGraded || hasDue;

                        return (
                            <div
                                key={day}
                                onMouseEnter={(e) => handleMouseEnter(e, day, monthIndex, hasItems)}
                                onMouseLeave={handleMouseLeave}
                                className={`
                                    h-8 rounded text-[11px] relative flex flex-col items-center justify-center transition-all
                                    ${isToday ? 'bg-primary-100 text-primary-700 font-bold' : 'text-slate-600'}
                                    ${hasItems ? 'cursor-pointer hover:bg-slate-100 hover:ring-1 hover:ring-primary-300' : 'cursor-default'}
                                `}
                            >
                                <span>{day}</span>

                                <div className="flex items-center gap-0.5 absolute bottom-0.5">
                                    {hasGraded && gradedItems.slice(0, 2).map((item, i) => (
                                        <div
                                            key={i}
                                            className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[item.status] || STATUS_COLORS.pending}`}
                                        />
                                    ))}
                                    {gradedItems.length > 2 && (
                                        <span className="text-[8px] text-slate-400">+{gradedItems.length - 2}</span>
                                    )}

                                    {hasDue && (
                                        <div className="flex items-center">
                                            <Clock className="w-2.5 h-2.5 text-amber-500" />
                                            {dueItems.length > 1 && (
                                                <span className="text-[8px] text-amber-600 font-medium">{dueItems.length}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Get hovered day items
    const getHoveredItems = () => {
        if (hoveredDay === null || hoveredMonth === null) return { graded: [], due: [] };

        const month = hoveredMonth === 0 ? month1 : month2;
        const year = hoveredMonth === 0 ? year1 : year2;
        const { gradedByDay, dueByDay } = getItemsForMonth(month, year);

        return {
            graded: gradedByDay[hoveredDay] || [],
            due: dueByDay[hoveredDay] || [],
            month,
            year
        };
    };

    const hoveredItems = getHoveredItems();
    const showTooltip = hoveredDay !== null && (hoveredItems.graded.length > 0 || hoveredItems.due.length > 0);

    return (
        <div className="card overflow-hidden relative">
            {/* Header */}
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-primary-50 to-accent-50">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-primary-600" />
                    <h3 className="font-semibold text-sm text-slate-900">Assignment Calendar</h3>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-white/60 transition">
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <button onClick={goToToday} className="px-2 py-0.5 text-xs font-medium text-primary-600 hover:bg-white/60 rounded transition">
                        Today
                    </button>
                    <button onClick={goToNextMonth} className="p-1 rounded hover:bg-white/60 transition">
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                </div>
            </div>

            <div className="p-3">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-3">
                            {renderMonth(month1, year1, 0)}
                            <div className="w-px bg-slate-200"></div>
                            {renderMonth(month2, year2, 1)}
                        </div>

                        {/* Legend */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-[10px]">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-slate-500">Graded</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-slate-500">Submitted</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-amber-500" />
                                <span className="text-slate-500">Due</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Floating Tooltip */}
            {showTooltip && (
                <div
                    className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 p-3 min-w-48 max-w-64 transform -translate-x-1/2 -translate-y-full pointer-events-none"
                    style={{ left: tooltipPosition.x, top: tooltipPosition.y }}
                >
                    <div className="text-xs font-semibold text-slate-700 mb-2 border-b pb-1">
                        {MONTHS[hoveredItems.month]} {hoveredDay}, {hoveredItems.year}
                    </div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {hoveredItems.graded.map((item, i) => (
                            <div key={`g-${i}`} className="flex items-center gap-2 text-xs">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[item.status]}`} />
                                <span className="flex-1 truncate">{item.title}</span>
                                {item.gradedAt && (
                                    <span className="text-emerald-600 text-[10px] flex-shrink-0">
                                        ✓ {new Date(item.gradedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        ))}
                        {hoveredItems.due.filter(d => !hoveredItems.graded.find(g => g.id === d.id)).map((item, i) => (
                            <div key={`d-${i}`} className="flex items-center gap-2 text-xs text-amber-700">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                <span className="flex-1 truncate">{item.title}</span>
                                <span className="text-[10px] flex-shrink-0">
                                    {new Date(item.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Triangle pointer */}
                    <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
                        <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
                    </div>
                </div>
            )}
        </div>
    );
}
