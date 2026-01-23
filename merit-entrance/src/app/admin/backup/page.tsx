'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ChevronLeft, Database, CloudUpload, Download, Upload, Trash2,
    RefreshCw, CheckCircle, AlertCircle, Cloud, HardDrive
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BackupStats {
    admins: number;
    students: number;
    exams: number;
    sections: number;
    questions: number;
    exam_schedules: number;
    exam_assignments: number;
    exam_attempts: number;
    question_responses: number;
    demo_content: number;
    size: string;
    timestamp: string;
}

interface CloudBackup {
    publicId: string;
    url: string;
    createdAt: string;
    size: string;
}

export default function BackupPage() {
    const [loading, setLoading] = useState(false);
    const [cloudBackups, setCloudBackups] = useState<CloudBackup[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(true);
    const [lastBackup, setLastBackup] = useState<BackupStats | null>(null);
    const [restoreData, setRestoreData] = useState<unknown>(null);
    const [restoreFilename, setRestoreFilename] = useState('');
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        loadCloudBackups();
    }, []);

    const loadCloudBackups = async () => {
        setLoadingBackups(true);
        try {
            const response = await fetch('/api/admin/backup/list');
            const data = await response.json();
            if (data.success) {
                setCloudBackups(data.backups);
            }
        } catch (error) {
            console.error('Failed to load backups:', error);
        } finally {
            setLoadingBackups(false);
        }
    };

    const createBackup = async (uploadToCloud: boolean) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/backup?upload=${uploadToCloud}`);
            const data = await response.json();

            if (data.success) {
                setLastBackup(data.stats);

                if (uploadToCloud) {
                    toast.success('Backup uploaded to cloud!');
                    loadCloudBackups();
                } else {
                    // Download the backup file
                    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = data.filename;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Backup downloaded!');
                }
            } else {
                toast.error(data.error || 'Backup failed');
            }
        } catch (error) {
            toast.error('Backup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                setRestoreData(data);
                setRestoreFilename(file.name);
                toast.success('Backup file loaded');
            } catch {
                toast.error('Invalid backup file');
            }
        };
        reader.readAsText(file);
    };

    const restoreBackup = async () => {
        if (!restoreData) return;

        if (!confirm('This will restore data from the backup. Existing data will NOT be deleted, but duplicates will be skipped. Continue?')) {
            return;
        }

        setRestoring(true);
        try {
            const response = await fetch('/api/admin/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backup: restoreData }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Restore completed!');
                setRestoreData(null);
                setRestoreFilename('');
            } else {
                toast.error(data.error || 'Restore failed');
            }
        } catch (error) {
            toast.error('Restore failed');
        } finally {
            setRestoring(false);
        }
    };

    const deleteCloudBackup = async (publicId: string) => {
        if (!confirm('Delete this backup from cloud storage?')) return;

        try {
            const response = await fetch(`/api/admin/backup?publicId=${encodeURIComponent(publicId)}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Backup deleted');
                loadCloudBackups();
            } else {
                toast.error(data.error || 'Delete failed');
            }
        } catch {
            toast.error('Delete failed');
        }
    };

    const downloadFromCloud = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(downloadUrl);
        } catch {
            toast.error('Download failed');
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Backup & Restore</h1>
                                <p className="text-sm text-gray-500">Manage database backups</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Create Backup Section */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Create Backup
                    </h2>
                    <p className="text-gray-600 mb-4">
                        Create a complete backup of all database tables including exams, questions, students, and attempts.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => createBackup(false)}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            <HardDrive className="w-4 h-4" />
                            {loading ? 'Creating...' : 'Download to Computer'}
                        </button>
                        <button
                            onClick={() => createBackup(true)}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                            <CloudUpload className="w-4 h-4" />
                            {loading ? 'Uploading...' : 'Upload to Cloud'}
                        </button>
                    </div>

                    {lastBackup && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                                <CheckCircle className="w-4 h-4" />
                                Backup Created Successfully
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm text-green-800">
                                <div>Exams: {lastBackup.exams}</div>
                                <div>Sections: {lastBackup.sections}</div>
                                <div>Questions: {lastBackup.questions}</div>
                                <div>Students: {lastBackup.students}</div>
                                <div>Size: {lastBackup.size}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Restore Section */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Restore from Backup
                    </h2>
                    <p className="text-gray-600 mb-4">
                        Upload a backup file to restore data. Existing data will not be deleted.
                    </p>

                    <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400">
                            <Upload className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">Choose backup file</span>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </label>

                        {restoreFilename && (
                            <>
                                <span className="text-sm text-gray-600">
                                    Selected: <strong>{restoreFilename}</strong>
                                </span>
                                <button
                                    onClick={restoreBackup}
                                    disabled={restoring}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                                >
                                    {restoring ? 'Restoring...' : 'Restore Now'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Cloud Backups Section */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Cloud className="w-5 h-5" />
                            Cloud Backups
                        </h2>
                        <button
                            onClick={loadCloudBackups}
                            disabled={loadingBackups}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    {loadingBackups ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : cloudBackups.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            No cloud backups found
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {cloudBackups.map((backup) => (
                                <div
                                    key={backup.publicId}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                                >
                                    <div>
                                        <div className="font-medium text-gray-900">
                                            {backup.publicId.split('/').pop()}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {formatDate(backup.createdAt)} • {backup.size}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => downloadFromCloud(backup.url, backup.publicId.split('/').pop() + '.json')}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteCloudBackup(backup.publicId)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
