'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRightLeft, ArrowLeft, Check, X, Clock, CheckCircle, XCircle, Package, Filter, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { labsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
    pending: { label: 'Pending', color: 'amber', icon: Clock },
    approved: { label: 'Approved', color: 'blue', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'red', icon: XCircle },
    completed: { label: 'Completed', color: 'emerald', icon: Package }
};

export default function ShiftRequestsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [actionLoading, setActionLoading] = useState(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [notesModal, setNotesModal] = useState({ open: false, request: null, action: '' });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (!['admin', 'principal', 'lab_assistant'].includes(user?.role)) {
            router.push('/dashboard'); return;
        }
        loadRequests();
    }, [isAuthenticated, _hasHydrated, statusFilter]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const params = statusFilter ? { status: statusFilter } : {};
            const res = await labsAPI.getShiftRequests(params);
            setRequests(res.data.data.shiftRequests || []);
        } catch (error) {
            toast.error('Failed to load shift requests');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (request) => {
        setNotesModal({ open: true, request, action: 'approve' });
    };

    const handleReject = async (request) => {
        setNotesModal({ open: true, request, action: 'reject' });
    };

    const confirmAction = async () => {
        const { request, action } = notesModal;
        setActionLoading(request.id);
        try {
            if (action === 'approve') {
                await labsAPI.approveShiftRequest(request.id, adminNotes);
                toast.success('Request approved');
            } else {
                await labsAPI.rejectShiftRequest(request.id, adminNotes);
                toast.success('Request rejected');
            }
            setNotesModal({ open: false, request: null, action: '' });
            setAdminNotes('');
            loadRequests();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    const handleComplete = async (request) => {
        setActionLoading(request.id);
        try {
            await labsAPI.completeShiftRequest(request.id);
            toast.success(`${request.item.itemNumber} moved successfully`);
            loadRequests();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to complete transfer');
        } finally {
            setActionLoading(null);
        }
    };

    const isAdmin = ['admin', 'principal'].includes(user?.role);

    if (loading && requests.length === 0) {
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
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-slate-900">Equipment Shift Requests</h1>
                                <p className="text-sm text-slate-500">Manage equipment transfer requests between labs</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={loadRequests} className="btn btn-secondary">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Status Filter Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <button
                        onClick={() => setStatusFilter('')}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${!statusFilter ? 'bg-primary-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                    >
                        All Requests
                    </button>
                    {Object.entries(STATUS_CONFIG).map(([status, { label, color, icon: Icon }]) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap ${statusFilter === status ? `bg-${color}-500 text-white` : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                        >
                            <Icon className="w-4 h-4" /> {label}
                        </button>
                    ))}
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {Object.entries(STATUS_CONFIG).map(([status, { label, color, icon: Icon }]) => {
                        const count = requests.filter(r => r.status === status).length;
                        return (
                            <div key={status} className={`card p-4 border-l-4 border-${color}-500`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">{count}</p>
                                        <p className="text-sm text-slate-500">{label}</p>
                                    </div>
                                    <Icon className={`w-8 h-8 text-${color}-500`} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {requests.length === 0 ? (
                    <div className="card p-12 text-center">
                        <ArrowRightLeft className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No Shift Requests</h3>
                        <p className="text-slate-500">Equipment shift requests will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((request) => {
                            const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
                            const StatusIcon = statusConfig.icon;
                            return (
                                <div key={request.id} className="card p-6">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        {/* Item Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-${statusConfig.color}-100 text-${statusConfig.color}-700`}>
                                                    <StatusIcon className="w-3 h-3" /> {statusConfig.label}
                                                </span>
                                                <span className="text-sm text-slate-500">
                                                    {new Date(request.requestedAt).toLocaleDateString()} at {new Date(request.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                                {request.item?.itemNumber}
                                                <span className="text-sm font-normal text-slate-500 ml-2">
                                                    ({request.item?.brand} {request.item?.modelNo})
                                                </span>
                                            </h3>
                                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                                                <span className="font-medium">{request.fromLab?.name}</span>
                                                <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                                                <span className="font-medium">{request.toLab?.name}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-2">
                                                <strong>Reason:</strong> {request.reason}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Requested by: {request.requestedBy?.firstName} {request.requestedBy?.lastName}
                                            </p>
                                            {request.approvedBy && (
                                                <p className="text-xs text-slate-500">
                                                    {request.status === 'rejected' ? 'Rejected' : 'Approved'} by: {request.approvedBy?.firstName} {request.approvedBy?.lastName}
                                                </p>
                                            )}
                                            {request.adminNotes && (
                                                <p className="text-xs text-slate-500 mt-1">
                                                    <strong>Notes:</strong> {request.adminNotes}
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 flex-shrink-0">
                                            {request.status === 'pending' && isAdmin && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(request)}
                                                        disabled={actionLoading === request.id}
                                                        className="btn bg-emerald-500 hover:bg-emerald-600 text-white"
                                                    >
                                                        <Check className="w-4 h-4" /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(request)}
                                                        disabled={actionLoading === request.id}
                                                        className="btn bg-red-500 hover:bg-red-600 text-white"
                                                    >
                                                        <X className="w-4 h-4" /> Reject
                                                    </button>
                                                </>
                                            )}
                                            {request.status === 'approved' && (
                                                <button
                                                    onClick={() => handleComplete(request)}
                                                    disabled={actionLoading === request.id}
                                                    className="btn btn-primary"
                                                >
                                                    {actionLoading === request.id ? 'Moving...' : (
                                                        <><Package className="w-4 h-4" /> Complete Transfer</>
                                                    )}
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

            {/* Admin Notes Modal */}
            {notesModal.open && notesModal.request && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900">
                                {notesModal.action === 'approve' ? 'Approve' : 'Reject'} Shift Request
                            </h3>
                            <p className="text-sm text-slate-500">
                                {notesModal.request.item?.itemNumber}: {notesModal.request.fromLab?.name} → {notesModal.request.toLab?.name}
                            </p>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Admin Notes (Optional)
                            </label>
                            <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                className="input min-h-[80px]"
                                placeholder={notesModal.action === 'reject' ? 'Reason for rejection...' : 'Any notes for the requester...'}
                            />
                        </div>
                        <div className="p-6 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => { setNotesModal({ open: false, request: null, action: '' }); setAdminNotes(''); }}
                                className="btn btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAction}
                                disabled={actionLoading === notesModal.request?.id}
                                className={`btn flex-1 ${notesModal.action === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                            >
                                {actionLoading ? 'Processing...' : (notesModal.action === 'approve' ? 'Approve Request' : 'Reject Request')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
