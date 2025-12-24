'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
    Pencil, Eraser, Circle, Square, Minus, Type, Undo2, Redo2, Trash2, Download, Save,
    Palette, ChevronDown, X, Maximize2, Minimize2, Share2, MousePointer2
} from 'lucide-react';

const COLORS = [
    '#000000', '#1e293b', '#475569',
    '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#3b82f6', '#8b5cf6',
    '#ec4899', '#ffffff', '#94a3b8'
];

const STROKE_WIDTHS = [2, 4, 6, 8, 12];

export default function Whiteboard({
    onSave,
    onClose,
    isFullscreen = false,
    onToggleFullscreen,
    width = 800,
    height = 600,
    // Sharing props
    onShare,
    isSharing = false,
    sharingTargets = [],
    onStopSharing,
    socket,
    sessionId,
    isInstructor = false
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState('pen'); // pen, eraser, line, rectangle, circle, text
    const [color, setColor] = useState('#000000');
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showStrokePicker, setShowStrokePicker] = useState(false);

    // Background options
    const [bgPattern, setBgPattern] = useState('plain'); // plain, dotted, grid, lined
    const [bgColor, setBgColor] = useState('#ffffff');
    const [showBgPicker, setShowBgPicker] = useState(false);

    // History for undo/redo
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Drawing state
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

    // Canvas dimensions - keep fixed to prevent content loss
    const canvasWidth = width;
    const canvasHeight = height;

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Save initial state
        saveToHistory();
    }, []);

    // Save current state to history
    const saveToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const imageData = canvas.toDataURL();

        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(imageData);
            return newHistory.slice(-50); // Keep last 50 states
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [historyIndex]);

    // Restore state from history
    const restoreFromHistory = useCallback((index) => {
        const canvas = canvasRef.current;
        if (!canvas || !history[index]) return;

        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.src = history[index];
    }, [history]);

    // Undo
    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            restoreFromHistory(newIndex);
        }
    }, [historyIndex, restoreFromHistory]);

    // Redo
    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            restoreFromHistory(newIndex);
        }
    }, [historyIndex, history.length, restoreFromHistory]);

    // Clear canvas
    const handleClear = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveToHistory();
    }, [saveToHistory]);

    // Get position from event (works for both mouse and touch)
    const getPosition = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }, []);

    // Emit draw event via socket when sharing
    const emitDrawEvent = useCallback((eventData) => {
        if (isSharing && socket && sessionId) {
            socket.emit('whiteboard:draw', {
                sessionId,
                ...eventData
            });
        }
    }, [isSharing, socket, sessionId]);

    // Start drawing
    const startDrawing = useCallback((e) => {
        e.preventDefault();
        const pos = getPosition(e);
        setIsDrawing(true);
        setStartPos(pos);
        setCurrentPos(pos);

        if (tool === 'pen' || tool === 'eraser') {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);

            // Emit start event
            emitDrawEvent({
                type: 'path',
                isStart: true,
                x: pos.x,
                y: pos.y,
                color: tool === 'eraser' ? '#ffffff' : color,
                strokeWidth: tool === 'eraser' ? strokeWidth * 3 : strokeWidth
            });
        }
    }, [getPosition, tool, color, strokeWidth, emitDrawEvent]);

    // Draw
    const draw = useCallback((e) => {
        if (!isDrawing) return;
        e.preventDefault();

        const pos = getPosition(e);
        setCurrentPos(pos);

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (tool === 'pen') {
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            // Emit path event
            emitDrawEvent({
                type: 'path',
                isStart: false,
                x: pos.x,
                y: pos.y,
                color,
                strokeWidth
            });
        } else if (tool === 'eraser') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = strokeWidth * 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            // Emit eraser event
            emitDrawEvent({
                type: 'path',
                isStart: false,
                x: pos.x,
                y: pos.y,
                color: '#ffffff',
                strokeWidth: strokeWidth * 3
            });
        }
    }, [isDrawing, getPosition, tool, color, strokeWidth, emitDrawEvent]);

    // Stop drawing
    const stopDrawing = useCallback((e) => {
        if (!isDrawing) return;
        e.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getPosition(e);

        // Draw shapes on release
        if (tool === 'line') {
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            // Emit line event
            emitDrawEvent({
                type: 'line',
                startX: startPos.x,
                startY: startPos.y,
                endX: pos.x,
                endY: pos.y,
                color,
                strokeWidth
            });
        } else if (tool === 'rectangle') {
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
            ctx.strokeRect(
                startPos.x,
                startPos.y,
                pos.x - startPos.x,
                pos.y - startPos.y
            );

            // Emit rectangle event
            emitDrawEvent({
                type: 'rectangle',
                x: startPos.x,
                y: startPos.y,
                width: pos.x - startPos.x,
                height: pos.y - startPos.y,
                color,
                strokeWidth
            });
        } else if (tool === 'circle') {
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
            const radiusX = Math.abs(pos.x - startPos.x) / 2;
            const radiusY = Math.abs(pos.y - startPos.y) / 2;
            const centerX = startPos.x + (pos.x - startPos.x) / 2;
            const centerY = startPos.y + (pos.y - startPos.y) / 2;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            ctx.stroke();

            // Emit ellipse event
            emitDrawEvent({
                type: 'ellipse',
                centerX,
                centerY,
                radiusX,
                radiusY,
                color,
                strokeWidth
            });
        }

        setIsDrawing(false);
        saveToHistory();
    }, [isDrawing, getPosition, tool, color, strokeWidth, startPos, saveToHistory, emitDrawEvent]);

    // Download as image
    const handleDownload = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }, []);

    // Save and return data
    const handleSave = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const imageData = canvas.toDataURL('image/png');
        if (onSave) {
            onSave(imageData);
        }
    }, [onSave]);

    // Get blob for upload
    const getBlob = useCallback(() => {
        return new Promise((resolve) => {
            const canvas = canvasRef.current;
            if (!canvas) {
                resolve(null);
                return;
            }
            canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
    }, []);

    // Expose getBlob method
    useEffect(() => {
        if (canvasRef.current) {
            canvasRef.current.getBlob = getBlob;
        }
    }, [getBlob]);

    const tools = [
        { id: 'pen', icon: Pencil, label: 'Pen' },
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
        { id: 'line', icon: Minus, label: 'Line' },
        { id: 'rectangle', icon: Square, label: 'Rectangle' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'text', icon: Type, label: 'Text' },
    ];

    // Get cursor based on tool
    const getCursor = () => {
        if (tool === 'eraser') return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${strokeWidth * 2}" height="${strokeWidth * 2}" viewBox="0 0 ${strokeWidth * 2} ${strokeWidth * 2}"><rect width="${strokeWidth * 2}" height="${strokeWidth * 2}" fill="white" stroke="black" stroke-width="1"/></svg>') ${strokeWidth} ${strokeWidth}, auto`;
        return 'crosshair';
    };

    return (
        <div
            ref={containerRef}
            className={`bg-white rounded-xl shadow-2xl flex flex-col ${isFullscreen ? 'fixed inset-4 z-50' : ''
                }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-primary-500" />
                    Whiteboard
                    {isSharing && (
                        <span className="flex items-center gap-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full ml-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            LIVE - {sharingTargets.join(', ')}
                        </span>
                    )}
                </h3>
                <div className="flex items-center gap-2">
                    {onToggleFullscreen && (
                        <button
                            onClick={onToggleFullscreen}
                            className="p-2 hover:bg-slate-200 rounded-lg transition"
                            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-200 rounded-lg transition"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-100 bg-white">
                {/* Drawing Tools */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    {tools.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTool(t.id)}
                            className={`p-2 rounded-md transition ${tool === t.id
                                ? 'bg-primary-500 text-white shadow'
                                : 'hover:bg-slate-200 text-slate-600'
                                }`}
                            title={t.label}
                        >
                            <t.icon className="w-4 h-4" />
                        </button>
                    ))}
                </div>

                <div className="w-px h-8 bg-slate-200" />

                {/* Color Picker */}
                <div className="relative">
                    <button
                        onClick={() => { setShowColorPicker(!showColorPicker); setShowStrokePicker(false); }}
                        className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition"
                        title="Color"
                    >
                        <div
                            className="w-5 h-5 rounded-full border-2 border-slate-300"
                            style={{ backgroundColor: color }}
                        />
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    {showColorPicker && (
                        <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                            <div className="grid grid-cols-5 gap-1">
                                {COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => { setColor(c); setShowColorPicker(false); }}
                                        className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-primary-500 ring-2 ring-primary-200' : 'border-slate-200'
                                            }`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Stroke Width */}
                <div className="relative">
                    <button
                        onClick={() => { setShowStrokePicker(!showStrokePicker); setShowColorPicker(false); }}
                        className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition"
                        title="Stroke Width"
                    >
                        <div className="w-5 flex items-center justify-center">
                            <div
                                className="rounded-full bg-slate-800"
                                style={{ width: strokeWidth * 2, height: strokeWidth * 2 }}
                            />
                        </div>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    {showStrokePicker && (
                        <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                            <div className="flex flex-col gap-1">
                                {STROKE_WIDTHS.map((w) => (
                                    <button
                                        key={w}
                                        onClick={() => { setStrokeWidth(w); setShowStrokePicker(false); }}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${strokeWidth === w ? 'bg-primary-50 text-primary-600' : 'hover:bg-slate-50'
                                            }`}
                                    >
                                        <div
                                            className="rounded-full bg-current"
                                            style={{ width: w * 2, height: w * 2 }}
                                        />
                                        <span className="text-sm">{w}px</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Background Options */}
                <div className="relative">
                    <button
                        onClick={() => { setShowBgPicker(!showBgPicker); setShowColorPicker(false); setShowStrokePicker(false); }}
                        className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition"
                        title="Background"
                    >
                        <div
                            className="w-5 h-5 rounded border-2 border-slate-300"
                            style={{
                                backgroundColor: bgColor,
                                backgroundImage: bgPattern === 'dotted'
                                    ? 'radial-gradient(circle, #999 1px, transparent 1px)'
                                    : bgPattern === 'grid'
                                        ? 'linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px)'
                                        : 'none',
                                backgroundSize: bgPattern === 'dotted' ? '8px 8px' : '10px 10px'
                            }}
                        />
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    {showBgPicker && (
                        <div className="absolute top-full left-0 mt-1 p-3 bg-white rounded-lg shadow-lg border border-slate-200 z-10 w-48">
                            <p className="text-xs font-medium text-slate-500 mb-2">Pattern</p>
                            <div className="grid grid-cols-4 gap-1 mb-3">
                                {[
                                    { id: 'plain', label: 'Plain' },
                                    { id: 'dotted', label: 'Dots' },
                                    { id: 'grid', label: 'Grid' },
                                    { id: 'lined', label: 'Lines' }
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setBgPattern(p.id)}
                                        className={`p-2 rounded border text-xs ${bgPattern === p.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs font-medium text-slate-500 mb-2">Color</p>
                            <div className="grid grid-cols-5 gap-1">
                                {['#ffffff', '#f8fafc', '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#1e293b'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setBgColor(c)}
                                        className={`w-6 h-6 rounded border-2 ${bgColor === c ? 'border-primary-500' : 'border-slate-200'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-8 bg-slate-200" />

                {/* Undo/Redo */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="p-2 hover:bg-slate-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Undo"
                    >
                        <Undo2 className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-2 hover:bg-slate-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Redo"
                    >
                        <Redo2 className="w-4 h-4 text-slate-600" />
                    </button>
                </div>

                <div className="w-px h-8 bg-slate-200" />

                {/* Clear */}
                <button
                    onClick={handleClear}
                    className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition"
                    title="Clear All"
                >
                    <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex-1" />

                {/* Sharing, Download & Save */}
                <div className="flex items-center gap-2">
                    {/* Share Button (for instructors) */}
                    {isInstructor && (
                        <button
                            onClick={isSharing ? onStopSharing : onShare}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm ${isSharing
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-amber-500 hover:bg-amber-600 text-white'
                                }`}
                            title={isSharing ? 'Stop Sharing' : 'Share with students'}
                        >
                            <Share2 className="w-4 h-4" />
                            {isSharing ? 'Stop Sharing' : 'Share'}
                        </button>
                    )}

                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Download
                    </button>
                    {onSave && (
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition text-sm"
                        >
                            <Save className="w-4 h-4" />
                            Save
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas */}
            <div className={`flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center ${isFullscreen ? 'h-full' : ''}`}>
                <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    className="rounded-lg shadow-lg touch-none"
                    style={{
                        maxWidth: isFullscreen ? '95vw' : '100%',
                        maxHeight: isFullscreen ? 'calc(100vh - 200px)' : '100%',
                        width: isFullscreen ? 'auto' : undefined,
                        height: isFullscreen ? 'auto' : undefined,
                        backgroundColor: bgColor,
                        backgroundImage: bgPattern === 'dotted'
                            ? 'radial-gradient(circle, #ccc 1px, transparent 1px)'
                            : bgPattern === 'grid'
                                ? 'linear-gradient(#e5e5e5 1px, transparent 1px), linear-gradient(90deg, #e5e5e5 1px, transparent 1px)'
                                : bgPattern === 'lined'
                                    ? 'linear-gradient(#e5e5e5 1px, transparent 1px)'
                                    : 'none',
                        backgroundSize: bgPattern === 'dotted' ? '20px 20px' : bgPattern === 'grid' ? '20px 20px' : '100% 25px',
                        cursor: getCursor(),
                        border: '2px solid #e2e8f0',
                        outline: '1px solid #cbd5e1'
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 rounded-b-xl">
                <p className="text-xs text-slate-500 text-center">
                    ✨ Draw with mouse or touch • Supports stylus input on tablets
                </p>
            </div>
        </div>
    );
}
