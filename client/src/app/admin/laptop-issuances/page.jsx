'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Laptop, ArrowLeft, Plus, Search, RotateCcw, FileText,
    Share2, Mail, MessageCircle, Printer, User, Calendar,
    CheckCircle, Clock, AlertTriangle, X, Camera, Copy
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { labsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    issued: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Issued' },
    returned: { bg: 'bg-green-100', text: 'text-green-700', label: 'Returned' },
    overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Overdue' },
    lost: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Lost' }
};

export default function LaptopIssuancesPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [issuances, setIssuances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Issue modal state
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [availableLaptops, setAvailableLaptops] = useState([]);
    const [staffMembers, setStaffMembers] = useState([]);

    // Calculate default return date (April of current/next year - end of session)
    const getDefaultReturnDate = () => {
        const now = new Date();
        const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear(); // If after March, next year
        return `${year}-04-30`; // April 30
    };

    const [issueForm, setIssueForm] = useState({
        laptopId: '', issuedToId: '', purpose: '',
        expectedReturnDate: getDefaultReturnDate(),
        conditionOnIssue: 'good',
        remarks: '',
        // Component status fields
        screenStatus: 'working',
        keyboardStatus: 'working',
        touchpadStatus: 'working',
        batteryStatus: 'working',
        portsStatus: 'working',
        chargerStatus: 'working'
    });
    const [issuing, setIssuing] = useState(false);

    // Camera scanner state
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    const scannerRef = useRef(null);
    const html5QrcodeRef = useRef(null);
    const voucherContentRef = useRef(null);

    // Return modal state
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedIssuance, setSelectedIssuance] = useState(null);
    const [returnForm, setReturnForm] = useState({ conditionOnReturn: 'good', returnRemarks: '' });
    const [returning, setReturning] = useState(false);

    // Voucher modal state
    const [showVoucherModal, setShowVoucherModal] = useState(false);
    const [voucherData, setVoucherData] = useState(null);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        const allowedRoles = ['admin', 'principal', 'lab_assistant'];
        if (!allowedRoles.includes(user?.role)) { router.push('/dashboard'); return; }
        loadIssuances();
    }, [isAuthenticated, _hasHydrated, statusFilter]);

    const loadIssuances = async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            const res = await labsAPI.getLaptopIssuances(params);
            setIssuances(res.data.data.issuances || []);
        } catch (error) {
            toast.error('Failed to load issuances');
        } finally {
            setLoading(false);
        }
    };

    const openIssueModal = async () => {
        try {
            const [laptopsRes, staffRes] = await Promise.all([
                labsAPI.getAvailableLaptops(),
                labsAPI.getStaffMembers()
            ]);
            setAvailableLaptops(laptopsRes.data.data.laptops || []);
            setStaffMembers(staffRes.data.data.staff || []);
            setShowIssueModal(true);
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to load data';
            console.error('Load error:', error.response?.data || error);
            toast.error(errorMsg, { duration: 8000 });
        }
    };

    const handleIssueLaptop = async (e) => {
        e.preventDefault();
        if (!issueForm.laptopId || !issueForm.issuedToId) {
            toast.error('Please select laptop and staff member');
            return;
        }
        setIssuing(true);
        try {
            const res = await labsAPI.issueLaptop(issueForm);
            toast.success(res.data.message);
            setShowIssueModal(false);
            setIssueForm({ laptopId: '', issuedToId: '', purpose: '', expectedReturnDate: '', conditionOnIssue: 'good', remarks: '' });
            loadIssuances();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to issue laptop');
        } finally {
            setIssuing(false);
        }
    };

    const openReturnModal = (issuance) => {
        setSelectedIssuance(issuance);
        setReturnForm({ conditionOnReturn: 'good', returnRemarks: '' });
        setShowReturnModal(true);
    };

    const handleReturnLaptop = async (e) => {
        e.preventDefault();
        setReturning(true);
        try {
            const res = await labsAPI.returnLaptop(selectedIssuance.id, returnForm);
            toast.success(res.data.message);
            setShowReturnModal(false);
            loadIssuances();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to return laptop');
        } finally {
            setReturning(false);
        }
    };

    const openVoucher = async (issuance) => {
        try {
            const res = await labsAPI.getIssuanceVoucher(issuance.id);
            setVoucherData(res.data.data.voucher);
            setShowVoucherModal(true);
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Failed to load voucher';
            console.error('Voucher error:', error.response?.data || error);
            toast.error(errorMsg, { duration: 8000 });
        }
    };

    const getVoucherText = () => {
        if (!voucherData) return '';
        const v = voucherData;
        return `📋 LAPTOP ISSUANCE VOUCHER\n\n` +
            `Voucher No: ${v.voucherNumber}\n` +
            `Date: ${new Date(v.issuedAt).toLocaleDateString()}\n\n` +
            `🏫 ${v.school?.name || 'School'}\n\n` +
            `💻 LAPTOP DETAILS\n` +
            `Item No: ${v.laptop?.itemNumber}\n` +
            `Brand: ${v.laptop?.brand || 'N/A'}\n` +
            `Model: ${v.laptop?.modelNo || 'N/A'}\n` +
            `Serial: ${v.laptop?.serialNo || 'N/A'}\n\n` +
            `👤 ISSUED TO\n` +
            `Name: ${v.issuedTo?.firstName} ${v.issuedTo?.lastName}\n` +
            `Role: ${v.issuedTo?.role}\n` +
            `Email: ${v.issuedTo?.email}\n` +
            `Phone: ${v.issuedTo?.phone || 'N/A'}\n\n` +
            `📝 Purpose: ${v.purpose || 'N/A'}\n` +
            `Condition: ${v.conditionOnIssue}\n` +
            `Expected Return: ${v.expectedReturnDate ? new Date(v.expectedReturnDate).toLocaleDateString() : 'N/A'}\n\n` +
            `Issued By: ${v.issuedBy?.firstName} ${v.issuedBy?.lastName}`;
    };

    const shareViaWhatsApp = () => {
        const text = encodeURIComponent(getVoucherText());
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const shareViaEmail = () => {
        const subject = encodeURIComponent(`Laptop Issuance Voucher - ${voucherData?.voucherNumber}`);
        const body = encodeURIComponent(getVoucherText());
        window.open(`mailto:${voucherData?.issuedTo?.email || ''}?subject=${subject}&body=${body}`, '_blank');
    };

    const printVoucher = () => {
        // Build component status HTML
        const componentStatusHtml = voucherData?.componentStatus ?
            Object.entries(voucherData.componentStatus).map(([key, status]) => {
                const icons = { screen: '🖥️', keyboard: '⌨️', touchpad: '🖱️', battery: '🔋', ports: '🔌', charger: '⚡' };
                const colors = { working: '#16a34a', minor_issue: '#d97706', not_working: '#dc2626' };
                const labels = { working: '✓ Working', minor_issue: '⚠ Minor Issue', not_working: '✕ Not Working' };
                return `<div style="display: flex; align-items: center; gap: 8px;">
                    <span>${icons[key] || '•'}</span>
                    <span style="text-transform: capitalize;">${key}:</span>
                    <span style="color: ${colors[status] || '#475569'}; font-weight: ${status !== 'working' ? 'bold' : 'normal'};">${labels[status] || status}</span>
                </div>`;
            }).join('') : '';

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head><title>Voucher - ${voucherData?.voucherNumber}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; padding: 30px; max-width: 500px; margin: auto; color: #1e293b; }
                .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
                .voucher-number { font-size: 28px; font-weight: 700; color: #0f172a; }
                .voucher-subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
                .section { padding: 16px; border-radius: 12px; margin-bottom: 16px; }
                .section-blue { background: #eff6ff; }
                .section-green { background: #f0fdf4; }
                .section-slate { background: #f8fafc; }
                .section-amber { background: #fffbeb; }
                .section-title { font-weight: 600; margin-bottom: 12px; font-size: 15px; }
                .title-blue { color: #1e40af; }
                .title-green { color: #166534; }
                .title-slate { color: #0f172a; }
                .title-amber { color: #92400e; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; }
                .grid-label { color: #3b82f6; }
                .grid-label-green { color: #22c55e; }
                .grid-label-slate { color: #64748b; }
                .row { font-size: 14px; margin-bottom: 6px; }
                .component-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px; }
                .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; }
                .signature { text-align: center; }
                .signature-line { border-top: 1px solid #334155; width: 150px; margin-top: 50px; padding-top: 8px; font-size: 12px; color: #64748b; }
                @media print { body { padding: 20px; } }
            </style>
            </head>
            <body>
                <div class="header">
                    <div class="voucher-number">${voucherData?.voucherNumber}</div>
                    <div class="voucher-subtitle">Laptop Issuance Voucher</div>
                </div>
                
                <div class="section section-blue">
                    <div class="section-title title-blue">Laptop Details</div>
                    <div class="grid">
                        <div><span class="grid-label">Item No:</span> ${voucherData?.laptop?.itemNumber || 'N/A'}</div>
                        <div><span class="grid-label">Brand:</span> ${voucherData?.laptop?.brand || 'N/A'}</div>
                        <div><span class="grid-label">Model:</span> ${voucherData?.laptop?.modelNo || 'N/A'}</div>
                        <div><span class="grid-label">Serial:</span> ${voucherData?.laptop?.serialNo || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="section section-green">
                    <div class="section-title title-green">Issued To</div>
                    <div class="row"><span class="grid-label-green">Name:</span> ${voucherData?.issuedTo?.firstName} ${voucherData?.issuedTo?.lastName}</div>
                    <div class="row"><span class="grid-label-green">Role:</span> ${voucherData?.issuedTo?.role || 'N/A'}</div>
                    <div class="row"><span class="grid-label-green">Email:</span> ${voucherData?.issuedTo?.email || 'N/A'}</div>
                    <div class="row"><span class="grid-label-green">Phone:</span> ${voucherData?.issuedTo?.phone || 'N/A'}</div>
                </div>
                
                <div class="section section-slate">
                    <div class="section-title title-slate">Issue Details</div>
                    <div class="grid">
                        <div><span class="grid-label-slate">Issue Date:</span> ${new Date(voucherData?.issuedAt).toLocaleDateString()}</div>
                        <div><span class="grid-label-slate">Condition:</span> ${voucherData?.conditionOnIssue || 'good'}</div>
                        <div><span class="grid-label-slate">Expected Return:</span> ${voucherData?.expectedReturnDate ? new Date(voucherData?.expectedReturnDate).toLocaleDateString() : 'N/A'}</div>
                        <div><span class="grid-label-slate">Issued By:</span> ${voucherData?.issuedBy?.firstName} ${voucherData?.issuedBy?.lastName}</div>
                    </div>
                    ${voucherData?.purpose ? `<div class="row" style="margin-top: 8px;"><span class="grid-label-slate">Purpose:</span> ${voucherData.purpose}</div>` : ''}
                </div>
                
                ${componentStatusHtml ? `
                <div class="section section-amber">
                    <div class="section-title title-amber">Component Status at Issue</div>
                    <div class="component-grid">${componentStatusHtml}</div>
                </div>
                ` : ''}
                
                <div class="signatures">
                    <div class="signature">
                        <div class="signature-line">Issuer Signature</div>
                    </div>
                    <div class="signature">
                        <div class="signature-line">Receiver Signature</div>
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const copyVoucherAsImage = async () => {
        if (!voucherContentRef.current) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(voucherContentRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true
            });
            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    toast.success('Voucher copied! Paste in WhatsApp');
                } catch (err) {
                    // Fallback: download the image
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `voucher-${voucherData?.voucherNumber}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Image downloaded (clipboard not supported)');
                }
            }, 'image/png');
        } catch (err) {
            console.error('Screenshot error:', err);
            toast.error('Failed to capture voucher');
        }
    };

    const filteredIssuances = issuances.filter(i =>
        i.laptop?.itemNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.issuedTo?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.issuedTo?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.voucherNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/labs" className="text-slate-500 hover:text-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Laptop className="w-6 h-6 text-blue-500" />
                            <h1 className="text-xl font-semibold text-slate-900">Laptop Issuances</h1>
                        </div>
                    </div>
                    <button onClick={openIssueModal} className="btn btn-primary">
                        <Plus className="w-4 h-4" /> Issue Laptop
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="card p-4 mb-6">
                    <div className="flex flex-wrap gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by laptop, name, voucher..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10 w-full"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input w-auto"
                        >
                            <option value="all">All Status</option>
                            <option value="issued">Issued</option>
                            <option value="returned">Returned</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {['issued', 'returned', 'overdue'].map(status => {
                        const count = issuances.filter(i => i.status === status).length;
                        const config = STATUS_COLORS[status];
                        return (
                            <div key={status} className={`card p-4 ${config.bg}`}>
                                <div className={`text-2xl font-bold ${config.text}`}>{count}</div>
                                <div className={`text-sm ${config.text}`}>{config.label}</div>
                            </div>
                        );
                    })}
                    <div className="card p-4 bg-slate-100">
                        <div className="text-2xl font-bold text-slate-700">{issuances.length}</div>
                        <div className="text-sm text-slate-600">Total</div>
                    </div>
                </div>

                {/* Issuances List */}
                {filteredIssuances.length === 0 ? (
                    <div className="card p-12 text-center">
                        <Laptop className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No laptop issuances found</p>
                        <button onClick={openIssueModal} className="btn btn-primary mt-4">
                            <Plus className="w-4 h-4" /> Issue First Laptop
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredIssuances.map(issuance => {
                            const status = STATUS_COLORS[issuance.status] || STATUS_COLORS.issued;
                            return (
                                <div key={issuance.id} className="card p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                                <Laptop className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-slate-900">
                                                        {issuance.laptop?.itemNumber}
                                                    </span>
                                                    <span className={`px-2 py-0.5 text-xs rounded-full ${status.bg} ${status.text}`}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-600">
                                                    {issuance.laptop?.brand} {issuance.laptop?.modelNo}
                                                </div>
                                                <div className="text-sm text-slate-500 mt-1">
                                                    Voucher: <span className="font-mono">{issuance.voucherNumber}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-[200px]">
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <User className="w-4 h-4" />
                                                <span className="font-medium">{issuance.issuedTo?.firstName} {issuance.issuedTo?.lastName}</span>
                                                <span className="text-slate-400">({issuance.issuedTo?.role})</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                <Calendar className="w-4 h-4" />
                                                <span>Issued: {new Date(issuance.issuedAt).toLocaleDateString()}</span>
                                            </div>
                                            {issuance.returnedAt && (
                                                <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                                                    <CheckCircle className="w-4 h-4" />
                                                    <span>Returned: {new Date(issuance.returnedAt).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => openVoucher(issuance)}
                                                className="btn btn-secondary text-sm"
                                            >
                                                <FileText className="w-4 h-4" /> Voucher
                                            </button>
                                            {issuance.status === 'issued' && (
                                                <button
                                                    onClick={() => openReturnModal(issuance)}
                                                    className="btn btn-primary text-sm"
                                                >
                                                    <RotateCcw className="w-4 h-4" /> Return
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Issue Modal */}
            {showIssueModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Issue Laptop</h2>
                            <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleIssueLaptop} className="p-6 space-y-4">
                            {/* Barcode Scanner Section */}
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <label className="label text-blue-700 flex items-center gap-2 mb-2">
                                    <span>📷</span> Scan Barcode / Serial No
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Type or scan barcode/serial..."
                                        className="input font-mono flex-1"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const scanned = e.target.value.trim().toUpperCase();
                                                const match = availableLaptops.find(l =>
                                                    l.serialNo?.toUpperCase() === scanned ||
                                                    l.itemNumber?.toUpperCase() === scanned
                                                );
                                                if (match) {
                                                    setIssueForm({ ...issueForm, laptopId: match.id });
                                                    toast.success(`Selected: ${match.itemNumber}`);
                                                    e.target.value = '';
                                                } else {
                                                    toast.error(`No laptop found: ${scanned}`);
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setShowCameraScanner(true);
                                            // Dynamically import html5-qrcode
                                            try {
                                                const { Html5Qrcode } = await import('html5-qrcode');
                                                setTimeout(() => {
                                                    if (scannerRef.current) {
                                                        const scanner = new Html5Qrcode('camera-scanner');
                                                        html5QrcodeRef.current = scanner;
                                                        scanner.start(
                                                            { facingMode: 'environment' },
                                                            { fps: 10, qrbox: { width: 250, height: 100 } },
                                                            (decodedText) => {
                                                                // Barcode scanned!
                                                                const scanned = decodedText.trim().toUpperCase();
                                                                const match = availableLaptops.find(l =>
                                                                    l.serialNo?.toUpperCase() === scanned ||
                                                                    l.itemNumber?.toUpperCase() === scanned
                                                                );
                                                                if (match) {
                                                                    setIssueForm({ ...issueForm, laptopId: match.id });
                                                                    toast.success(`Scanned: ${match.itemNumber}`);
                                                                } else {
                                                                    toast.error(`No laptop found: ${scanned}`);
                                                                }
                                                                // Stop scanner after successful scan
                                                                scanner.stop().then(() => {
                                                                    setShowCameraScanner(false);
                                                                });
                                                            },
                                                            (errorMessage) => {
                                                                // Ignore scan errors, just keep trying
                                                            }
                                                        ).catch(err => {
                                                            toast.error('Camera access denied');
                                                            setShowCameraScanner(false);
                                                        });
                                                    }
                                                }, 100);
                                            } catch (err) {
                                                toast.error('Scanner not available');
                                                setShowCameraScanner(false);
                                            }
                                        }}
                                        className="btn bg-blue-500 hover:bg-blue-600 text-white"
                                    >
                                        <Camera className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-xs text-blue-600 mt-1">Type + Enter, or tap camera to scan</p>

                                {/* Camera Scanner Modal */}
                                {showCameraScanner && (
                                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
                                        <div className="bg-white rounded-xl p-4 max-w-md w-full mx-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-semibold">Scan Barcode</h3>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (html5QrcodeRef.current) {
                                                            html5QrcodeRef.current.stop().catch(() => { });
                                                        }
                                                        setShowCameraScanner(false);
                                                    }}
                                                    className="text-slate-500 hover:text-slate-700"
                                                >
                                                    <X className="w-6 h-6" />
                                                </button>
                                            </div>
                                            <div
                                                id="camera-scanner"
                                                ref={scannerRef}
                                                className="w-full h-64 bg-black rounded-lg overflow-hidden"
                                            />
                                            <p className="text-center text-sm text-slate-500 mt-2">
                                                Point camera at laptop barcode/serial number
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="label">Select Laptop * (or use scanner above)</label>
                                <select
                                    value={issueForm.laptopId}
                                    onChange={(e) => setIssueForm({ ...issueForm, laptopId: e.target.value })}
                                    className="input"
                                    required
                                >
                                    <option value="">Choose laptop...</option>
                                    {availableLaptops.map(laptop => (
                                        <option key={laptop.id} value={laptop.id}>
                                            {laptop.itemNumber} - {laptop.brand} {laptop.modelNo} ({laptop.serialNo || 'No Serial'})
                                        </option>
                                    ))}
                                </select>
                                {availableLaptops.length === 0 && (
                                    <p className="text-sm text-amber-600 mt-1">No laptops available. Add laptops to inventory first.</p>
                                )}
                            </div>
                            <div>
                                <label className="label">Issue To (Staff Member) *</label>
                                <select
                                    value={issueForm.issuedToId}
                                    onChange={(e) => setIssueForm({ ...issueForm, issuedToId: e.target.value })}
                                    className="input"
                                    required
                                >
                                    <option value="">Choose staff member...</option>
                                    {staffMembers.map(staff => (
                                        <option key={staff.id} value={staff.id}>
                                            {staff.firstName} {staff.lastName} ({staff.role}) - {staff.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Purpose</label>
                                <input
                                    type="text"
                                    value={issueForm.purpose}
                                    onChange={(e) => setIssueForm({ ...issueForm, purpose: e.target.value })}
                                    className="input"
                                    placeholder="e.g., Online teaching, Project work"
                                />
                            </div>

                            {/* Component Status Section */}
                            <div>
                                <label className="label mb-2">Component Status (at time of issue)</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg">
                                    {[
                                        { key: 'screenStatus', label: '🖥️ Screen' },
                                        { key: 'keyboardStatus', label: '⌨️ Keyboard' },
                                        { key: 'touchpadStatus', label: '🖱️ Touchpad' },
                                        { key: 'batteryStatus', label: '🔋 Battery' },
                                        { key: 'portsStatus', label: '🔌 Ports' },
                                        { key: 'chargerStatus', label: '⚡ Charger' }
                                    ].map(comp => (
                                        <div key={comp.key} className="flex items-center justify-between p-2 bg-white rounded border">
                                            <span className="text-sm">{comp.label}</span>
                                            <select
                                                value={issueForm[comp.key]}
                                                onChange={(e) => setIssueForm({ ...issueForm, [comp.key]: e.target.value })}
                                                className="text-xs border rounded px-1 py-0.5"
                                            >
                                                <option value="working">✓ Working</option>
                                                <option value="minor_issue">⚠ Minor Issue</option>
                                                <option value="not_working">✕ Not Working</option>
                                                <option value="na">N/A</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Expected Return Date (Session End)</label>
                                    <input
                                        type="date"
                                        value={issueForm.expectedReturnDate}
                                        onChange={(e) => setIssueForm({ ...issueForm, expectedReturnDate: e.target.value })}
                                        className="input"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Default: End of session (April)</p>
                                </div>
                                <div>
                                    <label className="label">Overall Condition</label>
                                    <select
                                        value={issueForm.conditionOnIssue}
                                        onChange={(e) => setIssueForm({ ...issueForm, conditionOnIssue: e.target.value })}
                                        className="input"
                                    >
                                        <option value="excellent">Excellent</option>
                                        <option value="good">Good</option>
                                        <option value="fair">Fair</option>
                                        <option value="needs_repair">Needs Repair</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="label">Remarks</label>
                                <textarea
                                    value={issueForm.remarks}
                                    onChange={(e) => setIssueForm({ ...issueForm, remarks: e.target.value })}
                                    className="input"
                                    rows={2}
                                    placeholder="Any additional notes about condition, accessories, etc..."
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowIssueModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" disabled={issuing} className="btn btn-primary">
                                    {issuing ? 'Issuing...' : 'Issue Laptop'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Return Modal */}
            {showReturnModal && selectedIssuance && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Return Laptop</h2>
                            <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleReturnLaptop} className="p-6 space-y-4">
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <div className="font-medium">{selectedIssuance.laptop?.itemNumber}</div>
                                <div className="text-sm text-slate-600">
                                    Issued to: {selectedIssuance.issuedTo?.firstName} {selectedIssuance.issuedTo?.lastName}
                                </div>
                            </div>
                            <div>
                                <label className="label">Condition on Return</label>
                                <select
                                    value={returnForm.conditionOnReturn}
                                    onChange={(e) => setReturnForm({ ...returnForm, conditionOnReturn: e.target.value })}
                                    className="input"
                                >
                                    <option value="excellent">Excellent</option>
                                    <option value="good">Good</option>
                                    <option value="fair">Fair</option>
                                    <option value="damaged">Damaged</option>
                                    <option value="needs_repair">Needs Repair</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Notes</label>
                                <textarea
                                    value={returnForm.returnRemarks}
                                    onChange={(e) => setReturnForm({ ...returnForm, returnRemarks: e.target.value })}
                                    className="input"
                                    rows={2}
                                    placeholder="Any issues or notes..."
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowReturnModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" disabled={returning} className="btn btn-primary">
                                    {returning ? 'Processing...' : 'Confirm Return'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Voucher Modal */}
            {showVoucherModal && voucherData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Issuance Voucher</h2>
                            <button onClick={() => setShowVoucherModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            {/* Voucher Content - wrapped in ref for screenshot capture */}
                            <div ref={voucherContentRef} className="bg-white p-4">
                                <div className="text-center mb-6">
                                    <div className="text-2xl font-bold text-slate-900">{voucherData.voucherNumber}</div>
                                    <div className="text-sm text-slate-500">Laptop Issuance Voucher</div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <h3 className="font-semibold text-blue-900 mb-2">Laptop Details</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div><span className="text-blue-700">Item No:</span> {voucherData.laptop?.itemNumber}</div>
                                            <div><span className="text-blue-700">Brand:</span> {voucherData.laptop?.brand || 'N/A'}</div>
                                            <div><span className="text-blue-700">Model:</span> {voucherData.laptop?.modelNo || 'N/A'}</div>
                                            <div><span className="text-blue-700">Serial:</span> {voucherData.laptop?.serialNo || 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-green-50 rounded-lg">
                                        <h3 className="font-semibold text-green-900 mb-2">Issued To</h3>
                                        <div className="text-sm">
                                            <div><span className="text-green-700">Name:</span> {voucherData.issuedTo?.firstName} {voucherData.issuedTo?.lastName}</div>
                                            <div><span className="text-green-700">Role:</span> {voucherData.issuedTo?.role}</div>
                                            <div><span className="text-green-700">Email:</span> {voucherData.issuedTo?.email}</div>
                                            <div><span className="text-green-700">Phone:</span> {voucherData.issuedTo?.phone || 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <h3 className="font-semibold text-slate-900 mb-2">Issue Details</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div><span className="text-slate-600">Issue Date:</span> {new Date(voucherData.issuedAt).toLocaleDateString()}</div>
                                            <div><span className="text-slate-600">Condition:</span> {voucherData.conditionOnIssue}</div>
                                            <div><span className="text-slate-600">Expected Return:</span> {voucherData.expectedReturnDate ? new Date(voucherData.expectedReturnDate).toLocaleDateString() : 'N/A'}</div>
                                            <div><span className="text-slate-600">Issued By:</span> {voucherData.issuedBy?.firstName} {voucherData.issuedBy?.lastName}</div>
                                        </div>
                                        {voucherData.purpose && (
                                            <div className="mt-2 text-sm"><span className="text-slate-600">Purpose:</span> {voucherData.purpose}</div>
                                        )}
                                    </div>

                                    {/* Component Status Section */}
                                    {voucherData.componentStatus && Object.keys(voucherData.componentStatus).length > 0 && (
                                        <div className="p-4 bg-amber-50 rounded-lg">
                                            <h3 className="font-semibold text-amber-900 mb-2">Component Status at Issue</h3>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                {Object.entries(voucherData.componentStatus).map(([key, status]) => {
                                                    const statusColors = {
                                                        working: 'text-green-600',
                                                        minor_issue: 'text-amber-600 font-medium',
                                                        not_working: 'text-red-600 font-bold',
                                                        na: 'text-slate-400'
                                                    };
                                                    const icons = {
                                                        screen: '🖥️', keyboard: '⌨️', touchpad: '🖱️',
                                                        battery: '🔋', ports: '🔌', charger: '⚡'
                                                    };
                                                    const displayStatus = status === 'working' ? '✓ Working' :
                                                        status === 'minor_issue' ? '⚠ Minor Issue' :
                                                            status === 'not_working' ? '✕ Not Working' : '— N/A';
                                                    return (
                                                        <div key={key} className="flex items-center gap-2">
                                                            <span>{icons[key] || '•'}</span>
                                                            <span className="capitalize">{key}:</span>
                                                            <span className={statusColors[status] || 'text-slate-600'}>{displayStatus}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Highlight issues */}
                                            {Object.values(voucherData.componentStatus).some(s => s === 'minor_issue' || s === 'not_working') && (
                                                <div className="mt-2 p-2 bg-red-100 rounded text-red-800 text-sm">
                                                    ⚠️ <strong>Issues Found:</strong> {Object.entries(voucherData.componentStatus)
                                                        .filter(([, s]) => s === 'minor_issue' || s === 'not_working')
                                                        .map(([k]) => k).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {voucherData.status === 'returned' && (
                                        <div className="p-4 bg-green-100 rounded-lg">
                                            <h3 className="font-semibold text-green-900 mb-2">Return Details</h3>
                                            <div className="text-sm">
                                                <div><span className="text-green-700">Returned On:</span> {new Date(voucherData.returnedAt).toLocaleDateString()}</div>
                                                <div><span className="text-green-700">Condition:</span> {voucherData.conditionOnReturn}</div>
                                                {voucherData.receivedBy && (
                                                    <div><span className="text-green-700">Received By:</span> {voucherData.receivedBy.firstName} {voucherData.receivedBy.lastName}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div> {/* End voucherContentRef */}

                            {/* Share Actions */}
                            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t">
                                <button onClick={copyVoucherAsImage} className="btn flex-1 bg-purple-500 hover:bg-purple-600 text-white">
                                    <Copy className="w-4 h-4" /> Copy Image
                                </button>
                                <button onClick={printVoucher} className="btn btn-secondary flex-1">
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                                <button onClick={shareViaWhatsApp} className="btn flex-1 bg-green-500 hover:bg-green-600 text-white">
                                    <MessageCircle className="w-4 h-4" /> WhatsApp
                                </button>
                                <button onClick={shareViaEmail} className="btn flex-1 bg-blue-500 hover:bg-blue-600 text-white">
                                    <Mail className="w-4 h-4" /> Email
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
