'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Monitor, Plus, Edit2, Trash2, X, Search, ArrowLeft, Building, Printer, Wifi, Speaker, Armchair, Table, Projector, Package, BarChart3, History, ArrowRightLeft, Camera, Network, Volume2, User, Wrench, CheckCircle, AlertTriangle, Clock, Laptop, Barcode, ClipboardList, PackagePlus, UserPlus, UserMinus, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { labsAPI, usersAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

const ITEM_TYPE_ICONS = {
    pc: { icon: Monitor, color: 'blue' },
    printer: { icon: Printer, color: 'purple' },
    router: { icon: Wifi, color: 'green' },
    speaker: { icon: Speaker, color: 'amber' },
    projector: { icon: Projector, color: 'red' },
    smart_camera: { icon: Camera, color: 'indigo' },
    network_switch: { icon: Network, color: 'cyan' },
    soundbar: { icon: Volume2, color: 'orange' },
    chair: { icon: Armchair, color: 'slate' },
    table: { icon: Table, color: 'emerald' },
    other: { icon: Package, color: 'gray' }
};

export default function LabsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [labs, setLabs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingLab, setEditingLab] = useState(null);
    const [formData, setFormData] = useState({ name: '', nameHindi: '', roomNumber: '', capacity: 30, inchargeId: '' });
    const [instructors, setInstructors] = useState([]);

    // Delete confirmation state
    const [deleteDialog, setDeleteDialog] = useState({ open: false, lab: null });
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Maintenance modal state
    const [maintenanceModal, setMaintenanceModal] = useState({ open: false, lab: null });
    const [maintenanceData, setMaintenanceData] = useState({ reason: '', endDate: '' });
    const [maintenanceLoading, setMaintenanceLoading] = useState(false);

    // History modal (comprehensive: maintenance + events)
    const [historyModal, setHistoryModal] = useState({ open: false, lab: null });
    const [maintenanceHistory, setMaintenanceHistory] = useState([]);
    const [eventHistory, setEventHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTab, setHistoryTab] = useState('all'); // 'all', 'maintenance', 'inventory', 'incharge'

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (user?.role !== 'admin' && user?.role !== 'principal') { router.push('/dashboard'); return; }
        loadLabs();
    }, [isAuthenticated, _hasHydrated]);

    const loadLabs = async () => {
        setLoading(true);
        try {
            const [labsRes, usersRes] = await Promise.all([
                labsAPI.getAll(),
                usersAPI.getAll({ role: 'instructor', limit: 100 })
            ]);
            setLabs(labsRes.data.data.labs || []);
            // Include lab_assistants too
            const instructorsList = usersRes.data.data.users || [];
            setInstructors(instructorsList);
        } catch (error) {
            toast.error('Failed to load labs');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingLab) {
                await labsAPI.update(editingLab.id, formData);
                toast.success('Lab updated');
            } else {
                await labsAPI.create(formData);
                toast.success('Lab created');
            }
            setShowModal(false);
            setEditingLab(null);
            setFormData({ name: '', nameHindi: '', roomNumber: '', capacity: 30, inchargeId: '' });
            loadLabs();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (lab) => {
        setEditingLab(lab);
        setFormData({
            name: lab.name,
            nameHindi: lab.nameHindi || '',
            roomNumber: lab.roomNumber || '',
            capacity: lab.capacity || 30,
            inchargeId: lab.inchargeId || ''
        });
        setShowModal(true);
    };

    const handleDelete = (lab) => {
        setDeleteDialog({ open: true, lab });
    };

    const confirmDelete = async () => {
        if (!deleteDialog.lab) return;
        setDeleteLoading(true);
        try {
            await labsAPI.delete(deleteDialog.lab.id);
            toast.success('Lab deleted');
            loadLabs();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete');
        } finally {
            setDeleteLoading(false);
            setDeleteDialog({ open: false, lab: null });
        }
    };

    const handleMaintenanceToggle = (lab) => {
        setMaintenanceModal({ open: true, lab });
        setMaintenanceData({
            reason: lab.maintenanceReason || '',
            endDate: lab.maintenanceEndDate ? new Date(lab.maintenanceEndDate).toISOString().split('T')[0] : ''
        });
    };

    const submitMaintenanceStatus = async (newStatus) => {
        if (!maintenanceModal.lab) return;
        setMaintenanceLoading(true);
        try {
            await labsAPI.updateStatus(maintenanceModal.lab.id, {
                status: newStatus,
                maintenanceReason: maintenanceData.reason,
                maintenanceEndDate: maintenanceData.endDate || null
            });
            toast.success(newStatus === 'maintenance' ? 'Lab set to maintenance mode' : 'Lab activated');
            setMaintenanceModal({ open: false, lab: null });
            loadLabs();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update status');
        } finally {
            setMaintenanceLoading(false);
        }
    };

    const loadMaintenanceHistory = async (lab) => {
        console.log('[Debug] Loading history for lab:', lab.id, lab.name);
        setHistoryModal({ open: true, lab });
        setHistoryLoading(true);
        setHistoryTab('all');
        try {
            const [maintenanceRes, eventRes] = await Promise.all([
                labsAPI.getMaintenanceHistory(lab.id),
                labsAPI.getEventHistory(lab.id)
            ]);
            console.log('[Debug] Maintenance history response:', maintenanceRes.data);
            console.log('[Debug] Event history response:', eventRes.data);
            setMaintenanceHistory(maintenanceRes.data.data.history || []);
            setEventHistory(eventRes.data.data.history || []);
        } catch (error) {
            console.error('[Debug] History loading error:', error);
            toast.error('Failed to load history');
            setMaintenanceHistory([]);
            setEventHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const filteredLabs = labs.filter(l =>
        l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.roomNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Building className="w-6 h-6 text-primary-500" />
                            <h1 className="text-xl font-semibold text-slate-900">Labs Management</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/admin/barcode-generator" className="btn btn-secondary">
                            <Barcode className="w-4 h-4" /> Barcodes
                        </Link>
                        <Link href="/admin/procurement" className="btn btn-secondary">
                            <ClipboardList className="w-4 h-4" /> Procurement
                        </Link>
                        <Link href="/admin/laptop-issuances" className="btn btn-secondary">
                            <Laptop className="w-4 h-4" /> Laptop Issuances
                        </Link>
                        <Link href="/admin/labs/shift-requests" className="btn btn-secondary">
                            <ArrowRightLeft className="w-4 h-4" /> Shift Requests
                        </Link>
                        <Link href="/admin/labs/import-history" className="btn btn-secondary">
                            <History className="w-4 h-4" /> Import History
                        </Link>
                        <Link href="/admin/labs/inventory-reports" className="btn btn-secondary">
                            <BarChart3 className="w-4 h-4" /> Reports
                        </Link>
                        <button onClick={() => { setEditingLab(null); setFormData({ name: '', nameHindi: '', roomNumber: '', capacity: 30, inchargeId: '' }); setShowModal(true); }} className="btn btn-primary">
                            <Plus className="w-4 h-4" /> Add Lab
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Search */}
                <div className="card p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search labs by name or room..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10"
                        />
                    </div>
                </div>

                {/* Labs Grid */}
                {filteredLabs.length === 0 ? (
                    <div className="card p-12 text-center">
                        <Building className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No labs found</h3>
                        <p className="text-slate-500 mb-4">Create your first computer lab to get started.</p>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary">
                            <Plus className="w-4 h-4" /> Add Lab
                        </button>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredLabs.map((lab) => (
                            <div key={lab.id} className={`card p-6 hover:shadow-lg transition ${lab.status === 'maintenance' ? 'border-l-4 border-amber-500 bg-amber-50/50' : lab.status === 'closed' ? 'border-l-4 border-red-500 bg-red-50/50' : ''}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                                        <Monitor className="w-6 h-6" />
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleMaintenanceToggle(lab)} className={`p-2 rounded ${lab.status === 'maintenance' ? 'text-amber-600 bg-amber-100' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`} title="Set Maintenance">
                                            <Wrench className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => loadMaintenanceHistory(lab)} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded" title="View History">
                                            <Clock className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleEdit(lab)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(lab)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                {/* Status Badge */}
                                {lab.status && lab.status !== 'active' && (
                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mb-2 ${lab.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                        {lab.status === 'maintenance' ? <Wrench className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                        {lab.status.charAt(0).toUpperCase() + lab.status.slice(1)}
                                        {lab.maintenanceReason && <span className="ml-1">• {lab.maintenanceReason}</span>}
                                    </div>
                                )}
                                <h3 className="text-lg font-semibold text-slate-900 mb-1">{lab.name}</h3>
                                {lab.nameHindi && <p className="text-sm text-slate-500 mb-2">{lab.nameHindi}</p>}
                                <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                                    {lab.roomNumber && <span>Room: {lab.roomNumber}</span>}
                                    <span>Capacity: {lab.capacity}</span>
                                </div>
                                {/* Lab Incharge */}
                                {lab.incharge && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <span>Incharge: <span className="font-medium text-slate-700">{lab.incharge.firstName} {lab.incharge.lastName}</span></span>
                                    </div>
                                )}
                                {/* Item Counts by Type */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {lab.itemCounts && Object.entries(lab.itemCounts).map(([type, count]) => {
                                        const typeInfo = ITEM_TYPE_ICONS[type] || ITEM_TYPE_ICONS.other;
                                        const Icon = typeInfo.icon;
                                        return (
                                            <span key={type} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-${typeInfo.color}-50 text-${typeInfo.color}-700`}>
                                                <Icon className="w-3 h-3" /> {count}
                                            </span>
                                        );
                                    })}
                                    {(!lab.itemCounts || Object.keys(lab.itemCounts).length === 0) && (
                                        <span className="text-xs text-slate-400">No items</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">{lab.totalItems || 0} Total Items</span>
                                    <Link
                                        href={`/admin/labs/${lab.id}/pcs`}
                                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                    >
                                        Manage Inventory →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )
                }
            </main >

            {/* Create/Edit Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full">
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                                <h3 className="text-xl font-semibold text-slate-900">
                                    {editingLab ? 'Edit Lab' : 'Create Lab'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Lab Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Computer Lab 1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Name (Hindi)</label>
                                    <input
                                        type="text"
                                        value={formData.nameHindi}
                                        onChange={(e) => setFormData({ ...formData, nameHindi: e.target.value })}
                                        className="input"
                                        placeholder="कंप्यूटर लैब 1"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Room Number</label>
                                        <input
                                            type="text"
                                            value={formData.roomNumber}
                                            onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                                            className="input"
                                            placeholder="e.g., CL-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
                                        <input
                                            type="number"
                                            value={formData.capacity}
                                            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 30 })}
                                            className="input"
                                            min="1"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Lab Incharge</label>
                                    <select
                                        value={formData.inchargeId}
                                        onChange={(e) => setFormData({ ...formData, inchargeId: e.target.value })}
                                        className="input"
                                    >
                                        <option value="">Select Instructor</option>
                                        {instructors.map(inst => (
                                            <option key={inst.id} value={inst.id}>
                                                {inst.firstName} {inst.lastName} ({inst.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary flex-1">
                                        {editingLab ? 'Update' : 'Create'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, lab: null })}
                onConfirm={confirmDelete}
                title="Delete Lab"
                message={`Are you sure you want to delete "${deleteDialog.lab?.name}"? This will also delete all items in this lab. This action cannot be undone.`}
                confirmText="Delete Lab"
                type="danger"
                loading={deleteLoading}
            />

            {/* Maintenance Modal */}
            {maintenanceModal.open && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">
                                {maintenanceModal.lab?.status === 'maintenance' ? 'Lab Maintenance' : 'Set Maintenance Mode'}
                            </h3>
                            <button onClick={() => setMaintenanceModal({ open: false, lab: null })} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">
                                Lab: <span className="font-semibold">{maintenanceModal.lab?.name}</span>
                                {maintenanceModal.lab?.status === 'maintenance' && (
                                    <span className="ml-2 text-amber-600">(Currently in maintenance)</span>
                                )}
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Maintenance</label>
                                <input
                                    type="text"
                                    value={maintenanceData.reason}
                                    onChange={(e) => setMaintenanceData({ ...maintenanceData, reason: e.target.value })}
                                    className="input"
                                    placeholder="e.g., Deep cleaning, Renovation, Electrical work"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Expected End Date & Time (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={maintenanceData.endDate}
                                    onChange={(e) => setMaintenanceData({ ...maintenanceData, endDate: e.target.value })}
                                    className="input"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                {maintenanceModal.lab?.status === 'maintenance' ? (
                                    <>
                                        <button
                                            onClick={() => submitMaintenanceStatus('active')}
                                            disabled={maintenanceLoading}
                                            className="btn btn-primary flex-1 gap-2"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Activate Lab
                                        </button>
                                        <button
                                            onClick={() => setMaintenanceModal({ open: false, lab: null })}
                                            className="btn btn-secondary flex-1"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => submitMaintenanceStatus('maintenance')}
                                            disabled={maintenanceLoading || !maintenanceData.reason}
                                            className="btn btn-warning flex-1 gap-2"
                                        >
                                            <Wrench className="w-4 h-4" /> Set Maintenance
                                        </button>
                                        <button
                                            onClick={() => setMaintenanceModal({ open: false, lab: null })}
                                            className="btn btn-secondary flex-1"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lab History Modal (Comprehensive) */}
            {historyModal.open && (() => {
                // Filter event history based on selected tab
                const filteredEvents = historyTab === 'all' ? eventHistory :
                    historyTab === 'inventory' ? eventHistory.filter(e => e.eventType === 'item_added' || e.eventType === 'procurement_received') :
                        historyTab === 'incharge' ? eventHistory.filter(e => e.eventType.includes('incharge')) :
                            [];
                const showMaintenance = historyTab === 'all' || historyTab === 'maintenance';
                const showEvents = historyTab !== 'maintenance';

                // Combine maintenance and events for "all" tab, sorted by date
                const allHistory = historyTab === 'all' ? [
                    ...maintenanceHistory.map(m => ({ ...m, _type: 'maintenance' })),
                    ...eventHistory.map(e => ({ ...e, _type: 'event' }))
                ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];

                return (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
                            <div className="p-6 border-b border-slate-200">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900">Lab History</h3>
                                        <p className="text-sm text-slate-500">{historyModal.lab?.name}</p>
                                    </div>
                                    <button onClick={() => setHistoryModal({ open: false, lab: null })} className="p-2 hover:bg-slate-100 rounded-lg">
                                        <X className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>
                                {/* Tabs */}
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { id: 'all', label: 'All', icon: History },
                                        { id: 'maintenance', label: 'Maintenance', icon: Wrench },
                                        { id: 'inventory', label: 'Inventory', icon: Package },
                                        { id: 'incharge', label: 'Incharge', icon: User }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setHistoryTab(tab.id)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${historyTab === tab.id ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto max-h-[60vh]">
                                {historyLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
                                    </div>
                                ) : (historyTab === 'all' ? allHistory.length === 0 :
                                    historyTab === 'maintenance' ? maintenanceHistory.length === 0 : filteredEvents.length === 0) ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                        <p>No history records found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* All tab - Combined view */}
                                        {historyTab === 'all' && allHistory.map((entry) => (
                                            <div key={entry.id} className={`border-l-4 pl-4 py-3 bg-slate-50 rounded-r-lg ${entry._type === 'maintenance' ? 'border-purple-500' :
                                                    entry.eventType === 'item_added' ? 'border-blue-500' :
                                                        entry.eventType === 'procurement_received' ? 'border-green-500' :
                                                            entry.eventType?.includes('incharge') ? 'border-amber-500' : 'border-slate-400'
                                                }`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {entry._type === 'maintenance' ? <Wrench className="w-4 h-4 text-purple-600" /> :
                                                            entry.eventType === 'item_added' ? <PackagePlus className="w-4 h-4 text-blue-600" /> :
                                                                entry.eventType === 'procurement_received' ? <ShoppingCart className="w-4 h-4 text-green-600" /> :
                                                                    entry.eventType === 'incharge_assigned' ? <UserPlus className="w-4 h-4 text-amber-600" /> :
                                                                        entry.eventType === 'incharge_removed' ? <UserMinus className="w-4 h-4 text-red-600" /> :
                                                                            <User className="w-4 h-4 text-amber-600" />}
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${entry._type === 'maintenance' ? 'bg-purple-100 text-purple-700' :
                                                                entry.eventType === 'item_added' ? 'bg-blue-100 text-blue-700' :
                                                                    entry.eventType === 'procurement_received' ? 'bg-green-100 text-green-700' :
                                                                        'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {entry._type === 'maintenance' ? entry.action?.toUpperCase() : entry.eventType?.replace(/_/g, ' ').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(entry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 mb-2">
                                                    {entry._type === 'maintenance' ?
                                                        `${entry.previousStatus || 'active'} → ${entry.newStatus}${entry.reason ? `: ${entry.reason}` : ''}` :
                                                        entry.description}
                                                </p>
                                                {entry.performedBy && (
                                                    <span className="text-xs text-slate-500">👤 {entry.performedBy.firstName} {entry.performedBy.lastName}</span>
                                                )}
                                                {entry.procurementRequest && (
                                                    <span className="text-xs text-slate-500 ml-3">📦 PO: {entry.procurementRequest.poNumber || entry.procurementRequest.title}</span>
                                                )}
                                            </div>
                                        ))}

                                        {/* Maintenance tab */}
                                        {historyTab === 'maintenance' && maintenanceHistory.map((entry) => (
                                            <div key={entry.id} className="border-l-4 border-purple-500 pl-4 py-3 bg-slate-50 rounded-r-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-mono text-slate-400">#{entry.id.slice(0, 8)}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${entry.action === 'started' ? 'bg-amber-100 text-amber-700' :
                                                        entry.action === 'ended' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                                                        {entry.action.toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm font-medium text-slate-700">{entry.previousStatus} → {entry.newStatus}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                                                    <div className="bg-white rounded p-2 border">
                                                        <p className="text-slate-400 mb-1">Started</p>
                                                        <p className="font-medium text-slate-700">{entry.startedAt ? new Date(entry.startedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                                                    </div>
                                                    <div className="bg-white rounded p-2 border">
                                                        <p className="text-slate-400 mb-1">Ended</p>
                                                        <p className="font-medium text-slate-700">{entry.endedAt ? new Date(entry.endedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                                                    </div>
                                                </div>
                                                {entry.reason && <p className="text-sm text-slate-600 mb-2">💬 {entry.reason}</p>}
                                                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                                    {entry.expectedEndDate && <span>⏰ Expected: {new Date(entry.expectedEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                                                    {entry.performedBy && <span>👤 {entry.performedBy.firstName} {entry.performedBy.lastName}</span>}
                                                    <span className="text-slate-400">📅 Created: {new Date(entry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Inventory tab */}
                                        {historyTab === 'inventory' && filteredEvents.map((entry) => (
                                            <div key={entry.id} className={`border-l-4 pl-4 py-3 bg-slate-50 rounded-r-lg ${entry.eventType === 'procurement_received' ? 'border-green-500' : 'border-blue-500'
                                                }`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {entry.eventType === 'procurement_received' ?
                                                            <ShoppingCart className="w-4 h-4 text-green-600" /> :
                                                            <PackagePlus className="w-4 h-4 text-blue-600" />}
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${entry.eventType === 'procurement_received' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {entry.eventType === 'procurement_received' ? 'FROM PROCUREMENT' : 'ITEM ADDED'}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(entry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 mb-2">{entry.description}</p>
                                                {entry.itemDetails && (
                                                    <div className="bg-white rounded p-2 border mb-2 text-xs">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div><span className="text-slate-400">Type:</span> <span className="font-medium">{entry.itemDetails.itemType}</span></div>
                                                            <div><span className="text-slate-400">Number:</span> <span className="font-medium">{entry.itemDetails.itemNumber}</span></div>
                                                            {entry.itemDetails.brand && <div><span className="text-slate-400">Brand:</span> <span className="font-medium">{entry.itemDetails.brand}</span></div>}
                                                            {entry.itemDetails.quantity && <div><span className="text-slate-400">Qty:</span> <span className="font-medium">{entry.itemDetails.quantity}</span></div>}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                                                    {entry.performedBy && <span>👤 {entry.performedBy.firstName} {entry.performedBy.lastName}</span>}
                                                    {entry.procurementRequest && (
                                                        <span className="text-green-600">📦 {entry.procurementRequest.poNumber || entry.procurementRequest.title}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {/* Incharge tab */}
                                        {historyTab === 'incharge' && filteredEvents.map((entry) => (
                                            <div key={entry.id} className={`border-l-4 pl-4 py-3 bg-slate-50 rounded-r-lg ${entry.eventType === 'incharge_assigned' ? 'border-emerald-500' :
                                                    entry.eventType === 'incharge_removed' ? 'border-red-500' : 'border-amber-500'
                                                }`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {entry.eventType === 'incharge_assigned' ? <UserPlus className="w-4 h-4 text-emerald-600" /> :
                                                            entry.eventType === 'incharge_removed' ? <UserMinus className="w-4 h-4 text-red-600" /> :
                                                                <ArrowRightLeft className="w-4 h-4 text-amber-600" />}
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${entry.eventType === 'incharge_assigned' ? 'bg-emerald-100 text-emerald-700' :
                                                                entry.eventType === 'incharge_removed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {entry.eventType.replace(/_/g, ' ').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(entry.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 mb-2">{entry.description}</p>
                                                <div className="flex gap-4 text-xs mb-2">
                                                    {entry.oldIncharge && (
                                                        <div className="bg-red-50 rounded px-2 py-1">
                                                            <span className="text-red-400">Previous:</span> <span className="font-medium text-red-700">{entry.oldIncharge.firstName} {entry.oldIncharge.lastName}</span>
                                                        </div>
                                                    )}
                                                    {entry.newIncharge && (
                                                        <div className="bg-emerald-50 rounded px-2 py-1">
                                                            <span className="text-emerald-400">New:</span> <span className="font-medium text-emerald-700">{entry.newIncharge.firstName} {entry.newIncharge.lastName}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {entry.performedBy && (
                                                    <span className="text-xs text-slate-500">👤 Changed by: {entry.performedBy.firstName} {entry.performedBy.lastName}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div >
    );
}
