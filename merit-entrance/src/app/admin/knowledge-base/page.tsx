'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Upload, BookOpen, Trash2, Library, Loader2, CheckCircle2, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReferenceMaterial {
    id: string;
    title: string;
    author: string | null;
    createdAt: string;
    _count?: {
        chunks: number;
    };
}

export default function KnowledgeBasePage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (_hasHydrated && (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || ''))) {
            router.push('/');
        } else if (_hasHydrated) {
            fetchMaterials();
        }
    }, [_hasHydrated, isAuthenticated, user, router]);

    const fetchMaterials = async () => {
        try {
            const res = await fetch('/api/admin/knowledge-base');
            const data = await res.json();
            if (data.success) {
                setMaterials(data.materials);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== 'application/pdf') {
                toast.error('Please upload a PDF file');
                return;
            }
            setFile(selectedFile);
            if (!title) {
                setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
            }
        }
    };

    const handleUpload = async () => {
        if (!file || !title) {
            toast.error('Please provide a file and a title.');
            return;
        }

        setIsUploading(true);
        setProgress(10);

        try {
            // 1. Extract text using PDF.js inside the browser (to avoid massive server payload limits on Vercel/Netlify for large PDFs)
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = "";
            const numPages = pdf.numPages;

            for (let i = 1; i <= numPages; i++) {
                setProgress(10 + Math.round((i / numPages) * 30));
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(" ");
                fullText += pageText + "\n\n";
            }

            setProgress(50);

            // 2. Send the extracted text strings to our API for vector chunking
            const response = await fetch('/api/admin/knowledge-base/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    author,
                    textContent: fullText
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to upload knowledge base document');
            }

            setProgress(100);
            toast.success('Document vectorized and added to Knowledge Base!');
            setFile(null);
            setTitle('');
            setAuthor('');
            fetchMaterials();

        } catch (error: any) {
            console.error('Upload Error:', error);
            toast.error(error.message);
        } finally {
            setIsUploading(false);
            setProgress(0);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this document and all its embedded chunks from the Vector DB?')) return;

        try {
            const res = await fetch(`/api/admin/knowledge-base/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Document deleted');
                fetchMaterials();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to delete');
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to delete document');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                        <Library className="w-6 h-6 text-blue-600" />
                        Knowledge Base
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Upload textbooks and reference materials to power the AI Original Question Generator.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upload Form */}
                <div className="lg:col-span-1 border rounded-lg bg-white p-6 shadow-sm h-fit">
                    <h2 className="text-lg font-semibold mb-4">Add New Document</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. NCERT Physics Class 11"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Author / Publisher</label>
                            <input
                                type="text"
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. NCERT"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Upload PDF</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-400 transition-colors bg-gray-50">
                                <div className="space-y-1 text-center">
                                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                    <div className="flex text-sm text-gray-600 justify-center">
                                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 p-1">
                                            <span>Select a file</span>
                                            <input id="file-upload" name="file-upload" type="file" accept=".pdf" className="sr-only" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-500">Extracts embedded text up to 50MB</p>
                                </div>
                            </div>
                            {file && (
                                <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </div>
                            )}
                        </div>

                        {isUploading && (
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={!file || !title || isUploading}
                            className="w-full flex justify-center py-2 px-4 shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUploading ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Embedding Vectors...</>
                            ) : (
                                <><Upload className="w-5 h-5 mr-2" /> Vectorize Document</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Document List */}
                <div className="lg:col-span-2 border rounded-lg bg-white shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-semibold">Indexed Materials</h2>
                        <span className="text-sm bg-blue-100 text-blue-800 py-1 px-2 rounded-full font-medium">
                            {materials.length} Documents
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : materials.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                            <BookOpen className="w-12 h-12 mb-3 text-gray-300" />
                            <p className="text-lg font-medium text-gray-900">No documents yet</p>
                            <p className="max-w-sm mt-1">Upload textbooks to enable AI Original Question Generation through semantic RAG search.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {materials.map((doc) => (
                                <li key={doc.id} className="p-4 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                            <BookOpen className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{doc.title}</h3>
                                            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                                                {doc.author && <span>By {doc.author}</span>}
                                                <span className="flex items-center gap-1">
                                                    <Layers className="w-4 h-4" />
                                                    {doc._count?.chunks || 0} chunks
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleDelete(doc.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                            title="Delete Document"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
