'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { ArrowLeft, Tag, Plus, Trash2, Search, AlertCircle, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface TagItem {
    id: string;
    name: string;
    created_at: string;
}

export default function TagsManagementPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [tags, setTags] = useState<TagItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTagName, setNewTagName] = useState('');
    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadTags();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadTags = async () => {
        try {
            const response = await fetch('/api/admin/tags');
            const data = await response.json();
            if (data.success) {
                setTags(data.tags);
            }
        } catch (error) {
            console.error('Failed to load tags:', error);
            toast.error('Failed to load tags');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,name\nScience\nMathematics\nReasoning";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "tags_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleAddTag = async () => {
        if (!newTagName.trim()) {
            toast.error('Tag name cannot be empty');
            return;
        }

        setAdding(true);
        try {
            const response = await fetch('/api/admin/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTagName.trim() }),
            });

            const data = await response.json();
            if (response.ok) {
                toast.success('Tag added successfully');
                setNewTagName('');
                loadTags();
            } else {
                toast.error(data.error || 'Failed to add tag');
            }
        } catch (error) {
            toast.error('Failed to add tag');
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteTag = async (tagId: string, tagName: string) => {
        if (!confirm(`Delete tag "${tagName}"? Questions using this tag will become untagged.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/tags?id=${tagId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Tag deleted');
                loadTags();
            } else {
                toast.error('Failed to delete tag');
            }
        } catch (error) {
            toast.error('Failed to delete tag');
        }
    };

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Tag className="w-6 h-6 text-purple-600" />
                        <h1 className="text-xl font-bold text-gray-900">Tag Management</h1>
                    </div>
                    <button
                        onClick={handleDownloadTemplate}
                        className="ml-auto px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <FileDown className="w-4 h-4" />
                        Download Template
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Info Banner */}
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-purple-800">
                        <p className="font-medium">About Tags</p>
                        <p className="mt-1">Tags help categorize questions by topic, exam type, or year (e.g., SOE2025, Botany, Physics). Each question can have one tag assigned.</p>
                    </div>
                </div>

                {/* Add New Tag */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Tag</h2>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                            placeholder="Enter tag name (e.g., SOE2025, Botany, Physics)"
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <button
                            onClick={handleAddTag}
                            disabled={adding || !newTagName.trim()}
                            className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>
                </div>

                {/* Tags List */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            All Tags ({tags.length})
                        </h2>
                        <div className="relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search tags..."
                                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-48 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {filteredTags.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Tag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p>{search ? 'No tags match your search' : 'No tags created yet'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {filteredTags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-purple-200 transition group"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></div>
                                        <span className="font-medium text-gray-900 truncate">{tag.name}</span>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteTag(tag.id, tag.name)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition"
                                        title="Delete tag"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
