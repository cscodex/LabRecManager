'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Laptop, ArrowLeft, Plus, Search, RotateCcw, FileText,
    Share2, Mail, MessageCircle, Printer, User, Calendar,
    CheckCircle, Clock, AlertTriangle, X
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
    const [issueForm, setIssueForm] = useState({
        laptopId: '', issuedToId: '', purpose: '', expectedReturnDate: '', conditionOnIssue: 'good', remarks: ''
    });
    const [issuing, setIssuing] = useState(false);

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
            toast.error('Failed to load voucher');
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
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head><title>Voucher - ${voucherData?.voucherNumber}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: auto; }
                h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
                .section { margin: 20px 0; }
                .section h3 { background: #f0f0f0; padding: 8px; margin: 0 0 10px; }
                .row { display: flex; padding: 5px 0; border-bottom: 1px solid #eee; }
                .label { font-weight: bold; width: 120px; }
                .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
                .signature { text-align: center; }
                .signature-line { border-top: 1px solid #333; width: 150px; margin-top: 40px; padding-top: 5px; }
            </style>
            </head>
            <body>
                <h1>Laptop Issuance Voucher</h1>
                <p style="text-align: center; font-size: 18px; color: #666;">${voucherData?.voucherNumber}</p>
                
                <div class="section">
                    <h3>School Details</h3>
                    <div class="row"><span class="label">Name:</span> ${voucherData?.school?.name || 'N/A'}</div>
                </div>
                
                <div class="section">
                    <h3>Laptop Details</h3>
                    <div class="row"><span class="label">Item No:</span> ${voucherData?.laptop?.itemNumber}</div>
                    <div class="row"><span class="label">Brand:</span> ${voucherData?.laptop?.brand || 'N/A'}</div>
                    <div class="row"><span class="label">Model:</span> ${voucherData?.laptop?.modelNo || 'N/A'}</div>
                    <div class="row"><span class="label">Serial No:</span> ${voucherData?.laptop?.serialNo || 'N/A'}</div>
                    <div class="row"><span class="label">Condition:</span> ${voucherData?.conditionOnIssue}</div>
                </div>
                
                <div class="section">
                    <h3>Issued To</h3>
                    <div class="row"><span class="label">Name:</span> ${voucherData?.issuedTo?.firstName} ${voucherData?.issuedTo?.lastName}</div>
                    <div class="row"><span class="label">Role:</span> ${voucherData?.issuedTo?.role}</div>
                    <div class="row"><span class="label">Email:</span> ${voucherData?.issuedTo?.email}</div>
                    <div class="row"><span class="label">Phone:</span> ${voucherData?.issuedTo?.phone || 'N/A'}</div>
                </div>
                
                <div class="section">
                    <h3>Issue Details</h3>
                    <div class="row"><span class="label">Issue Date:</span> ${new Date(voucherData?.issuedAt).toLocaleDateString()}</div>
                    <div class="row"><span class="label">Expected Return:</span> ${voucherData?.expectedReturnDate ? new Date(voucherData?.expectedReturnDate).toLocaleDateString() : 'N/A'}</div>
                    <div class="row"><span class="label">Purpose:</span> ${voucherData?.purpose || 'N/A'}</div>
                    <div class="row"><span class="label">Remarks:</span> ${voucherData?.remarks || 'N/A'}</div>
                    <div class="row"><span class="label">Issued By:</span> ${voucherData?.issuedBy?.firstName} ${voucherData?.issuedBy?.lastName}</div>
                </div>
                
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
                            <div>
                                <label className="label">Select Laptop *</label>
                                <select
                                    value={issueForm.laptopId}
                                    onChange={(e) => setIssueForm({ ...issueForm, laptopId: e.target.value })}
                                    className="input"
                                    required
                                >
                                    <option value="">Choose laptop...</option>
                                    {availableLaptops.map(laptop => (
                                        <option key={laptop.id} value={laptop.id}>
                                            {laptop.itemNumber} - {laptop.brand} {laptop.modelNo} ({laptop.lab?.name || 'No Lab'})
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Expected Return Date</label>
                                    <input
                                        type="date"
                                        value={issueForm.expectedReturnDate}
                                        onChange={(e) => setIssueForm({ ...issueForm, expectedReturnDate: e.target.value })}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label">Condition</label>
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
                                    placeholder="Any additional notes..."
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
                            {/* Voucher Content */}
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

                            {/* Share Actions */}
                            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t">
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
