'use client';

import { useState, useEffect } from 'react';
import { formatDateTimeIST } from '@/lib/utils';
import { Search, Filter, RefreshCw, User, Activity } from 'lucide-react';

interface Log {
    id: string;
    action: string;
    message: string;
    metadata: any;
    createdAt: string;
    adminName: string;
}

export default function ActivityLogViewer() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/activity');
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(filter.toLowerCase()) ||
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        log.adminName.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                    />
                </div>
                <button
                    onClick={loadLogs}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title="Refresh Logs"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3">Timestamp</th>
                                <th className="px-6 py-3">Action</th>
                                <th className="px-6 py-3">User</th>
                                <th className="px-6 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        Loading activity...
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        No activity logs found.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {formatDateTimeIST(log.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                <Activity className="w-3 h-3" />
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <User className="w-4 h-4 text-gray-400" />
                                                {log.adminName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {log.message}
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
