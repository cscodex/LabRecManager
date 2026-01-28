'use client';

import { useState, useEffect } from 'react';
import { formatDateTimeIST } from '@/lib/utils';
import { Download, Upload, Database, RefreshCw, FileJson, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Backup {
    id: string;
    type: string;
    action: string;
    status: string;
    filename: string;
    size: number;
    createdAt: string;
    adminName: string;
}

export default function BackupSettings() {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadBackups();
    }, []);

    const loadBackups = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/backups');
            const data = await res.json();
            if (data.success) {
                setBackups(data.backups);
            }
        } catch (error) {
            toast.error('Failed to load backups');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBackup = async (type: 'json' | 'sql') => {
        if (!confirm(`Are you sure you want to generate a new ${type.toUpperCase()} backup?`)) return;

        setProcessing(true);
        // NOTE: Actual backup generation logic would go to a POST endpoint here
        // For now we simulate it or implement the POST endpoint next
        try {
            // Mocking the call for UI integration - we need to implement POST route later or now
            // await fetch('/api/admin/backups', { method: 'POST', body: JSON.stringify({ type }) });
            toast.success('Backup initiated (Simulation)');
            // Refresh list
            loadBackups();
        } catch (error) {
            toast.error('Backup failed');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex flex-col items-center text-center">
                    <Database className="w-10 h-10 text-blue-600 mb-3" />
                    <h3 className="font-semibold text-gray-900">SQL Backup</h3>
                    <p className="text-sm text-gray-500 mb-4">Full database dump for disaster recovery.</p>
                    <button
                        onClick={() => handleCreateBackup('sql')}
                        disabled={processing}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                    >
                        {processing ? 'Processing...' : 'Generate New SQL Backup'}
                    </button>
                </div>

                <div className="bg-purple-50 p-6 rounded-xl border border-purple-100 flex flex-col items-center text-center">
                    <FileJson className="w-10 h-10 text-purple-600 mb-3" />
                    <h3 className="font-semibold text-gray-900">JSON Export</h3>
                    <p className="text-sm text-gray-500 mb-4">Export exam questions for portability.</p>
                    <button
                        onClick={() => handleCreateBackup('json')}
                        disabled={processing}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                    >
                        {processing ? 'Processing...' : 'Generate New JSON Export'}
                    </button>
                </div>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
                    <h3 className="font-semibold text-gray-900">Backup History</h3>
                    <button onClick={loadBackups} className="text-gray-500 hover:text-gray-700">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Admin</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : backups.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No backups found.</td></tr>
                            ) : (
                                backups.map(backup => (
                                    <tr key={backup.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{formatDateTimeIST(backup.createdAt)}</td>
                                        <td className="px-6 py-4 uppercase font-medium">{backup.type}</td>
                                        <td className="px-6 py-4">
                                            {backup.status === 'success' ?
                                                <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" /> Success</span> :
                                                <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> Failed</span>
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">{backup.adminName}</td>
                                        <td className="px-6 py-4 text-right">
                                            {backup.status === 'success' && (
                                                <button className="text-blue-600 hover:text-blue-800 font-medium text-xs">Download</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
