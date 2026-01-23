'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Database, AlertCircle, CheckCircle, Clock, RefreshCw, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface QueryLog {
    id: string;
    route: string;
    method: string;
    query: string | null;
    params: string | null;
    success: boolean;
    error: string | null;
    duration: number | null;
    user_id: string | null;
    created_at: string;
}

interface Stats {
    total: number;
    totalErrors: number;
    errorRate: string;
    last24h: { total: number; errors: number; errorRate: string };
    lastHour: number;
    avgDurationMs: number;
}

export default function QueryLogsPage() {
    const [logs, setLogs] = useState<QueryLog[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
    const [filters, setFilters] = useState({ success: '', search: '' });
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTimeRange, setDeleteTimeRange] = useState('7d');

    useEffect(() => {
        loadData();
    }, [pagination.page, filters.success]);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pagination.page),
                limit: String(pagination.limit),
                ...(filters.success && { success: filters.success }),
                ...(filters.search && { search: filters.search })
            });

            const response = await fetch(`/api/admin/query-logs?${params}`);
            const data = await response.json();

            if (data.success) {
                setLogs(data.data.logs);
                setPagination(prev => ({ ...prev, ...data.data.pagination }));
                setStats(data.data.stats);
            } else {
                toast.error(data.error || 'Failed to load logs');
            }
        } catch (error) {
            console.error('Failed to load query logs:', error);
            toast.error('Failed to load query logs');
        } finally {
            setLoading(false);
        }
    };

    const timeRangeOptions = [
        { value: '1h', label: 'Last hour', days: 0.042 },
        { value: '24h', label: 'Last 24 hours', days: 1 },
        { value: '7d', label: 'Last 7 days', days: 7 },
        { value: '4w', label: 'Last 4 weeks', days: 28 },
        { value: 'all', label: 'All time', days: 9999 }
    ];

    const handleClearLogs = async () => {
        const selected = timeRangeOptions.find(o => o.value === deleteTimeRange);
        if (!selected) return;

        setShowDeleteModal(false);
        try {
            const response = await fetch(`/api/admin/query-logs?days=${selected.days}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
                toast.success(data.message);
                loadData();
            } else {
                toast.error(data.error || 'Failed to clear logs');
            }
        } catch (error) {
            toast.error('Failed to clear logs');
        }
    };

    const formatDuration = (ms: number | null) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-xl font-bold text-gray-900">Query Logs</h1>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                <Trash2 className="w-4 h-4" />
                                Clear Logs
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <Database className="w-4 h-4" />
                                Total Queries
                            </div>
                            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
                                <AlertCircle className="w-4 h-4" />
                                Errors
                            </div>
                            <div className="text-2xl font-bold text-red-600">{stats.totalErrors}</div>
                            <div className="text-xs text-gray-500">{stats.errorRate}% rate</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-blue-500 text-sm mb-1">
                                <Clock className="w-4 h-4" />
                                Last 24h
                            </div>
                            <div className="text-2xl font-bold">{stats.last24h.total.toLocaleString()}</div>
                            <div className="text-xs text-red-500">{stats.last24h.errors} errors</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-green-500 text-sm mb-1">
                                <CheckCircle className="w-4 h-4" />
                                Last Hour
                            </div>
                            <div className="text-2xl font-bold">{stats.lastHour.toLocaleString()}</div>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-purple-500 text-sm mb-1">
                                <Clock className="w-4 h-4" />
                                Avg Duration
                            </div>
                            <div className="text-2xl font-bold">{formatDuration(stats.avgDurationMs)}</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <select
                            value={filters.success}
                            onChange={e => { setFilters(f => ({ ...f, success: e.target.value })); setPagination(p => ({ ...p, page: 1 })); }}
                            className="px-3 py-2 border rounded-lg text-sm"
                        >
                            <option value="">All Status</option>
                            <option value="true">Success</option>
                            <option value="false">Errors Only</option>
                        </select>
                        <div className="flex-1 relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search route or error..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                                value={filters.search}
                                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && loadData()}
                            />
                        </div>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left">Timestamp</th>
                                    <th className="px-4 py-3 text-left">Route</th>
                                    <th className="px-4 py-3 text-left">Method</th>
                                    <th className="px-4 py-3 text-right">Duration</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <>
                                        <tr
                                            key={log.id}
                                            className={`border-t cursor-pointer hover:bg-gray-50 ${!log.success ? 'bg-red-50' : ''}`}
                                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                                                {formatDate(log.created_at)}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs max-w-xs truncate">
                                                {log.route}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs ${log.method === 'GET' ? 'bg-green-100 text-green-700' :
                                                        log.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                                                            log.method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                                                                log.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                                    'bg-gray-100'
                                                    }`}>
                                                    {log.method}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs">
                                                {formatDuration(log.duration)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {log.success ? (
                                                    <CheckCircle className="w-4 h-4 text-green-500 inline" />
                                                ) : (
                                                    <AlertCircle className="w-4 h-4 text-red-500 inline" />
                                                )}
                                            </td>
                                        </tr>
                                        {expandedLog === log.id && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={5} className="px-4 py-3">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <div className="font-medium text-xs text-gray-500 mb-1">Query/Params</div>
                                                            <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                                                                {log.query || log.params || '-'}
                                                            </pre>
                                                        </div>
                                                        {log.error && (
                                                            <div>
                                                                <div className="font-medium text-xs text-red-500 mb-1">Error</div>
                                                                <pre className="text-xs bg-red-50 text-red-700 p-2 rounded border border-red-200 overflow-auto max-h-40">
                                                                    {log.error}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            {loading ? 'Loading...' : 'No query logs found'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="px-4 py-3 border-t flex justify-between items-center">
                            <div className="text-sm text-gray-500">
                                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                    disabled={pagination.page <= 1}
                                    className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                    disabled={pagination.page >= pagination.pages}
                                    className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
                        <div className="p-6 border-b">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">Clear Query Logs</h3>
                                    <p className="text-sm text-gray-500">Select time range to delete</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-2">
                            {timeRangeOptions.map(option => (
                                <label
                                    key={option.value}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${deleteTimeRange === option.value
                                            ? 'border-red-500 bg-red-50'
                                            : 'border-gray-200 hover:border-red-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="deleteTimeRange"
                                        value={option.value}
                                        checked={deleteTimeRange === option.value}
                                        onChange={(e) => setDeleteTimeRange(e.target.value)}
                                        className="w-4 h-4 text-red-500"
                                    />
                                    <span className="font-medium">{option.label}</span>
                                    {option.value === 'all' && (
                                        <span className="text-xs text-red-600 font-medium">⚠️ Deletes everything</span>
                                    )}
                                </label>
                            ))}
                        </div>
                        <div className="p-4 border-t flex gap-3 justify-end">
                            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleClearLogs} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                Delete Logs
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
