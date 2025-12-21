'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Monitor, Plus, Edit2, Trash2, X, ArrowLeft, Cpu, HardDrive, MemoryStick, Server } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { labsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function LabPCsPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [lab, setLab] = useState(null);
    const [pcs, setPCs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingPC, setEditingPC] = useState(null);
    const [formData, setFormData] = useState({
        pcNumber: '', brand: '', modelNo: '', serialNo: '',
        ram: '', storage: '', processor: '', os: '', status: 'active', notes: ''
    });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (user?.role !== 'admin' && user?.role !== 'principal' && user?.role !== 'lab_assistant') {
            router.push('/dashboard'); return;
        }
        loadData();
    }, [isAuthenticated, _hasHydrated]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [labRes, pcsRes] = await Promise.all([
                labsAPI.getById(params.id),
                labsAPI.getPCs(params.id)
            ]);
            setLab(labRes.data.data.lab);
            setPCs(pcsRes.data.data.pcs || []);
        } catch (error) {
            toast.error('Failed to load lab data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPC) {
                await labsAPI.updatePC(params.id, editingPC.id, formData);
                toast.success('PC updated');
            } else {
                await labsAPI.createPC(params.id, formData);
                toast.success('PC added');
            }
            closeModal();
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (pc) => {
        setEditingPC(pc);
        setFormData({
            pcNumber: pc.pcNumber,
            brand: pc.brand || '',
            modelNo: pc.modelNo || '',
            serialNo: pc.serialNo || '',
            ram: pc.ram || '',
            storage: pc.storage || '',
            processor: pc.processor || '',
            os: pc.os || '',
            status: pc.status || 'active',
            notes: pc.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (pc) => {
        if (!confirm(`Delete PC "${pc.pcNumber}"?`)) return;
        try {
            await labsAPI.deletePC(params.id, pc.id);
            toast.success('PC deleted');
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete');
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingPC(null);
        setFormData({ pcNumber: '', brand: '', modelNo: '', serialNo: '', ram: '', storage: '', processor: '', os: '', status: 'active', notes: '' });
    };

    const getStatusBadge = (status) => {
        const styles = {
            active: 'bg-emerald-100 text-emerald-700',
            maintenance: 'bg-amber-100 text-amber-700',
            retired: 'bg-slate-100 text-slate-500'
        };
        return styles[status] || styles.active;
    };

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
                        <Link href="/admin/labs" className="text-slate-500 hover:text-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900">{lab?.name || 'Lab'} - PCs</h1>
                            {lab?.roomNumber && <p className="text-sm text-slate-500">Room: {lab.roomNumber}</p>}
                        </div>
                    </div>
                    <button onClick={() => { setEditingPC(null); setShowModal(true); }} className="btn btn-primary">
                        <Plus className="w-4 h-4" /> Add PC
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {pcs.length === 0 ? (
                    <div className="card p-12 text-center">
                        <Monitor className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No PCs in this lab</h3>
                        <p className="text-slate-500 mb-4">Add computers to start managing this lab's inventory.</p>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary">
                            <Plus className="w-4 h-4" /> Add First PC
                        </button>
                    </div>
                ) : (
                    <div className="card overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">PC #</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Brand/Model</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Specs</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Status</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Assigned</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pcs.map((pc) => (
                                    <tr key={pc.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Monitor className="w-4 h-4 text-blue-500" />
                                                <span className="font-medium text-slate-900">{pc.pcNumber}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-slate-900">{pc.brand || '-'}</p>
                                            <p className="text-xs text-slate-500">{pc.modelNo || ''}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1 text-xs">
                                                {pc.processor && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded">{pc.processor}</span>}
                                                {pc.ram && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{pc.ram}</span>}
                                                {pc.storage && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">{pc.storage}</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(pc.status)}`}>
                                                {pc.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {pc.assignedGroups?.length > 0
                                                ? pc.assignedGroups.map(g => g.name).join(', ')
                                                : <span className="text-slate-400">Not assigned</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                <button onClick={() => handleEdit(pc)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(pc)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* PC Form Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
                            <h3 className="text-xl font-semibold text-slate-900">
                                {editingPC ? 'Edit PC' : 'Add PC'}
                            </h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">PC Number *</label>
                                    <input
                                        type="text"
                                        value={formData.pcNumber}
                                        onChange={(e) => setFormData({ ...formData, pcNumber: e.target.value })}
                                        className="input"
                                        placeholder="e.g., CL2-PC-001"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                                    <input
                                        type="text"
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Dell, HP"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Model No</label>
                                    <input
                                        type="text"
                                        value={formData.modelNo}
                                        onChange={(e) => setFormData({ ...formData, modelNo: e.target.value })}
                                        className="input"
                                        placeholder="e.g., OptiPlex 7090"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
                                    <input
                                        type="text"
                                        value={formData.serialNo}
                                        onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })}
                                        className="input"
                                        placeholder="e.g., ABC123XYZ"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Processor</label>
                                    <input
                                        type="text"
                                        value={formData.processor}
                                        onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Intel i5-10400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">RAM</label>
                                    <input
                                        type="text"
                                        value={formData.ram}
                                        onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                                        className="input"
                                        placeholder="e.g., 16GB DDR4"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Storage</label>
                                    <input
                                        type="text"
                                        value={formData.storage}
                                        onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                                        className="input"
                                        placeholder="e.g., 512GB SSD"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Operating System</label>
                                    <input
                                        type="text"
                                        value={formData.os}
                                        onChange={(e) => setFormData({ ...formData, os: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Windows 11"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="input"
                                    >
                                        <option value="active">Active</option>
                                        <option value="maintenance">Maintenance</option>
                                        <option value="retired">Retired</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="input"
                                        rows={2}
                                        placeholder="Any additional notes..."
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    {editingPC ? 'Update PC' : 'Add PC'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
