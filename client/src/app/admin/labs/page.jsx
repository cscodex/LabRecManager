'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Monitor, Plus, Edit2, Trash2, X, Search, ArrowLeft, Building, Printer, Wifi, Speaker, Armchair, Table, Projector, Package } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { labsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const ITEM_TYPE_ICONS = {
    pc: { icon: Monitor, color: 'blue' },
    printer: { icon: Printer, color: 'purple' },
    router: { icon: Wifi, color: 'green' },
    speaker: { icon: Speaker, color: 'amber' },
    projector: { icon: Projector, color: 'red' },
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
    const [formData, setFormData] = useState({ name: '', nameHindi: '', roomNumber: '', capacity: 30 });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (user?.role !== 'admin' && user?.role !== 'principal') { router.push('/dashboard'); return; }
        loadLabs();
    }, [isAuthenticated, _hasHydrated]);

    const loadLabs = async () => {
        setLoading(true);
        try {
            const res = await labsAPI.getAll();
            setLabs(res.data.data.labs || []);
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
            setFormData({ name: '', nameHindi: '', roomNumber: '', capacity: 30 });
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
            capacity: lab.capacity || 30
        });
        setShowModal(true);
    };

    const handleDelete = async (lab) => {
        if (!confirm(`Delete lab "${lab.name}"? This will also delete all PCs in this lab.`)) return;
        try {
            await labsAPI.delete(lab.id);
            toast.success('Lab deleted');
            loadLabs();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete');
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
                    <button onClick={() => { setEditingLab(null); setFormData({ name: '', nameHindi: '', roomNumber: '', capacity: 30 }); setShowModal(true); }} className="btn btn-primary">
                        <Plus className="w-4 h-4" /> Add Lab
                    </button>
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
                            <div key={lab.id} className="card p-6 hover:shadow-lg transition">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                                        <Monitor className="w-6 h-6" />
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEdit(lab)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(lab)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-1">{lab.name}</h3>
                                {lab.nameHindi && <p className="text-sm text-slate-500 mb-2">{lab.nameHindi}</p>}
                                <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                                    {lab.roomNumber && <span>Room: {lab.roomNumber}</span>}
                                    <span>Capacity: {lab.capacity}</span>
                                </div>
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
                )}
            </main>

            {/* Create/Edit Modal */}
            {showModal && (
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
            )}
        </div>
    );
}
