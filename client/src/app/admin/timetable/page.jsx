'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Clock, Plus, Trash2, Save, RefreshCw, Users, BookOpen,
    ChevronLeft, ChevronRight, GripVertical, AlertCircle, CheckCircle
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { timetableAPI, classesAPI } from '@/lib/api';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };
const DAY_LABELS_FULL = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };

const SLOT_TYPES = [
    { value: 'lecture', label: 'Lecture', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { value: 'lab', label: 'Lab', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    { value: 'break_period', label: 'Break', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    { value: 'assembly', label: 'Assembly', color: 'bg-teal-100 text-teal-800 border-teal-200' },
    { value: 'free', label: 'Free', color: 'bg-slate-100 text-slate-600 border-slate-200' },
    { value: 'sports', label: 'Sports', color: 'bg-green-100 text-green-800 border-green-200' },
    { value: 'library', label: 'Library', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
];

const DEFAULT_PERIODS = [
    { periodNumber: 1, startTime: '08:00', endTime: '08:40' },
    { periodNumber: 2, startTime: '08:40', endTime: '09:20' },
    { periodNumber: 3, startTime: '09:20', endTime: '10:00' },
    { periodNumber: 4, startTime: '10:00', endTime: '10:15', slotType: 'break_period' },
    { periodNumber: 5, startTime: '10:15', endTime: '10:55' },
    { periodNumber: 6, startTime: '10:55', endTime: '11:35' },
    { periodNumber: 7, startTime: '11:35', endTime: '12:15' },
    { periodNumber: 8, startTime: '12:15', endTime: '12:55' },
];

function getSlotColor(slotType) {
    return SLOT_TYPES.find(s => s.value === slotType)?.color || 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function AdminTimetablePage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated, selectedSessionId } = useAuthStore();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [instructors, setInstructors] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [timetable, setTimetable] = useState(null);
    const [slots, setSlots] = useState({});

    // Create timetable modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', effectiveFrom: '' });

    // Edit slot modal
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [slotForm, setSlotForm] = useState({
        subjectId: '', instructorId: '', roomNumber: '', slotType: 'lecture',
        startTime: '', endTime: ''
    });

    const isAdmin = user?.role === 'admin' || user?.role === 'principal';

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (!isAdmin) { router.push('/dashboard'); return; }
        loadInitialData();
    }, [isAuthenticated, _hasHydrated, isAdmin, selectedSessionId]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [classesRes, usersRes] = await Promise.all([
                classesAPI.getAll(),
                api.get('/users', { params: { role: 'instructor', limit: 200 } })
            ]);
            setClasses(classesRes.data.data.classes || []);
            setInstructors(usersRes.data.data.users || []);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const loadTimetable = useCallback(async (classId) => {
        if (!classId) return;
        setLoading(true);
        try {
            const res = await timetableAPI.get({ classId });
            const tt = res.data.data?.timetable;
            setTimetable(tt);

            // Also load subjects for this class
            try {
                const subjectsRes = await api.get(`/subjects`, { params: { classId } });
                setSubjects(subjectsRes.data.data?.subjects || subjectsRes.data.data || []);
            } catch { setSubjects([]); }

            if (tt?.slots) {
                const grouped = {};
                DAYS.forEach(day => { grouped[day] = {}; });
                tt.slots.forEach(slot => {
                    grouped[slot.dayOfWeek][slot.periodNumber] = slot;
                });
                setSlots(grouped);
            } else {
                const grouped = {};
                DAYS.forEach(day => { grouped[day] = {}; });
                setSlots(grouped);
            }
        } catch (error) {
            console.error('Error loading timetable:', error);
            setTimetable(null);
            const grouped = {};
            DAYS.forEach(day => { grouped[day] = {}; });
            setSlots(grouped);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedClassId) loadTimetable(selectedClassId);
    }, [selectedClassId, loadTimetable]);

    const handleCreateTimetable = async () => {
        if (!createForm.name || !createForm.effectiveFrom || !selectedClassId) {
            toast.error('Please fill all required fields');
            return;
        }

        setSaving(true);
        try {
            const academicYearId = user?.currentAcademicYearId || selectedSessionId;
            const res = await timetableAPI.create({
                classId: selectedClassId,
                academicYearId,
                name: createForm.name,
                effectiveFrom: createForm.effectiveFrom
            });
            setTimetable(res.data.data.timetable);
            toast.success('Timetable created!');
            setShowCreateModal(false);
            setCreateForm({ name: '', effectiveFrom: '' });
            loadTimetable(selectedClassId);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create timetable');
        } finally {
            setSaving(false);
        }
    };

    const handleSlotClick = (day, periodNumber) => {
        const existing = slots[day]?.[periodNumber];
        const defaultPeriod = DEFAULT_PERIODS.find(p => p.periodNumber === periodNumber) || {};

        setEditingSlot({ day, periodNumber, existing });
        setSlotForm({
            subjectId: existing?.subjectId || '',
            instructorId: existing?.instructorId || '',
            roomNumber: existing?.roomNumber || '',
            slotType: existing?.slotType || defaultPeriod.slotType || 'lecture',
            startTime: existing?.startTime || defaultPeriod.startTime || '',
            endTime: existing?.endTime || defaultPeriod.endTime || ''
        });
        setShowSlotModal(true);
    };

    const handleSaveSlot = async () => {
        if (!timetable) return;
        setSaving(true);
        try {
            const { day, periodNumber, existing } = editingSlot;

            if (existing?.id) {
                // Update existing slot
                await timetableAPI.updateSlot(existing.id, {
                    subjectId: slotForm.subjectId || null,
                    instructorId: slotForm.instructorId || null,
                    roomNumber: slotForm.roomNumber || null,
                    slotType: slotForm.slotType,
                    startTime: slotForm.startTime,
                    endTime: slotForm.endTime
                });
                toast.success('Slot updated');
            } else {
                // Create new slot
                await timetableAPI.addSlot(timetable.id, {
                    dayOfWeek: day,
                    periodNumber,
                    startTime: slotForm.startTime || DEFAULT_PERIODS[periodNumber - 1]?.startTime || '08:00',
                    endTime: slotForm.endTime || DEFAULT_PERIODS[periodNumber - 1]?.endTime || '08:40',
                    subjectId: slotForm.subjectId || null,
                    instructorId: slotForm.instructorId || null,
                    roomNumber: slotForm.roomNumber || null,
                    slotType: slotForm.slotType
                });
                toast.success('Slot added');
            }

            setShowSlotModal(false);
            loadTimetable(selectedClassId);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save slot');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteSlot = async () => {
        if (!editingSlot?.existing?.id) return;
        setSaving(true);
        try {
            await timetableAPI.deleteSlot(editingSlot.existing.id);
            toast.success('Slot removed');
            setShowSlotModal(false);
            loadTimetable(selectedClassId);
        } catch (error) {
            toast.error('Failed to delete slot');
        } finally {
            setSaving(false);
        }
    };

    const handleAutoFillWeek = async () => {
        if (!timetable) return;
        const slotsToCreate = [];
        DAYS.forEach(day => {
            DEFAULT_PERIODS.forEach(dp => {
                if (!slots[day]?.[dp.periodNumber]) {
                    slotsToCreate.push({
                        dayOfWeek: day,
                        periodNumber: dp.periodNumber,
                        startTime: dp.startTime,
                        endTime: dp.endTime,
                        slotType: dp.slotType || 'lecture'
                    });
                }
            });
        });

        if (slotsToCreate.length === 0) {
            toast.info('All slots already filled');
            return;
        }

        setSaving(true);
        try {
            await timetableAPI.addSlotsBulk(timetable.id, slotsToCreate);
            toast.success(`${slotsToCreate.length} empty slots auto-filled`);
            loadTimetable(selectedClassId);
        } catch (error) {
            toast.error('Failed to auto-fill');
        } finally {
            setSaving(false);
        }
    };

    // Count stats
    const totalSlots = Object.values(slots).reduce((sum, daySlots) => sum + Object.keys(daySlots).length, 0);

    if (loading && !classes.length) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <PageHeader title="Timetable Builder" titleHindi="समय सारणी निर्माता" />

            <main className="max-w-full mx-auto px-4 lg:px-6 py-6">
                {/* Class Selector + Actions */}
                <div className="card p-4 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Select Class</label>
                            <select
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className="input w-full md:w-64"
                            >
                                <option value="">Choose a class...</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name || `Class ${c.gradeLevel}-${c.section}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedClassId && (
                            <div className="flex flex-wrap gap-2">
                                {!timetable ? (
                                    <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                                        <Plus className="w-4 h-4" /> Create Timetable
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={handleAutoFillWeek} disabled={saving} className="btn btn-secondary">
                                            <Clock className="w-4 h-4" /> Auto-fill Periods
                                        </button>
                                        <button onClick={() => loadTimetable(selectedClassId)} className="btn btn-ghost">
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {timetable && (
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                <strong>{timetable.name}</strong>
                            </span>
                            <span>From: {new Date(timetable.effectiveFrom).toLocaleDateString('en-IN')}</span>
                            <span>{totalSlots} slots configured</span>
                        </div>
                    )}
                </div>

                {/* Timetable Grid */}
                {timetable && (
                    <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="bg-gradient-to-r from-primary-500 to-primary-600">
                                        <th className="px-3 py-3 text-left text-sm font-semibold text-white w-20">Period</th>
                                        {DAYS.map(day => (
                                            <th key={day} className="px-3 py-3 text-center text-sm font-semibold text-white">
                                                <div className="hidden md:block">{DAY_LABELS_FULL[day]}</div>
                                                <div className="md:hidden">{DAY_LABELS[day]}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {DEFAULT_PERIODS.map(period => (
                                        <tr key={period.periodNumber} className={`border-b border-slate-100 dark:border-slate-800 ${period.slotType === 'break_period' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                                            <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-800">
                                                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">P{period.periodNumber}</div>
                                                <div className="text-[10px] text-slate-500">{period.startTime}-{period.endTime}</div>
                                            </td>
                                            {DAYS.map(day => {
                                                const slot = slots[day]?.[period.periodNumber];
                                                return (
                                                    <td key={day} className="px-1 py-1 border-r border-slate-100 dark:border-slate-800">
                                                        <button
                                                            onClick={() => handleSlotClick(day, period.periodNumber)}
                                                            className={`w-full min-h-[60px] rounded-lg px-2 py-1.5 text-left transition-all hover:shadow-md hover:scale-[1.02] border ${slot
                                                                ? getSlotColor(slot.slotType)
                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-dashed border-slate-200 dark:border-slate-700 hover:border-primary-300 hover:bg-primary-50/50'
                                                                }`}
                                                        >
                                                            {slot ? (
                                                                <>
                                                                    <div className="text-xs font-semibold truncate">
                                                                        {slot.slotType === 'break_period' ? '☕ Break' :
                                                                         slot.slotType === 'assembly' ? '🏫 Assembly' :
                                                                         slot.slotType === 'free' ? '— Free' :
                                                                         slot.slotType === 'sports' ? '⚽ Sports' :
                                                                         slot.slotType === 'library' ? '📚 Library' :
                                                                         slot.subject?.code || slot.subject?.name || 'No Subject'}
                                                                    </div>
                                                                    {slot.instructor && (
                                                                        <div className="text-[10px] opacity-80 truncate mt-0.5">
                                                                            {slot.instructor.firstName} {slot.instructor.lastName?.[0]}.
                                                                        </div>
                                                                    )}
                                                                    {slot.roomNumber && (
                                                                        <div className="text-[10px] opacity-60 truncate">
                                                                            Room {slot.roomNumber}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center justify-center h-full">
                                                                    <Plus className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-3">
                            {SLOT_TYPES.map(st => (
                                <span key={st.value} className={`px-2 py-1 rounded text-[10px] font-medium border ${st.color}`}>
                                    {st.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* No timetable state */}
                {selectedClassId && !timetable && !loading && (
                    <div className="card p-12 text-center">
                        <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Timetable Found</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">Create a timetable for this class to start scheduling periods.</p>
                        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                            <Plus className="w-4 h-4" /> Create Timetable
                        </button>
                    </div>
                )}

                {/* No class selected */}
                {!selectedClassId && (
                    <div className="card p-12 text-center">
                        <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Select a Class</h3>
                        <p className="text-slate-500 dark:text-slate-400">Choose a class from the dropdown above to view or create its timetable.</p>
                    </div>
                )}
            </main>

            {/* Create Timetable Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-xl">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Create Timetable</h3>
                            <p className="text-sm text-slate-500 mt-1">Set up a new timetable for the selected class</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Timetable Name *</label>
                                <input
                                    type="text"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g., Class 11-A Weekly Timetable"
                                    className="input w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Effective From *</label>
                                <input
                                    type="date"
                                    value={createForm.effectiveFrom}
                                    onChange={(e) => setCreateForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                                    className="input w-full"
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                            <button onClick={handleCreateTimetable} disabled={saving} className="btn btn-primary flex-1">
                                {saving ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Slot Edit Modal */}
            {showSlotModal && editingSlot && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-xl">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                {editingSlot.existing ? 'Edit Period' : 'Add Period'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {DAY_LABELS_FULL[editingSlot.day]} — Period {editingSlot.periodNumber}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Start Time</label>
                                    <input
                                        type="time"
                                        value={slotForm.startTime}
                                        onChange={(e) => setSlotForm(f => ({ ...f, startTime: e.target.value }))}
                                        className="input w-full"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">End Time</label>
                                    <input
                                        type="time"
                                        value={slotForm.endTime}
                                        onChange={(e) => setSlotForm(f => ({ ...f, endTime: e.target.value }))}
                                        className="input w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Slot Type</label>
                                <select
                                    value={slotForm.slotType}
                                    onChange={(e) => setSlotForm(f => ({ ...f, slotType: e.target.value }))}
                                    className="input w-full"
                                >
                                    {SLOT_TYPES.map(st => (
                                        <option key={st.value} value={st.value}>{st.label}</option>
                                    ))}
                                </select>
                            </div>

                            {(slotForm.slotType === 'lecture' || slotForm.slotType === 'lab') && (
                                <>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Subject</label>
                                        <select
                                            value={slotForm.subjectId}
                                            onChange={(e) => setSlotForm(f => ({ ...f, subjectId: e.target.value }))}
                                            className="input w-full"
                                        >
                                            <option value="">Select subject...</option>
                                            {subjects.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}{s.nameHindi ? ` (${s.nameHindi})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Instructor</label>
                                        <select
                                            value={slotForm.instructorId}
                                            onChange={(e) => setSlotForm(f => ({ ...f, instructorId: e.target.value }))}
                                            className="input w-full"
                                        >
                                            <option value="">Select instructor...</option>
                                            {instructors.map(i => (
                                                <option key={i.id} value={i.id}>
                                                    {i.firstName} {i.lastName} ({i.email})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Room Number</label>
                                        <input
                                            type="text"
                                            value={slotForm.roomNumber}
                                            onChange={(e) => setSlotForm(f => ({ ...f, roomNumber: e.target.value }))}
                                            placeholder="e.g., Lab-1, Room 201"
                                            className="input w-full"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                            {editingSlot.existing && (
                                <button onClick={handleDeleteSlot} disabled={saving} className="btn btn-ghost text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            <div className="flex-1" />
                            <button onClick={() => setShowSlotModal(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleSaveSlot} disabled={saving} className="btn btn-primary">
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
