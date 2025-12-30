'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Plus, FileText, Users, ShoppingCart, Package,
    Check, X, Printer, Edit2, Trash2, ChevronDown, ChevronUp,
    Building, Calculator, ClipboardList, UserPlus, Eye,
    Truck, CreditCard, Receipt, ScanLine, Video, CheckCircle2
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { procurementAPI, uploadAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    draft: 'bg-slate-100 text-slate-700',
    quotation_requested: 'bg-blue-100 text-blue-700',
    quotes_received: 'bg-purple-100 text-purple-700',
    approved: 'bg-green-100 text-green-700',
    ordered: 'bg-indigo-100 text-indigo-700',
    billed: 'bg-amber-100 text-amber-700',
    paid: 'bg-teal-100 text-teal-700',
    received: 'bg-cyan-100 text-cyan-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700'
};

const STATUS_LABELS = {
    draft: 'Draft',
    quotation_requested: 'Quotation Requested',
    quotes_received: 'Quotes Received',
    approved: 'Approved',
    ordered: 'Ordered',
    billed: 'Billed',
    paid: 'Paid',
    received: 'Received',
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
    const [vendorForm, setVendorForm] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', gstin: '', isLocal: false });
    const [editingVendor, setEditingVendor] = useState(null);

    // Request Detail Modal
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [requestDetail, setRequestDetail] = useState(null);
    const [showQuotationModal, setShowQuotationModal] = useState(false);
    const [quotationForm, setQuotationForm] = useState({
        vendorId: '', quotationNumber: '', quotationDate: '', validUntil: '', terms: '', remarks: '',
        items: []
    });

    // Flow state
    const [labs, setLabs] = useState([]);
    const [orderForm, setOrderForm] = useState({ poNumber: '', poUrl: '' });
    const [billForm, setBillForm] = useState({ billNumber: '', billDate: '', billAmount: '', billUrl: '' });
    const [paymentForm, setPaymentForm] = useState({ paymentMethod: 'bank_transfer', chequeNumber: '', chequeUrl: '', paymentDate: '', paymentReference: '' });
    const [receiveForm, setReceiveForm] = useState({ receivingVideoUrl: '', receivingNotes: '' });
    const [selectedLabId, setSelectedLabId] = useState('');

    // Workflow step state (0=Request Info for new, 1-9 for existing)
    const [workflowStep, setWorkflowStep] = useState(0);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [selectedVendorIds, setSelectedVendorIds] = useState([]);

    // Step 5-7 state
    const [vendorQuotationPrices, setVendorQuotationPrices] = useState({}); // { vendorId: { itemId: price } }
    const [selectedVendorForPurchase, setSelectedVendorForPurchase] = useState(null);
    const [gstRate, setGstRate] = useState(18);

    // Step 5: GST settings per vendor and quotation document URLs
    const [vendorGstSettings, setVendorGstSettings] = useState({}); // { vendorId: { addGst: true, gstRate: 18 } }
    const [vendorQuotationDocs, setVendorQuotationDocs] = useState({}); // { vendorId: 'filename' }

    // Step 7: Editable quantities
    const [editableQuantities, setEditableQuantities] = useState({}); // { itemId: quantity }

    // Step 3: New item form
    const [newItemForm, setNewItemForm] = useState({ itemName: '', specifications: '', quantity: 1, unit: 'pcs', estimatedUnitPrice: '' });

    // Step 1: Letter content state
    const [letterContent, setLetterContent] = useState('');
    const [letterUpload, setLetterUpload] = useState(null); // Track uploaded file

    // Step 8: Bill state
    const [billUpload, setBillUpload] = useState(null);
    const [chequeUpload, setChequeUpload] = useState(null);
    const [chequeNumber, setChequeNumber] = useState('');
    const [billNumber, setBillNumber] = useState('');
    const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
    const [billAmount, setBillAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cheque');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    // Step 9: Items received state
    const [receivedItems, setReceivedItems] = useState({}); // { itemId: { received: qty, serialNumbers: [] } }

    // Validation functions for each step
    const validateStep = (step) => {
        switch (step) {
            case 1:
                if (!requestDetail?.request?.purchaseLetterUrl && !letterContent.trim()) {
                    toast.error('Please upload a letter or enter letter content');
                    return false;
                }
                return true;
            case 2:
                if (!requestDetail?.request?.committee?.length || requestDetail.request.committee.length < 3) {
                    toast.error('Please add at least 3 committee members');
                    return false;
                }
                return true;
            case 3:
                if (!requestDetail?.request?.items?.length) {
                    toast.error('Please add at least one item');
                    return false;
                }
                return true;
            case 4:
                // Check local setting
                const minVendors = (requestDetail?.request?.estimatedTotal || 0) > 100000 ? 5 : 3;
                if (selectedVendorIds.length < minVendors) {
                    toast.error(`Please select at least ${minVendors} vendors`);
                    return false;
                }
                const localVendorsSelected = selectedVendorIds.filter(id => vendors.find(v => v.id === id)?.isLocal).length;
                if (localVendorsSelected < 1) {
                    toast.error('At least 1 local vendor must be selected');
                    return false;
                }
                return true;
            case 5:
                // Check if all vendors have at least one price entered
                const hasPrices = selectedVendorIds.every(vendorId => {
                    const prices = vendorQuotationPrices[vendorId] || {};
                    return Object.values(prices).some(p => parseFloat(p) > 0) ||
                        requestDetail?.request?.quotations?.find(q => q.vendorId === vendorId);
                });

                if (!hasPrices) {
                    toast.error('Please enter quotation prices for all selected vendors');
                    return false;
                }
                return true;
            case 6:
                if (!selectedVendorForPurchase) {
                    toast.error('Please select a vendor for purchase');
                    return false;
                }
                return true;
            case 7:
                // Wait for PO generation
                return true;
            case 8:
                // Bill upload or existing bill required
                if ((!billUpload && !requestDetail?.request?.billUrl) && !requestDetail?.request?.billNumber) {
                    toast.error('Please upload the bill');
                    return false;
                }
                return true;
            case 9:
                // Items received confirmation
                if (!requestDetail?.request?.items?.some(i => i.isReceived || receivedItems[i.id]?.received > 0)) {
                    toast.error('Please mark items as received');
                    return false;
                }
                return true;
            default:
                return true;
        }
    };

    // Save step data to backend
    const saveStepData = async (step) => {
        try {
            switch (step) {
                case 1:
                    // Save letter content or upload file
                    if (letterUpload && letterUpload instanceof File) {
                        // Upload the file to Cloudinary
                        const uploadRes = await uploadAPI.uploadProcurementDoc(
                            selectedRequest.id,
                            'purchaseLetter',
                            letterUpload
                        );
                        if (uploadRes.data?.success) {
                            toast.success('Letter uploaded successfully!');
                            await openRequestDetail(selectedRequest);
                        }
                    } else if (letterContent.trim()) {
                        // Save letter content only
                        await procurementAPI.uploadPurchaseLetter(selectedRequest.id, {
                            letterContent: letterContent.trim()
                        });
                    }
                    break;
                case 4:
                    // Step 4: Save selected vendors to database
                    await procurementAPI.updateRequest(selectedRequest.id, {
                        selectedVendorIds: selectedVendorIds
                    });
                    break;
                case 5:
                    // Save quotation prices for each vendor
                    // Create VendorQuotation for each vendor with entered prices
                    for (const vendorId of selectedVendorIds) {
                        const prices = vendorQuotationPrices[vendorId] || {};
                        const items = requestDetail?.request?.items || [];
                        const hasAnyPrice = items.some(item => prices[item.id] && parseFloat(prices[item.id]) > 0);

                        if (hasAnyPrice) {
                            // Check if quotation already exists for this vendor
                            const existingQuotation = requestDetail?.request?.quotations?.find(q => q.vendor.id === vendorId);

                            if (!existingQuotation) {
                                // Create new quotation
                                const newQuotationRes = await procurementAPI.addQuotation(selectedRequest.id, {
                                    vendorId,
                                    quotationNumber: `QT-${Date.now().toString(36).toUpperCase()}`,
                                    quotationDate: new Date().toISOString().split('T')[0],
                                    items: items.map(item => ({
                                        procurementItemId: item.id,
                                        unitPrice: parseFloat(prices[item.id]) || 0,
                                        quantity: item.quantity
                                    }))
                                });

                                // Upload quotation document if exists
                                const docFile = vendorQuotationDocs[vendorId];
                                if (docFile && docFile instanceof File && newQuotationRes?.data?.id) {
                                    try {
                                        await uploadAPI.uploadQuotationDoc(newQuotationRes.data.id, docFile);
                                    } catch (uploadErr) {
                                        console.error('Quotation doc upload error:', uploadErr);
                                    }
                                }
                            } else {
                                // Update existing quotation document if new file uploaded
                                const docFile = vendorQuotationDocs[vendorId];
                                if (docFile && docFile instanceof File) {
                                    try {
                                        await uploadAPI.uploadQuotationDoc(existingQuotation.id, docFile);
                                    } catch (uploadErr) {
                                        console.error('Quotation doc upload error:', uploadErr);
                                    }
                                }
                            }
                        }
                    }
                    // Refresh data after saving
                    await openRequestDetail(selectedRequest);
                    break;
                case 6:
                    // Approve with the selected vendor for all items
                    if (selectedVendorForPurchase) {
                        const items = requestDetail?.request?.items || [];
                        const prices = vendorQuotationPrices[selectedVendorForPurchase] || {};

                        const approvedItems = items.map(item => ({
                            itemId: item.id,
                            vendorId: selectedVendorForPurchase,
                            unitPrice: parseFloat(prices[item.id]) || item.approvedUnitPrice || 0,
                            quantity: editableQuantities[item.id] ?? item.quantity
                        }));

                        await procurementAPI.approveRequest(selectedRequest.id, approvedItems);
                        await openRequestDetail(selectedRequest);
                    }
                    break;
                case 7:
                    // Update quantities via approve endpoint (re-approve with new quantities)
                    if (selectedVendorForPurchase) {
                        const items = requestDetail?.request?.items || [];
                        const prices = vendorQuotationPrices[selectedVendorForPurchase] || {};

                        const approvedItems = items.map(item => ({
                            itemId: item.id,
                            vendorId: item.approvedVendorId || selectedVendorForPurchase,
                            unitPrice: item.approvedUnitPrice || parseFloat(prices[item.id]) || 0,
                            quantity: editableQuantities[item.id] ?? item.quantity
                        }));

                        await procurementAPI.approveRequest(selectedRequest.id, approvedItems);

                        // Save PO Number if entered
                        if (orderForm.poNumber) {
                            await procurementAPI.markOrdered(selectedRequest.id, {
                                poNumber: orderForm.poNumber
                            });
                        }

                        await openRequestDetail(selectedRequest);
                    }
                    break;
                case 8:
                    // Upload bill document if new file selected
                    if (billUpload && billUpload instanceof File) {
                        try {
                            await uploadAPI.uploadProcurementDoc(selectedRequest.id, 'bill', billUpload);
                        } catch (err) {
                            console.error('Bill upload error:', err);
                            toast.error('Bill upload failed: ' + (err.response?.data?.message || err.message));
                        }
                    }

                    // Save bill details (always, to update fields like amount/number)
                    try {
                        await procurementAPI.addBill(selectedRequest.id, {
                            billNumber: billNumber || (billUpload?.name || 'BILL'),
                            billDate: billDate,
                            billAmount: billAmount
                        });
                    } catch (err) {
                        console.error('Bill details save error:', err);
                    }

                    // Upload cheque image
                    if (chequeUpload && chequeUpload instanceof File) {
                        try {
                            await uploadAPI.uploadProcurementDoc(selectedRequest.id, 'cheque', chequeUpload);
                        } catch (err) {
                            console.error('Cheque upload error:', err);
                        }
                    }
                    // Save payment info
                    if (chequeNumber || paymentMethod) {
                        try {
                            await procurementAPI.addPayment(selectedRequest.id, {
                                paymentMethod: paymentMethod,
                                chequeNumber: chequeNumber,
                                camelUrl: null, // chequeUrl handled by upload above
                                paymentDate: paymentDate,
                                paymentReference: chequeNumber // Use cheque number as ref for now
                            });
                        } catch (err) {
                            console.error('Payment save error:', err);
                        }
                    }
                    await openRequestDetail(selectedRequest);
                    break;
                case 9:
                    // Save received items
                    await procurementAPI.markReceived(selectedRequest.id, {
                        receivedItems: receivedItems,
                        status: 'received' // Explicitly mark as received
                    });
                    // Force refresh
                    await openRequestDetail(selectedRequest);
                    break;
            }
            toast.success(`Step ${step} data saved`);
            return true;
        } catch (error) {
            console.error(`Step ${step} save error:`, error);
            toast.error(`Failed to save Step ${step} data`);
            return false;
        }
    };

    // Save and proceed to next step
    const saveAndNext = async (currentStep) => {
        if (!validateStep(currentStep)) return;
        await saveStepData(currentStep);
        const nextStep = currentStep + 1;
        setWorkflowStep(nextStep);
        // Save step to database for persistence
        try {
            await procurementAPI.saveStep(selectedRequest.id, nextStep);
        } catch (e) {
            console.error('Failed to persist step:', e);
        }
    };

    // Check if step is complete (without showing toast errors)
    const isStepComplete = (step) => {
        switch (step) {
            case 1:
                return !!(requestDetail?.request?.purchaseLetterUrl || letterUpload || letterContent.trim());
            case 2:
                return (requestDetail?.request?.committee?.length || 0) >= 3;
            case 3:
                return (requestDetail?.request?.items?.length || 0) >= 1;
            case 4:
                const localCount = selectedVendorIds.filter(id => vendors.find(v => v.id === id)?.isLocal).length;
                return selectedVendorIds.length >= 3 && localCount >= 1;
            case 5:
                for (const vendorId of selectedVendorIds) {
                    const prices = vendorQuotationPrices[vendorId] || {};
                    for (const item of requestDetail?.request?.items || []) {
                        if (!prices[item.id] || parseFloat(prices[item.id]) <= 0) return false;
                    }
                }
                return selectedVendorIds.length > 0;
            case 6:
                return !!selectedVendorForPurchase;
            case 7:
                for (const item of requestDetail?.request?.items || []) {
                    const qty = editableQuantities[item.id] ?? item.quantity;
                    if (!qty || qty < 1) return false;
                }
                return true;
            case 8:
                // Step 8 complete if bill is uploaded (either in state or saved in DB)
                return !!(billUpload || requestDetail?.request?.billNumber || requestDetail?.request?.billUrl);
            case 9:
                // Step 9 requires Step 8 to be complete first
                const step8Done = !!(billUpload || requestDetail?.request?.billNumber || requestDetail?.request?.billUrl);
                if (!step8Done) return false;
                // Then check all items received
                for (const item of requestDetail?.request?.items || []) {
                    const received = receivedItems[item.id]?.received ?? 0;
                    const expected = editableQuantities[item.id] ?? item.quantity;
                    if (received < expected) return false;
                }
                return true;
            default:
                return false;
        }
    };

    // Get highest completed step (for tab navigation)
    const getHighestAccessibleStep = () => {
        for (let i = 1; i <= 9; i++) {
            if (!isStepComplete(i)) return i;
        }
        return 9;
    };

    // Number to words helper
    const numberToWords = (num) => {
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        if (num === 0) return 'Zero';
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
        if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
        if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
        if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
        return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
    };

    // Calculate vendor total from prices map (includes GST if enabled)
    const calculateVendorTotal = (vendorId, includeGst = true) => {
        const prices = vendorQuotationPrices[vendorId] || {};
        const gstSettings = vendorGstSettings[vendorId] || { addGst: true, gstRate: 18 };

        const subtotal = requestDetail?.request?.items?.reduce((sum, item) => {
            const price = parseFloat(prices[item.id]) || 0;
            return sum + (price * item.quantity);
        }, 0) || 0;

        if (includeGst && gstSettings.addGst) {
            return subtotal + (subtotal * gstSettings.gstRate / 100);
        }
        return subtotal;
    };

    // Find vendor with lowest total
    const getLowestVendor = () => {
        let lowestVendor = null;
        let lowestTotal = Infinity;
        selectedVendorIds.forEach(vid => {
            const total = calculateVendorTotal(vid);
            if (total > 0 && total < lowestTotal) {
                lowestTotal = total;
                lowestVendor = vid;
            }
        });
        return { vendorId: lowestVendor, total: lowestTotal };
    };

    useEffect(() => {
        if (_hasHydrated && !isAuthenticated) router.push('/login');
    }, [_hasHydrated, isAuthenticated, router]);

    useEffect(() => {
        if (_hasHydrated && user?.school?.id) {
            loadData();
        }
    }, [_hasHydrated, user?.school?.id]);

    const loadData = async () => {
        try {
            console.log('Loading procurement data...');
            const [reqRes, vendorRes, staffRes] = await Promise.all([
                procurementAPI.getRequests().catch(e => { console.error('Requests error:', e); return { data: { data: [] } }; }),
                procurementAPI.getVendors().catch(e => { console.error('Vendors error:', e); return { data: { data: [] } }; }),
                procurementAPI.getStaff().catch(e => { console.error('Staff error:', e); return { data: { data: [] } }; })
            ]);
            console.log('Requests:', reqRes.data);
            console.log('Vendors:', vendorRes.data);
            console.log('Staff:', staffRes.data);
            setRequests(reqRes.data?.data || []);
            setVendors(vendorRes.data?.data || []);
            setStaffList(staffRes.data?.data || []);
        } catch (error) {
            console.error('Load data error:', error);
            toast.error('Failed to load data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCommitteeMember = async () => {
        if (!selectedStaffId) return;

        // Check for duplicate
        if (requestDetail?.request?.committee?.some(m => m.userId === selectedStaffId)) {
            toast.error('This member is already in the committee');
            return;
        }

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

    const handleAddNewItem = async () => {
        if (!newItemForm.itemName.trim()) {
            toast.error('Item name is required');
            return;
        }
        try {
            await procurementAPI.addItem(selectedRequest.id, {
                itemName: newItemForm.itemName,
                specifications: newItemForm.specifications,
                quantity: parseInt(newItemForm.quantity) || 1,
                unit: newItemForm.unit,
                estimatedUnitPrice: parseFloat(newItemForm.estimatedUnitPrice) || null
            });
            toast.success('Item added');
            setNewItemForm({ itemName: '', specifications: '', quantity: 1, unit: 'pcs', estimatedUnitPrice: '' });
            openRequestDetail(selectedRequest);
        } catch (error) {
            toast.error('Failed to add item');
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
            const today = new Date().toLocaleDateString('en-IN');
            const isComplete = request.status === 'received' || request.status === 'completed';

            const html = `
            <html>
            <head><title>Procurement Document - ${request.title}</title>
            <style>
                @page { size: A4; margin: 15mm; }
                @page landscape { size: A4 landscape; }
                body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.4; }
                .page { page-break-after: always; padding: 20px; }
                .page:last-child { page-break-after: avoid; }
                .landscape { page: landscape; }
                .letterhead { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e40af; padding-bottom: 15px; }
                .letterhead img { max-height: 80px; }
                .letterhead h2 { margin: 5px 0; color: #1e40af; }
                .section-title { background: #1e40af; color: white; padding: 8px 12px; font-weight: bold; margin: 15px 0 10px 0; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
                th { background: #e5e7eb; font-weight: bold; }
                .lowest { background: #d4edda; font-weight: bold; }
                .total-row { font-weight: bold; background: #f3f4f6; }
                .summary-box { background: #f8f9fa; padding: 15px; border: 1px solid #ddd; margin: 15px 0; border-radius: 4px; }
                .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
                .signature { text-align: center; width: 150px; }
                .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 10px; }
                .meta-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
                .meta-info p { margin: 4px 0; }
                .stamp-area { border: 2px dashed #ccc; width: 120px; height: 120px; margin: 10px auto; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px; }
                @media print { 
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .page { padding: 10px; }
                }
            </style>
            </head>
            <body>
                <!-- PAGE 1: REQUEST LETTER -->
                <div class="page">
                    ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                    `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2><p>${school?.address || ''}</p></div>`}
                    
                    <div class="section-title">1. REQUEST FOR NEW PURCHASE</div>
                    <div class="meta-info">
                        <p><strong>Reference No:</strong> PR-${request.id?.slice(0, 8).toUpperCase() || 'XXXXXX'}</p>
                        <p><strong>Date:</strong> ${new Date(request.createdAt).toLocaleDateString('en-IN')}</p>
                        <p><strong>Department:</strong> ${request.department || 'N/A'}</p>
                        <p><strong>Budget Code:</strong> ${request.budgetCode || 'N/A'}</p>
                    </div>
                    
                    <p><strong>Subject:</strong> ${request.title}</p>
                    <p><strong>Purpose:</strong> ${request.purpose || 'Procurement of items as listed below for institutional requirements.'}</p>
                    
                    ${request.letterContent ? `<div style="margin: 15px 0; padding: 15px; border: 1px solid #ddd; background: #fafafa;"><pre style="white-space: pre-wrap; font-family: inherit;">${request.letterContent}</pre></div>` : ''}
                    
                    <table>
                        <tr><th>S.No</th><th>Item Description</th><th>Specifications</th><th>Qty</th><th>Unit</th><th>Est. Unit Price</th><th>Est. Total</th></tr>
                        ${request.items.map((item, i) => `<tr>
                            <td>${i + 1}</td>
                            <td>${item.itemName}</td>
                            <td>${item.specifications || '-'}</td>
                            <td>${item.quantity}</td>
                            <td>${item.unit || 'pcs'}</td>
                            <td>₹${(item.estimatedUnitPrice || 0).toLocaleString()}</td>
                            <td>₹${((item.estimatedUnitPrice || 0) * item.quantity).toLocaleString()}</td>
                        </tr>`).join('')}
                        <tr class="total-row">
                            <td colspan="6" style="text-align:right;">Estimated Total:</td>
                            <td>₹${request.items.reduce((sum, i) => sum + ((i.estimatedUnitPrice || 0) * i.quantity), 0).toLocaleString()}</td>
                        </tr>
                    </table>
                    
                    <div class="signatures">
                        <div class="signature"><div class="signature-line">Requested By</div></div>
                        <div class="signature"><div class="signature-line">HOD / Section Head</div></div>
                        <div class="signature"><div class="signature-line">Principal / Director</div></div>
                    </div>
                </div>

                <!-- PAGE 2: CALL FOR QUOTATIONS -->
                <div class="page">
                    ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                    `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2></div>`}
                    
                    <div class="section-title">2. CALL FOR QUOTATION</div>
                    <p><strong>Date:</strong> ${today}</p>
                    <p><strong>Subject:</strong> Invitation for Quotation - ${request.title}</p>
                    
                    <p style="margin: 15px 0;">Dear Vendor,</p>
                    <p>You are invited to submit your competitive quotation for the following items:</p>
                    
                    <table>
                        <tr><th>S.No</th><th>Item Description</th><th>Specifications</th><th>Qty</th><th>Unit</th></tr>
                        ${request.items.map((item, i) => `<tr>
                            <td>${i + 1}</td>
                            <td>${item.itemName}</td>
                            <td>${item.specifications || '-'}</td>
                            <td>${item.quantity}</td>
                            <td>${item.unit || 'pcs'}</td>
                        </tr>`).join('')}
                    </table>
                    
                    <div class="summary-box">
                        <p><strong>Terms & Conditions:</strong></p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>Quotation must be valid for minimum 30 days</li>
                            <li>Prices should include all taxes (GST, delivery, etc.)</li>
                            <li>Delivery period must be mentioned</li>
                            <li>Warranty/Guarantee details must be provided</li>
                        </ul>
                        <p><strong>Last Date for Submission:</strong> ____________</p>
                    </div>
                    
                    <p><strong>Vendors Contacted:</strong></p>
                    <ol>
                        ${vendors.map(v => `<li>${v.name} - ${v.contactPerson || ''} (${v.phone || v.email || 'N/A'})</li>`).join('')}
                    </ol>
                </div>

                <!-- PAGE 3: VENDOR QUOTATIONS RECEIVED -->
                <div class="page">
                    ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                    `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2></div>`}
                    
                    <div class="section-title">3. QUOTATIONS RECEIVED FROM VENDORS</div>
                    
                    ${vendors.map((v, idx) => `
                        <div style="margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #1e40af;">Vendor ${idx + 1}: ${v.name}</h4>
                            <table style="width: auto; margin: 0;">
                                <tr><td style="border:none; padding: 2px 15px 2px 0;"><strong>Contact:</strong></td><td style="border:none;">${v.contactPerson || '-'}</td></tr>
                                <tr><td style="border:none; padding: 2px 15px 2px 0;"><strong>Phone:</strong></td><td style="border:none;">${v.phone || '-'}</td></tr>
                                <tr><td style="border:none; padding: 2px 15px 2px 0;"><strong>Email:</strong></td><td style="border:none;">${v.email || '-'}</td></tr>
                                <tr><td style="border:none; padding: 2px 15px 2px 0;"><strong>Address:</strong></td><td style="border:none;">${v.address || '-'}</td></tr>
                                <tr><td style="border:none; padding: 2px 15px 2px 0;"><strong>GSTIN:</strong></td><td style="border:none;">${v.gstin || '-'}</td></tr>
                                <tr><td style="border:none; padding: 2px 15px 2px 0;"><strong>Local Vendor:</strong></td><td style="border:none;">${v.isLocal ? 'Yes ✓' : 'No'}</td></tr>
                            </table>
                        </div>
                    `).join('')}
                </div>

                <!-- PAGE 4: COMPARATIVE STATEMENT (Landscape) -->
                <div class="page" style="page: landscape;">
                    ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                    `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2></div>`}
                    
                    <div class="section-title">4. COMPARATIVE STATEMENT OF QUOTATIONS</div>
                    <p><strong>Reference:</strong> ${request.title} | <strong>Date:</strong> ${today}</p>
                    
                    <table style="font-size: 10px;">
                        <tr>
                            <th>S.No</th>
                            <th>Item Description</th>
                            <th>Qty</th>
                            ${vendorNames.map(v => `<th style="background:#e0e7ff;">${v}<br/>(Unit Price)</th>`).join('')}
                            <th style="background:#d4edda;">Lowest Price</th>
                            <th style="background:#d4edda;">Lowest Vendor</th>
                        </tr>
                        ${comparison.map((item, i) => {
                        const lowestVendor = Object.values(item.vendorPrices).find(vp => vp.unitPrice === item.lowestPrice);
                        return `<tr>
                                <td>${i + 1}</td>
                                <td>${item.itemName}</td>
                                <td>${item.quantity}</td>
                                ${vendorNames.map(vName => {
                            const vData = Object.values(item.vendorPrices).find(vp => vp.vendorName === vName);
                            const isLowest = vData && item.lowestPrice === vData.unitPrice;
                            return `<td class="${isLowest ? 'lowest' : ''}">₹${vData?.unitPrice?.toLocaleString() || '-'}</td>`;
                        }).join('')}
                                <td class="lowest">₹${item.lowestPrice?.toLocaleString() || '-'}</td>
                                <td class="lowest">${lowestVendor?.vendorName || '-'}</td>
                            </tr>`;
                    }).join('')}
                        <tr class="total-row">
                            <td colspan="3" style="text-align:right;"><strong>Total Amount:</strong></td>
                            ${vendorNames.map(vName => {
                        const total = comparison.reduce((sum, item) => sum + ((Object.values(item.vendorPrices).find(vp => vp.vendorName === vName)?.unitPrice || 0) * item.quantity), 0);
                        return `<td>₹${total.toLocaleString()}</td>`;
                    }).join('')}
                            <td class="lowest" colspan="2">₹${comparison.reduce((sum, item) => sum + ((item.lowestPrice || 0) * item.quantity), 0).toLocaleString()}</td>
                        </tr>
                    </table>
                    
                    ${committee?.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <p><strong>Procurement Committee:</strong></p>
                        <table style="width: auto;">
                            <tr><th>S.No</th><th>Name</th><th>Role</th><th>Signature</th></tr>
                            ${committee.map((m, i) => `<tr><td>${i + 1}</td><td>${m.user?.firstName} ${m.user?.lastName}</td><td>${m.role || 'Member'}</td><td style="min-width:100px;"></td></tr>`).join('')}
                        </table>
                    </div>` : ''}
                </div>

                <!-- PAGE 5: AMOUNT SHEET / COST SUMMARY -->
                <div class="page">
                    ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                    `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2></div>`}
                    
                    <div class="section-title">5. AMOUNT SHEET / COST SUMMARY</div>
                    <p><strong>Reference:</strong> ${request.title}</p>
                    
                    <table>
                        <tr>
                            <th>S.No</th>
                            <th>Item Description</th>
                            <th>Qty</th>
                            <th>Unit</th>
                            <th>Approved Unit Price</th>
                            <th>GST %</th>
                            <th>GST Amount</th>
                            <th>Total Amount</th>
                        </tr>
                        ${request.items.map((item, i) => {
                        const compItem = comparison.find(c => c.itemId === item.id);
                        const unitPrice = compItem?.lowestPrice || item.approvedUnitPrice || 0;
                        const gstPercent = 18; // Default GST
                        const baseAmount = unitPrice * item.quantity;
                        const gstAmount = baseAmount * (gstPercent / 100);
                        const totalAmount = baseAmount + gstAmount;
                        return `<tr>
                                <td>${i + 1}</td>
                                <td>${item.itemName}</td>
                                <td>${item.quantity}</td>
                                <td>${item.unit || 'pcs'}</td>
                                <td>₹${unitPrice.toLocaleString()}</td>
                                <td>${gstPercent}%</td>
                                <td>₹${gstAmount.toLocaleString()}</td>
                                <td>₹${totalAmount.toLocaleString()}</td>
                            </tr>`;
                    }).join('')}
                        <tr class="total-row">
                            <td colspan="7" style="text-align:right;"><strong>Grand Total (incl. GST):</strong></td>
                            <td><strong>₹${(totalApproved || comparison.reduce((sum, item) => sum + ((item.lowestPrice || 0) * item.quantity * 1.18), 0)).toLocaleString()}</strong></td>
                        </tr>
                    </table>
                    
                    <div class="summary-box">
                        <p><strong>Amount in Words:</strong> ________________________________________________________________</p>
                        <p><strong>Approved Vendor:</strong> ${vendors[0]?.name || '________________'}</p>
                    </div>
                    
                    <div class="signatures">
                        <div class="signature"><div class="signature-line">Prepared By</div></div>
                        <div class="signature"><div class="signature-line">Verified By</div></div>
                        <div class="signature"><div class="signature-line">Approved By</div></div>
                    </div>
                </div>

                <!-- PAGE 6: PURCHASE ORDER -->
                <div class="page">
                    ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                    `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2></div>`}
                    
                    <div class="section-title">6. PURCHASE ORDER</div>
                    <div class="meta-info">
                        <p><strong>PO Number:</strong> ${request.poNumber || 'PO-' + request.id?.slice(0, 8).toUpperCase()}</p>
                        <p><strong>PO Date:</strong> ${request.orderedAt ? new Date(request.orderedAt).toLocaleDateString('en-IN') : today}</p>
                        <p><strong>Budget Code:</strong> ${request.budgetCode || 'N/A'}</p>
                        <p><strong>Department:</strong> ${request.department || 'N/A'}</p>
                    </div>
                    
                    <div style="margin: 15px 0; padding: 15px; border: 1px solid #1e40af; border-radius: 4px;">
                        <p><strong>TO:</strong></p>
                        <p style="margin-left: 20px;">
                            <strong>${vendors[0]?.name || '________________'}</strong><br/>
                            ${vendors[0]?.address || '________________'}<br/>
                            Contact: ${vendors[0]?.contactPerson || ''} | Phone: ${vendors[0]?.phone || ''}<br/>
                            GSTIN: ${vendors[0]?.gstin || 'N/A'}
                        </p>
                    </div>
                    
                    <p>Please supply the following items as per agreed terms:</p>
                    
                    <table>
                        <tr><th>S.No</th><th>Item Description</th><th>Specifications</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
                        ${request.items.map((item, i) => {
                        const compItem = comparison.find(c => c.itemId === item.id);
                        const unitPrice = compItem?.lowestPrice || 0;
                        return `<tr>
                                <td>${i + 1}</td>
                                <td>${item.itemName}</td>
                                <td>${item.specifications || '-'}</td>
                                <td>${item.quantity}</td>
                                <td>₹${unitPrice.toLocaleString()}</td>
                                <td>₹${(unitPrice * item.quantity).toLocaleString()}</td>
                            </tr>`;
                    }).join('')}
                        <tr class="total-row">
                            <td colspan="5" style="text-align:right;"><strong>Total:</strong></td>
                            <td><strong>₹${comparison.reduce((sum, item) => sum + ((item.lowestPrice || 0) * item.quantity), 0).toLocaleString()}</strong></td>
                        </tr>
                    </table>
                    
                    <div class="summary-box">
                        <p><strong>Delivery Address:</strong> ${school?.address || '________________'}</p>
                        <p><strong>Expected Delivery:</strong> ____________ days from PO date</p>
                        <p><strong>Payment Terms:</strong> As per institutional policy</p>
                    </div>
                    
                    <div class="signatures">
                        <div class="signature"><div class="signature-line">Authorized Signatory</div><p style="font-size:10px;">${school?.name || ''}</p></div>
                        <div class="signature"><div class="stamp-area">Official Stamp</div></div>
                    </div>
                </div>

                <!-- PAGE 7: BILL RECEIVED (shown if bill exists) -->
                ${request.billNumber ? `
                <div class="page">
                    ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                        `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2></div>`}
                    
                    <div class="section-title">7. BILL / INVOICE RECEIVED</div>
                    <div class="meta-info">
                        <p><strong>Bill/Invoice Number:</strong> ${request.billNumber}</p>
                        <p><strong>Bill Date:</strong> ${request.billDate ? new Date(request.billDate).toLocaleDateString('en-IN') : '-'}</p>
                        <p><strong>Vendor:</strong> ${vendors[0]?.name || '-'}</p>
                        <p><strong>Vendor GSTIN:</strong> ${vendors[0]?.gstin || '-'}</p>
                    </div>
                    
                    <table>
                        <tr><th>S.No</th><th>Item Description</th><th>Qty Ordered</th><th>Qty Received</th><th>Unit Price</th><th>Amount</th></tr>
                        ${request.items.map((item, i) => {
                            const compItem = comparison.find(c => c.itemId === item.id);
                            const unitPrice = compItem?.lowestPrice || 0;
                            return `<tr>
                                <td>${i + 1}</td>
                                <td>${item.itemName}</td>
                                <td>${item.quantity}</td>
                                <td>${item.receivedQty || item.quantity}</td>
                                <td>₹${unitPrice.toLocaleString()}</td>
                                <td>₹${(unitPrice * (item.receivedQty || item.quantity)).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                        <tr class="total-row">
                            <td colspan="5" style="text-align:right;"><strong>Bill Amount:</strong></td>
                            <td><strong>₹${(request.billAmount || comparison.reduce((sum, item) => sum + ((item.lowestPrice || 0) * item.quantity), 0)).toLocaleString()}</strong></td>
                        </tr>
                    </table>
                    
                    <div class="summary-box">
                        <p><strong>Payment Method:</strong> ${request.paymentMethod || 'Bank Transfer'}</p>
                        <p><strong>Cheque Number:</strong> ${request.chequeNumber || 'N/A'}</p>
                        <p><strong>Payment Date:</strong> ${request.paymentDate ? new Date(request.paymentDate).toLocaleDateString('en-IN') : '________________'}</p>
                    </div>
                    
                    <div class="signatures">
                        <div class="signature"><div class="signature-line">Received By</div></div>
                        <div class="signature"><div class="signature-line">Verified By</div></div>
                        <div class="signature"><div class="signature-line">Approved for Payment</div></div>
                    </div>
                </div>` : ''}

                <!-- PAGE 8: STOCK REGISTER / INVENTORY SHEET (shown only if complete) -->
                ${isComplete ? `
                <div class="page">
                    ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                        `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2></div>`}
                    
                    <div class="section-title">8. STOCK REGISTER / NEW INVENTORY ENTRY</div>
                    <div class="meta-info">
                        <p><strong>Reference:</strong> ${request.title}</p>
                        <p><strong>Date of Entry:</strong> ${today}</p>
                        <p><strong>PO Number:</strong> ${request.poNumber || 'N/A'}</p>
                        <p><strong>Received From:</strong> ${vendors[0]?.name || '-'}</p>
                    </div>
                    
                    <table>
                        <tr>
                            <th>S.No</th>
                            <th>Item Description</th>
                            <th>Specifications</th>
                            <th>Qty Received</th>
                            <th>Unit</th>
                            <th>Serial Numbers / Asset Tags</th>
                            <th>Location / Lab</th>
                        </tr>
                        ${request.items.map((item, i) => `<tr>
                            <td>${i + 1}</td>
                            <td>${item.itemName}</td>
                            <td>${item.specifications || '-'}</td>
                            <td>${item.receivedQty || item.quantity}</td>
                            <td>${item.unit || 'pcs'}</td>
                            <td style="min-width: 150px;">${item.serialNumbers?.join(', ') || '________________'}</td>
                            <td>${item.labName || '________________'}</td>
                        </tr>`).join('')}
                    </table>
                    
                    <div class="summary-box">
                        <p><strong>Total Items Added to Inventory:</strong> ${request.items.length}</p>
                        <p><strong>Total Quantity:</strong> ${request.items.reduce((sum, i) => sum + (i.receivedQty || i.quantity), 0)} units</p>
                        <p><strong>Receiving Notes:</strong> ${request.receivingNotes || 'Items received in good condition.'}</p>
                    </div>
                    
                    <div class="signatures">
                        <div class="signature"><div class="signature-line">Store Keeper</div></div>
                        <div class="signature"><div class="signature-line">Lab In-charge</div></div>
                        <div class="signature"><div class="signature-line">HOD / Principal</div></div>
                    </div>
                </div>` : ''}

            </body>
            </html>`;

            const printWindow = window.open('', '_blank');
            printWindow.document.write(html);
            printWindow.document.close();
        } catch (error) {
            console.error('PDF Preview error:', error);
            toast.error('Failed to generate preview');
        }
    };

    // Generate Call Quotation for selected vendors
    const generateCallQuotation = async (vendorId) => {
        try {
            const res = await procurementAPI.getPreviewData(selectedRequest.id);
            const { school, request, committee } = res.data.data;
            const vendor = vendors.find(v => v.id === vendorId);
            if (!vendor) {
                toast.error('Vendor not found');
                return;
            }
            const today = new Date().toLocaleDateString('en-IN');

            const html = `
            <html>
            <head><title>Call for Quotation - ${vendor.name}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: auto; }
                .letterhead { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                .letterhead img { max-height: 80px; margin-bottom: 10px; }
                .letterhead h2 { margin: 5px 0; color: #1e40af; }
                .vendor-address { background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #1e40af; }
                .section { margin: 20px 0; }
                .section-title { font-weight: bold; color: #1e40af; margin-bottom: 10px; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 12px; }
                th { background: #e5e7eb; }
                .request-line { font-size: 14px; margin: 20px 0; line-height: 1.6; }
                .committee { margin-top: 40px; }
                .signatures { display: flex; justify-content: space-between; margin-top: 60px; flex-wrap: wrap; }
                .signature { text-align: center; width: 180px; margin: 20px 10px; }
                .signature-line { border-top: 1px solid #333; padding-top: 5px; font-size: 11px; }
                .signature-name { font-weight: bold; margin-bottom: 40px; }
                @media print { body { padding: 15px; } }
            </style>
            </head>
            <body>
                ${school?.letterheadUrl ? `<div class="letterhead"><img src="${school.letterheadUrl}" alt="Letterhead" style="max-width:100%" /></div>` :
                    `<div class="letterhead"><h2>${school?.name || 'Institution Name'}</h2><p>${school?.address || ''}</p></div>`}
                
                <div class="vendor-address">
                    <strong>To,</strong><br/>
                    <strong>${vendor.name}</strong><br/>
                    ${vendor.contactPerson ? `Attn: ${vendor.contactPerson}<br/>` : ''}
                    ${vendor.address || ''}<br/>
                    ${vendor.phone ? `Phone: ${vendor.phone}` : ''} ${vendor.email ? `| Email: ${vendor.email}` : ''}<br/>
                    ${vendor.gstin ? `GSTIN: ${vendor.gstin}` : ''}
                </div>
                
                <div class="section">
                    <p><strong>Date:</strong> ${today}</p>
                    <p><strong>Subject:</strong> Request for Quotation - ${request.title}</p>
                </div>
                
                <div class="request-line">
                    <p>Dear Sir/Madam,</p>
                    <p>We invite you to submit your best quotation for the following items required for <strong>${request.purpose || request.department || 'institutional purposes'}</strong>. Please provide your competitive rates at the earliest.</p>
                </div>
                
                <div class="section">
                    <div class="section-title">ITEMS REQUIRED</div>
                    <table>
                        <thead>
                            <tr><th>S.No</th><th>Item Name</th><th>Specifications</th><th>Quantity</th><th>Unit</th><th>Your Rate (₹)</th></tr>
                        </thead>
                        <tbody>
                            ${request.items.map((item, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${item.itemName}</td>
                                    <td>${item.specifications || '-'}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.unit || 'pcs'}</td>
                                    <td style="min-width:80px;"></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="section">
                    <p><strong>Terms & Conditions:</strong></p>
                    <ul>
                        <li>Quotation should be valid for at least 30 days</li>
                        <li>Delivery period should be mentioned</li>
                        <li>GST and other taxes should be mentioned separately</li>
                        <li>Warranty/Guarantee details (if applicable)</li>
                    </ul>
                </div>
                
                ${committee?.length > 0 ? `
                <div class="committee">
                    <div class="section-title">PROCUREMENT COMMITTEE</div>
                    <div class="signatures">
                        ${committee.map(m => `
                            <div class="signature">
                                <div class="signature-name">${m.user?.firstName} ${m.user?.lastName}</div>
                                <div class="signature-line">${m.role || 'Member'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>` : ''}
                
                <div style="margin-top: 40px; text-align: right;">
                    <div class="signature" style="display: inline-block;">
                        <div class="signature-name">Authorized Signatory</div>
                        <div class="signature-line">For ${school?.name || 'Institution'}</div>
                    </div>
                </div>
            </body>
            </html>`;

            const printWindow = window.open('', '_blank');
            printWindow.document.write(html);
            printWindow.document.close();
            toast.success(`Call Quotation generated for ${vendor.name}`);
        } catch (error) {
            console.error('Generate quotation error:', error);
            toast.error('Failed to generate call quotation');
        }
    };

    // Toggle vendor selection for call quotation
    const toggleVendorSelection = (vendorId) => {
        setSelectedVendorIds(prev =>
            prev.includes(vendorId)
                ? prev.filter(id => id !== vendorId)
                : [...prev, vendorId]
        );
    };

    // Generate call quotations for all selected vendors
    const generateAllCallQuotations = async () => {
        if (selectedVendorIds.length === 0) {
            toast.error('Please select at least one vendor');
            return;
        }
        for (const vendorId of selectedVendorIds) {
            await generateCallQuotation(vendorId);
        }
    };

    // Load labs for inventory
    const loadLabs = async () => {
        try {
            const res = await procurementAPI.getLabs();
            setLabs(res.data.data || []);
        } catch (error) { }
    };

    // Flow handlers
    const handleMarkOrdered = async () => {
        try {
            await procurementAPI.markOrdered(selectedRequest.id, orderForm);
            toast.success('Marked as ordered');
            openRequestDetail(selectedRequest);
            loadData();
        } catch (error) {
            toast.error('Failed to mark as ordered');
        }
    };

    const handleAddBill = async () => {
        try {
            await procurementAPI.addBill(selectedRequest.id, billForm);
            toast.success('Bill added');
            openRequestDetail(selectedRequest);
            loadData();
        } catch (error) {
            toast.error('Failed to add bill');
        }
    };

    const handleAddPayment = async () => {
        try {
            await procurementAPI.addPayment(selectedRequest.id, paymentForm);
            toast.success('Payment recorded');
            openRequestDetail(selectedRequest);
            loadData();
        } catch (error) {
            toast.error('Failed to record payment');
        }
    };

    const handleMarkReceived = async () => {
        try {
            await procurementAPI.markReceived(selectedRequest.id, receiveForm);
            toast.success('Marked as received');
            openRequestDetail(selectedRequest);
            loadData();
        } catch (error) {
            toast.error('Failed to mark as received');
        }
    };

    const handleReceiveItem = async (itemId, addToInventory, serialNo) => {
        try {
            await procurementAPI.receiveItem(selectedRequest.id, itemId, {
                addToInventory,
                labId: selectedLabId,
                serialNo
            });
            toast.success(addToInventory ? 'Item received and added to inventory' : 'Item received');
            openRequestDetail(selectedRequest);
        } catch (error) {
            toast.error('Failed to receive item');
        }
    };

    // Get current stage index
    const getStageIndex = (status) => {
        const stages = ['draft', 'quotation_requested', 'quotes_received', 'approved', 'ordered', 'billed', 'paid', 'received', 'completed'];
        return stages.indexOf(status);
    };

    // Start new request workflow
    const startNewRequest = () => {
        setIsCreatingNew(true);
        setRequestForm({ title: '', description: '', purpose: '', department: '', budgetCode: '', items: [] });
        setSelectedRequest(null);
        setRequestDetail(null);
        setWorkflowStep(0);
        setSelectedVendorIds([]);
        setLetterContent('');
        setLetterUpload(null);
    };

    const handleCreateRequest = async () => {
        if (!requestForm.title.trim()) {
            toast.error('Title is required');
            return false;
        }
        try {
            const res = await procurementAPI.createRequest(requestForm);
            toast.success('Request created! Proceeding to next steps...');
            // After creation, load the new request and continue with the flow
            const newRequest = res.data.data;
            setSelectedRequest(newRequest);
            setIsCreatingNew(false);
            await openRequestDetail(newRequest);
            setWorkflowStep(1);
            loadData();
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create request');
            return false;
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
            const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
            const errCode = error.response?.data?.code || '';
            const errMeta = error.response?.data?.meta ? JSON.stringify(error.response.data.meta) : '';
            toast.error(`Failed to save vendor: ${errMsg} ${errCode} ${errMeta}`, { duration: 8000 });
            console.error('Vendor save error:', error.response?.data);
        }
    };

    const openRequestDetail = async (request) => {
        setSelectedRequest(request);
        try {
            const res = await procurementAPI.getRequest(request.id);
            const data = res.data.data;
            setRequestDetail(data);

            // Restore local state from server data
            if (data.request?.letterContent) {
                setLetterContent(data.request.letterContent);
            }
            if (data.request?.purchaseLetterUrl) {
                setLetterUpload({ name: data.request.purchaseLetterName || 'Uploaded Document' });
            }

            // Restore selected vendors from DB first, fallback to quotations
            if (data.request?.selectedVendorIds?.length > 0) {
                setSelectedVendorIds(data.request.selectedVendorIds);
            } else if (data.request?.quotations?.length > 0) {
                const vendorIds = [...new Set(data.request.quotations.map(q => q.vendor.id))];
                setSelectedVendorIds(vendorIds);
            }

            // Restore quotation prices from quotations
            if (data.request?.quotations?.length > 0) {
                const prices = {};
                data.request.quotations.forEach(q => {
                    prices[q.vendor.id] = {};
                    q.items.forEach(item => {
                        prices[q.vendor.id][item.procurementItemId] = item.unitPrice;
                    });
                });
                setVendorQuotationPrices(prices);
            }

            // Restore selected vendor for purchase (from approved items)
            if (data.request?.items?.[0]?.approvedVendorId) {
                setSelectedVendorForPurchase(data.request.items[0].approvedVendorId);
            }

            // Restore editable quantities
            if (data.request?.items?.length > 0) {
                const qtys = {};
                data.request.items.forEach(item => {
                    qtys[item.id] = item.quantity;
                });
                setEditableQuantities(qtys);
            }

            // Restore received items
            if (data.request?.items?.some(item => item.receivedQty > 0)) {
                const received = {};
                data.request.items.forEach(item => {
                    received[item.id] = { received: item.receivedQty || 0, serialNumbers: [] };
                });
                setReceivedItems(received);
            }

            // Restore bill/cheque info
            if (data.request?.billUrl) {
                setBillUpload({ name: 'Bill Document' });
            }
            if (data.request?.billNumber) {
                setBillNumber(data.request.billNumber);
            }
            if (data.request?.billDate) {
                setBillDate(new Date(data.request.billDate).toISOString().split('T')[0]);
            }
            // Pre-populate bill amount from approved total
            if (data.request?.approvedTotal && !data.request?.billAmount) {
                setBillAmount(parseFloat(data.request.approvedTotal).toFixed(2));
            } else if (data.request?.billAmount) {
                setBillAmount(parseFloat(data.request.billAmount).toFixed(2));
            }
            if (data.request?.chequeNumber) {
                setChequeNumber(data.request.chequeNumber);
            }
            if (data.request?.chequeUrl) {
                setChequeUpload({ name: 'Cheque Image' });
            }
            if (data.request?.paymentMethod) {
                setPaymentMethod(data.request.paymentMethod);
            }
            if (data.request?.paymentDate) {
                setPaymentDate(new Date(data.request.paymentDate).toISOString().split('T')[0]);
            }

            // Restore PO Number and URL
            if (data.request?.poNumber || data.request?.poUrl) {
                setOrderForm({
                    poNumber: data.request.poNumber || '',
                    poUrl: data.request.poUrl || ''
                });
            }

            // Restore quotation document names
            if (data.request?.quotations?.length > 0) {
                const docs = {};
                data.request.quotations.forEach(q => {
                    if (q.documentUrl) {
                        docs[q.vendor.id] = 'Quotation Document';
                    }
                });
                setVendorQuotationDocs(docs);
            }

            // Use currentStep from server if available, otherwise calculate
            if (data.request?.currentStep) {
                setWorkflowStep(data.request.currentStep);
            } else {
                // Fallback: Calculate and set workflow step based on completed steps
                const calcHighestStep = (r, vIds) => {
                    if (r.status === 'received' || r.status === 'completed') return 9;
                    if (r.billNumber) return 8;
                    if (r.poNumber) return 7;
                    if (r.items?.[0]?.approvedVendorId) return 6;
                    if (r.quotations?.length >= 3) return 5;
                    if (vIds.length >= 3) return 4;
                    if (r.items?.length >= 1) return 3;
                    if ((r.committee?.length || 0) >= 3) return 2;
                    if (r.purchaseLetterUrl || r.letterContent) return 1;
                    return 1;
                };
                const vendorIds = data.request?.quotations?.length > 0
                    ? [...new Set(data.request.quotations.map(q => q.vendor.id))]
                    : [];
                const highestStep = calcHighestStep(data.request, vendorIds);
                setWorkflowStep(highestStep);
            }
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
                        <button onClick={startNewRequest} className="btn btn-primary">
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
                                <button onClick={startNewRequest} className="btn btn-primary mt-4">
                                    <Plus className="w-4 h-4" /> Create First Request
                                </button>
                            </div>
                        ) : (
                            requests.map(req => {
                                // Use currentStep from DB if available, otherwise calculate
                                const getCompletedSteps = (r) => {
                                    // If we have explicit currentStep from DB, use it
                                    if (r.currentStep) {
                                        // If status is completed/received, force 9
                                        if (r.status === 'received' || r.status === 'completed') return 9;
                                        // Don't count step 1 twice (currentStep=1 means 0 completed if brand new, but usually 1 means step 1 in progress/done)
                                        // Actually currentStep represents "Next Step to do" essentially in this workflow logic
                                        // But displayed as "Steps Completed"
                                        return Math.max(1, r.currentStep - 1);
                                    }

                                    // Fallback calculation strictly from data for accuracy
                                    let completed = 0;
                                    if (r.purchaseLetterUrl || r.letterContent) completed++; // Step 1
                                    if ((r.committee?.length || 0) >= 3) completed++; // Step 2
                                    if ((r.items?.length || 0) >= 1) completed++; // Step 3
                                    // Step 4: vendors selected
                                    const uniqueVendors = r.selectedVendorIds?.length > 0
                                        ? r.selectedVendorIds
                                        : [...new Set((r.quotations || []).map(q => q.vendor?.id || q.vendorId))];
                                    if (uniqueVendors.length >= 3) completed++; // Step 4
                                    // Step 5: quotation prices entered
                                    if ((r.quotations?.length || 0) >= 3) completed++; // Step 5
                                    if (r.items?.[0]?.approvedVendorId) completed++; // Step 6: vendor approved
                                    if (r.poNumber) completed++; // Step 7: PO generated
                                    if (r.billNumber) completed++; // Step 8: bill added
                                    if (r.status === 'received' || r.status === 'completed') completed++; // Step 9: received
                                    return Math.min(completed, 9);
                                };
                                const completedSteps = getCompletedSteps(req);
                                const progressPercent = Math.round((completedSteps / 9) * 100);

                                return (
                                    <div key={req.id} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg">{req.title}</h3>
                                                <p className="text-sm text-slate-500 line-clamp-1">{req.purpose || req.description || 'No description'}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                                                {STATUS_LABELS[req.status]}
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                                <span>Step {completedSteps}/9 completed</span>
                                                <span className="font-medium">{progressPercent}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all ${progressPercent === 100 ? 'bg-green-500' : progressPercent >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Stats Row */}
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mb-3">
                                            <span className="flex items-center gap-1">
                                                <Package className="w-3 h-3" /> {req.items?.length || 0} items
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Receipt className="w-3 h-3" /> {req.quotations?.length || 0} quotes
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" /> {req.createdBy?.firstName}
                                            </span>
                                        </div>

                                        {/* Dates */}
                                        <div className="flex items-center justify-between text-xs text-slate-400 border-t pt-2">
                                            <span>Created: {new Date(req.createdAt).toLocaleDateString()}</span>
                                            <span>Updated: {new Date(req.updatedAt).toLocaleDateString()}</span>
                                        </div>

                                        {/* View Button */}
                                        <button
                                            onClick={() => openRequestDetail(req)}
                                            className="btn btn-primary text-sm w-full mt-3"
                                        >
                                            View Details →
                                        </button>
                                    </div>
                                );
                            })
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
                            <div>
                                <label className="label">Address</label>
                                <textarea
                                    value={vendorForm.address}
                                    onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                                    className="input min-h-[80px]"
                                    placeholder="Full address of vendor"
                                />
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="isLocal"
                                    checked={vendorForm.isLocal}
                                    onChange={(e) => setVendorForm({ ...vendorForm, isLocal: e.target.checked })}
                                    className="w-5 h-5 accent-amber-600"
                                />
                                <label htmlFor="isLocal" className="text-amber-800 font-medium cursor-pointer">
                                    Local Vendor (Required for quotation compliance)
                                </label>
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
            {(selectedRequest && requestDetail) || isCreatingNew ? (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    {isCreatingNew ? 'New Procurement Request' : requestDetail?.request?.title}
                                </h2>
                                {!isCreatingNew && (
                                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[requestDetail?.request?.status]}`}>
                                        {STATUS_LABELS[requestDetail?.request?.status]}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {!isCreatingNew && (
                                    <>
                                        <button onClick={openCombinedPdfPreview} className="btn bg-indigo-500 hover:bg-indigo-600 text-white text-sm">
                                            <Eye className="w-4 h-4" /> Preview PDF
                                        </button>
                                        {requestDetail?.comparison?.length > 0 && (
                                            <button onClick={printComparison} className="btn btn-secondary text-sm">
                                                <Printer className="w-4 h-4" /> Print Comparison
                                            </button>
                                        )}
                                    </>
                                )}
                                <button onClick={() => { setSelectedRequest(null); setIsCreatingNew(false); setWorkflowStep(1); }} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            {!isCreatingNew && requestDetail?.request?.purpose && (
                                <p className="text-slate-600 mb-4">{requestDetail.request.purpose}</p>
                            )}

                            {/* Workflow Steps Tabs */}
                            <div className="mb-6">
                                <div className="flex flex-wrap border-b border-slate-200">
                                    {[
                                        { step: 0, label: 'Request Info', icon: ClipboardList, showOnlyNew: true },
                                        { step: 1, label: 'Letter', icon: FileText },
                                        { step: 2, label: 'Committee', icon: Users },
                                        { step: 3, label: 'Items', icon: Package },
                                        { step: 4, label: 'Call Quotations', icon: Building },
                                        { step: 5, label: 'Quotations', icon: Receipt },
                                        { step: 6, label: 'Comparative', icon: Calculator },
                                        { step: 7, label: 'Purchase Order', icon: ClipboardList },
                                        { step: 8, label: 'Bill', icon: CreditCard },
                                        { step: 9, label: 'Received', icon: CheckCircle2 }
                                    ].filter(t => !t.showOnlyNew || isCreatingNew).map(({ step, label, icon: Icon }) => {
                                        const maxAccessible = isCreatingNew ? 0 : getHighestAccessibleStep();
                                        const isAccessible = isCreatingNew ? step === 0 : step <= maxAccessible;
                                        const isComplete = isCreatingNew ? false : (step < maxAccessible || (step === maxAccessible && isStepComplete(step)));
                                        return (
                                            <button
                                                key={step}
                                                onClick={() => isAccessible && setWorkflowStep(step)}
                                                disabled={!isAccessible}
                                                className={`flex items-center gap-1 px-3 py-2 border-b-2 transition-colors text-xs ${workflowStep === step
                                                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                                                    : isComplete
                                                        ? 'border-green-500 text-green-600 hover:bg-green-50'
                                                        : isAccessible
                                                            ? 'border-transparent text-slate-500 hover:text-slate-700'
                                                            : 'border-transparent text-slate-300 cursor-not-allowed'
                                                    }`}
                                            >
                                                {isComplete && step !== workflowStep ? (
                                                    <Check className="w-3 h-3 text-green-500" />
                                                ) : (
                                                    <Icon className="w-3 h-3" />
                                                )}
                                                <span className="font-medium">{isCreatingNew && step === 0 ? '' : `${step}. `}{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Step 0: Request Info (Create New) */}
                            {workflowStep === 0 && isCreatingNew && (
                                <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-indigo-800">
                                        <ClipboardList className="w-5 h-5" /> Create New Procurement Request
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">Enter the basic information for your procurement request.</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="md:col-span-2">
                                            <label className="label">Title *</label>
                                            <input
                                                type="text"
                                                value={requestForm.title}
                                                onChange={e => setRequestForm({ ...requestForm, title: e.target.value })}
                                                className="input"
                                                placeholder="e.g., Computer Lab Hardware Upgrade"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="label">Purpose / Description</label>
                                            <textarea
                                                value={requestForm.purpose}
                                                onChange={e => setRequestForm({ ...requestForm, purpose: e.target.value })}
                                                className="input min-h-[80px]"
                                                placeholder="Reason for procurement..."
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Department</label>
                                            <input
                                                type="text"
                                                value={requestForm.department}
                                                onChange={e => setRequestForm({ ...requestForm, department: e.target.value })}
                                                className="input"
                                                placeholder="e.g., Computer Science"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Budget Code</label>
                                            <input
                                                type="text"
                                                value={requestForm.budgetCode}
                                                onChange={e => setRequestForm({ ...requestForm, budgetCode: e.target.value })}
                                                className="input"
                                                placeholder="e.g., IT-2024-001"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setIsCreatingNew(false); setSelectedRequest(null); }}
                                            className="btn btn-secondary"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCreateRequest}
                                            disabled={!requestForm.title.trim()}
                                            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Create & Continue →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 1: Requirement Letter */}
                            {workflowStep === 1 && (
                                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-800">
                                        <FileText className="w-5 h-5" /> Step 1: Requirement Letter
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">Upload a request letter for new purchase or the letter will be generated with school letterhead.</p>

                                    {requestDetail?.request?.purchaseLetterUrl ? (
                                        <div className="flex items-center gap-3 bg-white p-3 rounded mb-4">
                                            <FileText className="w-5 h-5 text-green-600" />
                                            <span className="flex-1">{requestDetail?.request?.purchaseLetterName || 'Purchase Letter'}</span>
                                            <a href={requestDetail?.request?.purchaseLetterUrl} target="_blank" rel="noreferrer" className="btn btn-secondary text-sm">View</a>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="label">Upload Requirement Letter (PDF/Image)</label>
                                                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="input" onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setLetterUpload(file);
                                                        toast.success(`Selected: ${file.name}`);
                                                    }
                                                }} />
                                                {letterUpload && <div className="text-sm text-green-600 mt-2">✓ {letterUpload.name}</div>}
                                            </div>
                                            <div className="text-center text-slate-500 text-sm">— OR —</div>
                                            <div>
                                                <label className="label">Create Letter Content (will use school letterhead)</label>
                                                <textarea
                                                    className="input min-h-[150px]"
                                                    placeholder="Enter the requirement letter content here. This will be formatted with school letterhead automatically.

Example:
Subject: Request for Purchase of Laboratory Equipment

The undersigned requests approval to purchase the following items for the science laboratory..."
                                                    value={letterContent}
                                                    onChange={e => setLetterContent(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => saveStepData(1)} disabled={!isStepComplete(1)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                                            Save
                                        </button>
                                        <button onClick={() => saveAndNext(1)} disabled={!isStepComplete(1)} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                                            Save & Next →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Committee Formation */}
                            {workflowStep === 2 && (
                                <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-800">
                                        <Users className="w-5 h-5" /> Step 2: Procurement Committee ({requestDetail.request.committee?.length || 0}/5)
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">Add 3-5 committee members. Admin is automatically set as Chairperson.</p>

                                    <div className="space-y-2 mb-3">
                                        {requestDetail.request.committee?.length > 0 ? (
                                            requestDetail.request.committee.map(member => (
                                                <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded border">
                                                    <div>
                                                        <span className="font-medium">{member.user?.firstName} {member.user?.lastName}</span>
                                                        <span className={`ml-2 px-2 py-0.5 text-xs rounded ${member.role === 'chairperson' ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
                                                            {member.role}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => handleRemoveCommitteeMember(member.id)} className="text-red-500 hover:text-red-700">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-slate-500 text-sm italic bg-white p-3 rounded">No committee members added yet.</div>
                                        )}
                                    </div>

                                    {(!requestDetail.request.committee || requestDetail.request.committee.length < 5) && (
                                        <div className="flex gap-2 mb-4">
                                            <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)} className="input flex-1">
                                                <option value="">Select staff member...</option>
                                                {staffList.filter(s => !requestDetail.request.committee?.find(c => c.userId === s.id)).map(s => (
                                                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.role})</option>
                                                ))}
                                            </select>
                                            <select value={committeeRole} onChange={e => setCommitteeRole(e.target.value)} className="input w-36">
                                                <option value="member">Member</option>
                                                <option value="chairperson">Chairperson</option>
                                                <option value="secretary">Secretary</option>
                                            </select>
                                            <button onClick={handleAddCommitteeMember} disabled={!selectedStaffId} className="btn btn-primary">
                                                <UserPlus className="w-4 h-4" /> Add
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button onClick={() => setWorkflowStep(1)} className="btn btn-secondary">← Back</button>
                                        <button onClick={() => saveStepData(2)} disabled={!isStepComplete(2)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                                        <button onClick={() => saveAndNext(2)} disabled={!isStepComplete(2)} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Save & Next →</button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Items & Specifications */}
                            {workflowStep === 3 && (
                                <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-800">
                                        <Package className="w-5 h-5" /> Step 3: Items & Specifications ({requestDetail.request.items?.length || 0} items)
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">Review items to be procured with their specifications.</p>

                                    <div className="space-y-2 mb-4">
                                        {requestDetail.request.items?.map((item, idx) => (
                                            <div key={item.id} className="p-3 bg-white rounded border flex justify-between items-start">
                                                <div>
                                                    <span className="text-slate-400 text-sm mr-2">{idx + 1}.</span>
                                                    <span className="font-medium">{item.itemName}</span>
                                                    {item.specifications && <div className="text-slate-500 text-sm mt-1">Specs: {item.specifications}</div>}
                                                </div>
                                                <div className="text-right text-sm">
                                                    <div>Qty: {item.quantity} {item.unit || 'pcs'}</div>
                                                    {item.estimatedUnitPrice && <div className="text-slate-500">Est: ₹{item.estimatedUnitPrice}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add New Item Form */}
                                    <div className="bg-white p-4 rounded border mb-4">
                                        <h4 className="font-medium mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Add New Item</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="label">Item Name *</label>
                                                <input type="text" className="input" placeholder="e.g., Microscope"
                                                    value={newItemForm.itemName}
                                                    onChange={e => setNewItemForm({ ...newItemForm, itemName: e.target.value })} />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="label">Specifications</label>
                                                <textarea className="input min-h-[80px]" placeholder="e.g., Binocular, 40x-1000x magnification"
                                                    value={newItemForm.specifications}
                                                    onChange={e => setNewItemForm({ ...newItemForm, specifications: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="label">Quantity</label>
                                                <input type="number" className="input" min="1"
                                                    value={newItemForm.quantity}
                                                    onChange={e => setNewItemForm({ ...newItemForm, quantity: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="label">Unit</label>
                                                <select className="input" value={newItemForm.unit} onChange={e => setNewItemForm({ ...newItemForm, unit: e.target.value })}>
                                                    <option value="pcs">Pieces</option>
                                                    <option value="kg">Kilograms</option>
                                                    <option value="liters">Liters</option>
                                                    <option value="boxes">Boxes</option>
                                                    <option value="sets">Sets</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label">Est. Unit Price (₹)</label>
                                                <input type="number" className="input" placeholder="Optional"
                                                    value={newItemForm.estimatedUnitPrice}
                                                    onChange={e => setNewItemForm({ ...newItemForm, estimatedUnitPrice: e.target.value })} />
                                            </div>
                                            <div className="flex items-end">
                                                <button onClick={handleAddNewItem} className="btn btn-primary w-full">
                                                    <Plus className="w-4 h-4" /> Add Item
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => setWorkflowStep(2)} className="btn btn-secondary">← Back</button>
                                        <button onClick={() => saveStepData(3)} disabled={!isStepComplete(3)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                                        <button onClick={() => saveAndNext(3)} disabled={!isStepComplete(3)} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Save & Next →</button>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Vendors & Call Quotation */}
                            {workflowStep === 4 && (
                                <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-purple-800">
                                        <Building className="w-5 h-5" /> Step 4: Select Vendors & Generate Call Quotations
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">
                                        Select vendors to send quotation requests. Min 3 vendors for ₹500-1L, Min 5 for ₹1L-2.5L (1 local required).
                                    </p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                        {vendors.map(vendor => (
                                            <div key={vendor.id} className={`p-3 rounded border cursor-pointer transition-colors ${selectedVendorIds.includes(vendor.id) ? 'bg-purple-100 border-purple-400' : 'bg-white hover:bg-purple-50'}`}
                                                onClick={() => toggleVendorSelection(vendor.id)}>
                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" checked={selectedVendorIds.includes(vendor.id)} onChange={() => { }} className="w-4 h-4" />
                                                    <span className="font-medium">{vendor.name}</span>
                                                    {vendor.isLocal && <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded">Local</span>}
                                                </div>
                                                <div className="text-slate-500 text-sm mt-1">{vendor.address || 'No address'}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between bg-white p-3 rounded border mb-4">
                                        <span className="text-sm">
                                            <strong>{selectedVendorIds.length}</strong> vendors selected
                                            {selectedVendorIds.filter(id => vendors.find(v => v.id === id)?.isLocal).length > 0 &&
                                                <span className="text-green-600 ml-2">({selectedVendorIds.filter(id => vendors.find(v => v.id === id)?.isLocal).length} local)</span>
                                            }
                                        </span>
                                        <button onClick={generateAllCallQuotations} disabled={selectedVendorIds.length === 0} className="btn bg-purple-600 hover:bg-purple-700 text-white">
                                            <Printer className="w-4 h-4" /> Generate Call Quotations
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => setWorkflowStep(3)} className="btn btn-secondary">← Back</button>
                                        <button onClick={() => saveStepData(4)} disabled={!isStepComplete(4)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                                        <button onClick={() => saveAndNext(4)} disabled={!isStepComplete(4)} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Save & Next →</button>
                                    </div>
                                </div>
                            )}

                            {/* Step 5: Quotations Received */}
                            {workflowStep === 5 && (
                                <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-orange-800">
                                        <Receipt className="w-5 h-5" /> Step 5: Vendor Quotations Received
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">Enter prices from quotations received from each vendor for comparison.</p>

                                    {selectedVendorIds.length === 0 ? (
                                        <div className="text-slate-500 italic">No vendors selected. Go back to Step 4 to select vendors.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {selectedVendorIds.map(vendorId => {
                                                const vendor = vendors.find(v => v.id === vendorId);
                                                return (
                                                    <div key={vendorId} className="bg-white p-4 rounded border">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="font-medium flex items-center gap-2">
                                                                {vendor?.name}
                                                                {vendor?.isLocal && <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded">Local</span>}
                                                            </h4>
                                                            <div className="flex items-center gap-2">
                                                                <label className="flex items-center gap-2 text-sm">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4"
                                                                        checked={vendorGstSettings[vendorId]?.addGst !== false}
                                                                        onChange={e => setVendorGstSettings(prev => ({
                                                                            ...prev,
                                                                            [vendorId]: { ...prev[vendorId], addGst: e.target.checked, gstRate: prev[vendorId]?.gstRate || 18 }
                                                                        }))}
                                                                    />
                                                                    Add GST @
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    className="input w-16 text-sm"
                                                                    value={vendorGstSettings[vendorId]?.gstRate ?? 18}
                                                                    onChange={e => setVendorGstSettings(prev => ({
                                                                        ...prev,
                                                                        [vendorId]: { ...prev[vendorId], gstRate: parseFloat(e.target.value) || 0 }
                                                                    }))}
                                                                />
                                                                <span className="text-sm">%</span>
                                                            </div>
                                                        </div>

                                                        {/* Quotation Upload */}
                                                        <div className="mb-3 p-2 bg-slate-50 rounded">
                                                            <label className="label text-xs">Upload Quotation Copy</label>
                                                            <input
                                                                type="file"
                                                                className="input text-sm"
                                                                accept=".pdf,.jpg,.jpeg,.png"
                                                                onChange={e => {
                                                                    const file = e.target.files[0];
                                                                    if (file) {
                                                                        setVendorQuotationDocs(prev => ({ ...prev, [vendorId]: file.name }));
                                                                        toast.success(`Quotation uploaded: ${file.name}`);
                                                                    }
                                                                }}
                                                            />
                                                            {vendorQuotationDocs[vendorId] && (
                                                                <div className="text-xs text-green-600 mt-1">✓ {vendorQuotationDocs[vendorId]}</div>
                                                            )}
                                                        </div>

                                                        <div className="space-y-2">
                                                            {requestDetail.request.items?.map(item => (
                                                                <div key={item.id} className="flex items-center gap-3">
                                                                    <span className="flex-1 text-sm">{item.itemName} (Qty: {item.quantity})</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-sm text-slate-500">₹</span>
                                                                        <input
                                                                            type="number"
                                                                            className="input w-28 text-sm"
                                                                            placeholder="Unit Price"
                                                                            value={vendorQuotationPrices[vendorId]?.[item.id] || ''}
                                                                            onChange={e => {
                                                                                setVendorQuotationPrices(prev => ({
                                                                                    ...prev,
                                                                                    [vendorId]: { ...prev[vendorId], [item.id]: e.target.value }
                                                                                }));
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-3 pt-3 border-t">
                                                            <div className="flex justify-between text-sm">
                                                                <span>Subtotal:</span>
                                                                <span>₹{calculateVendorTotal(vendorId, false).toLocaleString()}</span>
                                                            </div>
                                                            {(vendorGstSettings[vendorId]?.addGst !== false) && (
                                                                <div className="flex justify-between text-sm text-slate-600">
                                                                    <span>GST ({vendorGstSettings[vendorId]?.gstRate ?? 18}%):</span>
                                                                    <span>₹{(calculateVendorTotal(vendorId, false) * (vendorGstSettings[vendorId]?.gstRate ?? 18) / 100).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between font-semibold text-lg mt-1">
                                                                <span>Total:</span>
                                                                <span>₹{calculateVendorTotal(vendorId).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => setWorkflowStep(4)} className="btn btn-secondary">← Back</button>
                                        <button onClick={() => saveStepData(5)} disabled={!isStepComplete(5)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                                        <button onClick={() => saveAndNext(5)} disabled={!isStepComplete(5)} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Save & Next →</button>
                                    </div>
                                </div>
                            )}

                            {/* Step 6: Comparative Statement */}
                            {workflowStep === 6 && (
                                <div className="mb-6 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-cyan-800">
                                        <Calculator className="w-5 h-5" /> Step 6: Comparative Statement
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">Compare prices from all vendors. Lowest total is auto-selected.</p>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100">
                                                    <th className="border p-2 text-left">S.No</th>
                                                    <th className="border p-2 text-left">Item</th>
                                                    <th className="border p-2 text-center">Qty</th>
                                                    {selectedVendorIds.map(vid => {
                                                        const v = vendors.find(v => v.id === vid);
                                                        const { vendorId: lowestId } = getLowestVendor();
                                                        return (
                                                            <th key={vid} className={`border p-2 text-center ${vid === lowestId ? 'bg-green-100' : ''}`}>
                                                                {v?.name} {vid === lowestId && '✓'}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {requestDetail?.request?.items?.map((item, idx) => (
                                                    <tr key={item.id}>
                                                        <td className="border p-2">{idx + 1}</td>
                                                        <td className="border p-2">{item.itemName}</td>
                                                        <td className="border p-2 text-center">{item.quantity}</td>
                                                        {selectedVendorIds.map(vid => {
                                                            const price = parseFloat(vendorQuotationPrices[vid]?.[item.id]) || 0;
                                                            return (
                                                                <td key={vid} className="border p-2 text-right">
                                                                    {price > 0 ? `₹${(price * item.quantity).toLocaleString()}` : '-'}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                <tr className="font-bold bg-slate-50">
                                                    <td colSpan={3} className="border p-2 text-right">TOTAL:</td>
                                                    {selectedVendorIds.map(vid => {
                                                        const total = calculateVendorTotal(vid);
                                                        const { vendorId: lowestId } = getLowestVendor();
                                                        return (
                                                            <td key={vid} className={`border p-2 text-right ${vid === lowestId ? 'bg-green-200 text-green-800' : ''}`}>
                                                                ₹{total.toLocaleString()}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {(() => {
                                        const { vendorId, total } = getLowestVendor();
                                        const selectedVendor = vendors.find(v => v.id === vendorId);
                                        if (selectedVendor) {
                                            return (
                                                <div className="mt-4 p-4 bg-green-100 rounded border border-green-300">
                                                    <p className="font-semibold text-green-800">
                                                        ✓ Selected Vendor: <span className="text-lg">{selectedVendor.name}</span>
                                                    </p>
                                                    <p className="text-green-700 text-sm mt-1">
                                                        Reason: Lowest quotation amount of ₹{total.toLocaleString()}
                                                    </p>
                                                    <button
                                                        onClick={() => setSelectedVendorForPurchase(vendorId)}
                                                        className="btn bg-green-600 hover:bg-green-700 text-white mt-3"
                                                    >
                                                        <Check className="w-4 h-4" /> Confirm Selection
                                                    </button>
                                                </div>
                                            );
                                        }
                                        return <div className="text-slate-500 italic mt-4">Enter prices in Step 5 to see comparison.</div>;
                                    })()}

                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => setWorkflowStep(5)} className="btn btn-secondary">← Back</button>
                                        <button onClick={() => saveStepData(6)} disabled={!isStepComplete(6)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                                        <button onClick={() => saveAndNext(6)} disabled={!isStepComplete(6)} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Save & Next →</button>
                                    </div>
                                </div>
                            )}

                            {/* Step 7: Purchase Order */}
                            {workflowStep === 7 && (
                                <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-800">
                                        <ClipboardList className="w-5 h-5" /> Step 7: Purchase Order
                                    </h3>

                                    {!selectedVendorForPurchase ? (
                                        <div className="text-slate-500 italic">Please select a vendor in Step 6 first.</div>
                                    ) : (() => {
                                        const vendor = vendors.find(v => v.id === selectedVendorForPurchase);

                                        // Calculate total with editable quantities
                                        const calculatePOTotal = () => {
                                            return requestDetail?.request?.items?.reduce((sum, item) => {
                                                const price = parseFloat(vendorQuotationPrices[selectedVendorForPurchase]?.[item.id]) || 0;
                                                const qty = editableQuantities[item.id] ?? item.quantity;
                                                return sum + (price * qty);
                                            }, 0) || 0;
                                        };
                                        const grandTotal = calculatePOTotal();

                                        return (
                                            <div className="space-y-4">
                                                <div className="bg-white p-4 rounded border">
                                                    <h4 className="font-medium mb-2">Vendor: {vendor?.name}</h4>
                                                    <p className="text-slate-600 text-sm">{vendor?.address}</p>
                                                </div>

                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-100">
                                                            <th className="border p-2">S.No</th>
                                                            <th className="border p-2 text-left">Item</th>
                                                            <th className="border p-2">Qty</th>
                                                            <th className="border p-2">Unit Price</th>
                                                            <th className="border p-2">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {requestDetail?.request?.items?.map((item, idx) => {
                                                            const price = parseFloat(vendorQuotationPrices[selectedVendorForPurchase]?.[item.id]) || 0;
                                                            const qty = editableQuantities[item.id] ?? item.quantity;
                                                            return (
                                                                <tr key={item.id}>
                                                                    <td className="border p-2 text-center">{idx + 1}</td>
                                                                    <td className="border p-2">{item.itemName}</td>
                                                                    <td className="border p-2 text-center">
                                                                        <input
                                                                            type="number"
                                                                            className="input w-20 text-sm text-center"
                                                                            min="1"
                                                                            value={qty}
                                                                            onChange={e => setEditableQuantities(prev => ({
                                                                                ...prev,
                                                                                [item.id]: parseInt(e.target.value) || 1
                                                                            }))}
                                                                        />
                                                                        <span className="text-xs text-slate-500 ml-1">{item.unit || 'pcs'}</span>
                                                                    </td>
                                                                    <td className="border p-2 text-right">₹{price.toLocaleString()}</td>
                                                                    <td className="border p-2 text-right">₹{(price * qty).toLocaleString()}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                        <tr className="bg-slate-50">
                                                            <td colSpan={4} className="border p-2 text-right font-medium">Subtotal:</td>
                                                            <td className="border p-2 text-right font-medium">₹{grandTotal.toLocaleString()}</td>
                                                        </tr>
                                                        {(vendorGstSettings[selectedVendorForPurchase]?.addGst !== false) && (() => {
                                                            const gstRate = vendorGstSettings[selectedVendorForPurchase]?.gstRate ?? 18;
                                                            const gstAmount = grandTotal * gstRate / 100;
                                                            const grandTotalWithGst = grandTotal + gstAmount;
                                                            return (
                                                                <>
                                                                    <tr className="bg-slate-50">
                                                                        <td colSpan={4} className="border p-2 text-right text-slate-600">GST ({gstRate}%):</td>
                                                                        <td className="border p-2 text-right text-slate-600">₹{gstAmount.toLocaleString()}</td>
                                                                    </tr>
                                                                    <tr className="bg-green-100 font-bold">
                                                                        <td colSpan={4} className="border p-2 text-right text-lg">Grand Total (Incl. GST):</td>
                                                                        <td className="border p-2 text-right text-lg">₹{grandTotalWithGst.toLocaleString()}</td>
                                                                    </tr>
                                                                </>
                                                            );
                                                        })()}
                                                        {vendorGstSettings[selectedVendorForPurchase]?.addGst === false && (
                                                            <tr className="bg-green-100 font-bold">
                                                                <td colSpan={4} className="border p-2 text-right text-lg">Grand Total:</td>
                                                                <td className="border p-2 text-right text-lg">₹{grandTotal.toLocaleString()}</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>

                                                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                                    <strong>Amount in Words:</strong> Rupees {numberToWords(Math.round(
                                                        vendorGstSettings[selectedVendorForPurchase]?.addGst !== false
                                                            ? grandTotal + (grandTotal * (vendorGstSettings[selectedVendorForPurchase]?.gstRate ?? 18) / 100)
                                                            : grandTotal
                                                    ))} Only
                                                </div>

                                                {/* PO Number and Document */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                    <div className="bg-white p-4 rounded border">
                                                        <label className="label">PO Number</label>
                                                        <input
                                                            type="text"
                                                            className="input w-full"
                                                            placeholder="Enter PO Number (e.g., PO-2024-001)"
                                                            value={orderForm.poNumber}
                                                            onChange={e => setOrderForm({ ...orderForm, poNumber: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="bg-white p-4 rounded border">
                                                        <label className="label">Upload PO Document</label>
                                                        <input
                                                            type="file"
                                                            className="input w-full"
                                                            accept=".pdf,.jpg,.jpeg,.png"
                                                            onChange={async (e) => {
                                                                const file = e.target.files[0];
                                                                if (file && selectedRequest?.id) {
                                                                    try {
                                                                        await uploadAPI.uploadProcurementDoc(selectedRequest.id, 'po', file);
                                                                        setOrderForm({ ...orderForm, poUrl: file.name });
                                                                        toast.success('PO document uploaded');
                                                                    } catch (err) {
                                                                        toast.error('Upload failed');
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        {(orderForm.poUrl || requestDetail?.request?.poUrl) && (
                                                            <div className="text-sm text-green-600 mt-2">✓ PO Document uploaded</div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex justify-end mt-4">
                                                    <div className="bg-white p-4 rounded border w-80">
                                                        <h4 className="font-medium mb-3 text-center">Committee Signatures</h4>
                                                        <div className="space-y-4">
                                                            {requestDetail?.request?.committee?.map(m => (
                                                                <div key={m.id} className="text-center border-b pb-3">
                                                                    <div className="h-10 border-b border-dashed border-slate-400 mb-1" />
                                                                    <div className="font-medium">{m.user?.firstName} {m.user?.lastName}</div>
                                                                    <div className="text-xs text-slate-500">{m.role}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => setWorkflowStep(6)} className="btn btn-secondary">← Back</button>
                                        <button onClick={() => saveStepData(7)} disabled={!isStepComplete(7)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                                        <button onClick={() => { if (validateStep(7)) openCombinedPdfPreview(); }} disabled={!isStepComplete(7)} className="btn bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                                            <Printer className="w-4 h-4" /> Generate PO PDF
                                        </button>
                                        <button onClick={() => saveAndNext(7)} disabled={!isStepComplete(7)} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Save & Next →</button>
                                    </div>
                                </div>
                            )}

                            {/* Step 8: Bill Received */}
                            {workflowStep === 8 && (
                                <div className="mb-6 p-4 bg-rose-50 rounded-lg border border-rose-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-rose-800">
                                        <CreditCard className="w-5 h-5" /> Step 8: Bill & Payment
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">Upload the vendor bill and payment cheque for records.</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="bg-white p-4 rounded border">
                                            <label className="label">Upload Bill/Invoice *</label>
                                            <input
                                                type="file"
                                                className="input"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setBillUpload(file);
                                                        toast.success(`Bill selected: ${file.name}`);
                                                    }
                                                }}
                                            />
                                            {billUpload && <div className="text-sm text-green-600 mt-2">✓ {billUpload.name || billUpload}</div>}
                                        </div>

                                        <div className="bg-white p-4 rounded border">
                                            <label className="label">Upload Cheque Image (for auto-extraction)</label>
                                            <input
                                                type="file"
                                                className="input"
                                                accept=".jpg,.jpeg,.png"
                                                onChange={e => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setChequeUpload(file);
                                                        // Simulate OCR extraction (placeholder)
                                                        setTimeout(() => {
                                                            const mockChequeNo = Math.floor(100000 + Math.random() * 900000).toString();
                                                            setChequeNumber(mockChequeNo);
                                                            toast.success(`Cheque number extracted: ${mockChequeNo}`);
                                                        }, 1000);
                                                    }
                                                }}
                                            />
                                            {chequeUpload && <div className="text-sm text-green-600 mt-2">✓ {chequeUpload.name || chequeUpload}</div>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="bg-white p-4 rounded border">
                                            <label className="label">Bill Number / Invoice No.</label>
                                            <input
                                                type="text"
                                                className="input mb-3"
                                                placeholder="Enter Bill Number"
                                                value={billNumber}
                                                onChange={e => setBillNumber(e.target.value)}
                                            />
                                            <label className="label">Bill Date</label>
                                            <input
                                                type="date"
                                                className="input mb-3"
                                                value={billDate}
                                                onChange={e => setBillDate(e.target.value)}
                                            />
                                            <label className="label">Bill Amount (₹)</label>
                                            <input
                                                type="number"
                                                className="input"
                                                placeholder="0.00"
                                                value={billAmount}
                                                onChange={e => setBillAmount(e.target.value)}
                                            />
                                        </div>
                                        <div className="bg-white p-4 rounded border">
                                            <label className="label">Payment Method</label>
                                            <select
                                                className="input mb-3"
                                                value={paymentMethod}
                                                onChange={e => setPaymentMethod(e.target.value)}
                                            >
                                                <option value="cheque">Cheque</option>
                                                <option value="upi">UPI</option>
                                                <option value="neft">NEFT/RTGS</option>
                                                <option value="cash">Cash</option>
                                            </select>

                                            <label className="label">Cheque/Ref Number</label>
                                            <input
                                                type="text"
                                                className="input mb-3"
                                                placeholder="Cheque No. or Transaction Ref"
                                                value={chequeNumber}
                                                onChange={e => setChequeNumber(e.target.value)}
                                            />

                                            <label className="label">Payment Date</label>
                                            <input
                                                type="date"
                                                className="input"
                                                value={paymentDate}
                                                onChange={e => setPaymentDate(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded border mb-4">
                                        <p className="text-xs text-slate-500 mt-1">Ensure all bill and payment details are accurate.</p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => setWorkflowStep(7)} className="btn btn-secondary">← Back</button>
                                        <button onClick={() => saveStepData(8)} disabled={!isStepComplete(8)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                                        <button onClick={() => saveAndNext(8)} disabled={!isStepComplete(8)} className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Save & Next →</button>
                                    </div>
                                </div>
                            )}

                            {/* Step 9: Items Received */}
                            {workflowStep === 9 && (
                                <div className="mb-6 p-4 bg-teal-50 rounded-lg border border-teal-200">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-teal-800">
                                        <CheckCircle2 className="w-5 h-5" /> Step 9: Items Received & Inventory Update
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">Verify received items, scan barcodes for serial numbers, and update inventory.</p>

                                    <div className="space-y-3 mb-4">
                                        {requestDetail?.request?.items?.map((item, idx) => {
                                            const expected = editableQuantities[item.id] ?? item.quantity;
                                            const received = receivedItems[item.id]?.received ?? 0;
                                            const serials = receivedItems[item.id]?.serialNumbers || [];

                                            return (
                                                <div key={item.id} className="bg-white p-4 rounded border">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div>
                                                            <span className="text-slate-400 text-sm mr-2">{idx + 1}.</span>
                                                            <span className="font-medium">{item.itemName}</span>
                                                            <span className="text-slate-500 text-sm ml-2">(Expected: {expected})</span>
                                                        </div>
                                                        <div className={`px-3 py-1 rounded text-sm font-medium ${received >= expected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                            {received}/{expected} Received
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 mb-3">
                                                        <label className="text-sm">Received Qty:</label>
                                                        <input
                                                            type="number"
                                                            className="input w-24"
                                                            min="0"
                                                            max={expected}
                                                            value={received}
                                                            onChange={e => setReceivedItems(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], received: parseInt(e.target.value) || 0 }
                                                            }))}
                                                        />
                                                        <button
                                                            onClick={() => setReceivedItems(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...prev[item.id], received: expected }
                                                            }))}
                                                            className="btn btn-secondary text-sm"
                                                        >
                                                            Mark All Received
                                                        </button>
                                                    </div>

                                                    <div className="bg-slate-50 p-3 rounded">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <ScanLine className="w-4 h-4 text-slate-600" />
                                                            <span className="text-sm font-medium">Serial Numbers (Barcode Scan)</span>
                                                        </div>
                                                        <div className="flex gap-2 mb-2">
                                                            <input
                                                                type="text"
                                                                className="input flex-1"
                                                                placeholder="Scan barcode or enter serial number"
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                                                        setReceivedItems(prev => ({
                                                                            ...prev,
                                                                            [item.id]: {
                                                                                ...prev[item.id],
                                                                                serialNumbers: [...(prev[item.id]?.serialNumbers || []), e.target.value.trim()]
                                                                            }
                                                                        }));
                                                                        e.target.value = '';
                                                                        toast.success('Serial number added');
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        {serials.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {serials.map((sn, i) => (
                                                                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">{sn}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="bg-green-100 p-4 rounded border border-green-300 mb-4">
                                        <h4 className="font-medium text-green-800 mb-2">Update Inventory</h4>
                                        <p className="text-green-700 text-sm mb-3">Click below to add received items to the inventory system with serial numbers.</p>
                                        <button
                                            onClick={() => {
                                                if (validateStep(9)) {
                                                    toast.success('Items added to inventory successfully!');
                                                }
                                            }}
                                            className="btn bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            <Package className="w-4 h-4" /> Update Inventory
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => setWorkflowStep(8)} className="btn btn-secondary">← Back</button>
                                        <button onClick={() => saveStepData(9)} disabled={!isStepComplete(9)} className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
                                        <button
                                            onClick={async () => {
                                                if (validateStep(9)) {
                                                    await saveStepData(9);
                                                    toast.success('Procurement workflow completed!');
                                                }
                                            }}
                                            disabled={!isStepComplete(9)}
                                            className="btn bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Check className="w-4 h-4" /> Complete Procurement
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div >
            ) : null
            }

            {/* Add Quotation Modal */}
            {
                showQuotationModal && (
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
                )
            }
        </div >
    );
}
