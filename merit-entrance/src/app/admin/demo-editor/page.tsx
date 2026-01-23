'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Trash2, Edit2, Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'react-hot-toast';
import ScientificEditor from '@/components/ScientificEditor';

interface DemoContent {
    id: string;
    title: string;
    content: string;
    contentType: string;
    createdAt: string;
    updatedAt: string;
}

const CONTENT_TYPES = [
    { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-700' },
    { value: 'math', label: 'Mathematics', color: 'bg-blue-100 text-blue-700' },
    { value: 'chemistry', label: 'Chemistry', color: 'bg-green-100 text-green-700' },
    { value: 'physics', label: 'Physics', color: 'bg-purple-100 text-purple-700' },
    { value: 'biology', label: 'Biology', color: 'bg-orange-100 text-orange-700' },
];

export default function DemoEditorPage() {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [contentType, setContentType] = useState('general');
    const [savedItems, setSavedItems] = useState<DemoContent[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Load saved items
    const loadSavedItems = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/demo-content');
            const data = await response.json();
            if (data.success) {
                setSavedItems(data.items);
            }
        } catch (error) {
            console.error('Failed to load items:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSavedItems();
    }, []);

    // Save content
    const handleSave = async () => {
        if (!title.trim()) {
            toast.error('Please enter a title');
            return;
        }
        if (!content.trim()) {
            toast.error('Please enter some content');
            return;
        }

        setSaving(true);
        try {
            const url = editingId
                ? `/api/admin/demo-content/${editingId}`
                : '/api/admin/demo-content';

            const response = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, contentType }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(editingId ? 'Updated successfully!' : 'Saved successfully!');
                setTitle('');
                setContent('');
                setContentType('general');
                setEditingId(null);
                loadSavedItems();
            } else {
                toast.error(data.error || 'Failed to save');
            }
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // Edit item
    const handleEdit = (item: DemoContent) => {
        setEditingId(item.id);
        setTitle(item.title);
        setContent(item.content);
        setContentType(item.contentType);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Delete item
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            const response = await fetch(`/api/admin/demo-content/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Deleted successfully!');
                loadSavedItems();
                if (editingId === id) {
                    setEditingId(null);
                    setTitle('');
                    setContent('');
                    setContentType('general');
                }
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete');
        }
    };

    // Cancel edit
    const handleCancelEdit = () => {
        setEditingId(null);
        setTitle('');
        setContent('');
        setContentType('general');
    };

    const getTypeStyle = (type: string) => {
        const found = CONTENT_TYPES.find(t => t.value === type);
        return found?.color || CONTENT_TYPES[0].color;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Toaster position="top-right" />

            {/* Header */}
            <header className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/admin')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Scientific Symbol Editor Demo</h1>
                            <p className="text-sm text-gray-500">Create and manage content with math, chemistry, physics & biology symbols</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Editor Section */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">
                                    {editingId ? '✏️ Edit Content' : '🆕 Create New Content'}
                                </h2>
                                {editingId && (
                                    <button
                                        onClick={handleCancelEdit}
                                        className="text-sm text-gray-500 hover:text-gray-700"
                                    >
                                        Cancel editing
                                    </button>
                                )}
                            </div>

                            {/* Title Input */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter a title for your content..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Content Type */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Content Type
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {CONTENT_TYPES.map((type) => (
                                        <button
                                            key={type.value}
                                            onClick={() => setContentType(type.value)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${contentType === type.value
                                                    ? `${type.color} ring-2 ring-offset-1 ring-blue-500`
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scientific Editor */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Content
                                </label>
                                <ScientificEditor
                                    value={content}
                                    onChange={setContent}
                                    placeholder="Type your content here... Use the symbol picker above to insert scientific symbols!"
                                />
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : editingId ? 'Update' : 'Save to Database'}
                                </button>
                            </div>

                            {/* Preview */}
                            {content && (
                                <div className="mt-6 pt-6 border-t">
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
                                    <div className="p-4 bg-gray-50 rounded-lg border">
                                        <div className="whitespace-pre-wrap font-mono text-lg">{content}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Saved Items Section */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">📁 Saved Content</h2>
                                <button
                                    onClick={loadSavedItems}
                                    disabled={loading}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                                    <p className="text-gray-500 mt-2">Loading...</p>
                                </div>
                            ) : savedItems.length === 0 ? (
                                <div className="text-center py-8">
                                    <Plus className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-500">No saved content yet</p>
                                    <p className="text-sm text-gray-400">Create your first entry above!</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {savedItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`p-4 rounded-lg border transition-all ${editingId === item.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                                                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full mt-1 ${getTypeStyle(item.contentType)}`}>
                                                        {CONTENT_TYPES.find(t => t.value === item.contentType)?.label || 'General'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1 ml-2">
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 font-mono line-clamp-2">{item.content}</p>
                                            <p className="text-xs text-gray-400 mt-2">
                                                {new Date(item.updatedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Help Section */}
                <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border p-6">
                    <h2 className="text-lg font-semibold mb-4">📖 Quick Reference</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-lg">
                            <h3 className="font-medium text-blue-700 mb-2">🔢 Mathematics</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Greek letters: α, β, γ, θ, π</li>
                                <li>• Operators: √, ∫, ∑, ∂, ∇</li>
                                <li>• Superscripts: x², x³, xⁿ</li>
                                <li>• Relations: ≤, ≥, ≠, ≈</li>
                            </ul>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                            <h3 className="font-medium text-green-700 mb-2">🧪 Chemistry</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Subscripts: H₂O, CO₂, H₂SO₄</li>
                                <li>• Reactions: →, ⇌, ⟶</li>
                                <li>• States: ↑ (gas), ↓ (precipitate)</li>
                                <li>• Charges: ⊕, ⊖</li>
                            </ul>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                            <h3 className="font-medium text-purple-700 mb-2">⚡ Physics</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• h-bar: ℏ</li>
                                <li>• Units: Å, ℃, ℉, Ω</li>
                                <li>• Operations: ·, ×</li>
                                <li>• Constants: ε, μ, λ</li>
                            </ul>
                        </div>
                        <div className="bg-white p-4 rounded-lg">
                            <h3 className="font-medium text-orange-700 mb-2">🧬 Biology</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Gender: ♀, ♂</li>
                                <li>• Extinction: †</li>
                                <li>• Temperature: °C</li>
                                <li>• Reactions: →, ⇌</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
