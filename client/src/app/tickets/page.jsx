'use client';
import { useState, useEffect } from 'react';
import { ticketsAPI, labsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from 'react-hot-toast';
import {
    Ticket, Plus, Filter, Search, Clock, CheckCircle2, AlertCircle,
    MessageSquare, User, Monitor, Building2, ChevronRight, X, Send
} from 'lucide-react';

const statusColors = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-slate-100 text-slate-600'
};

const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700'
};

const categoryLabels = {
    hardware_issue: '🔧 Hardware Issue',
    software_issue: '💻 Software Issue',
    maintenance_request: '🛠️ Maintenance Request',
    general_complaint: '📝 General Complaint',
    other: '📋 Other'
};

export default function TicketsPage() {
    const { user } = useAuthStore();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [labs, setLabs] = useState([]);
    const [issueTypes, setIssueTypes] = useState({});
    const [labItems, setLabItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [myTicketsOnly, setMyTicketsOnly] = useState(false);

    // Create form
    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'hardware_issue',
        priority: 'medium',
        labId: '',
        itemId: '',
        issueTypeId: ''
    });

    useEffect(() => {
        loadTickets();
        loadLabs();
        loadIssueTypes();
    }, [statusFilter, priorityFilter, myTicketsOnly]);

    // Load items when lab changes (for hardware/software issues)
    useEffect(() => {
        if (form.labId && (form.category === 'hardware_issue' || form.category === 'software_issue')) {
            loadLabItems(form.labId);
        } else {
            setLabItems([]);
        }
    }, [form.labId, form.category]);

    const loadTickets = async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (priorityFilter) params.priority = priorityFilter;
            if (myTicketsOnly) params.myTickets = 'true';

            const res = await ticketsAPI.getAll(params);
            setTickets(res.data.data.tickets || []);
        } catch (error) {
            toast.error('Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    const loadLabs = async () => {
        try {
            const res = await labsAPI.getAll();
            setLabs(res.data.data.labs || []);
        } catch { }
    };

    const loadIssueTypes = async () => {
        try {
            const res = await ticketsAPI.getIssueTypes();
            setIssueTypes(res.data.data.byCategory || {});
        } catch { }
    };

    const loadLabItems = async (labId) => {
        setItemsLoading(true);
        try {
            const res = await labsAPI.getItems(labId);
            const allItems = res.data.data.items || [];
            // Filter out furniture items for H/W and S/W tickets - only show IT equipment
            const furnitureTypes = ['chair', 'table', 'desk', 'furniture', 'bench'];
            const filteredItems = allItems.filter(item =>
                !furnitureTypes.some(type => item.itemType?.toLowerCase().includes(type))
            );
            setLabItems(filteredItems);
        } catch { }
        setItemsLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.description.trim()) {
            toast.error('Title and description are required');
            return;
        }

        try {
            const data = {
                title: form.title,
                description: form.description,
                category: form.category,
                priority: form.priority
            };
            if (form.labId) data.labId = form.labId;
            if (form.itemId) data.itemId = form.itemId;
            if (form.issueTypeId) data.issueTypeId = form.issueTypeId;

            const res = await ticketsAPI.create(data);
            toast.success(`Ticket ${res.data.data.ticket.ticketNumber} created!`);
            setShowCreateModal(false);
            setForm({ title: '', description: '', category: 'hardware_issue', priority: 'medium', labId: '', itemId: '', issueTypeId: '' });
            loadTickets();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create ticket');
        }
    };

    const openDetail = async (ticket) => {
        setSelectedTicket(ticket);
        setShowDetailModal(true);
        setDetailLoading(true);
        try {
            const res = await ticketsAPI.getById(ticket.id);
            setSelectedTicket(res.data.data.ticket);
        } catch (error) {
            toast.error('Failed to load ticket details');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            await ticketsAPI.addComment(selectedTicket.id, newComment);
            toast.success('Comment added');
            setNewComment('');
            // Reload ticket detail
            const res = await ticketsAPI.getById(selectedTicket.id);
            setSelectedTicket(res.data.data.ticket);
        } catch (error) {
            toast.error('Failed to add comment');
        }
    };

    const handleStatusChange = async (ticketId, newStatus) => {
        try {
            if (newStatus === 'resolved') {
                await ticketsAPI.resolve(ticketId, '');
            } else if (newStatus === 'closed') {
                await ticketsAPI.close(ticketId);
            } else {
                await ticketsAPI.update(ticketId, { status: newStatus });
            }
            toast.success('Status updated');
            loadTickets();
            if (selectedTicket?.id === ticketId) {
                const res = await ticketsAPI.getById(ticketId);
                setSelectedTicket(res.data.data.ticket);
            }
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const filteredTickets = tickets.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isAdmin = ['admin', 'principal', 'lab_assistant'].includes(user?.role);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                            <Ticket className="text-purple-600" />
                            Support Tickets
                        </h1>
                        <p className="text-slate-500 mt-1">Report issues, request maintenance, or submit complaints</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                        <Plus size={18} />
                        Create Ticket
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search tickets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="all">All Status</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="">All Priority</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={myTicketsOnly}
                                onChange={(e) => setMyTicketsOnly(e.target.checked)}
                                className="w-4 h-4 rounded text-purple-600"
                            />
                            <span className="text-sm text-slate-600">My tickets only</span>
                        </label>
                    </div>
                </div>

                {/* Tickets List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                        <p className="mt-2 text-slate-500">Loading tickets...</p>
                    </div>
                ) : filteredTickets.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                        <Ticket className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No tickets found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredTickets.map((ticket) => (
                            <div
                                key={ticket.id}
                                onClick={() => openDetail(ticket)}
                                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition cursor-pointer"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-mono text-slate-400">{ticket.ticketNumber}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[ticket.status]}`}>
                                                {ticket.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[ticket.priority]}`}>
                                                {ticket.priority.toUpperCase()}
                                            </span>
                                        </div>
                                        <h3 className="font-semibold text-slate-800 mb-1">{ticket.title}</h3>
                                        <p className="text-sm text-slate-500 line-clamp-1">{ticket.description}</p>
                                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <User size={14} />
                                                {ticket.createdBy?.firstName} {ticket.createdBy?.lastName}
                                            </span>
                                            {ticket.lab && (
                                                <span className="flex items-center gap-1">
                                                    <Building2 size={14} />
                                                    {ticket.lab.name}
                                                </span>
                                            )}
                                            {ticket.item && (
                                                <span className="flex items-center gap-1">
                                                    <Monitor size={14} />
                                                    {ticket.item.itemNumber}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            </span>
                                            {ticket._count?.comments > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <MessageSquare size={14} />
                                                    {ticket._count.comments}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="text-slate-400" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Ticket Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-xl font-bold">Create New Ticket</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="Brief summary of the issue"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Detailed description of the issue..."
                                    rows={3}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>

                            {/* Category and Priority */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                                    <select
                                        value={form.category}
                                        onChange={(e) => setForm({ ...form, category: e.target.value, issueTypeId: '', itemId: '' })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="hardware_issue">🔧 Hardware Issue</option>
                                        <option value="software_issue">💻 Software Issue</option>
                                        <option value="maintenance_request">🛠️ Maintenance Request</option>
                                        <option value="general_complaint">📝 General Complaint</option>
                                        <option value="other">📋 Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                                    <select
                                        value={form.priority}
                                        onChange={(e) => setForm({ ...form, priority: e.target.value })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>

                            {/* Issue Type - Dynamic based on category */}
                            {issueTypes[form.category]?.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Issue Type *</label>
                                    <select
                                        value={form.issueTypeId}
                                        onChange={(e) => {
                                            const selected = issueTypes[form.category]?.find(t => t.id === e.target.value);
                                            setForm({
                                                ...form,
                                                issueTypeId: e.target.value,
                                                title: selected ? selected.name : form.title
                                            });
                                        }}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="">Select issue type...</option>
                                        {issueTypes[form.category]?.map(type => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Lab Selection - for hardware/software issues */}
                            {(form.category === 'hardware_issue' || form.category === 'software_issue' || form.category === 'maintenance_request') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Lab {(form.category === 'hardware_issue' || form.category === 'software_issue') ? '*' : '(Optional)'}
                                    </label>
                                    <select
                                        value={form.labId}
                                        onChange={(e) => setForm({ ...form, labId: e.target.value, itemId: '' })}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="">Select a lab...</option>
                                        {labs.map(lab => (
                                            <option key={lab.id} value={lab.id}>{lab.name} {lab.roomNumber ? `(${lab.roomNumber})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Item Selection - for hardware/software issues */}
                            {(form.category === 'hardware_issue' || form.category === 'software_issue') && form.labId && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Affected PC/Item *</label>
                                    {itemsLoading ? (
                                        <div className="text-sm text-slate-500 py-2">Loading items...</div>
                                    ) : labItems.length === 0 ? (
                                        <div className="text-sm text-amber-600 py-2">No items found in this lab</div>
                                    ) : (
                                        <select
                                            value={form.itemId}
                                            onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                        >
                                            <option value="">Select item...</option>
                                            {labItems.map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.itemType} - {item.itemNumber} {item.brand ? `(${item.brand})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                                >
                                    Create Ticket
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Ticket Detail Modal */}
            {showDetailModal && selectedTicket && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                            <div>
                                <span className="text-sm font-mono text-slate-400">{selectedTicket.ticketNumber}</span>
                                <h2 className="text-xl font-bold">{selectedTicket.title}</h2>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                            </div>
                        ) : (
                            <div className="p-4 space-y-4">
                                {/* Status and Actions */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedTicket.status]}`}>
                                        {selectedTicket.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[selectedTicket.priority]}`}>
                                        {selectedTicket.priority.toUpperCase()}
                                    </span>
                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-sm">
                                        {categoryLabels[selectedTicket.category]}
                                    </span>
                                    {isAdmin && selectedTicket.status !== 'closed' && (
                                        <select
                                            value={selectedTicket.status}
                                            onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                                            className="ml-auto px-3 py-1 border rounded-lg text-sm"
                                        >
                                            <option value="open">Open</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="resolved">Resolved</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                    )}
                                </div>

                                {/* Description */}
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                                </div>

                                {/* Meta Info */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-400">Created by</p>
                                        <p className="font-medium">{selectedTicket.createdBy?.firstName} {selectedTicket.createdBy?.lastName}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">Created</p>
                                        <p className="font-medium">{new Date(selectedTicket.createdAt).toLocaleString('en-IN')}</p>
                                    </div>
                                    {selectedTicket.lab && (
                                        <div>
                                            <p className="text-slate-400">Lab</p>
                                            <p className="font-medium">{selectedTicket.lab.name}</p>
                                        </div>
                                    )}
                                    {selectedTicket.item && (
                                        <div>
                                            <p className="text-slate-400">Item</p>
                                            <p className="font-medium">{selectedTicket.item.itemType} - {selectedTicket.item.itemNumber}</p>
                                        </div>
                                    )}
                                    {selectedTicket.assignedTo && (
                                        <div>
                                            <p className="text-slate-400">Assigned to</p>
                                            <p className="font-medium">{selectedTicket.assignedTo.firstName} {selectedTicket.assignedTo.lastName}</p>
                                        </div>
                                    )}
                                    {selectedTicket.resolvedBy && (
                                        <div>
                                            <p className="text-slate-400">Resolved by</p>
                                            <p className="font-medium">{selectedTicket.resolvedBy.firstName} {selectedTicket.resolvedBy.lastName}</p>
                                        </div>
                                    )}
                                </div>

                                {selectedTicket.resolutionNotes && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                        <p className="text-sm font-medium text-emerald-700 mb-1">Resolution Notes</p>
                                        <p className="text-emerald-800">{selectedTicket.resolutionNotes}</p>
                                    </div>
                                )}

                                {/* Comments */}
                                <div>
                                    <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                        <MessageSquare size={18} />
                                        Comments ({selectedTicket.comments?.length || 0})
                                    </h3>
                                    <div className="space-y-3 max-h-60 overflow-y-auto">
                                        {selectedTicket.comments?.map(comment => (
                                            <div key={comment.id} className="bg-slate-50 rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-sm">
                                                        {comment.user?.firstName} {comment.user?.lastName}
                                                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-slate-200 rounded">
                                                            {comment.user?.role}
                                                        </span>
                                                    </span>
                                                    <span className="text-xs text-slate-400">
                                                        {new Date(comment.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700">{comment.content}</p>
                                            </div>
                                        ))}
                                        {(!selectedTicket.comments || selectedTicket.comments.length === 0) && (
                                            <p className="text-sm text-slate-400 italic">No comments yet</p>
                                        )}
                                    </div>

                                    {/* Add Comment */}
                                    {selectedTicket.status !== 'closed' && (
                                        <div className="flex gap-2 mt-3">
                                            <input
                                                type="text"
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                                placeholder="Add a comment..."
                                                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                            />
                                            <button
                                                onClick={handleAddComment}
                                                disabled={!newComment.trim()}
                                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Send size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
