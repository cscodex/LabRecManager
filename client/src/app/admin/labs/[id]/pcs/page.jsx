'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Monitor, Plus, Edit2, Trash2, X, ArrowLeft, Printer, Wifi, Speaker, Armchair, Table, Projector, Package, PlusCircle, Eye, Download, Upload, FileSpreadsheet, Calendar, Shield, Image } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { labsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const ITEM_TYPES = {
    pc: { label: 'Computer', icon: Monitor, color: 'blue', specFields: ['processor', 'ram', 'storage', 'os', 'monitor'] },
    printer: { label: 'Printer', icon: Printer, color: 'purple', specFields: ['printType', 'paperSize', 'connectivity'] },
    router: { label: 'WiFi Router', icon: Wifi, color: 'green', specFields: ['speed', 'frequency', 'ports'] },
    speaker: { label: 'Speaker', icon: Speaker, color: 'amber', specFields: ['power', 'channels'] },
    projector: { label: 'Projector', icon: Projector, color: 'red', specFields: ['resolution', 'lumens', 'connectivity'] },
    chair: { label: 'Chair', icon: Armchair, color: 'slate', specFields: ['material', 'color'] },
    table: { label: 'Table', icon: Table, color: 'emerald', specFields: ['material', 'dimensions', 'color'] },
    other: { label: 'Other', icon: Package, color: 'gray', specFields: [] }
};

const SPEC_LABELS = {
    processor: 'Processor', ram: 'RAM', storage: 'Storage', os: 'OS', monitor: 'Monitor Size',
    printType: 'Print Type', paperSize: 'Paper Size', connectivity: 'Connectivity',
    speed: 'Speed', frequency: 'Frequency', ports: 'Ports',
    power: 'Power', channels: 'Channels',
    resolution: 'Resolution', lumens: 'Lumens',
    material: 'Material', dimensions: 'Dimensions', color: 'Color'
};

export default function LabInventoryPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [lab, setLab] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');

    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [viewingItem, setViewingItem] = useState(null);
    const [formData, setFormData] = useState({
        itemType: 'pc', itemNumber: '', brand: '', modelNo: '', serialNo: '',
        specs: {}, status: 'active', notes: '', imageUrl: '', purchaseDate: '', warrantyEnd: ''
    });
    const fileInputRef = useRef(null);

    // Custom fields state
    const [customFields, setCustomFields] = useState([]);
    const [newFieldName, setNewFieldName] = useState('');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (!['admin', 'principal', 'lab_assistant'].includes(user?.role)) {
            router.push('/dashboard'); return;
        }
        loadData();
    }, [isAuthenticated, _hasHydrated]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [labRes, itemsRes] = await Promise.all([
                labsAPI.getById(params.id),
                labsAPI.getItems(params.id)
            ]);
            setLab(labRes.data.data.lab);
            setItems(itemsRes.data.data.items || []);
        } catch (error) {
            toast.error('Failed to load lab data');
        } finally {
            setLoading(false);
        }
    };

    // Get custom fields used by other items of the same type (for suggestions)
    const suggestedCustomFields = useMemo(() => {
        const defaultFields = ITEM_TYPES[formData.itemType]?.specFields || [];
        const customFieldsFromItems = new Set();

        items.filter(i => i.itemType === formData.itemType).forEach(item => {
            if (item.specs) {
                Object.keys(item.specs).forEach(key => {
                    if (!defaultFields.includes(key) && !customFieldsFromItems.has(key)) {
                        customFieldsFromItems.add(key);
                    }
                });
            }
        });

        return Array.from(customFieldsFromItems).filter(f => !customFields.includes(f));
    }, [items, formData.itemType, customFields]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData, specs: formData.specs };
            if (editingItem) {
                await labsAPI.updateItem(params.id, editingItem.id, payload);
                toast.success('Item updated');
            } else {
                await labsAPI.createItem(params.id, payload);
                toast.success('Item added');
            }
            closeModal();
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        const defaultFields = ITEM_TYPES[item.itemType]?.specFields || [];
        const existingCustomFields = item.specs ? Object.keys(item.specs).filter(k => !defaultFields.includes(k)) : [];
        setCustomFields(existingCustomFields);
        setFormData({
            itemType: item.itemType,
            itemNumber: item.itemNumber,
            brand: item.brand || '',
            modelNo: item.modelNo || '',
            serialNo: item.serialNo || '',
            specs: item.specs || {},
            status: item.status || 'active',
            notes: item.notes || '',
            imageUrl: item.imageUrl || '',
            purchaseDate: item.purchaseDate?.split('T')[0] || '',
            warrantyEnd: item.warrantyEnd?.split('T')[0] || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (item) => {
        if (!confirm(`Delete ${ITEM_TYPES[item.itemType]?.label} "${item.itemNumber}"?`)) return;
        try {
            await labsAPI.deleteItem(params.id, item.id);
            toast.success('Item deleted');
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete');
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setCustomFields([]);
        setNewFieldName('');
        setFormData({
            itemType: 'pc', itemNumber: '', brand: '', modelNo: '', serialNo: '',
            specs: {}, status: 'active', notes: '', imageUrl: '', purchaseDate: '', warrantyEnd: ''
        });
    };

    const updateSpec = (key, value) => {
        setFormData(prev => ({ ...prev, specs: { ...prev.specs, [key]: value } }));
    };

    const addCustomField = (fieldName) => {
        const name = fieldName || newFieldName.trim();
        if (!name) return;
        if (customFields.includes(name) || ITEM_TYPES[formData.itemType]?.specFields?.includes(name)) {
            toast.error('Field already exists');
            return;
        }
        setCustomFields([...customFields, name]);
        setNewFieldName('');
    };

    const removeCustomField = (fieldName) => {
        setCustomFields(customFields.filter(f => f !== fieldName));
        const newSpecs = { ...formData.specs };
        delete newSpecs[fieldName];
        setFormData(prev => ({ ...prev, specs: newSpecs }));
    };

    const handleTypeChange = (newType) => {
        // When changing type, load custom fields from existing items of that type
        const defaultFields = ITEM_TYPES[newType]?.specFields || [];
        const customFromItems = new Set();
        items.filter(i => i.itemType === newType).forEach(item => {
            if (item.specs) {
                Object.keys(item.specs).forEach(key => {
                    if (!defaultFields.includes(key)) customFromItems.add(key);
                });
            }
        });
        setCustomFields(Array.from(customFromItems));
        setFormData(prev => ({ ...prev, itemType: newType, specs: {} }));
    };

    const getStatusBadge = (status) => {
        const styles = { active: 'bg-emerald-100 text-emerald-700', maintenance: 'bg-amber-100 text-amber-700', retired: 'bg-slate-100 text-slate-500' };
        return styles[status] || styles.active;
    };

    const getIcon = (type) => ITEM_TYPES[type]?.icon || Package;

    const filteredItems = filterType === 'all' ? items : items.filter(i => i.itemType === filterType);

    // Download CSV Template with sample data
    const downloadTemplate = () => {
        const headers = ['itemType', 'itemNumber', 'brand', 'modelNo', 'serialNo', 'status', 'notes', 'purchaseDate', 'warrantyEnd', 'specs'];
        const sampleData = [
            ['pc', 'LAB1-PC-001', 'Dell', 'OptiPlex 7080', 'ABC123456', 'active', 'Main workstation', '2024-01-15', '2027-01-15', '{"processor":"i7-10700","ram":"16GB","storage":"512GB SSD","os":"Windows 11"}'],
            ['printer', 'LAB1-PTR-001', 'HP', 'LaserJet Pro', 'XYZ789012', 'active', 'Color printer', '2024-03-10', '2026-03-10', '{"printType":"Laser Color","paperSize":"A4","connectivity":"WiFi/USB"}'],
            ['projector', 'LAB1-PRJ-001', 'Epson', 'EB-X51', 'PRJ456789', 'active', 'Ceiling mounted', '2023-06-20', '2025-06-20', '{"resolution":"1024x768","lumens":"3800","connectivity":"HDMI/VGA"}'],
            ['chair', 'LAB1-CHR-001', 'Godrej', 'Ergonomic Pro', '', 'active', 'Adjustable height', '2024-02-01', '2029-02-01', '{"material":"Mesh","color":"Black"}'],
            ['table', 'LAB1-TBL-001', 'Featherlite', 'Comp Desk', '', 'active', 'Cable management', '2024-02-01', '2034-02-01', '{"material":"Wood","dimensions":"120x60x75cm","color":"Oak"}']
        ];
        const csvContent = [headers.join(','), ...sampleData.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory_template.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Template downloaded');
    };

    // Export items to CSV
    const exportItems = () => {
        if (items.length === 0) { toast.error('No items to export'); return; }
        const headers = ['itemType', 'itemNumber', 'brand', 'modelNo', 'serialNo', 'status', 'notes', 'purchaseDate', 'warrantyEnd', 'specs'];
        const rows = items.map(item => [
            item.itemType || '',
            item.itemNumber || '',
            item.brand || '',
            item.modelNo || '',
            item.serialNo || '',
            item.status || '',
            item.notes || '',
            item.purchaseDate?.split('T')[0] || '',
            item.warrantyEnd?.split('T')[0] || '',
            JSON.stringify(item.specs || {})
        ]);
        const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${lab?.name || 'inventory'}_export.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${items.length} items`);
    };

    // Import items from CSV
    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { toast.error('CSV file is empty or invalid'); return; }
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            const requiredHeaders = ['itemType', 'itemNumber'];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                toast.error('Missing required columns: itemType, itemNumber');
                return;
            }
            let successCount = 0, errorCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].match(/("[^"]*"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
                const row = {};
                headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
                if (!row.itemType || !row.itemNumber) { errorCount++; continue; }
                try {
                    let specs = {};
                    if (row.specs) { try { specs = JSON.parse(row.specs); } catch { } }
                    await labsAPI.createItem(params.id, {
                        itemType: row.itemType,
                        itemNumber: row.itemNumber,
                        brand: row.brand || null,
                        modelNo: row.modelNo || null,
                        serialNo: row.serialNo || null,
                        status: row.status || 'active',
                        notes: row.notes || null,
                        purchaseDate: row.purchaseDate || null,
                        warrantyEnd: row.warrantyEnd || null,
                        specs
                    });
                    successCount++;
                } catch { errorCount++; }
            }
            toast.success(`Imported ${successCount} items${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
            loadData();
        } catch (err) { toast.error('Failed to parse CSV file'); }
        e.target.value = '';
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
                            <h1 className="text-xl font-semibold text-slate-900">{lab?.name} - Inventory</h1>
                            {lab?.roomNumber && <p className="text-sm text-slate-500">Room: {lab.roomNumber}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={downloadTemplate} className="btn btn-secondary text-sm" title="Download Template">
                            <FileSpreadsheet className="w-4 h-4" /> Template
                        </button>
                        <button onClick={exportItems} className="btn btn-secondary text-sm" title="Export to CSV">
                            <Download className="w-4 h-4" /> Export
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary text-sm" title="Import from CSV">
                            <Upload className="w-4 h-4" /> Import
                        </button>
                        <input type="file" ref={fileInputRef} accept=".csv" onChange={handleImport} className="hidden" />
                        <button onClick={() => { setEditingItem(null); setCustomFields([]); setShowModal(true); }} className="btn btn-primary">
                            <Plus className="w-4 h-4" /> Add Item
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Stock Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                    {Object.entries(ITEM_TYPES).map(([key, { label, icon: Icon, color }]) => {
                        const count = items.filter(i => i.itemType === key).length;
                        if (count === 0) return null;
                        return (
                            <div key={key} className="card p-3 text-center">
                                <Icon className={`w-6 h-6 mx-auto mb-1 text-${color}-500`} />
                                <p className="text-2xl font-bold text-slate-900">{count}</p>
                                <p className="text-xs text-slate-500">{label}s</p>
                            </div>
                        );
                    })}
                    <div className="card p-3 text-center bg-slate-900 text-white">
                        <Package className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-2xl font-bold">{items.length}</p>
                        <p className="text-xs opacity-80">Total</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${filterType === 'all' ? 'bg-primary-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                        All ({items.length})
                    </button>
                    {Object.entries(ITEM_TYPES).map(([key, { label, icon: Icon }]) => {
                        const count = items.filter(i => i.itemType === key).length;
                        if (count === 0 && filterType !== key) return null;
                        return (
                            <button key={key} onClick={() => setFilterType(key)} className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 whitespace-nowrap ${filterType === key ? 'bg-primary-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                                <Icon className="w-4 h-4" /> {label} ({count})
                            </button>
                        );
                    })}
                </div>

                {filteredItems.length === 0 ? (
                    <div className="card p-12 text-center">
                        <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No items found</h3>
                        <p className="text-slate-500 mb-4">Add equipment to this lab's inventory.</p>
                        <button onClick={() => setShowModal(true)} className="btn btn-primary">
                            <Plus className="w-4 h-4" /> Add First Item
                        </button>
                    </div>
                ) : (
                    <div className="card overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Item</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Brand/Model</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Serial</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Specs</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Status</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredItems.map((item) => {
                                    const Icon = getIcon(item.itemType);
                                    const typeInfo = ITEM_TYPES[item.itemType] || ITEM_TYPES.other;
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-lg bg-${typeInfo.color}-100 flex items-center justify-center`}>
                                                        <Icon className={`w-4 h-4 text-${typeInfo.color}-600`} />
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-slate-900">{item.itemNumber}</span>
                                                        <p className="text-xs text-slate-500">{typeInfo.label}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-slate-900">{item.brand || '-'}</p>
                                                <p className="text-xs text-slate-500">{item.modelNo || ''}</p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-sm">{item.serialNo || '-'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {item.specs && Object.entries(item.specs).slice(0, 4).map(([k, v]) => v && (
                                                        <span key={k} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded" title={k}>{v}</span>
                                                    ))}
                                                    {item.specs && Object.keys(item.specs).length > 4 && (
                                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-xs rounded">+{Object.keys(item.specs).length - 4}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(item.status)}`}>{item.status}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <button onClick={() => setViewingItem(item)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="View Details">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Item Form Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
                            <h3 className="text-xl font-semibold text-slate-900">{editingItem ? 'Edit Item' : 'Add Item'}</h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Item Type */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Item Type *</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {Object.entries(ITEM_TYPES).map(([key, { label, icon: Icon }]) => (
                                        <button key={key} type="button" onClick={() => handleTypeChange(key)}
                                            className={`p-2 rounded-lg border text-center ${formData.itemType === key ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                                            <Icon className="w-5 h-5 mx-auto mb-1" />
                                            <span className="text-xs">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Item Number *</label>
                                    <input type="text" value={formData.itemNumber} onChange={(e) => setFormData({ ...formData, itemNumber: e.target.value })} className="input" placeholder="e.g., CL2-PC-001" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                                    <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} className="input" placeholder="e.g., Dell, HP" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Model No</label>
                                    <input type="text" value={formData.modelNo} onChange={(e) => setFormData({ ...formData, modelNo: e.target.value })} className="input" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
                                    <input type="text" value={formData.serialNo} onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })} className="input" />
                                </div>
                            </div>

                            {/* Default Spec Fields */}
                            {ITEM_TYPES[formData.itemType]?.specFields?.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Default Specifications</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {ITEM_TYPES[formData.itemType].specFields.map(field => (
                                            <div key={field}>
                                                <label className="block text-xs text-slate-500 mb-1">{SPEC_LABELS[field] || field}</label>
                                                <input type="text" value={formData.specs[field] || ''} onChange={(e) => updateSpec(field, e.target.value)} className="input text-sm" placeholder={SPEC_LABELS[field]} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Custom Fields */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Custom Parameters</label>

                                {/* Suggestions from existing items */}
                                {suggestedCustomFields.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-xs text-slate-500 mb-1">Used in other {ITEM_TYPES[formData.itemType]?.label}s:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {suggestedCustomFields.map(field => (
                                                <button key={field} type="button" onClick={() => addCustomField(field)}
                                                    className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1">
                                                    <Plus className="w-3 h-3" /> {field}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Current custom fields */}
                                {customFields.length > 0 && (
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        {customFields.map(field => (
                                            <div key={field} className="relative">
                                                <label className="block text-xs text-slate-500 mb-1 flex items-center justify-between">
                                                    {field}
                                                    <button type="button" onClick={() => removeCustomField(field)} className="text-red-400 hover:text-red-600">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </label>
                                                <input type="text" value={formData.specs[field] || ''} onChange={(e) => updateSpec(field, e.target.value)} className="input text-sm" placeholder={field} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add new custom field */}
                                <div className="flex gap-2">
                                    <input type="text" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomField())}
                                        className="input text-sm flex-1" placeholder="New parameter name..." />
                                    <button type="button" onClick={() => addCustomField()} className="btn btn-secondary text-sm px-3">
                                        <PlusCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
                                    <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} className="input" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Warranty End</label>
                                    <input type="date" value={formData.warrantyEnd} onChange={(e) => setFormData({ ...formData, warrantyEnd: e.target.value })} className="input" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input">
                                    <option value="active">Active</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="retired">Retired</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input" rows={2} />
                            </div>

                            {/* Image URL */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Image className="w-4 h-4 inline mr-1" /> Image URL
                                </label>
                                <input
                                    type="url"
                                    value={formData.imageUrl}
                                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                    className="input"
                                    placeholder="https://example.com/image.jpg"
                                />
                                {formData.imageUrl && (
                                    <div className="mt-2 relative">
                                        <img
                                            src={formData.imageUrl}
                                            alt="Item preview"
                                            className="w-full h-32 object-cover rounded-lg border border-slate-200"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">{editingItem ? 'Update' : 'Add Item'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Item Modal */}
            {viewingItem && (() => {
                const typeInfo = ITEM_TYPES[viewingItem.itemType] || ITEM_TYPES.other;
                const Icon = typeInfo.icon;
                return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl bg-${typeInfo.color}-100 flex items-center justify-center`}>
                                        <Icon className={`w-5 h-5 text-${typeInfo.color}-600`} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-slate-900">{viewingItem.itemNumber}</h3>
                                        <p className="text-sm text-slate-500">{typeInfo.label}</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingItem(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Item Image */}
                                {viewingItem.imageUrl && (
                                    <div className="rounded-xl overflow-hidden border border-slate-200">
                                        <img src={viewingItem.imageUrl} alt={viewingItem.itemNumber} className="w-full h-48 object-cover" />
                                    </div>
                                )}

                                {/* Status */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">Status</span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(viewingItem.status)}`}>{viewingItem.status}</span>
                                </div>

                                {/* Basic Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    {viewingItem.brand && (
                                        <div><p className="text-xs text-slate-500 mb-1">Brand</p><p className="font-medium text-slate-900">{viewingItem.brand}</p></div>
                                    )}
                                    {viewingItem.modelNo && (
                                        <div><p className="text-xs text-slate-500 mb-1">Model No</p><p className="font-medium text-slate-900">{viewingItem.modelNo}</p></div>
                                    )}
                                    {viewingItem.serialNo && (
                                        <div className="col-span-2"><p className="text-xs text-slate-500 mb-1">Serial Number</p><p className="font-medium text-slate-900 font-mono">{viewingItem.serialNo}</p></div>
                                    )}
                                </div>

                                {/* Specifications */}
                                {viewingItem.specs && Object.keys(viewingItem.specs).length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 mb-3">Specifications</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries(viewingItem.specs).map(([key, value]) => value && (
                                                <div key={key} className="bg-slate-50 rounded-lg p-3">
                                                    <p className="text-xs text-slate-500 mb-1">{SPEC_LABELS[key] || key}</p>
                                                    <p className="font-medium text-slate-900">{String(value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Dates */}
                                {(viewingItem.purchaseDate || viewingItem.warrantyEnd) && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {viewingItem.purchaseDate && (
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <div><p className="text-xs text-slate-500">Purchased</p><p className="font-medium text-slate-900">{new Date(viewingItem.purchaseDate).toLocaleDateString()}</p></div>
                                            </div>
                                        )}
                                        {viewingItem.warrantyEnd && (
                                            <div className="flex items-center gap-2">
                                                <Shield className="w-4 h-4 text-slate-400" />
                                                <div><p className="text-xs text-slate-500">Warranty Until</p><p className="font-medium text-slate-900">{new Date(viewingItem.warrantyEnd).toLocaleDateString()}</p></div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Assigned Groups (for PCs) */}
                                {viewingItem.itemType === 'pc' && viewingItem.assignedGroups?.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 mb-2">Assigned to Groups</p>
                                        <div className="flex flex-wrap gap-2">
                                            {viewingItem.assignedGroups.map(group => (
                                                <span key={group.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                                    {group.name} {group.class && `(${group.class.gradeLevel}${group.class.section || ''})`}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                {viewingItem.notes && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                                        <p className="text-xs text-amber-600 font-medium mb-1">Notes</p>
                                        <p className="text-slate-700">{viewingItem.notes}</p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setViewingItem(null)} className="btn btn-secondary flex-1">Close</button>
                                    <button onClick={() => { handleEdit(viewingItem); setViewingItem(null); }} className="btn btn-primary flex-1">
                                        <Edit2 className="w-4 h-4" /> Edit Item
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
