'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Bot, Send, Upload, Database, ChevronDown, ChevronRight, Trash2,
    Sparkles, FileText, AlertTriangle, Copy, Check, RefreshCw, X,
    Loader2, Minimize2, Maximize2, Download, Image as ImageIcon, User, BarChart2, Expand, Shrink, File
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';

/* ─── Markdown-ish renderer ─── */
function RenderMessage({ content }) {
    if (!content) return null;
    const parts = content.split(/(```[\s\S]*?```)/g);
    return (
        <div className="ai-prose text-[13px] leading-relaxed">
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const m = part.match(/```(\w+)?\n?([\s\S]*?)```/);
                    if (m) return <CodeBlock key={i} code={m[2].trim()} language={m[1] || ''} />;
                }
                const html = part
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono text-pink-600">$1</code>')
                    .replace(/^### (.+)$/gm, '<h4 class="font-semibold mt-2 mb-0.5 text-[13px]">$1</h4>')
                    .replace(/^## (.+)$/gm, '<h3 class="font-semibold mt-3 mb-1 text-sm">$1</h3>')
                    .replace(/^- (.+)$/gm, '<li class="ml-3 list-disc text-[13px]">$1</li>')
                    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-3 list-decimal text-[13px]">$2</li>')
                    .replace(/\n{2,}/g, '</p><p class="mb-1.5">')
                    .replace(/\n/g, '<br/>');
                return <div key={i} dangerouslySetInnerHTML={{ __html: `<p class="mb-1.5">${html}</p>` }} />;
            })}
        </div>
    );
}

function CodeBlock({ code, language }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="my-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 text-[11px]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800">
                <span className="text-slate-400 font-mono uppercase text-[10px]">{language || 'code'}</span>
                <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px]">
                    {copied ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
            </div>
            <pre className="p-3 overflow-x-auto text-slate-100 font-mono leading-relaxed"><code>{code}</code></pre>
        </div>
    );
}

/* ─── SQL result panel: SQL hidden by default, table shown, CSV export ─── */
function SQLResult({ sql, result, onRerun }) {
    const [tableOpen, setTableOpen] = useState(true);
    const [sqlOpen, setSqlOpen] = useState(false);
    if (!result) return null;

    const cols = result.rows?.length > 0
        ? (result.fields?.map(f => f.name) || Object.keys(result.rows[0]))
        : [];

    const exportCSV = () => {
        if (!result.rows?.length) return;
        const escape = (v) => {
            if (v === null || v === undefined) return '';
            const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const header = cols.map(escape).join(',');
        const rows = result.rows.map(row => cols.map(c => escape(row[c])).join(','));
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `query_results_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(`Exported ${result.rows.length} rows`);
    };

    return (
        <div className="mt-2 rounded-lg border border-indigo-200 overflow-hidden bg-white text-[12px]">
            {/* SQL toggle — hidden by default */}
            {sql && (
                <button onClick={() => setSqlOpen(!sqlOpen)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 transition text-left border-b border-indigo-100">
                    {sqlOpen ? <ChevronDown className="w-3 h-3 text-indigo-500" /> : <ChevronRight className="w-3 h-3 text-indigo-500" />}
                    <Database className="w-3 h-3 text-indigo-500" />
                    <span className="font-medium text-indigo-700 text-[11px]">SQL Query</span>
                </button>
            )}
            {sqlOpen && sql && (
                <div className="px-3 py-2 bg-slate-900 border-b border-indigo-200">
                    <pre className="text-[10px] text-indigo-200 font-mono whitespace-pre-wrap">{sql}</pre>
                    <div className="flex gap-2 mt-1.5">
                        <button onClick={() => { navigator.clipboard.writeText(sql); toast.success('Copied'); }}
                            className="text-[10px] text-indigo-400 hover:text-white flex items-center gap-1">
                            <Copy className="w-2.5 h-2.5" /> Copy
                        </button>
                        {onRerun && (
                            <button onClick={onRerun} className="text-[10px] text-emerald-400 hover:text-white flex items-center gap-1">
                                <RefreshCw className="w-2.5 h-2.5" /> Re-run
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Result */}
            {!result.success ? (
                <div className="px-3 py-2 bg-red-50 text-red-700 text-[11px]">
                    <AlertTriangle className="w-3 h-3 inline mr-1" /> {result.error}
                </div>
            ) : (
                <>
                    {/* Header bar with row count, toggle, and export */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                        <button onClick={() => setTableOpen(!tableOpen)} className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900">
                            {tableOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <span className="font-medium">{result.rowCount ?? result.rows?.length ?? 0} row(s)</span>
                        </button>
                        {result.rows?.length > 0 && (
                            <button onClick={exportCSV} className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-medium">
                                <Download className="w-3 h-3" /> Export CSV
                            </button>
                        )}
                    </div>
                    {/* Data table — shown by default */}
                    {tableOpen && result.rows?.length > 0 && (
                        <div className="overflow-x-auto max-h-52">
                            <table className="w-full text-[11px]">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        {cols.map((c, i) => (
                                            <th key={i} className="px-2 py-1.5 text-left font-semibold text-slate-600 border-b whitespace-nowrap">{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.slice(0, 50).map((row, ri) => (
                                        <tr key={ri} className={ri % 2 ? 'bg-slate-50/50' : ''}>
                                            {cols.map((c, ci) => (
                                                <td key={ci} className="px-2 py-1 border-b border-slate-100 font-mono whitespace-nowrap max-w-[200px] truncate">
                                                    {row[c] === null ? <span className="text-slate-400 italic">NULL</span>
                                                        : typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {result.rows.length > 50 && <p className="text-[10px] text-slate-400 text-center py-1">Showing 50 of {result.rows.length}</p>}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ─── Chart component with copy/download ─── */
const DEFAULT_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

function ChatChart({ chartData }) {
    const echartsRef = useRef(null);
    if (!chartData || !chartData.data?.length) return null;

    const { type, title, data, seriesKeys = ['value'], colors = DEFAULT_COLORS } = chartData;

    const [activeType, setActiveType] = useState(type || 'bar');
    useEffect(() => { if (type) setActiveType(type); }, [type]);

    const getImgData = () => {
        const inst = echartsRef.current?.getEchartsInstance();
        if (!inst) return null;
        return inst.getDataURL({ type: 'png', backgroundColor: '#fff', pixelRatio: 2 });
    };

    const downloadChart = () => {
        const url = getImgData();
        if (!url) { toast.error('No chart to export'); return; }
        const a = document.createElement('a');
        a.download = `${(title || 'chart').replace(/\s+/g, '_')}.png`;
        a.href = url;
        a.click();
        toast.success('Chart downloaded');
    };

    const copyChart = async () => {
        const url = getImgData();
        if (!url) return;
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast.success('Chart copied to clipboard');
        } catch { toast.error('Copy not supported in this browser'); }
    };

    const renderChart = () => {
        const option = {
            tooltip: { trigger: 'axis', textStyle: { fontSize: 11 }, backgroundColor: 'rgba(255, 255, 255, 0.9)' },
            legend: { data: seriesKeys, bottom: 0, textStyle: { fontSize: 10 } },
            grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
            xAxis: activeType === 'pie' || activeType === 'doughnut' ? { show: false } : {
                type: 'category',
                data: data.map(d => d.label),
                axisLabel: { fontSize: 10, interval: 0, rotate: 20 },
                axisLine: { lineStyle: { color: '#cbd5e1' } }
            },
            yAxis: activeType === 'pie' || activeType === 'doughnut' ? { show: false } : {
                type: 'value',
                axisLabel: { fontSize: 10 },
                splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } }
            },
            color: colors,
            series: []
        };

        if (activeType === 'pie' || activeType === 'doughnut') {
            option.tooltip = { trigger: 'item' };
            option.series = [{
                type: 'pie',
                radius: activeType === 'doughnut' ? ['40%', '70%'] : '70%',
                data: data.map(d => ({ name: String(d.label), value: Number(d[seriesKeys[0] || 'value']) || 0 })),
                label: { show: true, formatter: '{b} ({c})', fontSize: 10 },
                itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 }
            }];
        } else {
            option.series = seriesKeys.map((key, i) => {
                let sType = activeType;
                if (activeType === 'composed') sType = i === 0 ? 'bar' : 'line';
                if (activeType === 'area') sType = 'line';
                
                const baseColor = colors[i % colors.length];
                return {
                    name: key,
                    type: sType,
                    stack: activeType === 'area' ? 'Total' : undefined,
                    areaStyle: activeType === 'area' ? { 
                        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: baseColor }, { offset: 1, color: baseColor + '11' }] }
                    } : undefined,
                    data: data.map(d => Number(d[key]) || 0),
                    label: { show: true, position: 'top', formatter: (p) => p.value === 0 ? '' : p.value, fontSize: 9, color: '#64748b' },
                    smooth: true,
                    symbolSize: sType === 'line' ? 8 : 0,
                    itemStyle: { 
                        borderRadius: sType === 'bar' ? [6, 6, 0, 0] : 0,
                        color: sType === 'bar' ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: baseColor }, { offset: 1, color: baseColor + '44' }] } : baseColor
                    },
                    lineStyle: sType === 'line' ? { width: 3, shadowColor: 'rgba(0,0,0,0.15)', shadowBlur: 10, shadowOffsetY: 5 } : undefined,
                    animationEasing: 'cubicOut',
                    animationDuration: 1000
                };
            });
        }
        return <ReactECharts ref={echartsRef} option={option} style={{ height: 220, width: '100%' }} opts={{ renderer: 'svg' }} />;
    };

    return (
        <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden bg-white">
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-slate-200">
                <span className="text-[11px] font-semibold text-indigo-700 truncate mr-2">{title || 'Chart'}</span>
                <div className="flex items-center gap-2 shrink-0">
                    <select 
                        value={activeType}
                        onChange={(e) => setActiveType(e.target.value)}
                        className="text-[10px] bg-white border border-slate-200 rounded px-1 py-0.5 text-slate-600 outline-none cursor-pointer hover:border-indigo-300"
                    >
                        <option value="bar">Bar</option>
                        <option value="line">Line</option>
                        <option value="area">Area</option>
                        {seriesKeys.length === 1 && <option value="pie">Pie</option>}
                        {seriesKeys.length === 1 && <option value="doughnut">Doughnut</option>}
                        {seriesKeys.length > 1 && <option value="composed">Composed</option>}
                    </select>
                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                        <button onClick={copyChart} className="p-1 hover:bg-indigo-100 rounded transition" title="Copy as image">
                            <ImageIcon className="w-3 h-3 text-indigo-500" />
                        </button>
                        <button onClick={downloadChart} className="p-1 hover:bg-indigo-100 rounded transition" title="Download PNG">
                            <Download className="w-3 h-3 text-indigo-500" />
                        </button>
                    </div>
                </div>
            </div>
            <div className="p-2 bg-white w-full overflow-hidden">{renderChart()}</div>
        </div>
    );
}

/* ─── Document badge ─── */
function DocBadge({ doc, onRemove }) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 border border-violet-200 rounded text-[10px]">
            <FileText className="w-3 h-3 text-violet-500" />
            <span className="text-violet-700 truncate max-w-[100px]">{doc.fileName}</span>
            <button onClick={onRemove} className="text-violet-400 hover:text-red-500"><X className="w-3 h-3" /></button>
        </span>
    );
}

/* ═══════════════════════════════════════════════════════
   MAIN FLOATING CHATBOT COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function FloatingChatbot() {
    const { user, isAuthenticated } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedDocs, setUploadedDocs] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [unread, setUnread] = useState(0);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);

    // Only render for admin/principal
    const isAdmin = user?.role === 'admin' || user?.role === 'principal';
    if (!isAuthenticated || !isAdmin) return null;

    useEffect(() => {
        if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen) { setUnread(0); inputRef.current?.focus(); }
    }, [isOpen]);

    const handleSend = async () => {
        const msg = input.trim();
        if (!msg || isLoading) return;
        setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);
        setInput('');
        setIsLoading(true);

        try {
            const history = messages.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', content: m.content }));
            const docCtx = uploadedDocs.map(d => `--- ${d.fileName} ---\n${d.extractedText}`).join('\n\n');

            const res = await api.post('/admin/chatbot/chat', { message: msg, conversationHistory: history, documentContext: docCtx });
            if (res.data.success) {
                const d = res.data.data;
                setMessages(prev => [...prev, { role: 'assistant', content: d.message, sql: d.sql, queryResult: d.queryResult, chartData: d.chartData, model: d.model, provider: d.provider, timestamp: d.timestamp }]);
                if (!isOpen) setUnread(u => u + 1);
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant', content: `❌ ${err.response?.data?.message || err.message}`, timestamp: new Date().toISOString(), isError: true
            }]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleRerunSQL = async (sql) => {
        setIsLoading(true);
        try {
            const res = await api.post('/admin/chatbot/execute', { sql });
            if (res.data.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: '🔄 **Re-executed:**', sql, queryResult: res.data.data, timestamp: new Date().toISOString() }]);
            }
        } catch (err) { toast.error(err.response?.data?.message || err.message); }
        finally { setIsLoading(false); }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const fd = new FormData();
            fd.append('document', file);
            const res = await api.post('/admin/chatbot/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) {
                setUploadedDocs(prev => [...prev, res.data.data]);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `📄 **Loaded:** ${res.data.data.fileName} (${res.data.data.charCount.toLocaleString()} chars).\nAsk me anything about it.`,
                    timestamp: new Date().toISOString()
                }]);
                toast.success('Document loaded');
            }
        } catch (err) { toast.error(err.response?.data?.message || err.message); }
        finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const clearChat = () => {
        setMessages([{ role: 'assistant', content: '🗑️ Chat cleared. How can I help?', timestamp: new Date().toISOString() }]);
        setUploadedDocs([]);
    };

    const suggestions = [
        "How many students enrolled?",
        "Top 5 classes by submissions",
        "Active instructors count",
        "Pending procurement requests",
    ];

    // ── Sizing ──
    const panelClass = isExpanded
        ? 'fixed inset-4 z-[9999] rounded-2xl'
        : 'fixed bottom-20 right-4 z-[9999] w-[420px] h-[600px] max-h-[80vh] rounded-2xl';

    return (
        <>
            {/* ── FAB Button ── */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-white shadow-2xl shadow-violet-500/40 flex items-center justify-center hover:scale-110 hover:shadow-violet-500/60 transition-all duration-300 group"
                    title="AI Assistant"
                >
                    <Bot className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    {/* Pulse ring */}
                    <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-20" />
                    {/* Unread badge */}
                    {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {unread}
                        </span>
                    )}
                </button>
            )}

            {/* ── Chat Panel ── */}
            {isOpen && (
                <div className={`${panelClass} flex flex-col bg-white border border-slate-200 shadow-2xl shadow-slate-900/20 overflow-hidden`}
                    style={{ backdropFilter: 'blur(20px)' }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                                <Bot className="w-4.5 h-4.5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm leading-none">AI Assistant</h3>
                                <p className="text-[10px] text-white/70 mt-0.5">Database-aware • Schema-synced</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={clearChat} className="p-1.5 hover:bg-white/20 rounded-lg transition" title="Clear chat">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-white/20 rounded-lg transition" title={isExpanded ? 'Minimize' : 'Expand'}>
                                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => { setIsOpen(false); setIsExpanded(false); }} className="p-1.5 hover:bg-white/20 rounded-lg transition" title="Close">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Document badges */}
                    {uploadedDocs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
                            {uploadedDocs.map((doc, i) => (
                                <DocBadge key={i} doc={doc} onRemove={() => setUploadedDocs(p => p.filter((_, j) => j !== i))} />
                            ))}
                        </div>
                    )}

                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50/50">
                        {messages.length === 0 && (
                            <div className="py-2 px-1">
                                <div className="text-center mb-3">
                                    <div className="w-10 h-10 mx-auto bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <h4 className="font-semibold text-slate-700 text-sm">Welcome to AI Analytics</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Ask questions about your school's data.</p>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Predefined Insights</span>
                                    </div>
                                    <table className="w-full text-[11px]">
                                        <tbody>
                                            {[
                                                { label: "Student Demographics", prompt: "Show me the total number of enrolled students by class in a pie chart" },
                                                { label: "Lab Inventory", prompt: "Show me a grouped bar chart of count of each item type for each lab" },
                                                { label: "Active Support Tickets", prompt: "Show me all pending and open IT support tickets" },
                                                { label: "Recent Submissions", prompt: "Show me the top 5 most recent assignment submissions" }
                                            ].map((q, i) => (
                                                <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50 transition cursor-pointer group" onClick={() => { setInput(q.prompt); inputRef.current?.focus(); }}>
                                                    <td className="px-2.5 py-2 font-medium text-slate-700 w-2/5 border-r border-slate-50">{q.label}</td>
                                                    <td className="px-2.5 py-2 text-slate-500 group-hover:text-indigo-600 transition truncate max-w-[120px]">{q.prompt}</td>
                                                    <td className="px-2 py-2 text-right w-6">
                                                        <Send className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 inline" />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[90%] ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 shadow-md shadow-indigo-500/15'
                                    : `rounded-2xl rounded-bl-sm px-3.5 py-3 shadow-sm ${msg.isError
                                        ? 'bg-red-50 border border-red-200'
                                        : 'bg-white border border-slate-200'}`
                                    }`}>
                                    {msg.role === 'assistant' && (
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                                <Bot className="w-3 h-3 text-white" />
                                            </div>
                                            <span className="text-[10px] text-slate-400">
                                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                    )}
                                    {msg.role === 'user'
                                        ? <p className="text-[13px] whitespace-pre-wrap">{msg.content}</p>
                                        : <RenderMessage content={msg.content} />
                                    }
                                    {msg.queryResult && <SQLResult sql={msg.sql} result={msg.queryResult} onRerun={() => handleRerunSQL(msg.sql)} />}
                                    {msg.chartData && <ChatChart chartData={msg.chartData} />}
                                    {msg.provider && <div className="mt-1 text-[9px] text-slate-400 text-right">{msg.provider}/{msg.model}</div>}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span className="text-[11px] text-slate-400">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />

                        {/* Suggestions on empty */}
                        {messages.length <= 1 && !isLoading && (
                            <div className="grid grid-cols-1 gap-1.5 mt-2">
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => setInput(s)}
                                        className="text-left px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition text-[12px] text-slate-600 hover:text-indigo-600">
                                        <Sparkles className="w-3 h-3 inline mr-1.5 text-indigo-400" />{s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Input bar */}
                    <div className="flex items-end gap-2 px-3 py-2.5 bg-white border-t border-slate-200 flex-shrink-0">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.csv,.json,.pdf,.md,.sql,.log" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                            className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-500 hover:bg-violet-100 transition disabled:opacity-50" title="Upload document">
                            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        </button>
                        <textarea ref={inputRef} value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Ask anything..."
                            rows={1}
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                            style={{ minHeight: '36px', maxHeight: '80px' }}
                        />
                        <button onClick={handleSend} disabled={!input.trim() || isLoading}
                            className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center hover:from-indigo-600 hover:to-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20">
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
