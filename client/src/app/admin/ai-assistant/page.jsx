'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Bot, Send, Upload, Database, ChevronDown, ChevronRight, Trash2,
    Sparkles, FileText, AlertTriangle, Copy, Check, RefreshCw, X, Download, Loader2
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

// Markdown-like renderer for AI messages
function RenderMessage({ content }) {
    if (!content) return null;

    const parts = content.split(/(```[\s\S]*?```)/g);

    return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
                    if (match) {
                        const lang = match[1] || '';
                        const code = match[2].trim();
                        return <CodeBlock key={i} code={code} language={lang} />;
                    }
                }
                // Convert basic markdown
                const html = part
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono text-pink-600 dark:text-pink-400">$1</code>')
                    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
                    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>')
                    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
                    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
                    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
                    .replace(/\n{2,}/g, '</p><p class="mb-2">')
                    .replace(/\n/g, '<br/>');

                return <div key={i} dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${html}</p>` }} />;
            })}
        </div>
    );
}

function CodeBlock({ code, language }) {
    const [copied, setCopied] = useState(false);
    const isSql = language.toLowerCase() === 'sql';

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-xs">
                <span className="text-slate-400 font-mono uppercase">{language || 'code'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 text-slate-400 hover:text-white transition">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm text-slate-100 font-mono leading-relaxed">
                <code>{code}</code>
            </pre>
        </div>
    );
}

// Collapsible SQL result table
function SQLResultPanel({ sql, result, onRerun }) {
    const [isOpen, setIsOpen] = useState(true);
    const [sqlOpen, setSqlOpen] = useState(false);

    if (!result) return null;

    return (
        <div className="mt-3 rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden bg-white dark:bg-slate-900">
            {/* SQL Query — collapsible */}
            {sql && (
                <button
                    onClick={() => setSqlOpen(!sqlOpen)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition text-left"
                >
                    {sqlOpen ? <ChevronDown className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />}
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-medium text-indigo-700 dark:text-indigo-300">SQL Query</span>
                    <span className="text-indigo-400 ml-auto font-mono truncate max-w-[300px]">{sql.substring(0, 60)}...</span>
                </button>
            )}
            {sqlOpen && sql && (
                <div className="px-4 py-3 bg-slate-900 border-b border-indigo-200 dark:border-indigo-800">
                    <pre className="text-xs text-indigo-200 font-mono whitespace-pre-wrap">{sql}</pre>
                    <div className="flex gap-2 mt-2">
                        <button onClick={() => { navigator.clipboard.writeText(sql); toast.success('SQL copied'); }}
                            className="text-xs text-indigo-400 hover:text-white flex items-center gap-1">
                            <Copy className="w-3 h-3" /> Copy
                        </button>
                        {onRerun && (
                            <button onClick={onRerun} className="text-xs text-emerald-400 hover:text-white flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" /> Re-run
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Results */}
            {!result.success ? (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-1" /> {result.error}
                </div>
            ) : (
                <>
                    <button onClick={() => setIsOpen(!isOpen)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span className="text-slate-600 dark:text-slate-400">
                            {result.rowCount ?? result.rows?.length ?? 0} row(s) returned — {result.command || 'SELECT'}
                        </span>
                    </button>
                    {isOpen && result.rows && result.rows.length > 0 && (
                        <div className="overflow-x-auto max-h-80">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                    <tr>
                                        {(result.fields?.map(f => f.name) || Object.keys(result.rows[0])).map((col, i) => (
                                            <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.slice(0, 50).map((row, ri) => (
                                        <tr key={ri} className={ri % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}>
                                            {(result.fields?.map(f => f.name) || Object.keys(row)).map((col, ci) => (
                                                <td key={ci} className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 font-mono whitespace-nowrap max-w-[300px] truncate">
                                                    {row[col] === null ? <span className="text-slate-400 italic">NULL</span>
                                                        : typeof row[col] === 'object' ? JSON.stringify(row[col])
                                                            : String(row[col])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {result.rows.length > 50 && (
                                <p className="text-xs text-slate-500 text-center py-2">Showing first 50 of {result.rows.length} rows</p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// Document badge
function DocumentBadge({ doc, onRemove }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-lg text-xs">
            <FileText className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-violet-700 dark:text-violet-300 font-medium truncate max-w-[150px]">{doc.fileName}</span>
            <span className="text-violet-400">{(doc.fileSize / 1024).toFixed(1)}KB</span>
            <button onClick={onRemove} className="text-violet-400 hover:text-red-500 transition">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

export default function AIAssistantPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedDocs, setUploadedDocs] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (user?.role !== 'admin' && user?.role !== 'principal') {
            router.push('/dashboard');
            toast.error('Access denied. Admin only.');
        }
    }, [isAuthenticated, user, _hasHydrated]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Welcome message
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{
                role: 'assistant',
                content: `👋 Hello! I'm your **AI Database Assistant**. I have full access to the school database schema and can help you:\n\n- 📊 **Query data** — "How many students are enrolled this year?"\n- 📋 **Generate reports** — "Show top 10 students by grades"\n- 🔍 **Analyze trends** — "Compare submissions per month"\n- 📄 **Read documents** — Upload any file and ask questions about it\n- 🗄️ **Explore schema** — "What tables store fee information?"\n\nJust ask anything in plain English!`,
                timestamp: new Date().toISOString()
            }]);
        }
    }, []);

    const handleSend = async () => {
        const msg = input.trim();
        if (!msg || isLoading) return;

        const userMessage = { role: 'user', content: msg, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Build conversation history (last 10 messages for context)
            const history = messages.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                content: m.content
            }));

            // Build document context
            const docContext = uploadedDocs.map(d => `--- Document: ${d.fileName} ---\n${d.extractedText}`).join('\n\n');

            const res = await api.post('/admin/chatbot/chat', {
                message: msg,
                conversationHistory: history,
                documentContext: docContext
            });

            if (res.data.success) {
                const data = res.data.data;
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.message,
                    sql: data.sql,
                    queryResult: data.queryResult,
                    timestamp: data.timestamp
                }]);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Something went wrong';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ **Error:** ${errorMsg}\n\nPlease try rephrasing your question.`,
                timestamp: new Date().toISOString(),
                isError: true
            }]);
            toast.error('AI request failed');
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
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '🔄 **Query re-executed successfully:**',
                    sql,
                    queryResult: res.data.data,
                    timestamp: new Date().toISOString()
                }]);
            }
        } catch (err) {
            toast.error('Query failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('document', file);

            const res = await api.post('/admin/chatbot/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                setUploadedDocs(prev => [...prev, res.data.data]);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `📄 **Document loaded:** ${res.data.data.fileName}\n\n*${res.data.data.charCount.toLocaleString()} characters extracted.* You can now ask me questions about this document.`,
                    timestamp: new Date().toISOString()
                }]);
                toast.success('Document uploaded');
            }
        } catch (err) {
            toast.error('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const clearChat = () => {
        setMessages([{
            role: 'assistant',
            content: '🗑️ Chat cleared. How can I help you?',
            timestamp: new Date().toISOString()
        }]);
        setUploadedDocs([]);
    };

    const suggestions = [
        "How many students are enrolled this year?",
        "Show top 5 classes by submission count",
        "List all active instructors with their subjects",
        "What's the average grade percentage across all submissions?",
        "Show pending procurement requests",
        "Count unresolved tickets by priority"
    ];

    if (!_hasHydrated || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
            <PageHeader title="AI Assistant" titleHindi="AI सहायक">
                <div className="flex items-center gap-2">
                    <button onClick={clearChat} className="btn btn-ghost text-sm flex items-center gap-1.5">
                        <Trash2 className="w-4 h-4" /> Clear
                    </button>
                </div>
            </PageHeader>

            <main className="max-w-5xl mx-auto px-4 pb-4 flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
                {/* Document badges */}
                {uploadedDocs.length > 0 && (
                    <div className="flex flex-wrap gap-2 py-2">
                        {uploadedDocs.map((doc, i) => (
                            <DocumentBadge key={i} doc={doc} onRemove={() => setUploadedDocs(prev => prev.filter((_, j) => j !== i))} />
                        ))}
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 py-4 scrollbar-thin">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-2xl rounded-br-md px-5 py-3 shadow-lg shadow-indigo-500/20'
                                    : `rounded-2xl rounded-bl-md px-5 py-4 shadow-sm ${msg.isError
                                        ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`
                                }`}>
                                {msg.role === 'assistant' && (
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                            <Bot className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">AI Assistant</span>
                                        <span className="text-[10px] text-slate-400">
                                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
                                        </span>
                                    </div>
                                )}
                                {msg.role === 'user' ? (
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                ) : (
                                    <RenderMessage content={msg.content} />
                                )}
                                {msg.queryResult && (
                                    <SQLResultPanel
                                        sql={msg.sql}
                                        result={msg.queryResult}
                                        onRerun={() => handleRerunSQL(msg.sql)}
                                    />
                                )}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                        <Bot className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <span className="text-xs font-medium text-slate-500">Thinking...</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />

                    {/* Suggestions — only show at start */}
                    {messages.length <= 1 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                            {suggestions.map((s, i) => (
                                <button key={i} onClick={() => { setInput(s); }}
                                    className="text-left px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:shadow-md transition-all text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                                    <Sparkles className="w-3.5 h-3.5 inline mr-2 text-indigo-400" />
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Input bar */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 pb-2">
                    <div className="flex items-end gap-2">
                        {/* Upload button */}
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden"
                            accept=".txt,.csv,.json,.pdf,.md,.sql,.log" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                            className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 flex items-center justify-center text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900 transition disabled:opacity-50"
                            title="Upload document">
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        </button>

                        {/* Text input */}
                        <div className="flex-1 relative">
                            <textarea ref={inputRef} value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                }}
                                placeholder="Ask anything about your data..."
                                rows={1}
                                className="w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                style={{ minHeight: '44px', maxHeight: '120px' }}
                            />
                        </div>

                        {/* Send button */}
                        <button onClick={handleSend} disabled={!input.trim() || isLoading}
                            className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center hover:from-indigo-600 hover:to-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                        AI can make mistakes. Always verify SQL before running destructive queries. Press Enter to send, Shift+Enter for new line.
                    </p>
                </div>
            </main>
        </div>
    );
}
