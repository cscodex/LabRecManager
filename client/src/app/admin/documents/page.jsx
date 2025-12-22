'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Search, Eye, Edit2, Trash2, X, Share2, Download, File, QrCode, ExternalLink, Clock, User, Copy, Check } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { documentsAPI } from '@/lib/api';
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
    const { isAuthenticated, _hasHydrated } = useAuthStore();

    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

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

    // Share modal
    const [sharingDoc, setSharingDoc] = useState(null);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [copied, setCopied] = useState(false);

    // Delete dialog
    const [deleteDialog, setDeleteDialog] = useState({ open: false, doc: null });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        loadDocuments();
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
            loadDocuments();
        }
    }, [searchQuery, categoryFilter]);

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
        const shareUrl = `${window.location.origin}/view-document/${doc.id}`;
        try {
            const qr = await QRCode.toDataURL(shareUrl, { width: 200 });
            setQrCodeUrl(qr);
        } catch { }
    };

    const copyShareLink = () => {
        const shareUrl = `${window.location.origin}/view-document/${sharingDoc.id}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Link copied!');
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
                    <p className="text-slate-500">Upload and manage PDFs, documents, and spreadsheets</p>
                </div>
                <button onClick={() => setShowUpload(true)} className="btn btn-primary">
                    <Upload className="w-4 h-4" /> Upload Document
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
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

            {/* Documents Grid */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading...</div>
            ) : documents.length === 0 ? (
                <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">No documents found</p>
                    <button onClick={() => setShowUpload(true)} className="btn btn-primary mt-4">Upload your first document</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(doc => (
                        <div key={doc.id} className="card p-4 hover:shadow-lg transition-shadow">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
                                    {FILE_ICONS[doc.fileType] || FILE_ICONS.file}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-900 truncate">{doc.name}</h3>
                                    <p className="text-sm text-slate-500">{doc.fileType.toUpperCase()} • {doc.fileSizeFormatted}</p>
                                    {doc.category && (
                                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 capitalize">{doc.category}</span>
                                    )}
                                </div>
                            </div>

                            {doc.description && (
                                <p className="text-sm text-slate-600 mt-3 line-clamp-2">{doc.description}</p>
                            )}

                            <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                                <Clock className="w-3 h-3" />
                                {formatDate(doc.createdAt)}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                                <button onClick={() => setViewingDoc(doc)} className="btn btn-secondary text-xs flex-1 py-1.5">
                                    <Eye className="w-3 h-3" /> View
                                </button>
                                <button onClick={() => handleEdit(doc)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleShare(doc)} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded">
                                    <Share2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteDialog({ open: true, doc })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
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
                    <div className="bg-white rounded-2xl max-w-sm w-full">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xl font-semibold">Share Document</h3>
                            <button onClick={() => setSharingDoc(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {!sharingDoc.isPublic ? (
                                <div className="text-center py-4 text-amber-600 bg-amber-50 rounded-lg">
                                    <p className="font-medium">Document is not public</p>
                                    <p className="text-sm mt-1">Enable "publicly shareable" to share</p>
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
