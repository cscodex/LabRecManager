'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Plus, FileText, Users, ShoppingCart, Package,
    Check, X, Printer, Edit2, Trash2, ChevronDown, ChevronUp,
    Building, Calculator, ClipboardList, UserPlus, Eye
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { procurementAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    draft: 'bg-slate-100 text-slate-700',
    quotation_requested: 'bg-blue-100 text-blue-700',
    quotes_received: 'bg-purple-100 text-purple-700',
    approved: 'bg-green-100 text-green-700',
    ordered: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700'
};

const STATUS_LABELS = {
    draft: 'Draft',
    quotation_requested: 'Quotation Requested',
    quotes_received: 'Quotes Received',
    approved: 'Approved',
    ordered: 'Ordered',
    completed: 'Completed',
    cancelled: 'Cancelled'
};

export default function ProcurementPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [activeTab, setActiveTab] = useState('requests'); // requests, vendors
    const [showCommitteeModal, setShowCommitteeModal] = useState(false);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [committeeRole, setCommitteeRole] = useState('member');

    // Create Request Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [requestForm, setRequestForm] = useState({
        title: '', description: '', purpose: '', department: '', budgetCode: '',
        items: [{ itemName: '', specifications: '', quantity: 1, unit: 'pcs', estimatedUnitPrice: '' }]
    });

    // Vendor Modal
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [vendorForm, setVendorForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', gstin: '' });
    const [editingVendor, setEditingVendor] = useState(null);

    // Request Detail Modal
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [requestDetail, setRequestDetail] = useState(null);
    const [showQuotationModal, setShowQuotationModal] = useState(false);
    const [quotationForm, setQuotationForm] = useState({
        vendorId: '', quotationNumber: '', quotationDate: '', validUntil: '', terms: '', remarks: '',
        items: []
    });

    useEffect(() => {
        if (_hasHydrated && !isAuthenticated) router.push('/login');
    }, [_hasHydrated, isAuthenticated, router]);

    useEffect(() => {
        if (user?.schoolId) {
            loadData();
        }
    }, [user?.schoolId]);

    const loadData = async () => {
        try {
            const [reqRes, vendorRes, staffRes] = await Promise.all([
                procurementAPI.getRequests(),
                procurementAPI.getVendors(),
                procurementAPI.getStaff()
            ]);
            setRequests(reqRes.data.data || []);
            setVendors(vendorRes.data.data || []);
            setStaffList(staffRes.data.data || []);
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCommitteeMember = async () => {
        if (!selectedStaffId) return;
        try {
            await procurementAPI.addCommitteeMember(selectedRequest.id, { userId: selectedStaffId, role: committeeRole });
            toast.success('Committee member added');
            setSelectedStaffId('');
            setCommitteeRole('member');
            openRequestDetail(selectedRequest);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add member');
        }
    };

    const handleRemoveCommitteeMember = async (memberId) => {
        try {
            await procurementAPI.removeCommitteeMember(selectedRequest.id, memberId);
            toast.success('Member removed');
            openRequestDetail(selectedRequest);
        } catch (error) {
            toast.error('Failed to remove member');
        }
    };

    const openCombinedPdfPreview = async () => {
        try {
            const res = await procurementAPI.getPreviewData(selectedRequest.id);
            const { school, request, comparison, vendors, totalApproved, committee } = res.data.data;
            const vendorNames = vendors.map(v => v.name);
            const today = new Date().toLocaleDateString();

            const html = `
            <html>
            <head><title>Procurement Document - ${request.title}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: auto; }
                .letterhead { text-align: center; margin-bottom: 30px; }
                .letterhead img { max-height: 100px; margin-bottom: 10px; }
                .letterhead h2 { margin: 5px 0; }
                .section { margin-bottom: 30px; page-break-inside: avoid; }
                .section-title { background: #1e40af; color: white; padding: 8px 12px; font-weight: bold; margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #333; padding: 6px; font-size: 11px; text-align: left; }
                th { background: #f0f0f0; }
                .lowest { background: #d4edda; font-weight: bold; }
                .summary-box { background: #f8f9fa; padding: 15px; border: 1px solid #ddd; margin: 15px 0; }
                .committee { margin-top: 20px; }
                .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
                .signature { text-align: center; width: 150px; }
                .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 5px; font-size: 11px; }
                @media print { body { padding: 10px; } }
            </style>
            </head>
            <body>
                ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                    `<div class="letterhead"><h2>${school?.name || 'School Name'}</h2><p>${school?.address || ''}</p></div>`}
                
                <div class="section">
                    <div class="section-title">1. CALL FOR QUOTATION</div>
                    <p><strong>Subject:</strong> ${request.title}</p>
                    <p><strong>Department:</strong> ${request.department || 'N/A'}</p>
                    <p><strong>Purpose:</strong> ${request.purpose || 'N/A'}</p>
                    <p><strong>Budget Code:</strong> ${request.budgetCode || 'N/A'}</p>
                    <p><strong>Date:</strong> ${today}</p>
                    <h4>Items Required:</h4>
                    <table>
                        <tr><th>S.No</th><th>Item</th><th>Specifications</th><th>Qty</th><th>Unit</th></tr>
                        ${request.items.map((item, i) => `<tr><td>${i + 1}</td><td>${item.itemName}</td><td>${item.specifications || '-'}</td><td>${item.quantity}</td><td>${item.unit || 'pcs'}</td></tr>`).join('')}
                    </table>
                </div>
                
                <div class="section">
                    <div class="section-title">2. VENDOR QUOTATIONS RECEIVED</div>
                    ${vendors.map(v => `<div style="margin-bottom:15px;"><strong>${v.name}</strong><br/>${v.contactPerson || ''} | ${v.phone || ''} | ${v.email || ''}<br/>GSTIN: ${v.gstin || 'N/A'}</div>`).join('')}
                </div>
                
                <div class="section">
                    <div class="section-title">3. COMPARATIVE STATEMENT</div>
                    <table>
                        <tr><th>S.No</th><th>Item</th><th>Qty</th>${vendorNames.map(v => `<th>${v}</th>`).join('')}<th>Lowest</th></tr>
                        ${comparison.map((item, i) => `<tr>
                            <td>${i + 1}</td>
                            <td>${item.itemName}</td>
                            <td>${item.quantity}</td>
                            ${vendorNames.map(vName => {
                        const vData = Object.values(item.vendorPrices).find(vp => vp.vendorName === vName);
                        const isLowest = vData && item.lowestPrice === vData.unitPrice;
                        return `<td class="${isLowest ? 'lowest' : ''}">₹${vData?.unitPrice?.toLocaleString() || '-'}</td>`;
                    }).join('')}
                            <td class="lowest">₹${item.lowestPrice?.toLocaleString() || '-'}</td>
                        </tr>`).join('')}
                        <tr style="font-weight:bold;"><td colspan="3">Total</td>
                        ${vendorNames.map(vName => {
                        const total = comparison.reduce((sum, item) => sum + ((Object.values(item.vendorPrices).find(vp => vp.vendorName === vName)?.unitPrice || 0) * item.quantity), 0);
                        return `<td>₹${total.toLocaleString()}</td>`;
                    }).join('')}
                        <td class="lowest">₹${comparison.reduce((sum, item) => sum + ((item.lowestPrice || 0) * item.quantity), 0).toLocaleString()}</td></tr>
                    </table>
                </div>
                
                <div class="section">
                    <div class="section-title">4. VENDOR SELECTION & APPROVAL</div>
                    <div class="summary-box">
                        <p><strong>Recommendation:</strong> Based on the comparative statement, items should be procured from vendors offering the lowest prices as highlighted above.</p>
                        <p><strong>Total Approved Amount:</strong> <span style="font-size:16px;font-weight:bold;">₹${totalApproved?.toLocaleString() || comparison.reduce((sum, item) => sum + ((item.lowestPrice || 0) * item.quantity), 0).toLocaleString()}</span></p>
                        <p><strong>Status:</strong> ${request.status}</p>
                    </div>
                </div>
                
                ${committee?.length > 0 ? `
                <div class="section committee">
                    <div class="section-title">5. PROCUREMENT COMMITTEE</div>
                    <table>
                        <tr><th>S.No</th><th>Name</th><th>Role</th><th>Designation</th><th>Signature</th></tr>
                        ${committee.map((m, i) => `<tr><td>${i + 1}</td><td>${m.user?.firstName} ${m.user?.lastName}</td><td>${m.role || 'Member'}</td><td>${m.designation || m.user?.role || '-'}</td><td style="min-width:100px;"></td></tr>`).join('')}
                    </table>
                </div>` : ''}
                
                <div class="signatures">
                    <div class="signature"><div class="signature-line">Prepared By</div></div>
                    <div class="signature"><div class="signature-line">Verified By</div></div>
                    <div class="signature"><div class="signature-line">Approved By</div></div>
                </div>
            </body>
            </html>`;

            const printWindow = window.open('', '_blank');
            printWindow.document.write(html);
            printWindow.document.close();
        } catch (error) {
            toast.error('Failed to generate preview');
        }
    };

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        try {
            await procurementAPI.createRequest(requestForm);
            toast.success('Procurement request created');
            setShowCreateModal(false);
            setRequestForm({ title: '', description: '', purpose: '', department: '', budgetCode: '', items: [{ itemName: '', specifications: '', quantity: 1, unit: 'pcs', estimatedUnitPrice: '' }] });
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create request');
        }
    };

    const addItemRow = () => {
        setRequestForm({
            ...requestForm,
            items: [...requestForm.items, { itemName: '', specifications: '', quantity: 1, unit: 'pcs', estimatedUnitPrice: '' }]
        });
    };

    const updateItem = (idx, field, value) => {
        const newItems = [...requestForm.items];
        newItems[idx][field] = value;
        setRequestForm({ ...requestForm, items: newItems });
    };

    const removeItem = (idx) => {
        if (requestForm.items.length > 1) {
            setRequestForm({ ...requestForm, items: requestForm.items.filter((_, i) => i !== idx) });
        }
    };

    const handleCreateVendor = async (e) => {
        e.preventDefault();
        try {
            if (editingVendor) {
                await procurementAPI.updateVendor(editingVendor.id, vendorForm);
                toast.success('Vendor updated');
            } else {
                await procurementAPI.createVendor(vendorForm);
                toast.success('Vendor created');
            }
            setShowVendorModal(false);
            setVendorForm({ name: '', contactPerson: '', email: '', phone: '', address: '', gstin: '' });
            setEditingVendor(null);
            loadData();
        } catch (error) {
            toast.error('Failed to save vendor');
        }
    };

    const openRequestDetail = async (request) => {
        setSelectedRequest(request);
        try {
            const res = await procurementAPI.getRequest(request.id);
            setRequestDetail(res.data.data);
        } catch (error) {
            toast.error('Failed to load request details');
        }
    };

    const openQuotationModal = () => {
        setQuotationForm({
            vendorId: '',
            quotationNumber: '',
            quotationDate: '',
            validUntil: '',
            terms: '',
            remarks: '',
            items: requestDetail?.request?.items?.map(item => ({
                procurementItemId: item.id,
                itemName: item.itemName,
                unitPrice: '',
                quantity: item.quantity
            })) || []
        });
        setShowQuotationModal(true);
    };

    const handleAddQuotation = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...quotationForm,
                items: quotationForm.items.map(item => ({
                    procurementItemId: item.procurementItemId,
                    unitPrice: parseFloat(item.unitPrice) || 0,
                    quantity: item.quantity
                }))
            };
            await procurementAPI.addQuotation(selectedRequest.id, payload);
            toast.success('Quotation added');
            setShowQuotationModal(false);
            openRequestDetail(selectedRequest);
        } catch (error) {
            toast.error('Failed to add quotation');
        }
    };

    const approveWithLowestPrices = async () => {
        if (!requestDetail?.comparison) return;
        const approvedItems = requestDetail.comparison.map(item => ({
            itemId: item.itemId,
            vendorId: item.lowestVendorId,
            unitPrice: item.lowestPrice,
            quantity: item.quantity
        })).filter(item => item.vendorId);

        if (approvedItems.length === 0) {
            toast.error('No items with vendor prices to approve');
            return;
        }

        try {
            await procurementAPI.approveRequest(selectedRequest.id, approvedItems);
            toast.success('Procurement approved with lowest prices');
            openRequestDetail(selectedRequest);
            loadData();
        } catch (error) {
            toast.error('Failed to approve');
        }
    };

    const printComparison = () => {
        if (!requestDetail) return;
        const { request, comparison } = requestDetail;
        const vendorNames = [...new Set(request.quotations.map(q => q.vendor.name))];

        const html = `
        <html>
        <head><title>Comparative Statement - ${request.title}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 30px; }
            h1 { text-align: center; margin-bottom: 10px; }
            .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f0f0f0; }
            .lowest { background: #d4edda; font-weight: bold; }
            .total-row { font-weight: bold; background: #f8f9fa; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
            .signature { text-align: center; }
            .signature-line { border-top: 1px solid #333; width: 150px; margin-top: 50px; padding-top: 5px; }
        </style>
        </head>
        <body>
            <h1>Comparative Statement</h1>
            <div class="subtitle">${request.title} | ${request.department || 'General'}</div>
            <p><strong>Purpose:</strong> ${request.purpose || 'N/A'}</p>
            <table>
                <thead>
                    <tr>
                        <th>S.No</th>
                        <th>Item Description</th>
                        <th>Qty</th>
                        ${vendorNames.map(v => `<th>${v}</th>`).join('')}
                        <th>Lowest</th>
                    </tr>
                </thead>
                <tbody>
                    ${comparison.map((item, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td>${item.itemName}<br/><small>${item.specifications || ''}</small></td>
                            <td>${item.quantity} ${item.unit || ''}</td>
                            ${vendorNames.map(vName => {
            const vData = Object.values(item.vendorPrices).find(vp => vp.vendorName === vName);
            const isLowest = vData && item.lowestPrice === vData.unitPrice;
            return `<td class="${isLowest ? 'lowest' : ''}">₹${vData?.unitPrice?.toLocaleString() || '-'}</td>`;
        }).join('')}
                            <td class="lowest">₹${item.lowestPrice?.toLocaleString() || '-'}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="3">Total (Qty × Unit Price)</td>
                        ${vendorNames.map(vName => {
            const total = comparison.reduce((sum, item) => {
                const vData = Object.values(item.vendorPrices).find(vp => vp.vendorName === vName);
                return sum + ((vData?.unitPrice || 0) * item.quantity);
            }, 0);
            return `<td>₹${total.toLocaleString()}</td>`;
        }).join('')}
                        <td class="lowest">₹${comparison.reduce((sum, item) => sum + ((item.lowestPrice || 0) * item.quantity), 0).toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>
            <div class="signatures">
                <div class="signature"><div class="signature-line">Prepared By</div></div>
                <div class="signature"><div class="signature-line">Verified By</div></div>
                <div class="signature"><div class="signature-line">Approved By</div></div>
            </div>
        </body>
        </html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    };

    if (!_hasHydrated || !isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/labs" className="text-slate-500 hover:text-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-6 h-6 text-indigo-600" />
                            <h1 className="text-xl font-semibold">Procurement Management</h1>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowVendorModal(true)} className="btn btn-secondary">
                            <Building className="w-4 h-4" /> Add Vendor
                        </button>
                        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                            <Plus className="w-4 h-4" /> New Request
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        <FileText className="w-4 h-4" /> Requests ({requests.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('vendors')}
                        className={`btn ${activeTab === 'vendors' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        <Users className="w-4 h-4" /> Vendors ({vendors.length})
                    </button>
                </div>

                {/* Requests Tab */}
                {activeTab === 'requests' && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-8 text-slate-500">Loading...</div>
                        ) : requests.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                                <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500">No procurement requests yet</p>
                                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary mt-4">
                                    <Plus className="w-4 h-4" /> Create First Request
                                </button>
                            </div>
                        ) : (
                            requests.map(req => (
                                <div key={req.id} className="bg-white rounded-xl shadow-sm p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-lg">{req.title}</h3>
                                            <p className="text-sm text-slate-500">{req.description}</p>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                                                <span>{req.items?.length || 0} items</span>
                                                <span>{req.quotations?.length || 0} quotations</span>
                                                <span>By: {req.createdBy?.firstName} {req.createdBy?.lastName}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                                                {STATUS_LABELS[req.status]}
                                            </span>
                                            <button onClick={() => openRequestDetail(req)} className="btn btn-secondary text-sm">
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Vendors Tab */}
                {activeTab === 'vendors' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vendors.length === 0 ? (
                            <div className="col-span-full text-center py-12 bg-white rounded-xl shadow-sm">
                                <Building className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500">No vendors added yet</p>
                            </div>
                        ) : (
                            vendors.map(vendor => (
                                <div key={vendor.id} className="bg-white rounded-xl shadow-sm p-4">
                                    <div className="flex items-start justify-between">
                                        <h3 className="font-semibold">{vendor.name}</h3>
                                        <button
                                            onClick={() => { setEditingVendor(vendor); setVendorForm(vendor); setShowVendorModal(true); }}
                                            className="text-slate-400 hover:text-slate-600"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-500">{vendor.contactPerson}</p>
                                    <p className="text-sm text-slate-500">{vendor.email}</p>
                                    <p className="text-sm text-slate-500">{vendor.phone}</p>
                                    {vendor.gstin && <p className="text-xs text-slate-400">GSTIN: {vendor.gstin}</p>}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>

            {/* Create Request Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">New Procurement Request</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="label">Title *</label>
                                    <input
                                        type="text"
                                        value={requestForm.title}
                                        onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                                        className="input"
                                        required
                                        placeholder="e.g., Computer Lab Hardware Upgrade"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="label">Purpose</label>
                                    <textarea
                                        value={requestForm.purpose}
                                        onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })}
                                        className="input"
                                        rows={2}
                                        placeholder="Reason for procurement..."
                                    />
                                </div>
                                <div>
                                    <label className="label">Department</label>
                                    <input
                                        type="text"
                                        value={requestForm.department}
                                        onChange={(e) => setRequestForm({ ...requestForm, department: e.target.value })}
                                        className="input"
                                        placeholder="e.g., Computer Science"
                                    />
                                </div>
                                <div>
                                    <label className="label">Budget Code</label>
                                    <input
                                        type="text"
                                        value={requestForm.budgetCode}
                                        onChange={(e) => setRequestForm({ ...requestForm, budgetCode: e.target.value })}
                                        className="input"
                                        placeholder="e.g., IT-2024-001"
                                    />
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <label className="label">Items to Procure</label>
                                <div className="space-y-3">
                                    {requestForm.items.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                            <div className="grid grid-cols-12 gap-2">
                                                <div className="col-span-5">
                                                    <input
                                                        type="text"
                                                        value={item.itemName}
                                                        onChange={(e) => updateItem(idx, 'itemName', e.target.value)}
                                                        className="input text-sm"
                                                        placeholder="Item name *"
                                                        required
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="text"
                                                        value={item.specifications}
                                                        onChange={(e) => updateItem(idx, 'specifications', e.target.value)}
                                                        className="input text-sm"
                                                        placeholder="Specs"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                        className="input text-sm"
                                                        min="1"
                                                        placeholder="Qty"
                                                    />
                                                </div>
                                                <div className="col-span-2 flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        value={item.estimatedUnitPrice}
                                                        onChange={(e) => updateItem(idx, 'estimatedUnitPrice', e.target.value)}
                                                        className="input text-sm"
                                                        placeholder="Est. ₹"
                                                    />
                                                    {requestForm.items.length > 1 && (
                                                        <button type="button" onClick={() => removeItem(idx)} className="text-red-500">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addItemRow} className="btn btn-secondary mt-2 text-sm">
                                    <Plus className="w-4 h-4" /> Add Item
                                </button>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Vendor Modal */}
            {showVendorModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
                            <button onClick={() => { setShowVendorModal(false); setEditingVendor(null); setVendorForm({ name: '', contactPerson: '', email: '', phone: '', address: '', gstin: '' }); }} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateVendor} className="p-6 space-y-4">
                            <div>
                                <label className="label">Vendor Name *</label>
                                <input type="text" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} className="input" required />
                            </div>
                            <div>
                                <label className="label">Contact Person</label>
                                <input type="text" value={vendorForm.contactPerson} onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })} className="input" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Email</label>
                                    <input type="email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} className="input" />
                                </div>
                                <div>
                                    <label className="label">Phone</label>
                                    <input type="text" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} className="input" />
                                </div>
                            </div>
                            <div>
                                <label className="label">GSTIN</label>
                                <input type="text" value={vendorForm.gstin} onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })} className="input" />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowVendorModal(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingVendor ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Request Detail Modal with Comparison */}
            {selectedRequest && requestDetail && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                            <div>
                                <h2 className="text-lg font-semibold">{requestDetail.request.title}</h2>
                                <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[requestDetail.request.status]}`}>
                                    {STATUS_LABELS[requestDetail.request.status]}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={openCombinedPdfPreview} className="btn bg-indigo-500 hover:bg-indigo-600 text-white text-sm">
                                    <Eye className="w-4 h-4" /> Preview PDF
                                </button>
                                {requestDetail.comparison?.length > 0 && (
                                    <button onClick={printComparison} className="btn btn-secondary text-sm">
                                        <Printer className="w-4 h-4" /> Print Comparison
                                    </button>
                                )}
                                <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 mb-4">{requestDetail.request.purpose}</p>

                            {/* Comparison Table */}
                            {requestDetail.comparison?.length > 0 && requestDetail.request.quotations?.length > 0 && (
                                <div className="overflow-x-auto mb-6">
                                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                                        <Calculator className="w-5 h-5" /> Comparative Statement
                                    </h3>
                                    <table className="w-full text-sm border">
                                        <thead className="bg-slate-100">
                                            <tr>
                                                <th className="p-2 border text-left">Item</th>
                                                <th className="p-2 border text-left">Qty</th>
                                                {requestDetail.request.quotations.map(q => (
                                                    <th key={q.id} className="p-2 border text-left">{q.vendor.name}</th>
                                                ))}
                                                <th className="p-2 border text-left bg-green-100">Lowest</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {requestDetail.comparison.map((item, idx) => (
                                                <tr key={item.itemId}>
                                                    <td className="p-2 border">
                                                        {item.itemName}
                                                        {item.specifications && <div className="text-xs text-slate-500">{item.specifications}</div>}
                                                    </td>
                                                    <td className="p-2 border">{item.quantity}</td>
                                                    {requestDetail.request.quotations.map(q => {
                                                        const price = item.vendorPrices[q.vendor.id];
                                                        const isLowest = price && item.lowestPrice === price.unitPrice;
                                                        return (
                                                            <td key={q.id} className={`p-2 border ${isLowest ? 'bg-green-100 font-bold' : ''}`}>
                                                                {price ? `₹${price.unitPrice.toLocaleString()}` : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-2 border bg-green-100 font-bold">
                                                        {item.lowestPrice ? `₹${item.lowestPrice.toLocaleString()}` : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="font-bold bg-slate-50">
                                                <td className="p-2 border">Total</td>
                                                <td className="p-2 border"></td>
                                                {requestDetail.request.quotations.map(q => {
                                                    const total = requestDetail.comparison.reduce((sum, item) => {
                                                        const price = item.vendorPrices[q.vendor.id];
                                                        return sum + ((price?.unitPrice || 0) * item.quantity);
                                                    }, 0);
                                                    return <td key={q.id} className="p-2 border">₹{total.toLocaleString()}</td>;
                                                })}
                                                <td className="p-2 border bg-green-100">
                                                    ₹{requestDetail.comparison.reduce((sum, item) => sum + ((item.lowestPrice || 0) * item.quantity), 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Committee Section */}
                            <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-800">
                                    <Users className="w-5 h-5" /> Procurement Committee ({requestDetail.request.committee?.length || 0}/5)
                                </h3>
                                <div className="space-y-2 mb-3">
                                    {requestDetail.request.committee?.map(member => (
                                        <div key={member.id} className="flex items-center justify-between bg-white p-2 rounded">
                                            <span>{member.user?.firstName} {member.user?.lastName} - <em className="text-slate-500">{member.role}</em></span>
                                            <button onClick={() => handleRemoveCommitteeMember(member.id)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                                {(!requestDetail.request.committee || requestDetail.request.committee.length < 5) && (
                                    <div className="flex gap-2">
                                        <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)} className="input flex-1">
                                            <option value="">Select staff member...</option>
                                            {staffList.filter(s => !requestDetail.request.committee?.find(c => c.userId === s.id)).map(s => (
                                                <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.role})</option>
                                            ))}
                                        </select>
                                        <select value={committeeRole} onChange={e => setCommitteeRole(e.target.value)} className="input w-32">
                                            <option value="member">Member</option>
                                            <option value="chairperson">Chairperson</option>
                                            <option value="secretary">Secretary</option>
                                        </select>
                                        <button onClick={handleAddCommitteeMember} disabled={!selectedStaffId} className="btn btn-secondary">
                                            <UserPlus className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                <button onClick={openQuotationModal} className="btn btn-primary">
                                    <Plus className="w-4 h-4" /> Add Vendor Quote
                                </button>
                                {requestDetail.comparison?.length > 0 && requestDetail.request.status !== 'approved' && (
                                    <button onClick={approveWithLowestPrices} className="btn bg-green-500 hover:bg-green-600 text-white">
                                        <Check className="w-4 h-4" /> Approve (Lowest Prices)
                                    </button>
                                )}
                            </div>

                            {/* Items List */}
                            <h3 className="font-semibold mb-2">Items ({requestDetail.request.items?.length})</h3>
                            <div className="space-y-2">
                                {requestDetail.request.items?.map(item => (
                                    <div key={item.id} className="p-3 bg-slate-50 rounded-lg flex justify-between">
                                        <div>
                                            <span className="font-medium">{item.itemName}</span>
                                            {item.specifications && <span className="text-slate-500 text-sm ml-2">({item.specifications})</span>}
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            Qty: {item.quantity} {item.unit}
                                            {item.estimatedUnitPrice && ` | Est: ₹${item.estimatedUnitPrice}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Quotation Modal */}
            {showQuotationModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Add Vendor Quotation</h2>
                            <button onClick={() => setShowQuotationModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddQuotation} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Vendor *</label>
                                    <select
                                        value={quotationForm.vendorId}
                                        onChange={(e) => setQuotationForm({ ...quotationForm, vendorId: e.target.value })}
                                        className="input"
                                        required
                                    >
                                        <option value="">Select vendor...</option>
                                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Quotation Number</label>
                                    <input
                                        type="text"
                                        value={quotationForm.quotationNumber}
                                        onChange={(e) => setQuotationForm({ ...quotationForm, quotationNumber: e.target.value })}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label">Quotation Date</label>
                                    <input
                                        type="date"
                                        value={quotationForm.quotationDate}
                                        onChange={(e) => setQuotationForm({ ...quotationForm, quotationDate: e.target.value })}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label">Valid Until</label>
                                    <input
                                        type="date"
                                        value={quotationForm.validUntil}
                                        onChange={(e) => setQuotationForm({ ...quotationForm, validUntil: e.target.value })}
                                        className="input"
                                    />
                                </div>
                            </div>

                            {/* Item Prices */}
                            <div>
                                <label className="label">Item Prices</label>
                                <div className="space-y-2">
                                    {quotationForm.items.map((item, idx) => (
                                        <div key={item.procurementItemId} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                                            <span className="flex-1 text-sm">{item.itemName}</span>
                                            <span className="text-sm text-slate-500">Qty: {item.quantity}</span>
                                            <div className="w-32">
                                                <input
                                                    type="number"
                                                    value={item.unitPrice}
                                                    onChange={(e) => {
                                                        const newItems = [...quotationForm.items];
                                                        newItems[idx].unitPrice = e.target.value;
                                                        setQuotationForm({ ...quotationForm, items: newItems });
                                                    }}
                                                    className="input text-sm"
                                                    placeholder="Unit ₹"
                                                    step="0.01"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowQuotationModal(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Add Quotation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
