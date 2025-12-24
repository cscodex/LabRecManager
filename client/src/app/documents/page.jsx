'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, Eye, Clock, User, Share2, Inbox, ExternalLink, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { documentsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

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

export default function SharedDocumentsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingDoc, setViewingDoc] = useState(null);
    const [downloading, setDownloading] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadSharedDocuments();
    }, [_hasHydrated, isAuthenticated]);

    const loadSharedDocuments = async () => {
        setLoading(true);
        try {
            const res = await documentsAPI.getShared();
            setDocuments(res.data.data.documents || []);
        } catch (err) {
            console.error('Failed to load shared documents:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            toast.error(`Failed to load documents: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    // Get icon based on fileType from document
    const getIcon = (item) => {
        const fileType = item.document?.fileType?.toLowerCase();
        return FILE_ICONS[fileType] || FILE_ICONS.file;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    // Download file - opens in new tab for viewing/saving
    const handleDownload = async (item) => {
        const doc = item.document;
        if (!doc?.url) {
            toast.error('Document URL not available');
            return;
        }

        setDownloading(item.shareId);
        try {
            // Open in new tab - browser will handle download/view based on file type
            window.open(doc.url, '_blank');
            toast.success('Opening document...');
        } catch (err) {
            console.error('Download error:', err);
            toast.error('Failed to download');
        } finally {
            setDownloading(null);
        }
    };

    // View/Preview document
    const handleView = (item) => {
        const doc = item.document;
        if (!doc?.url) {
            toast.error('Document URL not available');
            return;
        }
        setViewingDoc(doc);
    };

    // Check if file type supports preview
    const canPreview = (doc) => {
        if (!doc) return false;
        const type = doc.fileType?.toLowerCase();
        const mime = doc.mimeType?.toLowerCase() || '';
        return type === 'pdf' || mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type);
    };

    if (!_hasHydrated) return null;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <PageHeader
                title="Shared Documents"
                titleHindi="साझा दस्तावेज़"
                icon={<Share2 className="w-8 h-8 text-primary-500" />}
            />

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <input
                        type="text"
                        placeholder="Search documents by name, shared by, or message..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10 w-full"
                    />
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-16 text-slate-500">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
                    Loading documents...
                </div>
            ) : documents.length === 0 ? (
                <div className="card p-12 text-center">
                    <Inbox className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">No Documents Shared</h3>
                    <p className="text-slate-500">Documents shared with you by instructors or admins will appear here.</p>
                </div>
            ) : (() => {
                // Filter documents by search query
                const filteredDocs = documents.filter(item => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    const docName = item.document?.name?.toLowerCase() || '';
                    const sharedBy = `${item.sharedBy?.firstName || ''} ${item.sharedBy?.lastName || ''}`.toLowerCase();
                    const message = item.message?.toLowerCase() || '';
                    return docName.includes(query) || sharedBy.includes(query) || message.includes(query);
                });

                return filteredDocs.length === 0 ? (
                    <div className="card p-12 text-center">
                        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">No Results</h3>
                        <p className="text-slate-500">No documents match "{searchQuery}"</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3">
                            {filteredDocs.map(item => (
                                <div key={item.shareId} className="card p-4">
                                    <div className="flex items-start gap-3 mb-3">
                                        <span className="text-3xl">{getIcon(item)}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 truncate">{item.document?.name || 'Untitled'}</p>
                                            <p className="text-sm text-slate-500">
                                                {item.document?.fileSizeFormatted || '-'} • {item.document?.fileType?.toUpperCase() || 'File'}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Shared by {item.sharedBy?.firstName} {item.sharedBy?.lastName} • {formatDate(item.sharedAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleView(item)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-100 text-blue-600 font-medium"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Preview
                                        </button>
                                        <button
                                            onClick={() => handleDownload(item)}
                                            disabled={downloading === item.shareId}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-100 text-green-600 font-medium disabled:opacity-50"
                                        >
                                            {downloading === item.shareId ? (
                                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                            Download
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block card overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Document</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Shared By</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Shared On</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Source</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredDocs.map(item => (
                                        <tr key={item.shareId} className="hover:bg-slate-50 transition">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{getIcon(item)}</span>
                                                    <div>
                                                        <p className="font-medium text-slate-900">{item.document?.name || 'Untitled'}</p>
                                                        <p className="text-sm text-slate-500">
                                                            {item.document?.fileSizeFormatted || '-'} • {item.document?.fileType?.toUpperCase() || 'File'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                    <span className="text-slate-700">
                                                        {item.sharedBy?.firstName} {item.sharedBy?.lastName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-slate-400" />
                                                    <span className="text-slate-600">{formatDate(item.sharedAt)}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                {item.targetClass ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                                                        Class: {item.targetClass.name}
                                                    </span>
                                                ) : item.targetGroup ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                                                        Group: {item.targetGroup.name}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs">
                                                        Direct
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <button
                                                        onClick={() => handleView(item)}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition font-medium text-sm"
                                                        title="Preview"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        Preview
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(item)}
                                                        disabled={downloading === item.shareId}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-100 hover:bg-green-200 text-green-600 transition font-medium text-sm disabled:opacity-50"
                                                        title="Download"
                                                    >
                                                        {downloading === item.shareId ? (
                                                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Download className="w-4 h-4" />
                                                        )}
                                                        Download
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                );
            })()}

            {/* Document Preview Modal */}
            {viewingDoc && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingDoc(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{FILE_ICONS[viewingDoc.fileType?.toLowerCase()] || FILE_ICONS.file}</span>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">{viewingDoc.name}</h3>
                                    <p className="text-sm text-slate-500">{viewingDoc.fileSizeFormatted} • {viewingDoc.fileType?.toUpperCase()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Open in New Tab */}
                                <a
                                    href={viewingDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition"
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                                {/* Download */}
                                <a
                                    href={viewingDoc.url}
                                    download={viewingDoc.fileName || viewingDoc.name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-600 transition"
                                    title="Download"
                                >
                                    <Download className="w-5 h-5" />
                                </a>
                                {/* Close */}
                                <button
                                    onClick={() => setViewingDoc(null)}
                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                                    title="Close"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 min-h-[400px]">
                            {/* Image Preview */}
                            {viewingDoc.mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(viewingDoc.fileType?.toLowerCase()) ? (
                                <div className="flex items-center justify-center p-4 min-h-[60vh]">
                                    <img
                                        src={viewingDoc.url}
                                        alt={viewingDoc.name}
                                        className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = '';
                                            e.target.parentElement.innerHTML = '<p class="text-slate-500 p-8">Failed to load image</p>';
                                        }}
                                    />
                                </div>
                            ) : viewingDoc.fileType?.toLowerCase() === 'pdf' || viewingDoc.mimeType === 'application/pdf' ? (
                                /* PDF Preview - Using Google Docs viewer for better compatibility */
                                <div className="w-full h-[75vh]">
                                    <iframe
                                        src={`https://docs.google.com/gview?url=${encodeURIComponent(viewingDoc.url)}&embedded=true`}
                                        className="w-full h-full border-0"
                                        title={viewingDoc.name}
                                        sandbox="allow-scripts allow-same-origin allow-popups"
                                    />
                                </div>
                            ) : (
                                /* Unsupported file type - show download option */
                                <div className="flex flex-col items-center justify-center py-16 px-4">
                                    <FileText className="w-20 h-20 text-slate-300 mb-6" />
                                    <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                        Preview not available
                                    </h4>
                                    <p className="text-slate-500 mb-6 text-center">
                                        This file type ({viewingDoc.fileType?.toUpperCase() || 'Unknown'}) cannot be previewed directly.
                                    </p>
                                    <div className="flex gap-3">
                                        <a
                                            href={viewingDoc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition font-medium"
                                        >
                                            <Download className="w-5 h-5" />
                                            Download File
                                        </a>
                                        <a
                                            href={viewingDoc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition font-medium"
                                        >
                                            <ExternalLink className="w-5 h-5" />
                                            Open in Browser
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
