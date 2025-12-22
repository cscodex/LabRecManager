'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Search, Eye, Edit2, Trash2, X, Share2, Download, File, QrCode, ExternalLink, Clock, User, Copy, Check, Grid3X3, List, Calendar, Users, UsersRound, Inbox, GraduationCap } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { documentsAPI, classesAPI } from '@/lib/api';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import QRCode from 'qrcode';

const CATEGORIES = [
    { value: '', label: 'All Categories' },
    { value: 'manual', label: 'Manuals' },
    { value: 'agreement', label: 'Agreements' },
    { value: 'report', label: 'Reports' },
    { value: 'policy', label: 'Policies' },
    { value: 'other', label: 'Other' }
];

const FILE_ICONS = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    csv: '📊',
    txt: '📝',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    webp: '🖼️',
    file: '📁'
};

export default function DocumentsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();

    const [documents, setDocuments] = useState([]);
    const [sharedDocuments, setSharedDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [activeTab, setActiveTab] = useState('my'); // 'my' or 'shared'

    // Upload modal state
    const [showUpload, setShowUpload] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadData, setUploadData] = useState({ name: '', description: '', category: '', isPublic: false });
    const [uploading, setUploading] = useState(false);

    // View/Preview modal
    const [viewingDoc, setViewingDoc] = useState(null);

    // Edit modal
    const [editingDoc, setEditingDoc] = useState(null);
    const [editData, setEditData] = useState({ name: '', description: '', category: '', isPublic: false });

    // Share modal - advanced
    const [sharingDoc, setSharingDoc] = useState(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [shareMode, setShareMode] = useState('link'); // 'link' or 'target'
    const [shareTargetType, setShareTargetType] = useState(''); // 'class', 'group', 'instructor', 'student'
    const [shareTargets, setShareTargets] = useState([]);
    const [shareMessage, setShareMessage] = useState('');
    const [shareSearch, setShareSearch] = useState('');
    const [availableClasses, setAvailableClasses] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);
    const [availableInstructors, setAvailableInstructors] = useState([]);
    const [availableStudents, setAvailableStudents] = useState([]);
    const [sharingLoading, setSharingLoading] = useState(false);

    // Delete dialog
    const [deleteDialog, setDeleteDialog] = useState({ open: false, doc: null });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        loadDocuments();
        loadSharedDocuments();
        loadShareOptions();
    }, [_hasHydrated, isAuthenticated]);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const params = {};
            if (searchQuery) params.search = searchQuery;
            if (categoryFilter) params.category = categoryFilter;
            const res = await documentsAPI.getAll(params);
            setDocuments(res.data.data.documents || []);
        } catch (err) {
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (_hasHydrated && isAuthenticated) {
            if (activeTab === 'my') {
                loadDocuments();
            } else {
                loadSharedDocuments();
            }
        }
    }, [searchQuery, categoryFilter, dateFrom, dateTo, activeTab]);

    const loadSharedDocuments = async () => {
        try {
            const res = await documentsAPI.getShared();
            setSharedDocuments(res.data.data.documents || []);
        } catch (err) {
            console.error('Failed to load shared documents:', err);
        }
    };

    const loadShareOptions = async () => {
        try {
            // Load classes
            const classRes = await classesAPI.getAll();
            const classes = classRes.data.data.classes || [];
            setAvailableClasses(classes);

            // Load all groups from all classes
            const allGroups = [];
            for (const cls of classes) {
                try {
                    const groupRes = await classesAPI.getGroups(cls.id);
                    const groups = groupRes.data.data.groups || [];
                    groups.forEach(g => {
                        allGroups.push({ ...g, className: cls.name || `Grade ${cls.gradeLevel}-${cls.section}` });
                    });
                } catch (e) { /* ignore if no groups */ }
            }
            setAvailableGroups(allGroups);

            // Load instructors and admins
            const userRes = await api.get('/users', { params: { role: 'instructor,admin,principal' } });
            setAvailableInstructors(userRes.data.data.users || []);

            // Load students
            const studentRes = await api.get('/users', { params: { role: 'student' } });
            setAvailableStudents(studentRes.data.data.users || []);
        } catch (err) {
            console.error('Failed to load share options:', err);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
            setUploadData(prev => ({ ...prev, name: file.name.replace(/\.[^.]+$/, '') }));
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) { toast.error('Select a file'); return; }
        if (!uploadData.name) { toast.error('Name is required'); return; }

        setUploading(true);
        try {
            await documentsAPI.upload(uploadFile, uploadData);
            toast.success('Document uploaded!');
            setShowUpload(false);
            setUploadFile(null);
            setUploadData({ name: '', description: '', category: '', isPublic: false });
            loadDocuments();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (doc) => {
        setEditingDoc(doc);
        setEditData({ name: doc.name, description: doc.description || '', category: doc.category || '', isPublic: doc.isPublic });
    };

    const handleSaveEdit = async () => {
        try {
            await documentsAPI.update(editingDoc.id, editData);
            toast.success('Document updated');
            setEditingDoc(null);
            loadDocuments();
        } catch (err) {
            toast.error('Update failed');
        }
    };

    const handleDelete = async () => {
        try {
            await documentsAPI.delete(deleteDialog.doc.id);
            toast.success('Document deleted');
            setDeleteDialog({ open: false, doc: null });
            loadDocuments();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    const handleShare = async (doc) => {
        setSharingDoc(doc);
        setShareMode('link');
        setShareTargets([]);
        setShareMessage('');
        setAvailableGroups([]);
        const shareUrl = `${window.location.origin}/view-document/${doc.id}`;
        try {
            const qr = await QRCode.toDataURL(shareUrl, { width: 200 });
            setQrCodeUrl(qr);
        } catch { }
    };

    const handleShareSubmit = async () => {
        if (shareTargets.length === 0) {
            toast.error('Select at least one target');
            return;
        }
        setSharingLoading(true);
        try {
            await documentsAPI.share(sharingDoc.id, {
                targets: shareTargets,
                message: shareMessage
            });
            toast.success('Document shared successfully!');
            setSharingDoc(null);
            setShareTargets([]);
            setShareMessage('');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to share document');
        } finally {
            setSharingLoading(false);
        }
    };

    const toggleShareTarget = (type, id) => {
        const exists = shareTargets.find(t => t.type === type && t.id === id);
        if (exists) {
            setShareTargets(shareTargets.filter(t => !(t.type === type && t.id === id)));
        } else {
            setShareTargets([...shareTargets, { type, id }]);
            // If it's a class, load its groups
            if (type === 'class') {
                loadGroupsForClass(id);
            }
        }
    };

    const copyShareLink = () => {
        const shareUrl = `${window.location.origin}/view-document/${sharingDoc.id}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Link copied!');
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Filter documents by date range
    const filteredDocuments = (activeTab === 'my' ? documents : sharedDocuments).filter(item => {
        const doc = activeTab === 'my' ? item : item.document;
        if (!doc) return false;
        if (dateFrom && new Date(doc.createdAt) < new Date(dateFrom)) return false;
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (new Date(doc.createdAt) > toDate) return false;
        }
        return true;
    });

    // Check if user can upload (admin, principal, lab_assistant, instructor)
    const canUpload = ['admin', 'principal', 'lab_assistant', 'instructor'].includes(user?.role);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
                    <p className="text-slate-500">Upload and manage PDFs, documents, and spreadsheets</p>
                </div>
                {canUpload && (
                    <button onClick={() => setShowUpload(true)} className="btn btn-primary">
                        <Upload className="w-4 h-4" /> Upload Document
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('my')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'my'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <FileText className="w-4 h-4 inline mr-2" />
                    My Documents
                </button>
                <button
                    onClick={() => setActiveTab('shared')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'shared'
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <Inbox className="w-4 h-4" />
                    Shared with Me
                    {sharedDocuments.length > 0 && (
                        <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                            {sharedDocuments.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-3 mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10 w-full"
                            placeholder="Search documents..."
                        />
                    </div>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input w-full sm:w-48">
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                </div>

                {/* Date Filter & View Toggle */}
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-500">From:</span>
                            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input py-1.5 text-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500">To:</span>
                            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input py-1.5 text-sm" />
                        </div>
                        {(dateFrom || dateTo) && (
                            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-sm text-red-500 hover:underline">Clear</button>
                        )}
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                            title="Grid View"
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Documents Grid */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading...</div>
            ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">{activeTab === 'shared' ? 'No documents shared with you' : 'No documents found'}</p>
                    {activeTab === 'my' && canUpload && (
                        <button onClick={() => setShowUpload(true)} className="btn btn-primary mt-4">Upload your first document</button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocuments.map(item => {
                        const doc = activeTab === 'my' ? item : item.document;
                        const shareInfo = activeTab === 'shared' ? item : null;
                        if (!doc) return null;
                        return (
                            <div key={doc.id + (shareInfo?.shareId || '')} className="card p-4 hover:shadow-lg transition-shadow">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
                                        {FILE_ICONS[doc.fileType] || FILE_ICONS.file}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-900 truncate">{doc.name}</h3>
                                        <p className="text-sm text-slate-500">{doc.fileType?.toUpperCase()} • {doc.fileSizeFormatted || ''}</p>
                                        {doc.category && (
                                            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 capitalize">{doc.category}</span>
                                        )}
                                    </div>
                                </div>

                                {doc.description && (
                                    <p className="text-sm text-slate-600 mt-3 line-clamp-2">{doc.description}</p>
                                )}

                                {/* Shared info for shared tab */}
                                {shareInfo && (
                                    <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                                        <div className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            Shared by {shareInfo.sharedBy?.firstName} {shareInfo.sharedBy?.lastName}
                                        </div>
                                        {shareInfo.message && (
                                            <p className="mt-1 text-blue-600 italic">"{shareInfo.message}"</p>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(shareInfo ? shareInfo.sharedAt : doc.createdAt)}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                                    <button onClick={() => setViewingDoc(doc)} className="btn btn-secondary text-xs flex-1 py-1.5">
                                        <Eye className="w-3 h-3" /> View
                                    </button>
                                    {activeTab === 'my' && canUpload && (
                                        <>
                                            <button onClick={() => handleEdit(doc)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleShare(doc)} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded">
                                                <Share2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setDeleteDialog({ open: true, doc })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {activeTab === 'shared' && (
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary text-xs flex-1 py-1.5">
                                            <Download className="w-3 h-3" /> Download
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* List View */
                <div className="card overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left p-3 text-sm font-semibold text-slate-700">Name</th>
                                <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden md:table-cell">Type</th>
                                <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden md:table-cell">Size</th>
                                {activeTab === 'my' ? (
                                    <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell">Category</th>
                                ) : (
                                    <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell">Shared By</th>
                                )}
                                <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell">{activeTab === 'my' ? 'Uploaded' : 'Shared On'}</th>
                                <th className="text-left p-3 text-sm font-semibold text-slate-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocuments.map(item => {
                                const doc = activeTab === 'my' ? item : item.document;
                                const shareInfo = activeTab === 'shared' ? item : null;
                                if (!doc) return null;
                                return (
                                    <tr key={doc.id + (shareInfo?.shareId || '')} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{FILE_ICONS[doc.fileType] || FILE_ICONS.file}</span>
                                                <div>
                                                    <p className="font-medium text-slate-900">{doc.name}</p>
                                                    {doc.description && <p className="text-xs text-slate-500 truncate max-w-xs">{doc.description}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-sm text-slate-600 hidden md:table-cell">{doc.fileType?.toUpperCase()}</td>
                                        <td className="p-3 text-sm text-slate-600 hidden md:table-cell">{doc.fileSizeFormatted || ''}</td>
                                        {activeTab === 'my' ? (
                                            <td className="p-3 hidden lg:table-cell">
                                                {doc.category && <span className="px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 capitalize">{doc.category}</span>}
                                            </td>
                                        ) : (
                                            <td className="p-3 text-sm text-slate-600 hidden lg:table-cell">
                                                {shareInfo?.sharedBy?.firstName} {shareInfo?.sharedBy?.lastName}
                                            </td>
                                        )}
                                        <td className="p-3 text-sm text-slate-500 hidden lg:table-cell">{formatDate(shareInfo ? shareInfo.sharedAt : doc.createdAt)}</td>
                                        <td className="p-3">
                                            <div className="flex gap-1">
                                                <button onClick={() => setViewingDoc(doc)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="View">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {activeTab === 'my' && canUpload && (
                                                    <>
                                                        <button onClick={() => handleEdit(doc)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleShare(doc)} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded" title="Share">
                                                            <Share2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setDeleteDialog({ open: true, doc })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {activeTab === 'shared' && (
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded" title="Download">
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xl font-semibold">Upload Document</h3>
                            <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* File Drop Zone */}
                            <div
                                className={`border-2 border-dashed rounded-xl p-6 text-center ${uploadFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'}`}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); handleFileSelect({ target: { files: e.dataTransfer.files } }); }}
                            >
                                {uploadFile ? (
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{FILE_ICONS[uploadFile.name.split('.').pop()] || FILE_ICONS.file}</span>
                                        <div className="text-left flex-1">
                                            <p className="font-medium truncate">{uploadFile.name}</p>
                                            <p className="text-sm text-slate-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <button onClick={() => setUploadFile(null)} className="text-red-500"><X className="w-5 h-5" /></button>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer">
                                        <Upload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                                        <p className="text-slate-600">Drag & drop or click to select</p>
                                        <p className="text-xs text-slate-400 mt-1">PDF, DOC, XLS, CSV, TXT, Images • Max 100MB</p>
                                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp" onChange={handleFileSelect} />
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="label">Name</label>
                                <input type="text" value={uploadData.name} onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })} className="input" placeholder="Document name" />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea value={uploadData.description} onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })} className="input" rows={2} placeholder="Optional description" />
                            </div>
                            <div>
                                <label className="label">Category</label>
                                <select value={uploadData.category} onChange={(e) => setUploadData({ ...uploadData, category: e.target.value })} className="input">
                                    <option value="">Select category</option>
                                    {CATEGORIES.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={uploadData.isPublic} onChange={(e) => setUploadData({ ...uploadData, isPublic: e.target.checked })} className="rounded" />
                                <span className="text-sm text-slate-700">Make publicly shareable</span>
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowUpload(false)} className="btn btn-secondary flex-1">Cancel</button>
                                <button onClick={handleUpload} disabled={uploading} className="btn btn-primary flex-1">
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View/Preview Modal */}
            {viewingDoc && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-semibold">{viewingDoc.name}</h3>
                                <p className="text-sm text-slate-500">{viewingDoc.fileType.toUpperCase()} • {viewingDoc.fileSizeFormatted}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a href={viewingDoc.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-sm">
                                    <Download className="w-4 h-4" /> Download
                                </a>
                                <button onClick={() => setViewingDoc(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto bg-slate-100 p-4">
                            {['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(viewingDoc.fileType) ? (
                                <iframe
                                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingDoc.url)}&embedded=true`}
                                    className="w-full h-full min-h-[500px] rounded-lg border border-slate-200 bg-white"
                                    title="Document Preview"
                                />
                            ) : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(viewingDoc.fileType) ? (
                                <div className="flex items-center justify-center h-full min-h-[400px] bg-white rounded-lg border border-slate-200">
                                    <img
                                        src={viewingDoc.url}
                                        alt={viewingDoc.name}
                                        className="max-w-full max-h-[500px] object-contain"
                                    />
                                </div>
                            ) : viewingDoc.fileType === 'csv' ? (
                                <iframe
                                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingDoc.url)}&embedded=true`}
                                    className="w-full h-full min-h-[500px] rounded-lg border border-slate-200 bg-white"
                                    title="CSV Preview"
                                />
                            ) : viewingDoc.fileType === 'txt' ? (
                                <iframe
                                    src={viewingDoc.url}
                                    className="w-full h-full min-h-[500px] rounded-lg border border-slate-200 bg-white"
                                    title="Text Preview"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-500">
                                    <span className="text-6xl mb-4">{FILE_ICONS[viewingDoc.fileType] || FILE_ICONS.file}</span>
                                    <p className="mb-4">Preview not available for {viewingDoc.fileType.toUpperCase()} files</p>
                                    <a href={viewingDoc.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                        <ExternalLink className="w-4 h-4" /> Open in New Tab
                                    </a>
                                </div>
                            )}
                        </div>
                        {viewingDoc.description && (
                            <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                                <p className="text-sm text-slate-600">{viewingDoc.description}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingDoc && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xl font-semibold">Edit Document</h3>
                            <button onClick={() => setEditingDoc(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="label">Name</label>
                                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="input" />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea value={editData.description} onChange={(e) => setEditData({ ...editData, description: e.target.value })} className="input" rows={3} />
                            </div>
                            <div>
                                <label className="label">Category</label>
                                <select value={editData.category} onChange={(e) => setEditData({ ...editData, category: e.target.value })} className="input">
                                    <option value="">No category</option>
                                    {CATEGORIES.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={editData.isPublic} onChange={(e) => setEditData({ ...editData, isPublic: e.target.checked })} className="rounded" />
                                <span className="text-sm text-slate-700">Make publicly shareable</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setEditingDoc(null)} className="btn btn-secondary flex-1">Cancel</button>
                                <button onClick={handleSaveEdit} className="btn btn-primary flex-1">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Modal */}
            {sharingDoc && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-xl font-semibold">Share Document</h3>
                            <button onClick={() => setSharingDoc(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Share Mode Tabs */}
                        <div className="flex border-b border-slate-200 px-6">
                            <button
                                onClick={() => setShareMode('link')}
                                className={`py-3 px-4 text-sm font-medium border-b-2 transition ${shareMode === 'link' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}
                            >
                                <QrCode className="w-4 h-4 inline mr-2" />Public Link
                            </button>
                            <button
                                onClick={() => { setShareMode('target'); setShareTargetType(''); setShareSearch(''); }}
                                className={`py-3 px-4 text-sm font-medium border-b-2 transition ${shareMode === 'target' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500'}`}
                            >
                                <Users className="w-4 h-4 inline mr-2" />Share with...
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {shareMode === 'link' ? (
                                <>
                                    {!sharingDoc.isPublic ? (
                                        <div className="text-center py-4 text-amber-600 bg-amber-50 rounded-lg">
                                            <p className="font-medium">Document is not public</p>
                                            <p className="text-sm mt-1">Enable "publicly shareable" in edit to share via link</p>
                                        </div>
                                    ) : (
                                        <>
                                            {qrCodeUrl && (
                                                <div className="text-center">
                                                    <img src={qrCodeUrl} alt="QR Code" className="mx-auto rounded-lg" />
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={`${window.location.origin}/view-document/${sharingDoc.id}`}
                                                    readOnly
                                                    className="input flex-1 text-sm"
                                                />
                                                <button onClick={copyShareLink} className="btn btn-primary">
                                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <a
                                                href={sharingDoc.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary w-full"
                                            >
                                                <Download className="w-4 h-4" /> Direct Download Link
                                            </a>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Step 1: Select Type */}
                                    {!shareTargetType ? (
                                        <div className="space-y-3">
                                            <p className="text-sm text-slate-500">Select who you want to share with:</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <button
                                                    onClick={() => setShareTargetType('class')}
                                                    className="p-4 border-2 border-slate-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition text-center"
                                                >
                                                    <UsersRound className="w-8 h-8 mx-auto text-primary-600 mb-2" />
                                                    <span className="text-sm font-medium">Classes</span>
                                                    <p className="text-xs text-slate-500 mt-1">{availableClasses.length} available</p>
                                                </button>
                                                <button
                                                    onClick={() => setShareTargetType('group')}
                                                    className="p-4 border-2 border-slate-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition text-center"
                                                >
                                                    <Users className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                                                    <span className="text-sm font-medium">Groups</span>
                                                    <p className="text-xs text-slate-500 mt-1">{availableGroups.length} available</p>
                                                </button>
                                                <button
                                                    onClick={() => setShareTargetType('student')}
                                                    className="p-4 border-2 border-slate-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition text-center"
                                                >
                                                    <GraduationCap className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                                                    <span className="text-sm font-medium">Students</span>
                                                    <p className="text-xs text-slate-500 mt-1">{availableStudents.length} available</p>
                                                </button>
                                                <button
                                                    onClick={() => setShareTargetType('instructor')}
                                                    className="p-4 border-2 border-slate-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition text-center"
                                                >
                                                    <User className="w-8 h-8 mx-auto text-amber-600 mb-2" />
                                                    <span className="text-sm font-medium">Instructors</span>
                                                    <p className="text-xs text-slate-500 mt-1">{availableInstructors.length} available</p>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Step 2: Show list with search */
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <button
                                                    onClick={() => { setShareTargetType(''); setShareSearch(''); }}
                                                    className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                                                >
                                                    ← Back
                                                </button>
                                                <span className="text-sm font-medium capitalize">
                                                    {shareTargetType === 'class' ? 'Classes' : shareTargetType === 'group' ? 'Groups' : shareTargetType === 'student' ? 'Students' : 'Instructors/Admins'}
                                                </span>
                                            </div>

                                            {/* Search Box */}
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={shareSearch}
                                                    onChange={(e) => setShareSearch(e.target.value)}
                                                    placeholder={`Search ${shareTargetType}s...`}
                                                    className="input pl-9 w-full text-sm"
                                                />
                                            </div>

                                            {/* List based on type */}
                                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                                                {shareTargetType === 'class' && (
                                                    availableClasses
                                                        .filter(cls => {
                                                            const name = cls.name || `Grade ${cls.gradeLevel}-${cls.section}`;
                                                            return name.toLowerCase().includes(shareSearch.toLowerCase());
                                                        })
                                                        .map(cls => (
                                                            <label key={cls.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={shareTargets.some(t => t.type === 'class' && t.id === cls.id)}
                                                                    onChange={() => toggleShareTarget('class', cls.id)}
                                                                    className="rounded text-primary-600"
                                                                />
                                                                <span className="text-sm">{cls.name || `Grade ${cls.gradeLevel}-${cls.section}`}</span>
                                                            </label>
                                                        ))
                                                )}
                                                {shareTargetType === 'group' && (
                                                    availableGroups.length === 0 ? (
                                                        <div className="p-4 text-center text-slate-500 text-sm">
                                                            No groups found. Create groups in class settings first.
                                                        </div>
                                                    ) : (
                                                        availableGroups
                                                            .filter(grp => grp.name.toLowerCase().includes(shareSearch.toLowerCase()))
                                                            .map(grp => (
                                                                <label key={grp.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={shareTargets.some(t => t.type === 'group' && t.id === grp.id)}
                                                                        onChange={() => toggleShareTarget('group', grp.id)}
                                                                        className="rounded text-primary-600"
                                                                    />
                                                                    <div>
                                                                        <span className="text-sm">{grp.name}</span>
                                                                        <span className="text-xs text-slate-400 ml-2">({grp.className})</span>
                                                                    </div>
                                                                </label>
                                                            ))
                                                    )
                                                )}
                                                {shareTargetType === 'instructor' && (
                                                    availableInstructors
                                                        .filter(usr => `${usr.firstName} ${usr.lastName}`.toLowerCase().includes(shareSearch.toLowerCase()))
                                                        .map(usr => (
                                                            <label key={usr.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={shareTargets.some(t => (t.type === 'instructor' || t.type === 'admin') && t.id === usr.id)}
                                                                    onChange={() => toggleShareTarget(usr.role === 'admin' || usr.role === 'principal' ? 'admin' : 'instructor', usr.id)}
                                                                    className="rounded text-primary-600"
                                                                />
                                                                <span className="text-sm">{usr.firstName} {usr.lastName}</span>
                                                                <span className="text-xs text-slate-400 capitalize">({usr.role})</span>
                                                            </label>
                                                        ))
                                                )}
                                                {shareTargetType === 'student' && (
                                                    availableStudents.length === 0 ? (
                                                        <div className="p-4 text-center text-slate-500 text-sm">
                                                            No students found.
                                                        </div>
                                                    ) : (
                                                        availableStudents
                                                            .filter(stu => `${stu.firstName} ${stu.lastName} ${stu.email || ''} ${stu.studentId || stu.admissionNumber || ''}`.toLowerCase().includes(shareSearch.toLowerCase()))
                                                            .map(stu => (
                                                                <label key={stu.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={shareTargets.some(t => t.type === 'student' && t.id === stu.id)}
                                                                        onChange={() => toggleShareTarget('student', stu.id)}
                                                                        className="rounded text-primary-600"
                                                                    />
                                                                    <div className="flex-1">
                                                                        <span className="text-sm">{stu.firstName} {stu.lastName}</span>
                                                                        {(stu.studentId || stu.admissionNumber) && (
                                                                            <span className="text-xs text-slate-400 ml-2">({stu.studentId || stu.admissionNumber})</span>
                                                                        )}
                                                                    </div>
                                                                </label>
                                                            ))
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Message */}
                                    {shareTargetType && (
                                        <div>
                                            <label className="label">Message (optional)</label>
                                            <textarea
                                                value={shareMessage}
                                                onChange={(e) => setShareMessage(e.target.value)}
                                                placeholder="Add a note to recipients..."
                                                className="input w-full"
                                                rows={2}
                                            />
                                        </div>
                                    )}

                                    {/* Selected Count */}
                                    {shareTargets.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {shareTargets.map((t, i) => (
                                                <span key={i} className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">
                                                    {t.type}: {t.id.slice(0, 8)}...
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Share Button */}
                                    <button
                                        onClick={handleShareSubmit}
                                        disabled={shareTargets.length === 0 || sharingLoading}
                                        className="btn btn-primary w-full"
                                    >
                                        {sharingLoading ? 'Sharing...' : `Share with ${shareTargets.length} recipient(s)`}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* Delete Confirm */}
            <ConfirmDialog
                isOpen={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, doc: null })}
                onConfirm={handleDelete}
                title="Delete Document"
                message={`Are you sure you want to delete "${deleteDialog.doc?.name}"? This cannot be undone.`}
                confirmText="Delete"
                type="danger"
            />
        </div>
    );
}
