'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Search, Eye, Edit2, Trash2, X, Share2, Download, File, QrCode, ExternalLink, Clock, User, Copy, Check, Grid3X3, List, Calendar, Users, UsersRound, Inbox, GraduationCap, ChevronUp, ChevronDown, RotateCcw, Trash, HardDrive, Folder, FolderPlus, ChevronRight, FolderInput, CornerUpLeft, Clipboard, ClipboardCopy, Scissors } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { documentsAPI, classesAPI, storageAPI, foldersAPI } from '@/lib/api';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FileViewer from '@/components/FileViewer';
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
    const [trashDocuments, setTrashDocuments] = useState([]);
    const [folders, setFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null); // null = root
    const [folderBreadcrumbs, setFolderBreadcrumbs] = useState([]);
    const [storageInfo, setStorageInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list' - default to list
    const [activeTab, setActiveTab] = useState('my'); // 'my', 'shared', or 'trash'
    const [sortField, setSortField] = useState('createdAt'); // 'name', 'fileType', 'fileSize', 'createdAt'
    const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

    // Upload modal state
    const [showUpload, setShowUpload] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadData, setUploadData] = useState({ name: '', description: '', category: '', isPublic: false });
    const [uploading, setUploading] = useState(false);

    // Create Folder modal
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Move Document modal
    const [moveDialog, setMoveDialog] = useState({ open: false, doc: null });
    const [moveCurrentFolder, setMoveCurrentFolder] = useState(null); // navigation inside modal
    const [moveFolders, setMoveFolders] = useState([]); // list of folders in modal

    // View/Preview modal
    const [viewingDoc, setViewingDoc] = useState(null);

    // Edit modal
    const [editingDoc, setEditingDoc] = useState(null);
    const [editData, setEditData] = useState({ name: '', description: '', category: '', isPublic: false });
    const [editFile, setEditFile] = useState(null); // New file for replacing document

    // Share info popup for list view
    const [shareInfoModal, setShareInfoModal] = useState(null); // { doc, anchorEl }

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

    // Bulk Actions & Clipboard
    const [selectedDocs, setSelectedDocs] = useState(new Set());
    const [selectedFolders, setSelectedFolders] = useState(new Set());
    const [clipboard, setClipboard] = useState(null); // { mode: 'copy' | 'cut', documents: [], folders: [] }

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        loadDocuments();
        loadSharedDocuments();
        loadTrash();
        loadShareOptions();
        loadStorage();
    }, [_hasHydrated, isAuthenticated]);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            setLoading(true);
            const params = {};
            if (searchQuery) params.search = searchQuery;
            if (categoryFilter) params.category = categoryFilter;
            // Only filter by folder if we are in 'my' documents tab and not searching globally
            // (If searching, we might want to search all folders? For now, let's stick to current folder behavior or all if implemented server side)
            // But typical behavior is search current folder or all. Let's assume current folder for now.
            if (activeTab === 'my') {
                params.folderId = currentFolder ? currentFolder.id : 'root';
            }

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
                loadFolders();
            } else {
                loadSharedDocuments();
            }
        }
    }, [searchQuery, categoryFilter, dateFrom, dateTo, activeTab, currentFolder]);

    const loadFolders = async () => {
        try {
            const params = {};
            if (searchQuery) {
                params.search = searchQuery;
            } else {
                params.parentId = currentFolder ? currentFolder.id : null;
            }
            const res = await foldersAPI.getAll(params);
            setFolders(res.data.data.folders || []);
        } catch (err) {
            console.error('Failed to load folders:', err);
        }
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        try {
            await foldersAPI.create({
                name: newFolderName,
                parentId: currentFolder ? currentFolder.id : null
            });
            toast.success('Folder created successfully');
            setNewFolderName('');
            setShowCreateFolder(false);
            loadFolders();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create folder');
        }
    };

    const handleFolderClick = (folder) => {
        setCurrentFolder(folder);
        // Update breadcrumbs
        if (folder) {
            // If we are navigating down, add to breadcrumbs (or rebuild if we jumped)
            // ideally we fetch breadcrumbs from server but local is faster for simple navigation
            // For now let's just use what we have, but server does provide breadcrumbs on getById
            // Let's implement full breadcrumb loading on folder click
            loadFolderDetails(folder.id);
        } else {
            setFolderBreadcrumbs([]);
        }
        setSearchQuery(''); // Clear search on navigation
        setSelectedDocs(new Set());
        setSelectedFolders(new Set());
    };

    const loadFolderDetails = async (folderId) => {
        try {
            const res = await foldersAPI.getById(folderId);
            setFolderBreadcrumbs(res.data.data.breadcrumbs || []);
        } catch (err) {
            console.error('Failed to load folder details:', err);
            // If failed, maybe revert navigation?
        }
    };

    const handleNavigateBreadcrumb = (folder) => {
        setCurrentFolder(folder);
        // When clicking a breadcrumb, we need to rebuild the breadcrumb trail up to that point
        // But since we just set currentFolder, the next render + loadFolderDetails checks might be needed or 
        // we can slice the current breadcrumbs.
        if (!folder) {
            setFolderBreadcrumbs([]);
        } else {
            const index = folderBreadcrumbs.findIndex(b => b.id === folder.id);
            if (index !== -1) {
                setFolderBreadcrumbs(folderBreadcrumbs.slice(0, index + 1));
            }
        }
    };

    const loadSharedDocuments = async () => {
        try {
            const res = await documentsAPI.getShared();
            setSharedDocuments(res.data.data.documents || []);
        } catch (err) {
            console.error('Failed to load shared documents:', err);
        }
    };

    const loadTrash = async () => {
        try {
            const res = await documentsAPI.getTrash();
            setTrashDocuments(res.data.data.documents || []);
        } catch (err) {
            console.error('Failed to load trash:', err);
        }
    };

    const handleRestore = async (doc) => {
        try {
            await documentsAPI.restore(doc.id);
            toast.success('Document restored successfully');
            loadTrash();
            loadDocuments();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to restore document');
        }
    };

    const handlePermanentDelete = async (doc) => {
        if (!confirm(`Permanently delete "${doc.name}"? This cannot be undone.`)) return;
        try {
            await documentsAPI.permanentDelete(doc.id);
            toast.success('Document permanently deleted');
            loadTrash();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete document');
        }
    };

    const loadStorage = async () => {
        try {
            const res = await storageAPI.getUsage();
            setStorageInfo(res.data.data);
        } catch (err) {
            console.error('Failed to load storage info:', err);
        }
    };

    const loadShareOptions = async () => {
        try {
            // Load ALL classes (all: true bypasses session filter)
            const classRes = await api.get('/classes', { params: { all: true } });
            const classes = classRes.data.data.classes || [];
            setAvailableClasses(classes);

            // Load all groups from all classes
            const allGroups = [];
            const seenGroupIds = new Set();
            for (const cls of classes) {
                try {
                    const groupRes = await api.get(`/classes/${cls.id}/groups`);
                    const groups = groupRes.data.data.groups || [];
                    groups.forEach(g => {
                        if (!seenGroupIds.has(g.id)) {
                            seenGroupIds.add(g.id);
                            allGroups.push({ ...g, className: cls.name || `Grade ${cls.gradeLevel}-${cls.section}` });
                        }
                    });
                } catch (e) { /* ignore if no groups */ }
            }
            setAvailableGroups(allGroups);

            // Load instructors and admins (no session filtering on users without classId)
            const userRes = await api.get('/users', { params: { role: 'instructor', limit: 500 } });
            const adminRes = await api.get('/users', { params: { role: 'admin', limit: 100 } });
            const principalRes = await api.get('/users', { params: { role: 'principal', limit: 20 } });
            const allInstructors = [
                ...(userRes.data.data.users || []),
                ...(adminRes.data.data.users || []),
                ...(principalRes.data.data.users || [])
            ];
            setAvailableInstructors(allInstructors);

            // Load all students (no session filtering on users without classId)
            const studentRes = await api.get('/users', { params: { role: 'student', limit: 1000 } });
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
        setEditFile(null); // Reset file selection
    };

    const handleSaveEdit = async () => {
        try {
            // If there's a new file, upload it first
            if (editFile) {
                const formData = new FormData();
                formData.append('file', editFile);
                formData.append('name', editData.name);
                formData.append('description', editData.description);
                formData.append('category', editData.category);
                formData.append('isPublic', editData.isPublic);

                // Delete old and upload new
                await documentsAPI.delete(editingDoc.id);
                await documentsAPI.upload(formData);
                toast.success('Document replaced successfully');
            } else {
                await documentsAPI.update(editingDoc.id, editData);
                toast.success('Document updated');
            }
            setEditingDoc(null);
            setEditFile(null);
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
        setShareMode('target'); // Default to target sharing mode
        setShareTargetType(''); // Reset to show type selection first
        setShareMessage('');

        // Preload existing shares as selected targets from shareInfo
        const existingTargets = (doc.shareInfo || []).map(share => ({
            type: share.type,
            id: share.targetId // Use targetId directly from backend
        })).filter(t => t.id); // Filter out any with undefined IDs

        setShareTargets(existingTargets);

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

    // --- Move Document Logic ---
    const handleOpenMoveDialog = (doc) => {
        setMoveDialog({ open: true, doc });
        setMoveCurrentFolder(null); // Start at root
        loadMoveFolders(null);
    };

    const loadMoveFolders = async (parentId) => {
        try {
            const res = await foldersAPI.getAll(parentId);
            setMoveFolders(res.data.data.folders || []);
        } catch (err) {
            console.error('Failed to load move folders:', err);
        }
    };

    const handleMoveNavigate = (folder) => {
        setMoveCurrentFolder(folder);
        loadMoveFolders(folder ? folder.id : null);
    };

    const handleMoveUp = async () => {
        if (!moveCurrentFolder) return; // Already at root
        if (!moveCurrentFolder.parentId) {
            handleMoveNavigate(null); // Go to root
        } else {
            // We need to find the parent object. Since we don't have it easily available,
            // we can fetch the current folder details to get parent.
            // Or we could have maintained a breadcrumb stack for the modal.
            // For simplicity, let's just fetch parent.
            try {
                const res = await foldersAPI.getById(moveCurrentFolder.id);
                // The API returns parent object if exists
                const parent = res.data.data.folder.parent;
                handleMoveNavigate(parent || null); // parent might be null if root is parent
            } catch (err) {
                handleMoveNavigate(null); // Fallback to root
            }
        }
    };

    const handleMoveSubmit = async () => {
        if (!moveDialog.doc) return;
        try {
            await foldersAPI.moveDocuments(moveCurrentFolder ? moveCurrentFolder.id : 'root', [moveDialog.doc.id]);
            toast.success('Document moved successfully');
            setMoveDialog({ open: false, doc: null });
            loadDocuments(); // Refresh list
        } catch (err) {
            toast.error('Failed to move document');
        }
    };

    // --- Bulk & Clipboard Logic ---
    const toggleDocSelection = (id) => {
        const newSet = new Set(selectedDocs);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedDocs(newSet);
    };

    const toggleFolderSelection = (id) => {
        const newSet = new Set(selectedFolders);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedFolders(newSet);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedDocs(new Set(sortedDocuments.map(d => activeTab === 'my' ? d.id : d.document.id)));
            setSelectedFolders(new Set(folders.map(f => f.id)));
        } else {
            setSelectedDocs(new Set());
            setSelectedFolders(new Set());
        }
    };

    const handleBulkCopy = (mode) => {
        // mode: 'copy' or 'cut'
        setClipboard({
            mode,
            documents: Array.from(selectedDocs),
            folders: Array.from(selectedFolders)
        });
        toast.success(`${selectedDocs.size + selectedFolders.size} items ${mode === 'copy' ? 'copied' : 'cut'} to clipboard`);
        // Clear selection
        setSelectedDocs(new Set());
        setSelectedFolders(new Set());
    };

    const handlePaste = async () => {
        if (!clipboard) return;
        const targetFolderId = currentFolder ? currentFolder.id : 'root';
        const { mode, documents: docIds, folders: folderIds } = clipboard;

        try {
            // Handle Documents
            if (docIds.length > 0) {
                if (mode === 'copy') {
                    await documentsAPI.bulkCopy(docIds, targetFolderId);
                } else {
                    // Move
                    await foldersAPI.moveDocuments(targetFolderId === 'root' ? 'root' : targetFolderId, docIds);
                }
            }

            // Handle Folders (Move only implemented properly for now, copy is manual)
            // Note: We don't have bulk folder move/copy in API yet.
            // Loop for now.
            if (folderIds.length > 0) {
                if (mode === 'move') {
                    for (const fid of folderIds) {
                        // Don't move into self
                        if (fid === targetFolderId) continue;
                        await foldersAPI.update(fid, { parentId: targetFolderId === 'root' ? null : targetFolderId });
                    }
                } else {
                    // Copy Folders - NOT IMPLEMENTED BACKEND
                    // Skipping folder copy for now or implementing shallow creation?
                    // Let's notify user
                    if (folderIds.length > 0) toast('Folder copy not supported yet', { icon: '⚠️' });
                }
            }

            toast.success(`Items ${mode === 'copy' ? 'copied' : 'moved'} successfully`);
            setClipboard(null);
            loadDocuments();
            loadFolders();
        } catch (err) {
            console.error(err);
            toast.error('Failed to paste items');
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedDocs.size} documents and ${selectedFolders.size} folders?`)) return;

        try {
            if (selectedDocs.size > 0) {
                await documentsAPI.bulkDelete(Array.from(selectedDocs));
            }
            if (selectedFolders.size > 0) {
                for (const fid of selectedFolders) {
                    await foldersAPI.delete(fid);
                }
            }
            toast.success('Items deleted');
            setSelectedDocs(new Set());
            setSelectedFolders(new Set());
            loadDocuments();
            loadFolders();
        } catch (err) {
            toast.error('Failed to delete items');
        }
    };
    // ---------------------------

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

    // Sort documents
    const sortedDocuments = [...filteredDocuments].sort((a, b) => {
        const docA = activeTab === 'my' ? a : a.document;
        const docB = activeTab === 'my' ? b : b.document;
        if (!docA || !docB) return 0;

        let valueA, valueB;
        switch (sortField) {
            case 'name':
                valueA = docA.name?.toLowerCase() || '';
                valueB = docB.name?.toLowerCase() || '';
                break;
            case 'fileType':
                valueA = docA.fileType?.toLowerCase() || '';
                valueB = docB.fileType?.toLowerCase() || '';
                break;
            case 'fileSize':
                valueA = docA.fileSize || 0;
                valueB = docB.fileSize || 0;
                break;
            case 'createdAt':
            default:
                valueA = new Date(activeTab === 'shared' ? a.sharedAt : docA.createdAt).getTime();
                valueB = new Date(activeTab === 'shared' ? b.sharedAt : docB.createdAt).getTime();
                break;
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Handle column header click for sorting
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort indicator component
    const SortIndicator = ({ field }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc'
            ? <ChevronUp className="w-4 h-4 inline ml-1" />
            : <ChevronDown className="w-4 h-4 inline ml-1" />;
    };

    // Check if user can upload (admin, principal, lab_assistant, instructor)
    const canUpload = ['admin', 'principal', 'lab_assistant', 'instructor'].includes(user?.role);

    return (
        <div className="p-6 max-w-7xl mx-auto pb-24 relative">
            {/* Bulk Action Toolbar */}
            {(selectedDocs.size > 0 || selectedFolders.size > 0) && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 border border-slate-200 animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <span className="font-semibold text-slate-700 whitespace-nowrap">
                        {selectedDocs.size + selectedFolders.size} selected
                    </span>
                    <div className="h-6 w-px bg-slate-200" />
                    <button onClick={() => handleBulkCopy('copy')} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors">
                        <ClipboardCopy className="w-4 h-4" /> Copy
                    </button>
                    <button onClick={() => handleBulkCopy('cut')} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-orange-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors">
                        <Scissors className="w-4 h-4" /> Cut
                    </button>
                    <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-red-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors">
                        <Trash2 className="w-4 h-4" /> Delete
                    </button>
                    <div className="h-6 w-px bg-slate-200" />
                    <button onClick={() => { setSelectedDocs(new Set()); setSelectedFolders(new Set()); }} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
                    <p className="text-slate-500">Upload and manage PDFs, documents, and spreadsheets</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Storage Indicator */}
                    {storageInfo && canUpload && (
                        <div className="hidden sm:flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                            <HardDrive className="w-4 h-4 text-slate-500" />
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-600">
                                    {storageInfo.usedFormatted} / {storageInfo.quotaFormatted}
                                </span>
                                <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${storageInfo.percentUsed >= 90 ? 'bg-red-500' :
                                            storageInfo.percentUsed >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'
                                            }`}
                                        style={{ width: `${Math.min(100, storageInfo.percentUsed)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {canUpload && (
                        <div className="flex gap-2">
                            <button onClick={() => setShowCreateFolder(true)} className="btn bg-slate-100 text-slate-700 hover:bg-slate-200">
                                <FolderPlus className="w-4 h-4" /> New Folder
                            </button>
                            <button onClick={() => setShowUpload(true)} className="btn btn-primary">
                                <Upload className="w-4 h-4" /> Upload Document
                            </button>
                        </div>
                    )}
                    {clipboard && canUpload && (
                        <button onClick={handlePaste} className="btn bg-blue-100 text-blue-700 hover:bg-blue-200" title="Paste items here">
                            <Clipboard className="w-4 h-4 mr-2" /> Paste ({clipboard.documents.length + clipboard.folders.length})
                        </button>
                    )}
                </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
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
                {
                    canUpload && (
                        <button
                            onClick={() => setActiveTab('trash')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'trash'
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            <Trash className="w-4 h-4" />
                            Trash
                            {trashDocuments.length > 0 && (
                                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                    {trashDocuments.length}
                                </span>
                            )}
                        </button>
                    )
                }
            </div >

            {/* Filters */}
            < div className="flex flex-col gap-3 mb-6" >
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
            </div >

            {/* Breadcrumbs */}
            {
                activeTab === 'my' && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-slate-600 overflow-x-auto pb-2">
                        <button
                            onClick={() => handleFolderClick(null)}
                            className={`flex items-center gap-1 hover:text-primary-600 ${!currentFolder ? 'font-bold text-slate-900' : ''}`}
                        >
                            <HardDrive className="w-4 h-4" />
                            My Documents
                        </button>
                        {folderBreadcrumbs.map((crumb, index) => (
                            <div key={crumb.id} className="flex items-center gap-2 shrink-0">
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                <button
                                    onClick={() => handleNavigateBreadcrumb(crumb)}
                                    className={`hover:text-primary-600 ${index === folderBreadcrumbs.length - 1 ? 'font-bold text-slate-900' : ''}`}
                                >
                                    {crumb.name}
                                </button>
                            </div>
                        ))}
                        {currentFolder && !folderBreadcrumbs.find(b => b.id === currentFolder.id) && (
                            <div className="flex items-center gap-2 shrink-0">
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                <span className="font-bold text-slate-900">{currentFolder.name}</span>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Documents Grid */}
            {
                loading ? (
                    <div className="text-center py-12 text-slate-500">Loading...</div>
                ) : activeTab === 'trash' ? (
                    /* Trash View */
                    trashDocuments.length === 0 ? (
                        <div className="text-center py-12">
                            <Trash className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-500">Trash is empty</p>
                            <p className="text-sm text-slate-400 mt-2">Deleted documents will appear here for 30 days</p>
                        </div>
                    ) : (
                        <div className="card overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-red-50 border-b border-red-200">
                                    <tr>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Name</th>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden md:table-cell">Type</th>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden md:table-cell">Size</th>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell">Deleted</th>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell">Deleted By</th>
                                        <th className="text-left p-3 text-sm font-semibold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trashDocuments.map(doc => (
                                        <tr key={doc.id} className={`border-b border-slate-100 hover:bg-slate-50 group ${selectedDocs.has(doc.id) ? 'bg-primary-50' : ''}`}>
                                            {activeTab === 'my' && (
                                                <td className="p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDocs.has(doc.id)}
                                                        onChange={() => toggleDocSelection(doc.id)}
                                                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                </td>
                                            )}
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl opacity-50">{FILE_ICONS[doc.fileType] || FILE_ICONS.file}</span>
                                                    <div>
                                                        <p className="font-medium text-slate-700">{doc.name}</p>
                                                        {doc.description && <p className="text-xs text-slate-500 truncate max-w-xs">{doc.description}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm text-slate-600 hidden md:table-cell">{doc.fileType?.toUpperCase()}</td>
                                            <td className="p-3 text-sm text-slate-600 hidden md:table-cell">{doc.fileSizeFormatted || ''}</td>
                                            <td className="p-3 text-sm text-slate-500 hidden lg:table-cell">{formatDate(doc.deletedAt)}</td>
                                            <td className="p-3 text-sm text-slate-600 hidden lg:table-cell">
                                                {doc.deletedBy ? `${doc.deletedBy.firstName} ${doc.deletedBy.lastName}` : '-'}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleRestore(doc)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                                        title="Restore"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(doc)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        title="Delete Permanently"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : filteredDocuments.length === 0 && (activeTab !== 'my' || folders.length === 0) ? (
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-500">{activeTab === 'shared' ? 'No documents shared with you' : 'No documents found'}</p>
                        {activeTab === 'my' && canUpload && (
                            <button onClick={() => setShowUpload(true)} className="btn btn-primary mt-4">Upload your first document</button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Folders (Grid) */}
                        {activeTab === 'my' && folders.map(folder => (
                            <div
                                key={folder.id}
                                className={`card p-4 hover:shadow-md transition-all border border-slate-100 bg-slate-50/50 relative ${selectedFolders.has(folder.id) ? 'ring-2 ring-primary-500' : ''}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedFolders.has(folder.id)}
                                    onChange={() => toggleFolderSelection(folder.id)}
                                    className="absolute top-3 right-3 z-10 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                <div className="flex items-start justify-between cursor-pointer" onClick={() => handleFolderClick(folder)}>
                                    <div className="flex items-center gap-3">
                                        <Folder className="w-10 h-10 text-yellow-400 fill-yellow-100" />
                                        <div className="overflow-hidden">
                                            <h3 className="font-semibold text-slate-800 truncate" title={folder.name}>{folder.name}</h3>
                                            <p className="text-xs text-slate-500">{folder.documentCount || 0} files • {folder.subfolderCount || 0} folders</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {sortedDocuments.map(item => {
                            const doc = activeTab === 'my' ? item : item.document;
                            const shareInfo = activeTab === 'shared' ? item : null;
                            if (!doc) return null;
                            return (
                                <div key={doc.id + (shareInfo?.shareId || '')} className={`card p-4 hover:shadow-lg transition-shadow relative ${selectedDocs.has(doc.id) ? 'ring-2 ring-primary-500' : ''}`}>
                                    {activeTab === 'my' && (
                                        <input
                                            type="checkbox"
                                            checked={selectedDocs.has(doc.id)}
                                            onChange={() => toggleDocSelection(doc.id)}
                                            className="absolute top-3 right-3 z-10 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                        />
                                    )}
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

                                    {/* Share info for my documents */}
                                    {activeTab === 'my' && doc.shareCount > 0 && (
                                        <div className="mt-3 p-2 bg-emerald-50 rounded-lg text-xs">
                                            <div className="flex items-center gap-1 text-emerald-700 font-medium">
                                                <Share2 className="w-3 h-3" />
                                                Shared with {doc.shareCount} recipient{doc.shareCount > 1 ? 's' : ''}
                                            </div>
                                            <div className="mt-1 text-emerald-600 flex flex-wrap gap-1">
                                                {doc.shareInfo?.slice(0, 3).map((share, i) => (
                                                    <span key={share.id} className="inline-flex items-center px-1.5 py-0.5 bg-emerald-100 rounded text-emerald-700">
                                                        {share.type === 'class' ? '📚' : share.type === 'group' ? '👥' : '👤'} {share.targetName}
                                                    </span>
                                                ))}
                                                {doc.shareInfo?.length > 3 && (
                                                    <span className="text-emerald-500">+{doc.shareInfo.length - 3} more</span>
                                                )}
                                            </div>
                                        </div>
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
                                                <button onClick={() => handleOpenMoveDialog(doc)} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Move">
                                                    <FolderInput className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleShare(doc)} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded">
                                                    <Share2 className="w-4 h-4" />
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
                                    {activeTab === 'my' && (
                                        <th className="w-8 p-3">
                                            <input
                                                type="checkbox"
                                                onChange={handleSelectAll}
                                                checked={sortedDocuments.length > 0 && selectedDocs.size === sortedDocuments.length + folders.length && selectedFolders.size === folders.length}
                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                            />
                                        </th>
                                    )}
                                    <th
                                        onClick={() => handleSort('name')}
                                        className="text-left p-3 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                                    >
                                        Name<SortIndicator field="name" />
                                    </th>
                                    <th
                                        onClick={() => handleSort('fileType')}
                                        className="text-left p-3 text-sm font-semibold text-slate-700 hidden md:table-cell cursor-pointer hover:bg-slate-100 select-none"
                                    >
                                        Type<SortIndicator field="fileType" />
                                    </th>
                                    <th
                                        onClick={() => handleSort('fileSize')}
                                        className="text-left p-3 text-sm font-semibold text-slate-700 hidden md:table-cell cursor-pointer hover:bg-slate-100 select-none"
                                    >
                                        Size<SortIndicator field="fileSize" />
                                    </th>
                                    {activeTab === 'my' ? (
                                        <>
                                            <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell">Category</th>
                                            <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell">Shared With</th>
                                        </>
                                    ) : (
                                        <th className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell">Shared By</th>
                                    )}
                                    <th
                                        onClick={() => handleSort('createdAt')}
                                        className="text-left p-3 text-sm font-semibold text-slate-700 hidden lg:table-cell cursor-pointer hover:bg-slate-100 select-none"
                                    >
                                        {activeTab === 'my' ? 'Uploaded' : 'Shared On'}<SortIndicator field="createdAt" />
                                    </th>
                                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Folders (List) */}
                                {activeTab === 'my' && folders.map(folder => (
                                    <tr key={folder.id}
                                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer group ${selectedFolders.has(folder.id) ? 'bg-primary-50' : ''}`}
                                    >
                                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedFolders.has(folder.id)}
                                                onChange={() => toggleFolderSelection(folder.id)}
                                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                            />
                                        </td>
                                        <td className="p-3" onClick={() => handleFolderClick(folder)}>
                                            <div className="flex items-center gap-3">
                                                <Folder className="w-6 h-6 text-yellow-400 fill-yellow-100" />
                                                <div>
                                                    <p className="font-medium text-slate-900 group-hover:text-primary-600 transition-colors">{folder.name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-sm text-slate-600 hidden md:table-cell">Folder</td>
                                        <td className="p-3 text-sm text-slate-600 hidden md:table-cell">-</td>
                                        {activeTab === 'my' && (
                                            <>
                                                <td className="p-3 hidden lg:table-cell">
                                                    <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                                                        Folder
                                                    </span>
                                                </td>
                                                <td className="p-3 text-sm text-slate-600 hidden lg:table-cell">-</td>
                                            </>
                                        )}
                                        <td className="p-3 text-sm text-slate-600 hidden lg:table-cell">{formatDate(folder.createdAt)}</td>
                                        <td className="p-3">
                                            {/* Folder Actions Placeholder */}
                                        </td>
                                    </tr>
                                ))}

                                {sortedDocuments.map(item => {
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
                                                <>
                                                    <td className="p-3 hidden lg:table-cell">
                                                        {doc.category && <span className="px-2 py-0.5 text-xs rounded-full bg-primary-100 text-primary-700 capitalize">{doc.category}</span>}
                                                    </td>
                                                    <td className="p-3 hidden lg:table-cell">
                                                        {doc.shareCount > 0 ? (
                                                            <button
                                                                onClick={() => setShareInfoModal(doc)}
                                                                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded transition"
                                                            >
                                                                <Users className="w-3 h-3" />
                                                                {doc.shareCount}
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                </>
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
                                                            <button onClick={() => handleOpenMoveDialog(doc)} className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded" title="Move">
                                                                <FolderInput className="w-4 h-4" />
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
                )
            }

            {/* Upload Modal */}
            {
                showUpload && (
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
                )
            }

            {/* View/Preview Modal */}
            {
                viewingDoc && (
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
                                {['docx', 'xlsx', 'xls', 'csv'].includes(viewingDoc.fileType) ? (
                                    <FileViewer url={viewingDoc.url} fileType={viewingDoc.fileType} name={viewingDoc.name} />
                                ) : ['pdf', 'doc'].includes(viewingDoc.fileType) ? (
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
                )
            }

            {/* Edit Modal */}
            {
                editingDoc && (
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

                                {/* File replacement */}
                                <div>
                                    <label className="label">Replace File (optional)</label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center">
                                        {editFile ? (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-700">{editFile.name}</span>
                                                <button onClick={() => setEditFile(null)} className="text-red-500 hover:text-red-700">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="cursor-pointer">
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => setEditFile(e.target.files[0])}
                                                />
                                                <div className="text-slate-500 text-sm">
                                                    <Upload className="w-5 h-5 mx-auto mb-1" />
                                                    Click to select new file
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Current: {editingDoc?.fileName}</p>
                                </div>

                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={editData.isPublic} onChange={(e) => setEditData({ ...editData, isPublic: e.target.checked })} className="rounded" />
                                    <span className="text-sm text-slate-700">Make publicly shareable</span>
                                </label>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setEditingDoc(null)} className="btn btn-secondary flex-1">Cancel</button>
                                    <button onClick={handleSaveEdit} className="btn btn-primary flex-1">{editFile ? 'Replace & Save' : 'Save Changes'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Share Modal */}
            {
                sharingDoc && (
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

                                        {/* Selected Count Summary */}
                                        {shareTargets.length > 0 && (
                                            <div className="bg-slate-50 rounded-lg p-3">
                                                <p className="text-sm font-medium text-slate-700 mb-2">Selected Recipients ({shareTargets.length}):</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {/* Count by type */}
                                                    {['class', 'group', 'student', 'instructor', 'admin'].map(type => {
                                                        const count = shareTargets.filter(t => t.type === type).length;
                                                        if (count === 0) return null;
                                                        const labels = { class: 'Classes', group: 'Groups', student: 'Students', instructor: 'Instructors', admin: 'Admins' };
                                                        const colors = { class: 'bg-primary-100 text-primary-700', group: 'bg-emerald-100 text-emerald-700', student: 'bg-blue-100 text-blue-700', instructor: 'bg-amber-100 text-amber-700', admin: 'bg-purple-100 text-purple-700' };
                                                        return (
                                                            <span key={type} className={`px-2 py-1 text-xs rounded-full font-medium ${colors[type]}`}>
                                                                {count} {labels[type]}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                {/* List selected names */}
                                                <div className="mt-2 text-xs text-slate-500 max-h-20 overflow-y-auto">
                                                    {shareTargets.map((t, i) => {
                                                        let name = '';
                                                        // First check shareInfo for already-shared items (has the name already)
                                                        const existingShare = sharingDoc?.shareInfo?.find(s => s.type === t.type && s.targetId === t.id);
                                                        if (existingShare) {
                                                            name = existingShare.targetName;
                                                        } else if (t.type === 'class') {
                                                            const cls = availableClasses.find(c => c.id === t.id);
                                                            name = cls ? (cls.name || `Grade ${cls.gradeLevel}-${cls.section}`) : t.id;
                                                        } else if (t.type === 'group') {
                                                            const grp = availableGroups.find(g => g.id === t.id);
                                                            name = grp ? `${grp.name} (${grp.className})` : t.id;
                                                        } else if (t.type === 'student') {
                                                            const stu = availableStudents.find(s => s.id === t.id);
                                                            name = stu ? `${stu.firstName} ${stu.lastName}` : t.id;
                                                        } else {
                                                            const usr = availableInstructors.find(u => u.id === t.id);
                                                            name = usr ? `${usr.firstName} ${usr.lastName}` : t.id;
                                                        }
                                                        return <span key={i}>{i > 0 ? ', ' : ''}{name}</span>;
                                                    })}
                                                </div>
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
                )
            }


            {/* Share Info Popup Modal */}
            {
                shareInfoModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShareInfoModal(null)}>
                        <div className="bg-white rounded-2xl max-w-md w-full max-h-[60vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Shared With</h3>
                                <button onClick={() => setShareInfoModal(null)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto max-h-[calc(60vh-80px)]">
                                <p className="text-sm text-slate-600 mb-3">"{shareInfoModal.name}" is shared with:</p>
                                <div className="space-y-2">
                                    {shareInfoModal.shareInfo?.map((share, i) => (
                                        <div key={share.id || i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                            <span className="text-lg">
                                                {share.type === 'class' ? '📚' : share.type === 'group' ? '👥' : '👤'}
                                            </span>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-slate-900">{share.targetName}</p>
                                                <p className="text-xs text-slate-500 capitalize">{share.type}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!shareInfoModal.shareInfo || shareInfoModal.shareInfo.length === 0) && (
                                        <p className="text-sm text-slate-400 text-center py-4">No shares found</p>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-200 bg-slate-50">
                                <button onClick={() => { setShareInfoModal(null); handleShare(shareInfoModal); }} className="btn btn-primary w-full text-sm">
                                    <Share2 className="w-4 h-4" /> Edit Sharing
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create Folder Modal */}
            {
                showCreateFolder && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-lg">Create New Folder</h3>
                                <button onClick={() => setShowCreateFolder(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleCreateFolder} className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Folder Name *</label>
                                    <input
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        className="input w-full"
                                        placeholder="e.g. Project Docs"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateFolder(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                                        disabled={!newFolderName.trim()}
                                    >
                                        Create Folder
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }



            {/* Move Modal */}
            {
                moveDialog.open && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-lg">Move Document</h3>
                                <button onClick={() => setMoveDialog({ open: false, doc: null })} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                    <Folder className="w-4 h-4" />
                                    {moveCurrentFolder ? moveCurrentFolder.name : 'My Documents'}
                                </div>
                                {moveCurrentFolder && (
                                    <button onClick={handleMoveUp} className="text-sm bg-white border px-2 py-1 rounded hover:bg-slate-50 flex items-center gap-1">
                                        <CornerUpLeft className="w-3 h-3" /> Up
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {moveFolders.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 text-sm">No folders here</div>
                                ) : (
                                    <div className="space-y-1">
                                        {moveFolders.map(folder => (
                                            <div
                                                key={folder.id}
                                                onClick={() => handleMoveNavigate(folder)}
                                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 cursor-pointer"
                                            >
                                                <Folder className="w-5 h-5 text-yellow-500 fill-yellow-100" />
                                                <span className="text-sm font-medium text-slate-700">{folder.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t flex justify-end gap-3">
                                <button
                                    onClick={() => setMoveDialog({ open: false, doc: null })}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleMoveSubmit}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
                                    disabled={moveDialog.doc && moveDialog.doc.folderId === (moveCurrentFolder ? moveCurrentFolder.id : null)}
                                >
                                    Move Here
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

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
        </div >
    );
}
