'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDateTimeIST } from '@/lib/utils';
import { ChevronLeft, Plus, Trash2, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface Schedule {
    id: string;
    start_time: string;
    end_time: string;
}

export default function ExamSchedulePage() {
    const params = useParams();
    const examId = params.id as string;

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');


    const loadSchedules = useCallback(async () => {
        try {
            const response = await fetch(`/api/admin/exams/${examId}/schedule`);
            const data = await response.json();
            if (data.success) {
                setSchedules(data.schedules);
            }
        } catch (error) {
            toast.error('Failed to load schedules');
        } finally {
            setLoading(false);
        }
    }, [examId]);

    useEffect(() => {
        loadSchedules();
    }, [loadSchedules]);



    const handleAddSchedule = async () => {
        if (!startTime || !endTime) {
            toast.error('Both start and end times are required');
            return;
        }

        try {
            const response = await fetch(`/api/admin/exams/${examId}/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(endTime).toISOString(),
                }),
            });

            if (response.ok) {
                toast.success('Schedule added!');
                setStartTime('');
                setEndTime('');
                setShowAddForm(false);
                loadSchedules();
            }
        } catch (error) {
            toast.error('Failed to add schedule');
        }
    };

    const handleDeleteSchedule = async (scheduleId: string) => {
        if (!confirm('Delete this schedule?')) return;

        try {
            const response = await fetch(`/api/admin/exams/${examId}/schedule?scheduleId=${scheduleId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                toast.success('Schedule deleted');
                loadSchedules();
            }
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/admin/exams/${examId}`} className="text-gray-500 hover:text-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Exam Schedule</h1>
                    </div>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" />
                        Add Schedule
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
                {schedules.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No schedules set for this exam.</p>
                    </div>
                ) : (
                    schedules.map((schedule) => (
                        <div key={schedule.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 rounded-lg">
                                    <Calendar className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {formatDateTimeIST(schedule.start_time)}
                                    </p>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        to {formatDateTimeIST(schedule.end_time)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDeleteSchedule(schedule.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))
                )}

                {/* Add Schedule Modal */}
                {showAddForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Schedule</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time (IST)</label>
                                    <input
                                        type="datetime-local"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time (IST)</label>
                                    <input
                                        type="datetime-local"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full px-4 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddSchedule}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
