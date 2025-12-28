'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Monitor, Plus, Edit2, Trash2, X, ArrowLeft, Printer, Wifi, Speaker, Armchair, Table, Projector, Package, PlusCircle, Eye, Download, Upload, FileSpreadsheet, Calendar, Shield, Image, Search, QrCode, CheckSquare, Square, Wrench, AlertTriangle, RefreshCw, History, ArrowRightLeft, Camera, Network, Volume2, Laptop, Tablet } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { labsAPI, filesAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

const ITEM_TYPES = {
    pc: { label: 'Computer', icon: Monitor, color: 'blue', specFields: ['processor', 'ram', 'storage', 'os', 'monitor'] },
    laptop: { label: 'Laptop', icon: Laptop, color: 'sky', specFields: ['processor', 'ram', 'storage', 'os', 'screenSize', 'battery'] },
    tablet: { label: 'Tablet', icon: Tablet, color: 'teal', specFields: ['processor', 'ram', 'storage', 'os', 'screenSize', 'battery'] },
    printer: { label: 'Printer', icon: Printer, color: 'purple', specFields: ['printType', 'paperSize', 'connectivity'] },
    router: { label: 'WiFi Router', icon: Wifi, color: 'green', specFields: ['speed', 'frequency', 'ports'] },
    speaker: { label: 'Speaker', icon: Speaker, color: 'amber', specFields: ['power', 'channels'] },
    projector: { label: 'Projector', icon: Projector, color: 'red', specFields: ['resolution', 'lumens', 'connectivity'] },
    smart_camera: { label: 'Smart Camera', icon: Camera, color: 'indigo', specFields: ['resolution', 'nightVision', 'storageType', 'connectivity', 'poe'] },
    network_switch: { label: 'Network Switch', icon: Network, color: 'cyan', specFields: ['ports', 'speed', 'managedType', 'poe', 'rackMountable'] },
    soundbar: { label: 'Soundbar', icon: Volume2, color: 'orange', specFields: ['power', 'channels', 'connectivity', 'bluetooth', 'subwoofer'] },
    chair: { label: 'Chair', icon: Armchair, color: 'slate', specFields: ['material', 'color'] },
    table: { label: 'Table', icon: Table, color: 'emerald', specFields: ['material', 'dimensions', 'color'] },
    other: { label: 'Other', icon: Package, color: 'gray', specFields: [] }
};

const SPEC_LABELS = {
    // Computer & Laptop
    processor: 'Processor', ram: 'RAM', storage: 'Storage', os: 'OS', monitor: 'Monitor Size',
    screenSize: 'Screen Size', battery: 'Battery',
    // Printer
    printType: 'Print Type', paperSize: 'Paper Size', connectivity: 'Connectivity',
    // Router
    speed: 'Speed', frequency: 'Frequency', ports: 'Ports',
    // Speaker & Soundbar
    power: 'Power', channels: 'Channels', bluetooth: 'Bluetooth', subwoofer: 'Subwoofer',
    // Projector
    resolution: 'Resolution', lumens: 'Lumens',
    // Smart Camera
    nightVision: 'Night Vision', storageType: 'Storage Type', poe: 'PoE Support',
    // Network Switch
    managedType: 'Managed Type', rackMountable: 'Rack Mountable',
    // Furniture
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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [qrItem, setQrItem] = useState(null);
    const [formData, setFormData] = useState({
        itemType: 'pc', itemNumber: '', brand: '', modelNo: '', serialNo: '',
        specs: {}, status: 'active', notes: '', imageUrl: '', purchaseDate: '', warrantyEnd: ''
    });
    const fileInputRef = useRef(null);

    // Delete confirmation state
    const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null, type: 'single' });
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Custom fields state
    const [customFields, setCustomFields] = useState([]);
    const [newFieldName, setNewFieldName] = useState('');

    // Maintenance history state
    const [maintenanceHistory, setMaintenanceHistory] = useState([]);
    const [maintenanceLoading, setMaintenanceLoading] = useState(false);
    const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
    const [maintenanceForm, setMaintenanceForm] = useState({ type: 'issue', description: '', cost: '', vendor: '', partName: '' });

    // Shift modal state
    const [shiftModal, setShiftModal] = useState({ open: false, item: null });
    const [availableLabs, setAvailableLabs] = useState([]);
    const [shiftToLab, setShiftToLab] = useState('');
    const [shiftReason, setShiftReason] = useState('');
    const [shiftLoading, setShiftLoading] = useState(false);
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
            const [labRes, itemsRes, labsRes] = await Promise.all([
                labsAPI.getById(params.id),
                labsAPI.getItems(params.id),
                labsAPI.getAll()
            ]);
            setLab(labRes.data.data.lab);
            setItems(itemsRes.data.data.items || []);
            // Filter out current lab from available labs
            const allLabs = labsRes.data.data.labs || [];
            setAvailableLabs(allLabs.filter(l => l.id !== params.id));
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

    const handleDelete = (item) => {
        setDeleteDialog({ open: true, item, type: 'single' });
    };

    const confirmDelete = async () => {
        if (deleteDialog.type === 'single' && deleteDialog.item) {
            setDeleteLoading(true);
            try {
                await labsAPI.deleteItem(params.id, deleteDialog.item.id);
                toast.success('Item deleted');
                loadData();
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to delete');
            } finally {
                setDeleteLoading(false);
                setDeleteDialog({ open: false, item: null, type: 'single' });
            }
        } else if (deleteDialog.type === 'bulk') {
            setDeleteLoading(true);
            try {
                let successCount = 0;
                for (const id of selectedItems) {
                    try {
                        await labsAPI.deleteItem(params.id, id);
                        successCount++;
                    } catch { }
                }
                toast.success(`Deleted ${successCount} items`);
                setSelectedItems(new Set());
                loadData();
            } catch (error) {
                toast.error('Failed to delete items');
            } finally {
                setDeleteLoading(false);
                setDeleteDialog({ open: false, item: null, type: 'single' });
            }
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

    // Search and filter logic
    const filteredItems = useMemo(() => {
        let result = filterType === 'all' ? items : items.filter(i => i.itemType === filterType);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(i =>
                i.itemNumber?.toLowerCase().includes(q) ||
                i.brand?.toLowerCase().includes(q) ||
                i.modelNo?.toLowerCase().includes(q) ||
                i.serialNo?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [items, filterType, searchQuery]);

    // Bulk selection handlers
    const toggleSelectItem = (id) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); }
        setSelectedItems(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === filteredItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredItems.map(i => i.id)));
        }
    };

    const handleBulkDelete = () => {
        if (selectedItems.size === 0) return;
        setDeleteDialog({ open: true, item: null, type: 'bulk' });
    };

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

        const toastId = toast.loading(`Importing ${file.name}...`);
        console.log('Starting import:', file.name);

        try {
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim());
            console.log('Lines found:', lines.length);

            if (lines.length < 2) {
                toast.error('CSV file is empty or invalid', { id: toastId });
                return;
            }

            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
            console.log('Headers:', headers);

            const requiredHeaders = ['itemType', 'itemNumber'];
            if (!requiredHeaders.every(h => headers.includes(h))) {
                toast.error('Missing required columns: itemType, itemNumber', { id: toastId });
                return;
            }

            let successCount = 0, errorCount = 0;
            const errorMessages = [];
            const totalItems = lines.length - 1;

            for (let i = 1; i < lines.length; i++) {
                // Update progress every 5 items
                if (i % 5 === 0) {
                    toast.loading(`Importing... ${i}/${totalItems}`, { id: toastId });
                }

                // Proper CSV parsing that handles empty values and quoted fields
                const parseCSVLine = (line) => {
                    const result = [];
                    let current = '';
                    let inQuotes = false;

                    for (let j = 0; j < line.length; j++) {
                        const char = line[j];
                        if (char === '"') {
                            if (inQuotes && line[j + 1] === '"') {
                                current += '"';
                                j++; // Skip next quote
                            } else {
                                inQuotes = !inQuotes;
                            }
                        } else if (char === ',' && !inQuotes) {
                            result.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    result.push(current.trim());
                    return result;
                };

                const values = parseCSVLine(lines[i]);
                const row = {};
                headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

                if (!row.itemType || !row.itemNumber) {
                    errorCount++;
                    errorMessages.push(`Row ${i + 1}: Missing itemType or itemNumber`);
                    continue;
                }

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
                    console.log(`Imported: ${row.itemNumber}`);
                } catch (err) {
                    errorCount++;
                    const errMsg = err.response?.data?.message || 'Failed';
                    errorMessages.push(`Row ${i + 1}: ${errMsg}`);
                    console.error(`Failed: ${row.itemNumber}`, errMsg);
                }
            }

            // Save import history (but don't fail if import_history table doesn't exist)
            try {
                await labsAPI.saveImportHistory(params.id, {
                    fileName: file.name,
                    fileSize: file.size,
                    itemsImported: successCount,
                    itemsFailed: errorCount,
                    status: errorCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial',
                    errors: errorMessages.length > 0 ? errorMessages.slice(0, 10) : null
                });
            } catch (err) {
                console.error('Failed to save history:', err);
            }

            if (successCount > 0) {
                toast.success(`Imported ${successCount} items${errorCount > 0 ? `, ${errorCount} failed` : ''}`, { id: toastId, duration: 5000 });
            } else {
                // Show detailed error message
                const errorDetail = errorMessages.slice(0, 3).join('\n');
                toast.error(
                    <div>
                        <p className="font-semibold">Import failed. {errorCount} errors.</p>
                        <p className="text-xs mt-1 opacity-80">{errorDetail}</p>
                    </div>,
                    { id: toastId, duration: 10000 }
                );
            }

            // Also show errors in console for debugging
            if (errorMessages.length > 0) {
                console.error('Import errors:', errorMessages);
            }

            loadData();
        } catch (err) {
            console.error('Parse error:', err);
            toast.error(
                <div>
                    <p className="font-semibold">Failed to parse CSV file</p>
                    <p className="text-xs mt-1 opacity-80">{err.message || 'Unknown error'}</p>
                </div>,
                { id: toastId, duration: 10000 }
            );
        }
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

                {/* Search Bar + Bulk Actions */}
                <div className="card p-4 mb-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by item number, brand, model, or serial..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10"
                            />
                        </div>
                        {selectedItems.size > 0 && (
                            <button onClick={handleBulkDelete} className="btn bg-red-500 hover:bg-red-600 text-white">
                                <Trash2 className="w-4 h-4" /> Delete {selectedItems.size} Selected
                            </button>
                        )}
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
                                    <th className="w-10 px-4 py-3">
                                        <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                                            {selectedItems.size === filteredItems.length && filteredItems.length > 0 ?
                                                <CheckSquare className="w-5 h-5 text-primary-500" /> :
                                                <Square className="w-5 h-5" />}
                                        </button>
                                    </th>
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
                                    const isSelected = selectedItems.has(item.id);
                                    return (
                                        <tr key={item.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-primary-50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <button onClick={() => toggleSelectItem(item.id)} className="text-slate-400 hover:text-slate-600">
                                                    {isSelected ? <CheckSquare className="w-5 h-5 text-primary-500" /> : <Square className="w-5 h-5" />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {/* Thumbnail or Icon */}
                                                    {item.imageUrl ? (
                                                        <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-contain bg-slate-100 border border-slate-200" />
                                                    ) : (
                                                        <div className={`w-10 h-10 rounded-lg bg-${typeInfo.color}-100 flex items-center justify-center`}>
                                                            <Icon className={`w-5 h-5 text-${typeInfo.color}-600`} />
                                                        </div>
                                                    )}
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
                                            <td className="px-4 py-3 text-slate-600 text-sm font-mono">{item.serialNo || '-'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {item.specs && Object.entries(item.specs).slice(0, 3).map(([k, v]) => v && (
                                                        <span key={k} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded" title={k}>{v}</span>
                                                    ))}
                                                    {item.specs && Object.keys(item.specs).length > 3 && (
                                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-xs rounded">+{Object.keys(item.specs).length - 3}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(item.status)}`}>{item.status}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <button onClick={async () => {
                                                        setViewingItem(item);
                                                        setMaintenanceHistory([]);
                                                        setMaintenanceLoading(true);
                                                        try {
                                                            const res = await labsAPI.getItemMaintenanceHistory(item.id);
                                                            setMaintenanceHistory(res.data.data.history || []);
                                                        } catch { }
                                                        setMaintenanceLoading(false);
                                                    }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="View Details">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setQrItem(item)} className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded" title="QR Code">
                                                        <QrCode className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => { setShiftModal({ open: true, item }); setShiftToLab(''); setShiftReason(''); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Move to Another Lab">
                                                        <ArrowRightLeft className="w-4 h-4" />
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

                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Image className="w-4 h-4 inline mr-1" /> Item Image
                                </label>

                                {/* Drag & Drop Zone */}
                                <div
                                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${formData.imageUrl
                                        ? 'border-emerald-300 bg-emerald-50'
                                        : 'border-slate-300 hover:border-primary-400 hover:bg-primary-50'
                                        }`}
                                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary-500', 'bg-primary-100'); }}
                                    onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary-500', 'bg-primary-100'); }}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove('border-primary-500', 'bg-primary-100');
                                        const file = e.dataTransfer.files[0];
                                        if (file && file.type.startsWith('image/')) {
                                            try {
                                                toast.loading('Uploading...', { id: 'img-upload' });
                                                const res = await filesAPI.upload(file);
                                                setFormData(prev => ({ ...prev, imageUrl: res.data.data.url }));
                                                toast.success('Image uploaded!', { id: 'img-upload' });
                                            } catch (err) {
                                                toast.error(err.response?.data?.message || 'Upload failed', { id: 'img-upload' });
                                            }
                                        }
                                    }}
                                >
                                    {formData.imageUrl ? (
                                        <div className="relative">
                                            <img
                                                src={formData.imageUrl}
                                                alt="Preview"
                                                className="w-full h-32 object-contain bg-slate-50 rounded-lg"
                                                onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f1f5f9" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="12">Image Error</text></svg>'; }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer block">
                                            <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                            <p className="text-sm text-slate-600">Drag & drop or click to upload</p>
                                            <p className="text-xs text-slate-400 mt-1">Images & PDFs supported</p>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        try {
                                                            toast.loading('Uploading...', { id: 'img-upload' });
                                                            const res = await filesAPI.upload(file);
                                                            setFormData(prev => ({ ...prev, imageUrl: res.data.data.url }));
                                                            toast.success('Image uploaded!', { id: 'img-upload' });
                                                        } catch (err) {
                                                            toast.error(err.response?.data?.message || 'Upload failed', { id: 'img-upload' });
                                                        }
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>

                                {/* URL Fallback */}
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        value={formData.imageUrl}
                                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                        className="input text-sm"
                                        placeholder="Or paste image URL directly..."
                                    />
                                </div>
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
                                        <img src={viewingItem.imageUrl} alt={viewingItem.itemNumber} className="w-full max-h-48 object-contain bg-slate-50" />
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

                                {/* Maintenance History Section */}
                                <div className="border-t border-slate-200 pt-4 mt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                            <History className="w-4 h-4 text-primary-500" /> Maintenance History
                                        </h4>
                                        <button onClick={() => setShowMaintenanceForm(!showMaintenanceForm)} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                                            <Plus className="w-4 h-4" /> Add Record
                                        </button>
                                    </div>

                                    {/* Add Record Form */}
                                    {showMaintenanceForm && (
                                        <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
                                            <select value={maintenanceForm.type} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })} className="input text-sm">
                                                <option value="issue">🔴 Issue</option>
                                                <option value="maintenance">🔧 Maintenance</option>
                                                <option value="repair">🛠️ Repair</option>
                                                <option value="replacement">♻️ Part Replacement</option>
                                            </select>
                                            <textarea value={maintenanceForm.description} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })} className="input text-sm" rows={2} placeholder="Description..." />
                                            <div className="grid grid-cols-3 gap-2">
                                                <input type="number" value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })} className="input text-sm" placeholder="Cost (₹)" />
                                                <input type="text" value={maintenanceForm.vendor} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vendor: e.target.value })} className="input text-sm" placeholder="Vendor" />
                                                <input type="text" value={maintenanceForm.partName} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, partName: e.target.value })} className="input text-sm" placeholder="Part name" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setShowMaintenanceForm(false)} className="btn btn-secondary text-xs flex-1">Cancel</button>
                                                <button onClick={async () => {
                                                    if (!maintenanceForm.description) { toast.error('Description required'); return; }
                                                    try {
                                                        await labsAPI.addItemMaintenanceRecord(viewingItem.id, maintenanceForm);
                                                        toast.success('Record added');
                                                        setShowMaintenanceForm(false);
                                                        setMaintenanceForm({ type: 'issue', description: '', cost: '', vendor: '', partName: '' });
                                                        // Reload history
                                                        const res = await labsAPI.getItemMaintenanceHistory(viewingItem.id);
                                                        setMaintenanceHistory(res.data.data.history || []);
                                                    } catch (err) { toast.error('Failed to add record'); }
                                                }} className="btn btn-primary text-xs flex-1">Save</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* History Timeline */}
                                    {maintenanceLoading ? (
                                        <p className="text-sm text-slate-500 text-center py-4">Loading...</p>
                                    ) : maintenanceHistory.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-4">No maintenance records</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {maintenanceHistory.map(record => (
                                                <div key={record.id} className={`p-2 rounded-lg border text-sm ${record.type === 'issue' ? 'bg-red-50 border-red-200' :
                                                    record.type === 'repair' ? 'bg-blue-50 border-blue-200' :
                                                        record.type === 'replacement' ? 'bg-purple-50 border-purple-200' :
                                                            'bg-amber-50 border-amber-200'
                                                    }`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {record.type === 'issue' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                                        {record.type === 'repair' && <Wrench className="w-4 h-4 text-blue-500" />}
                                                        {record.type === 'replacement' && <RefreshCw className="w-4 h-4 text-purple-500" />}
                                                        {record.type === 'maintenance' && <Wrench className="w-4 h-4 text-amber-500" />}
                                                        <span className="font-medium capitalize">{record.type}</span>
                                                        <span className="text-xs text-slate-500 ml-auto">{new Date(record.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-slate-700">{record.description}</p>
                                                    {(record.cost || record.vendor || record.partName) && (
                                                        <div className="flex gap-3 mt-1 text-xs text-slate-500">
                                                            {record.cost && <span>₹{record.cost}</span>}
                                                            {record.vendor && <span>{record.vendor}</span>}
                                                            {record.partName && <span>{record.partName}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* QR Code Modal */}
            {qrItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-slate-900">QR Code</h3>
                            <button onClick={() => setQrItem(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 text-center">
                            <div className="bg-white p-4 rounded-xl inline-block mb-4 border border-slate-200">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify({
                                        id: qrItem.id,
                                        lab: lab?.name,
                                        item: qrItem.itemNumber,
                                        type: qrItem.itemType,
                                        serial: qrItem.serialNo || 'N/A',
                                        brand: qrItem.brand || 'N/A',
                                        model: qrItem.modelNo || 'N/A'
                                    }))}`}
                                    alt="QR Code"
                                    className="w-48 h-48"
                                />
                            </div>
                            <div className="mb-4">
                                <p className="font-semibold text-slate-900">{qrItem.itemNumber}</p>
                                <p className="text-sm text-slate-500">{lab?.name}</p>
                                {qrItem.serialNo && <p className="text-xs text-slate-400 font-mono mt-1">{qrItem.serialNo}</p>}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setQrItem(null)} className="btn btn-secondary flex-1">Close</button>
                                <a
                                    href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&data=${encodeURIComponent(JSON.stringify({
                                        id: qrItem.id,
                                        lab: lab?.name,
                                        item: qrItem.itemNumber,
                                        serial: qrItem.serialNo || 'N/A'
                                    }))}`}
                                    download={`QR-${qrItem.itemNumber}.png`}
                                    className="btn btn-primary flex-1"
                                >
                                    <Download className="w-4 h-4" /> Download
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, item: null, type: 'single' })}
                onConfirm={confirmDelete}
                title={deleteDialog.type === 'bulk' ? 'Delete Selected Items' : 'Delete Item'}
                message={deleteDialog.type === 'bulk'
                    ? `Are you sure you want to delete ${selectedItems.size} selected items? This action cannot be undone.`
                    : `Are you sure you want to delete "${deleteDialog.item?.itemNumber}"? This action cannot be undone.`}
                confirmText={deleteDialog.type === 'bulk' ? `Delete ${selectedItems.size} Items` : 'Delete'}
                type="danger"
                loading={deleteLoading}
            />

            {/* Shift Request Modal */}
            {shiftModal.open && shiftModal.item && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                    <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Move Equipment</h3>
                                    <p className="text-sm text-slate-500">{shiftModal.item.itemNumber}</p>
                                </div>
                            </div>
                            <button onClick={() => setShiftModal({ open: false, item: null })} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Current Lab</label>
                                <p className="text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">{lab?.name}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Move to Lab *</label>
                                <select
                                    value={shiftToLab}
                                    onChange={(e) => setShiftToLab(e.target.value)}
                                    className="input"
                                    required
                                >
                                    <option value="">Select destination lab...</option>
                                    {availableLabs.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}{l.roomNumber ? ` (${l.roomNumber})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Transfer *</label>
                                <textarea
                                    value={shiftReason}
                                    onChange={(e) => setShiftReason(e.target.value)}
                                    className="input min-h-[80px]"
                                    placeholder="Why does this equipment need to be moved?"
                                    required
                                />
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-sm text-amber-700">
                                    <strong>Note:</strong> This request will need admin approval before the equipment is moved.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => setShiftModal({ open: false, item: null })}
                                className="btn btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!shiftToLab || !shiftReason.trim()) {
                                        toast.error('Please select destination and provide reason');
                                        return;
                                    }
                                    setShiftLoading(true);
                                    try {
                                        await labsAPI.createShiftRequest(shiftModal.item.id, shiftToLab, shiftReason);
                                        toast.success('Shift request submitted for approval');
                                        setShiftModal({ open: false, item: null });
                                    } catch (error) {
                                        toast.error(error.response?.data?.message || 'Failed to create shift request');
                                    } finally {
                                        setShiftLoading(false);
                                    }
                                }}
                                disabled={shiftLoading || !shiftToLab || !shiftReason.trim()}
                                className="btn btn-primary flex-1"
                            >
                                {shiftLoading ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
