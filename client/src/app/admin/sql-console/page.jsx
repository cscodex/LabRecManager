'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Play, Trash2, Download, AlertTriangle, CheckCircle, Key, Terminal, Table2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function SQLConsolePage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();

    const [connectionString, setConnectionString] = useState('');
    const [sqlQuery, setSqlQuery] = useState('SELECT 1 as test;');
    const [isExecuting, setIsExecuting] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [queryHistory, setQueryHistory] = useState([]);
    const [useCustomConnection, setUseCustomConnection] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        // Admin only
        if (user?.role !== 'admin' && user?.role !== 'principal') {
            router.push('/dashboard');
            toast.error('Access denied. Admin only.');
            return;
        }
    }, [isAuthenticated, user, _hasHydrated]);

    const executeQuery = async () => {
        if (!sqlQuery.trim()) {
            toast.error('Please enter a SQL query');
            return;
        }

        setIsExecuting(true);
        setError(null);
        setResults(null);

        try {
            const response = await api.post('/admin/sql/execute', {
                query: sqlQuery,
                connectionString: useCustomConnection ? connectionString : undefined
            });

            setResults(response.data.data);

            // Add to history
            setQueryHistory(prev => [
                { query: sqlQuery, timestamp: new Date(), success: true },
                ...prev.slice(0, 9) // Keep last 10
            ]);

            toast.success(`Query executed. ${response.data.data.rowCount || 0} row(s) affected.`);
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Query execution failed';
            setError(errorMessage);
            setQueryHistory(prev => [
                { query: sqlQuery, timestamp: new Date(), success: false, error: errorMessage },
                ...prev.slice(0, 9)
            ]);
            toast.error('Query failed');
        } finally {
            setIsExecuting(false);
        }
    };

    const clearResults = () => {
        setResults(null);
        setError(null);
    };

    const downloadResults = () => {
        if (!results?.rows) return;

        const headers = results.fields?.map(f => f.name) || Object.keys(results.rows[0] || {});
        const csv = [
            headers.join(','),
            ...results.rows.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_results_${Date.now()}.csv`;
        a.click();
    };

    const loadFromHistory = (query) => {
        setSqlQuery(query);
    };

    if (!_hasHydrated || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="SQL Console" titleHindi="SQL कंसोल">
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Admin Only - Use with caution</span>
                </div>
            </PageHeader>

            <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Connection Settings */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                            <Key className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-900">Database Connection</h2>
                            <p className="text-sm text-slate-500">Configure connection settings</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useCustomConnection}
                                onChange={(e) => setUseCustomConnection(e.target.checked)}
                                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-slate-700">Use custom Neon connection string</span>
                        </label>

                        {useCustomConnection && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Neon Connection String
                                </label>
                                <input
                                    type="password"
                                    value={connectionString}
                                    onChange={(e) => setConnectionString(e.target.value)}
                                    placeholder="postgresql://user:password@host/database?sslmode=require"
                                    className="input w-full font-mono text-sm"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Format: postgresql://[user]:[password]@[host]/[database]?sslmode=require
                                </p>
                            </div>
                        )}

                        {!useCustomConnection && (
                            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-lg">
                                <Database className="w-4 h-4" />
                                <span>Using default server connection (DATABASE_URL)</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* SQL Query Editor */}
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <Terminal className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">SQL Query</h2>
                                <p className="text-sm text-slate-500">Write and execute SQL statements</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearResults}
                                className="btn btn-ghost text-sm"
                                disabled={!results && !error}
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear
                            </button>
                            <button
                                onClick={executeQuery}
                                disabled={isExecuting || !sqlQuery.trim()}
                                className="btn btn-primary"
                            >
                                {isExecuting ? (
                                    <>
                                        <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                                        Executing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4" />
                                        Execute
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <textarea
                        value={sqlQuery}
                        onChange={(e) => setSqlQuery(e.target.value)}
                        placeholder="SELECT * FROM users LIMIT 10;"
                        rows={10}
                        className="input w-full font-mono text-sm resize-y"
                        spellCheck={false}
                    />

                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <span>Tip: Use Ctrl+Enter to execute</span>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="card p-6 bg-red-50 border-red-200">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-red-800">Query Error</h3>
                                <pre className="text-sm text-red-700 mt-2 whitespace-pre-wrap font-mono bg-red-100 p-3 rounded-lg overflow-x-auto">
                                    {error}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results Display */}
                {results && (
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <Table2 className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-slate-900">Results</h2>
                                    <p className="text-sm text-slate-500">
                                        {results.rowCount || results.rows?.length || 0} row(s) returned
                                    </p>
                                </div>
                            </div>

                            {results.rows?.length > 0 && (
                                <button onClick={downloadResults} className="btn btn-ghost text-sm">
                                    <Download className="w-4 h-4" />
                                    Download CSV
                                </button>
                            )}
                        </div>

                        {results.rows && results.rows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            {(results.fields?.map(f => f.name) || Object.keys(results.rows[0])).map((col, i) => (
                                                <th key={i} className="px-4 py-2 text-left font-medium text-slate-700 border-b">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.rows.slice(0, 100).map((row, rowIndex) => (
                                            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                {(results.fields?.map(f => f.name) || Object.keys(row)).map((col, colIndex) => (
                                                    <td key={colIndex} className="px-4 py-2 border-b border-slate-100 font-mono text-xs">
                                                        {row[col] === null ? (
                                                            <span className="text-slate-400 italic">NULL</span>
                                                        ) : typeof row[col] === 'object' ? (
                                                            JSON.stringify(row[col])
                                                        ) : (
                                                            String(row[col])
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {results.rows.length > 100 && (
                                    <p className="text-sm text-slate-500 mt-2 text-center">
                                        Showing first 100 of {results.rows.length} rows
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-lg">
                                <CheckCircle className="w-5 h-5" />
                                <span>Query executed successfully. {results.rowCount || 0} row(s) affected.</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Query History */}
                {queryHistory.length > 0 && (
                    <div className="card p-6">
                        <h2 className="font-semibold text-slate-900 mb-4">Recent Queries</h2>
                        <div className="space-y-2">
                            {queryHistory.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => loadFromHistory(item.query)}
                                    className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition group"
                                >
                                    <div className="flex items-center justify-between">
                                        <code className="text-xs font-mono text-slate-600 truncate flex-1 mr-4">
                                            {item.query.substring(0, 80)}{item.query.length > 80 ? '...' : ''}
                                        </code>
                                        <div className="flex items-center gap-2">
                                            {item.success ? (
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                            )}
                                            <span className="text-xs text-slate-400">
                                                {new Date(item.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
