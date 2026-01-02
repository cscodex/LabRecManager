'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
    Pencil, Eraser, Circle, Square, Minus, Type, Undo2, Redo2, Trash2, Download, Save,
    Palette, ChevronDown, X, Maximize2, Minimize2, Share2, MousePointer2,
    Highlighter, MoveRight, Pointer, Image as ImageIcon, ChevronLeft, ChevronRight,
    Plus, Video, VideoOff, Mic, MicOff, Camera, RotateCw, Move, Pipette
} from 'lucide-react';

// Default colors (rainbow + black/white)
const DEFAULT_COLORS = [
    '#000000', '#ffffff', '#ef4444', // Black, White, Red
    '#f97316', '#eab308', '#22c55e', // Orange, Yellow, Green
    '#3b82f6', '#8b5cf6', '#ec4899', // Blue, Purple, Pink
];

// Highlighter colors with transparency
const HIGHLIGHTER_COLORS = [
    'rgba(255, 235, 59, 0.4)',  // Yellow
    'rgba(76, 175, 80, 0.4)',   // Green
    'rgba(33, 150, 243, 0.4)',  // Blue
    'rgba(233, 30, 99, 0.4)',   // Pink
    'rgba(255, 152, 0, 0.4)',   // Orange
];

const STROKE_WIDTHS = [2, 4, 6, 8, 12];

// Helper: Convert hex to RGB
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

// Helper: Convert RGB to hex
const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
};

// Helper: Convert RGB to HSB
const rgbToHsb = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), b: Math.round(v * 100) };
};

// Helper: Convert HSB to RGB
const hsbToRgb = (h, s, b) => {
    h /= 360; s /= 100; b /= 100;
    let r, g, bl;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = b * (1 - s);
    const q = b * (1 - f * s);
    const t = b * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = b; g = t; bl = p; break;
        case 1: r = q; g = b; bl = p; break;
        case 2: r = p; g = b; bl = t; break;
        case 3: r = p; g = q; bl = b; break;
        case 4: r = t; g = p; bl = b; break;
        case 5: r = b; g = p; bl = q; break;
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(bl * 255) };
};

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
    isInstructor = false,
    // Camera & Mic props
    showCameraControls = false,
    onCameraToggle,
    onMicToggle,
    isCameraOn = false,
    isMicOn = false
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

    // Text tool state
    const [showTextInput, setShowTextInput] = useState(false);
    const [textPos, setTextPos] = useState({ x: 0, y: 0 });
    const [textValue, setTextValue] = useState('');

    // Selection state
    const [selection, setSelection] = useState(null); // { x, y, width, height }
    const [clipboard, setClipboard] = useState(null); // imageData for copy/paste

    // Multi-page state
    const [pages, setPages] = useState([null]); // Array of canvas data URLs
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Laser pointer state
    const [laserPos, setLaserPos] = useState(null);
    const laserTimeoutRef = useRef(null);

    // Highlighter color
    const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_COLORS[0]);
    const [showHighlighterPicker, setShowHighlighterPicker] = useState(false);

    // Image insert
    const imageInputRef = useRef(null);

    // Recently used colors (3x3 = 9 colors)
    const [recentColors, setRecentColors] = useState(DEFAULT_COLORS);

    // Custom color picker state
    const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
    const [customColorMode, setCustomColorMode] = useState('rgb'); // 'rgb' or 'hsb'
    const [customRgb, setCustomRgb] = useState({ r: 0, g: 0, b: 0 });
    const [customHsb, setCustomHsb] = useState({ h: 0, s: 100, b: 100 });
    const [hexInput, setHexInput] = useState('#000000');

    // Image objects for manipulation (selectable, movable, resizable, rotatable)
    const [imageObjects, setImageObjects] = useState([]);
    const [selectedImageId, setSelectedImageId] = useState(null);
    const [imageDragState, setImageDragState] = useState(null); // { id, action, startX, startY, startObj }

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

    // Broadcast canvas state when sharing starts and periodically while sharing
    useEffect(() => {
        if (!isSharing || !socket || !sessionId) return;

        // Function to send current canvas state
        const sendCanvasState = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const imageData = canvas.toDataURL('image/png');
            socket.emit('whiteboard:canvas-state', {
                sessionId,
                imageData
            });
        };

        // Send immediately when sharing starts
        sendCanvasState();

        // Also send periodically to keep viewers in sync (every 2 seconds)
        const intervalId = setInterval(sendCanvasState, 2000);

        // Listen for state requests from new viewers
        const handleStateRequest = (data) => {
            if (data.sessionId === sessionId) {
                sendCanvasState();
            }
        };
        socket.on('whiteboard:request-state', handleStateRequest);

        return () => {
            clearInterval(intervalId);
            socket.off('whiteboard:request-state', handleStateRequest);
        };
    }, [isSharing, socket, sessionId]);

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

    // Copy selection to clipboard
    const handleCopySelection = useCallback(() => {
        if (!selection) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(selection.x, selection.y, selection.width, selection.height);
        setClipboard({ imageData, width: selection.width, height: selection.height });
    }, [selection]);

    // Cut selection (copy + delete)
    const handleCutSelection = useCallback(() => {
        if (!selection) return;
        handleCopySelection();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(selection.x, selection.y, selection.width, selection.height);
        setSelection(null);
        saveToHistory();
    }, [selection, handleCopySelection, saveToHistory]);

    // Paste from clipboard
    const handlePasteSelection = useCallback(() => {
        if (!clipboard) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        // Paste at center of canvas
        const x = (canvas.width - clipboard.width) / 2;
        const y = (canvas.height - clipboard.height) / 2;
        ctx.putImageData(clipboard.imageData, x, y);
        saveToHistory();
    }, [clipboard, saveToHistory]);

    // Delete selection
    const handleDeleteSelection = useCallback(() => {
        if (!selection) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(selection.x, selection.y, selection.width, selection.height);
        setSelection(null);
        saveToHistory();
    }, [selection, saveToHistory]);

    // Select color and add to recently used
    const selectColor = useCallback((newColor) => {
        setColor(newColor);
        setShowColorPicker(false);
        setShowCustomColorPicker(false);

        // Add to recently used (move to front, keep 9 max)
        setRecentColors(prev => {
            const filtered = prev.filter(c => c.toLowerCase() !== newColor.toLowerCase());
            return [newColor, ...filtered].slice(0, 9);
        });
    }, []);

    // Handle custom color RGB change
    const handleRgbChange = useCallback((key, value) => {
        const newRgb = { ...customRgb, [key]: Math.max(0, Math.min(255, parseInt(value) || 0)) };
        setCustomRgb(newRgb);
        const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        setHexInput(hex);
        setCustomHsb(rgbToHsb(newRgb.r, newRgb.g, newRgb.b));
    }, [customRgb]);

    // Handle custom color HSB change
    const handleHsbChange = useCallback((key, value) => {
        const max = key === 'h' ? 360 : 100;
        const newHsb = { ...customHsb, [key]: Math.max(0, Math.min(max, parseInt(value) || 0)) };
        setCustomHsb(newHsb);
        const rgb = hsbToRgb(newHsb.h, newHsb.s, newHsb.b);
        setCustomRgb(rgb);
        setHexInput(rgbToHex(rgb.r, rgb.g, rgb.b));
    }, [customHsb]);

    // Handle hex input change
    const handleHexChange = useCallback((value) => {
        setHexInput(value);
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            const rgb = hexToRgb(value);
            setCustomRgb(rgb);
            setCustomHsb(rgbToHsb(rgb.r, rgb.g, rgb.b));
        }
    }, []);

    // Apply custom color
    const applyCustomColor = useCallback(() => {
        selectColor(hexInput);
    }, [hexInput, selectColor]);

    // Delete selected image
    const deleteSelectedImage = useCallback(() => {
        if (selectedImageId) {
            setImageObjects(prev => prev.filter(img => img.id !== selectedImageId));
            setSelectedImageId(null);
            saveToHistory();
        }
    }, [selectedImageId, saveToHistory]);

    // Copy selected image
    const copySelectedImage = useCallback(() => {
        if (selectedImageId) {
            const img = imageObjects.find(i => i.id === selectedImageId);
            if (img) {
                setClipboard({ type: 'image', data: { ...img, id: Date.now() } });
            }
        }
    }, [selectedImageId, imageObjects]);

    // Paste image from clipboard
    const pasteImage = useCallback(() => {
        if (clipboard?.type === 'image') {
            const newImg = {
                ...clipboard.data,
                id: Date.now(),
                x: clipboard.data.x + 20,
                y: clipboard.data.y + 20
            };
            setImageObjects(prev => [...prev, newImg]);
            setSelectedImageId(newImg.id);
        }
    }, [clipboard]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modKey = isMac ? e.metaKey : e.ctrlKey;

            if (modKey && e.key === 'c') {
                if (selectedImageId) {
                    e.preventDefault();
                    copySelectedImage();
                }
            } else if (modKey && e.key === 'x') {
                if (selectedImageId) {
                    e.preventDefault();
                    copySelectedImage();
                    deleteSelectedImage();
                }
            } else if (modKey && e.key === 'v') {
                if (clipboard?.type === 'image') {
                    e.preventDefault();
                    pasteImage();
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedImageId && document.activeElement === document.body) {
                    e.preventDefault();
                    deleteSelectedImage();
                }
            } else if (e.key === 'Escape') {
                setSelectedImageId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImageId, clipboard, copySelectedImage, deleteSelectedImage, pasteImage]);

    // Image manipulation mouse handlers
    useEffect(() => {
        if (!imageDragState) return;

        const handleMouseMove = (e) => {
            const dx = e.clientX - imageDragState.startX;
            const dy = e.clientY - imageDragState.startY;
            const startObj = imageDragState.startObj;

            if (imageDragState.action === 'move') {
                setImageObjects(prev => prev.map(img =>
                    img.id === imageDragState.id
                        ? { ...img, x: startObj.x + dx, y: startObj.y + dy }
                        : img
                ));
            } else if (imageDragState.action === 'rotate') {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const centerX = startObj.x + startObj.width / 2;
                const centerY = startObj.y + startObj.height / 2;
                const canvasCenterX = rect.left + (centerX / canvas.width) * rect.width;
                const canvasCenterY = rect.top + (centerY / canvas.height) * rect.height;

                const startAngle = Math.atan2(imageDragState.startY - canvasCenterY, imageDragState.startX - canvasCenterX);
                const currentAngle = Math.atan2(e.clientY - canvasCenterY, e.clientX - canvasCenterX);
                const angleDiff = (currentAngle - startAngle) * (180 / Math.PI);

                setImageObjects(prev => prev.map(img =>
                    img.id === imageDragState.id
                        ? { ...img, rotation: startObj.rotation + angleDiff }
                        : img
                ));
            } else if (imageDragState.action.startsWith('resize-')) {
                const handle = imageDragState.action.replace('resize-', '');
                let newX = startObj.x, newY = startObj.y;
                let newWidth = startObj.width, newHeight = startObj.height;
                const minSize = 50;

                if (handle.includes('e')) {
                    newWidth = Math.max(minSize, startObj.width + dx);
                }
                if (handle.includes('w')) {
                    const widthChange = Math.min(dx, startObj.width - minSize);
                    newX = startObj.x + widthChange;
                    newWidth = startObj.width - widthChange;
                }
                if (handle.includes('s')) {
                    newHeight = Math.max(minSize, startObj.height + dy);
                }
                if (handle.includes('n')) {
                    const heightChange = Math.min(dy, startObj.height - minSize);
                    newY = startObj.y + heightChange;
                    newHeight = startObj.height - heightChange;
                }

                setImageObjects(prev => prev.map(img =>
                    img.id === imageDragState.id
                        ? { ...img, x: newX, y: newY, width: newWidth, height: newHeight }
                        : img
                ));
            }
        };

        const handleMouseUp = () => {
            setImageDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [imageDragState]);

    // Click on canvas to deselect images
    const handleCanvasClick = useCallback(() => {
        setSelectedImageId(null);
    }, []);

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

        // Handle text tool separately
        if (tool === 'text') {
            setTextPos(pos);
            setTextValue('');
            setShowTextInput(true);
            return;
        }

        // Handle select tool - start drawing selection box
        if (tool === 'select') {
            setSelection(null); // Clear previous selection
        }

        setIsDrawing(true);
        setStartPos(pos);
        setCurrentPos(pos);

        if (tool === 'pen' || tool === 'eraser' || tool === 'highlighter') {
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
                color: tool === 'eraser' ? '#ffffff' : (tool === 'highlighter' ? highlighterColor : color),
                strokeWidth: tool === 'eraser' ? strokeWidth * 3 : (tool === 'highlighter' ? strokeWidth * 4 : strokeWidth),
                isHighlighter: tool === 'highlighter'
            });
        }

        // Handle laser pointer
        if (tool === 'laser') {
            setLaserPos(pos);
            if (laserTimeoutRef.current) {
                clearTimeout(laserTimeoutRef.current);
            }
            // Emit laser position
            emitDrawEvent({
                type: 'laser',
                x: pos.x,
                y: pos.y
            });
        }
    }, [getPosition, tool, color, strokeWidth, highlighterColor, emitDrawEvent]);

    // Handle text submission
    const handleTextSubmit = useCallback(() => {
        if (!textValue.trim()) {
            setShowTextInput(false);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.font = `${strokeWidth * 4 + 12}px sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(textValue, textPos.x, textPos.y);

        // Emit text event
        emitDrawEvent({
            type: 'text',
            x: textPos.x,
            y: textPos.y,
            text: textValue,
            fontSize: strokeWidth * 4 + 12,
            color
        });

        setShowTextInput(false);
        setTextValue('');
        saveToHistory();
    }, [textValue, textPos, color, strokeWidth, emitDrawEvent, saveToHistory]);

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
        } else if (tool === 'highlighter') {
            ctx.strokeStyle = highlighterColor;
            ctx.lineWidth = strokeWidth * 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'multiply';
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';

            // Emit highlighter event
            emitDrawEvent({
                type: 'path',
                isStart: false,
                x: pos.x,
                y: pos.y,
                color: highlighterColor,
                strokeWidth: strokeWidth * 4,
                isHighlighter: true
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
        } else if (tool === 'laser') {
            setLaserPos(pos);
            if (laserTimeoutRef.current) {
                clearTimeout(laserTimeoutRef.current);
            }
            laserTimeoutRef.current = setTimeout(() => setLaserPos(null), 1500);
            emitDrawEvent({
                type: 'laser',
                x: pos.x,
                y: pos.y
            });
        }
    }, [isDrawing, getPosition, tool, color, strokeWidth, highlighterColor, emitDrawEvent]);

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
        } else if (tool === 'arrow') {
            // Draw arrow line
            ctx.strokeStyle = color;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            // Draw arrowhead
            const headLength = strokeWidth * 4;
            const angle = Math.atan2(pos.y - startPos.y, pos.x - startPos.x);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(
                pos.x - headLength * Math.cos(angle - Math.PI / 6),
                pos.y - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                pos.x - headLength * Math.cos(angle + Math.PI / 6),
                pos.y - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // Emit arrow event
            emitDrawEvent({
                type: 'arrow',
                startX: startPos.x,
                startY: startPos.y,
                endX: pos.x,
                endY: pos.y,
                color,
                strokeWidth
            });
        } else if (tool === 'select') {
            // Create selection rectangle
            const x = Math.min(startPos.x, pos.x);
            const y = Math.min(startPos.y, pos.y);
            const selWidth = Math.abs(pos.x - startPos.x);
            const selHeight = Math.abs(pos.y - startPos.y);

            if (selWidth > 5 && selHeight > 5) {
                setSelection({ x, y, width: selWidth, height: selHeight });
            }
        }

        setIsDrawing(false);
        if (tool !== 'select' && tool !== 'laser') saveToHistory();
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
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'pen', icon: Pencil, label: 'Pen' },
        { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
        { id: 'eraser', icon: Eraser, label: 'Eraser' },
        { id: 'laser', icon: Pointer, label: 'Laser Pointer' },
        { id: 'line', icon: Minus, label: 'Line' },
        { id: 'arrow', icon: MoveRight, label: 'Arrow' },
        { id: 'rectangle', icon: Square, label: 'Rectangle' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'image', icon: ImageIcon, label: 'Insert Image' },
    ];

    // Get cursor based on tool
    const getCursor = () => {
        if (tool === 'select') return 'default';
        if (tool === 'eraser') return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${strokeWidth * 2}" height="${strokeWidth * 2}" viewBox="0 0 ${strokeWidth * 2} ${strokeWidth * 2}"><rect width="${strokeWidth * 2}" height="${strokeWidth * 2}" fill="white" stroke="black" stroke-width="1"/></svg>') ${strokeWidth} ${strokeWidth}, auto`;
        if (tool === 'text') return 'text';
        if (tool === 'laser') return 'none';
        if (tool === 'highlighter') return 'crosshair';
        return 'crosshair';
    };

    // Page navigation functions
    const saveCurrentPage = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const imageData = canvas.toDataURL();
        setPages(prev => {
            const newPages = [...prev];
            newPages[currentPage] = imageData;
            return newPages;
        });
    }, [currentPage]);

    const loadPage = useCallback((pageIndex) => {
        const canvas = canvasRef.current;
        if (!canvas || pageIndex < 0 || pageIndex >= totalPages) return;

        saveCurrentPage();

        const ctx = canvas.getContext('2d');
        if (pages[pageIndex]) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = pages[pageIndex];
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        setCurrentPage(pageIndex);
    }, [pages, totalPages, saveCurrentPage]);

    const addNewPage = useCallback(() => {
        saveCurrentPage();
        const newIndex = totalPages;
        setPages(prev => [...prev, null]);
        setTotalPages(prev => prev + 1);
        setCurrentPage(newIndex);

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        saveToHistory();
    }, [totalPages, saveCurrentPage, saveToHistory]);

    const goToPrevPage = useCallback(() => {
        if (currentPage > 0) loadPage(currentPage - 1);
    }, [currentPage, loadPage]);

    const goToNextPage = useCallback(() => {
        if (currentPage < totalPages - 1) loadPage(currentPage + 1);
    }, [currentPage, totalPages, loadPage]);

    // Image insert handler - creates selectable image objects
    const handleImageInsert = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;

                // Scale image to fit canvas if too large
                let imgWidth = img.width;
                let imgHeight = img.height;
                const maxWidth = canvas.width * 0.6;
                const maxHeight = canvas.height * 0.6;

                if (imgWidth > maxWidth) {
                    const ratio = maxWidth / imgWidth;
                    imgWidth = maxWidth;
                    imgHeight *= ratio;
                }
                if (imgHeight > maxHeight) {
                    const ratio = maxHeight / imgHeight;
                    imgHeight = maxHeight;
                    imgWidth *= ratio;
                }

                // Create image object for manipulation
                const imageObj = {
                    id: Date.now(),
                    src: event.target.result,
                    x: (canvas.width - imgWidth) / 2,
                    y: (canvas.height - imgHeight) / 2,
                    width: imgWidth,
                    height: imgHeight,
                    rotation: 0, // degrees
                    imageElement: img
                };

                setImageObjects(prev => [...prev, imageObj]);
                setSelectedImageId(imageObj.id);

                // Emit image event
                emitDrawEvent({
                    type: 'image',
                    imageData: event.target.result,
                    x: imageObj.x,
                    y: imageObj.y,
                    width: imgWidth,
                    height: imgHeight
                });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    }, [emitDrawEvent]);

    // Handle tool click - special handling for image tool
    const handleToolClick = useCallback((toolId) => {
        if (toolId === 'image') {
            imageInputRef.current?.click();
        } else {
            setTool(toolId);
        }
    }, []);

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
                            onClick={() => handleToolClick(t.id)}
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

                {/* Hidden Image Input */}
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageInsert}
                    className="hidden"
                />

                <div className="w-px h-8 bg-slate-200" />

                {/* Color Picker - 3x3 Recently Used + Custom */}
                <div className="relative">
                    <button
                        onClick={() => { setShowColorPicker(!showColorPicker); setShowStrokePicker(false); setShowCustomColorPicker(false); }}
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
                        <div className="absolute top-full left-0 mt-1 p-3 bg-white rounded-lg shadow-lg border border-slate-200 z-20 w-44">
                            <p className="text-xs font-medium text-slate-500 mb-2">Recent Colors</p>
                            {/* 3x3 Grid of Recent Colors */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {recentColors.map((c, idx) => (
                                    <button
                                        key={`${c}-${idx}`}
                                        onClick={() => selectColor(c)}
                                        className={`w-10 h-10 rounded-lg border-2 transition hover:scale-105 ${color === c ? 'border-primary-500 ring-2 ring-primary-200' : 'border-slate-200'
                                            }`}
                                        style={{ backgroundColor: c }}
                                        title={c}
                                    />
                                ))}
                            </div>
                            {/* Custom Color Button */}
                            <button
                                onClick={() => {
                                    setShowCustomColorPicker(true);
                                    setShowColorPicker(false);
                                    // Initialize custom picker with current color
                                    const rgb = hexToRgb(color);
                                    setCustomRgb(rgb);
                                    setCustomHsb(rgbToHsb(rgb.r, rgb.g, rgb.b));
                                    setHexInput(color);
                                }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition"
                            >
                                <Palette className="w-4 h-4" />
                                Custom Color
                            </button>
                        </div>
                    )}

                    {/* Custom Color Picker Modal */}
                    {showCustomColorPicker && (
                        <div className="absolute top-full left-0 mt-1 p-4 bg-white rounded-lg shadow-xl border border-slate-200 z-20 w-72">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-semibold text-slate-700">Custom Color</p>
                                <button onClick={() => setShowCustomColorPicker(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Color Preview */}
                            <div
                                className="w-full h-16 rounded-lg border border-slate-200 mb-3"
                                style={{ backgroundColor: hexInput }}
                            />

                            {/* Mode Tabs */}
                            <div className="flex gap-2 mb-3">
                                <button
                                    onClick={() => setCustomColorMode('rgb')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${customColorMode === 'rgb' ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600'
                                        }`}
                                >
                                    RGB
                                </button>
                                <button
                                    onClick={() => setCustomColorMode('hsb')}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${customColorMode === 'hsb' ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-600'
                                        }`}
                                >
                                    HSB
                                </button>
                            </div>

                            {/* RGB Sliders */}
                            {customColorMode === 'rgb' && (
                                <div className="space-y-2 mb-3">
                                    {['r', 'g', 'b'].map(key => (
                                        <div key={key} className="flex items-center gap-2">
                                            <span className="w-4 text-xs font-medium text-slate-500 uppercase">{key}</span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="255"
                                                value={customRgb[key]}
                                                onChange={(e) => handleRgbChange(key, e.target.value)}
                                                className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                                                style={{
                                                    background: `linear-gradient(to right, 
                                                        ${key === 'r' ? `rgb(0,${customRgb.g},${customRgb.b}), rgb(255,${customRgb.g},${customRgb.b})` : ''}
                                                        ${key === 'g' ? `rgb(${customRgb.r},0,${customRgb.b}), rgb(${customRgb.r},255,${customRgb.b})` : ''}
                                                        ${key === 'b' ? `rgb(${customRgb.r},${customRgb.g},0), rgb(${customRgb.r},${customRgb.g},255)` : ''}
                                                    )`
                                                }}
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="255"
                                                value={customRgb[key]}
                                                onChange={(e) => handleRgbChange(key, e.target.value)}
                                                className="w-14 px-2 py-1 text-xs border border-slate-200 rounded text-center"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* HSB Sliders */}
                            {customColorMode === 'hsb' && (
                                <div className="space-y-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 text-xs font-medium text-slate-500">H</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="360"
                                            value={customHsb.h}
                                            onChange={(e) => handleHsbChange('h', e.target.value)}
                                            className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                                            style={{ background: 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)' }}
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            max="360"
                                            value={customHsb.h}
                                            onChange={(e) => handleHsbChange('h', e.target.value)}
                                            className="w-14 px-2 py-1 text-xs border border-slate-200 rounded text-center"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 text-xs font-medium text-slate-500">S</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={customHsb.s}
                                            onChange={(e) => handleHsbChange('s', e.target.value)}
                                            className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-slate-300 to-primary-500"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={customHsb.s}
                                            onChange={(e) => handleHsbChange('s', e.target.value)}
                                            className="w-14 px-2 py-1 text-xs border border-slate-200 rounded text-center"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 text-xs font-medium text-slate-500">B</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={customHsb.b}
                                            onChange={(e) => handleHsbChange('b', e.target.value)}
                                            className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-black to-white"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={customHsb.b}
                                            onChange={(e) => handleHsbChange('b', e.target.value)}
                                            className="w-14 px-2 py-1 text-xs border border-slate-200 rounded text-center"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Hex Input */}
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-medium text-slate-500">HEX</span>
                                <input
                                    type="text"
                                    value={hexInput}
                                    onChange={(e) => handleHexChange(e.target.value)}
                                    className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded font-mono"
                                    placeholder="#000000"
                                />
                            </div>

                            {/* Apply Button */}
                            <button
                                onClick={applyCustomColor}
                                className="w-full py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition"
                            >
                                Apply Color
                            </button>
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

                {/* Paste (when clipboard has content) */}
                {clipboard && (
                    <button
                        onClick={handlePasteSelection}
                        className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition"
                        title="Paste"
                    >
                        📋
                    </button>
                )}

                <div className="w-px h-8 bg-slate-200" />

                {/* Page Navigation */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage === 0}
                        className="p-2 hover:bg-slate-200 rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous Page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-slate-600 min-w-[50px] text-center">
                        {currentPage + 1} / {totalPages}
                    </span>
                    <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages - 1}
                        className="p-2 hover:bg-slate-200 rounded-md transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next Page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={addNewPage}
                        className="p-2 hover:bg-green-100 text-green-600 rounded-md transition"
                        title="Add New Page"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                {/* Highlighter Color Picker (shows when highlighter selected) */}
                {tool === 'highlighter' && (
                    <div className="relative">
                        <button
                            onClick={() => setShowHighlighterPicker(!showHighlighterPicker)}
                            className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition"
                            title="Highlighter Color"
                        >
                            <div
                                className="w-5 h-5 rounded border-2 border-slate-300"
                                style={{ backgroundColor: highlighterColor }}
                            />
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>
                        {showHighlighterPicker && (
                            <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                                <div className="flex gap-1">
                                    {HIGHLIGHTER_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => { setHighlighterColor(c); setShowHighlighterPicker(false); }}
                                            className={`w-8 h-8 rounded-lg border-2 ${highlighterColor === c ? 'border-primary-500 ring-2 ring-primary-200' : 'border-slate-200'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

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
                <div className="relative">
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
                        onClick={handleCanvasClick}
                    />

                    {/* Live Preview Overlay - Shows dotted shape preview while drawing */}
                    {isDrawing && (tool === 'line' || tool === 'arrow' || tool === 'rectangle' || tool === 'circle' || tool === 'select') && (
                        <svg
                            className="absolute top-0 left-0 pointer-events-none"
                            width={canvasWidth}
                            height={canvasHeight}
                            style={{
                                maxWidth: isFullscreen ? '95vw' : '100%',
                                maxHeight: isFullscreen ? 'calc(100vh - 200px)' : '100%',
                            }}
                            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                        >
                            {tool === 'line' && (
                                <line
                                    x1={startPos.x}
                                    y1={startPos.y}
                                    x2={currentPos.x}
                                    y2={currentPos.y}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray="5,5"
                                    strokeLinecap="round"
                                />
                            )}
                            {tool === 'arrow' && (
                                <g>
                                    <line
                                        x1={startPos.x}
                                        y1={startPos.y}
                                        x2={currentPos.x}
                                        y2={currentPos.y}
                                        stroke={color}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray="5,5"
                                        strokeLinecap="round"
                                    />
                                    {/* Arrow head preview */}
                                    <polygon
                                        points={(() => {
                                            const headLength = strokeWidth * 4;
                                            const angle = Math.atan2(currentPos.y - startPos.y, currentPos.x - startPos.x);
                                            const p1 = `${currentPos.x},${currentPos.y}`;
                                            const p2 = `${currentPos.x - headLength * Math.cos(angle - Math.PI / 6)},${currentPos.y - headLength * Math.sin(angle - Math.PI / 6)}`;
                                            const p3 = `${currentPos.x - headLength * Math.cos(angle + Math.PI / 6)},${currentPos.y - headLength * Math.sin(angle + Math.PI / 6)}`;
                                            return `${p1} ${p2} ${p3}`;
                                        })()}
                                        fill={color}
                                        opacity={0.5}
                                    />
                                </g>
                            )}
                            {tool === 'rectangle' && (
                                <rect
                                    x={Math.min(startPos.x, currentPos.x)}
                                    y={Math.min(startPos.y, currentPos.y)}
                                    width={Math.abs(currentPos.x - startPos.x)}
                                    height={Math.abs(currentPos.y - startPos.y)}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray="5,5"
                                    fill="none"
                                />
                            )}
                            {tool === 'circle' && (
                                <ellipse
                                    cx={startPos.x + (currentPos.x - startPos.x) / 2}
                                    cy={startPos.y + (currentPos.y - startPos.y) / 2}
                                    rx={Math.abs(currentPos.x - startPos.x) / 2}
                                    ry={Math.abs(currentPos.y - startPos.y) / 2}
                                    stroke={color}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray="5,5"
                                    fill="none"
                                />
                            )}
                            {tool === 'select' && (
                                <rect
                                    x={Math.min(startPos.x, currentPos.x)}
                                    y={Math.min(startPos.y, currentPos.y)}
                                    width={Math.abs(currentPos.x - startPos.x)}
                                    height={Math.abs(currentPos.y - startPos.y)}
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    strokeDasharray="6,4"
                                    fill="rgba(59, 130, 246, 0.1)"
                                />
                            )}
                        </svg>
                    )}

                    {/* Image Objects Layer - Selectable, Movable, Resizable, Rotatable */}
                    {imageObjects.map((imgObj) => {
                        const isSelected = selectedImageId === imgObj.id;
                        const handleSize = 10;

                        return (
                            <div
                                key={imgObj.id}
                                className="absolute"
                                style={{
                                    left: imgObj.x,
                                    top: imgObj.y,
                                    width: imgObj.width,
                                    height: imgObj.height,
                                    transform: `rotate(${imgObj.rotation}deg)`,
                                    transformOrigin: 'center center',
                                    cursor: isSelected ? 'move' : 'pointer',
                                    zIndex: isSelected ? 20 : 10,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageId(imgObj.id);
                                }}
                                onMouseDown={(e) => {
                                    if (!isSelected) {
                                        setSelectedImageId(imgObj.id);
                                        return;
                                    }
                                    if (e.target.dataset.handle) return; // Let handles handle their own events
                                    e.stopPropagation();
                                    setImageDragState({
                                        id: imgObj.id,
                                        action: 'move',
                                        startX: e.clientX,
                                        startY: e.clientY,
                                        startObj: { ...imgObj }
                                    });
                                }}
                            >
                                {/* Image */}
                                <img
                                    src={imgObj.src}
                                    alt="Inserted"
                                    className="w-full h-full object-contain pointer-events-none select-none"
                                    draggable={false}
                                />

                                {/* Selection Border */}
                                {isSelected && (
                                    <>
                                        <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />

                                        {/* Corner Resize Handles */}
                                        {['nw', 'ne', 'sw', 'se'].map(corner => {
                                            const pos = {
                                                nw: { left: -handleSize / 2, top: -handleSize / 2, cursor: 'nwse-resize' },
                                                ne: { right: -handleSize / 2, top: -handleSize / 2, cursor: 'nesw-resize' },
                                                sw: { left: -handleSize / 2, bottom: -handleSize / 2, cursor: 'nesw-resize' },
                                                se: { right: -handleSize / 2, bottom: -handleSize / 2, cursor: 'nwse-resize' },
                                            }[corner];

                                            return (
                                                <div
                                                    key={corner}
                                                    data-handle={corner}
                                                    className="absolute bg-white border-2 border-blue-500 rounded-sm z-30"
                                                    style={{
                                                        width: handleSize,
                                                        height: handleSize,
                                                        ...pos,
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setImageDragState({
                                                            id: imgObj.id,
                                                            action: `resize-${corner}`,
                                                            startX: e.clientX,
                                                            startY: e.clientY,
                                                            startObj: { ...imgObj }
                                                        });
                                                    }}
                                                />
                                            );
                                        })}

                                        {/* Edge Resize Handles */}
                                        {['n', 'e', 's', 'w'].map(edge => {
                                            const pos = {
                                                n: { left: '50%', top: -handleSize / 2, transform: 'translateX(-50%)', cursor: 'ns-resize' },
                                                s: { left: '50%', bottom: -handleSize / 2, transform: 'translateX(-50%)', cursor: 'ns-resize' },
                                                e: { right: -handleSize / 2, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
                                                w: { left: -handleSize / 2, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
                                            }[edge];

                                            return (
                                                <div
                                                    key={edge}
                                                    data-handle={edge}
                                                    className="absolute bg-white border-2 border-blue-500 rounded-sm z-30"
                                                    style={{
                                                        width: handleSize,
                                                        height: handleSize,
                                                        ...pos,
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setImageDragState({
                                                            id: imgObj.id,
                                                            action: `resize-${edge}`,
                                                            startX: e.clientX,
                                                            startY: e.clientY,
                                                            startObj: { ...imgObj }
                                                        });
                                                    }}
                                                />
                                            );
                                        })}

                                        {/* Rotate Handle */}
                                        <div
                                            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center z-30"
                                            style={{ top: -35 }}
                                        >
                                            <div className="w-px h-5 bg-blue-500" />
                                            <div
                                                data-handle="rotate"
                                                className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center cursor-grab hover:bg-blue-600"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setImageDragState({
                                                        id: imgObj.id,
                                                        action: 'rotate',
                                                        startX: e.clientX,
                                                        startY: e.clientY,
                                                        startObj: { ...imgObj }
                                                    });
                                                }}
                                            >
                                                <RotateCw className="w-3 h-3 text-white" />
                                            </div>
                                        </div>

                                        {/* Delete Button */}
                                        <button
                                            className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center z-30 shadow-lg"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSelectedImage();
                                            }}
                                        >
                                            <X className="w-3 h-3 text-white" />
                                        </button>
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {/* Laser Pointer Overlay */}
                    {laserPos && (
                        <div
                            className="absolute pointer-events-none z-10"
                            style={{
                                left: laserPos.x - 10,
                                top: laserPos.y - 10,
                                width: 20,
                                height: 20,
                            }}
                        >
                            <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                            <div className="absolute inset-1 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                        </div>
                    )}

                    {/* Text Input Popup - Draggable */}
                    {showTextInput && (
                        <div
                            className="absolute bg-white rounded-lg shadow-xl border-2 border-primary-400 p-2 z-10 cursor-move"
                            style={{ left: textPos.x, top: textPos.y }}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setDragImage(new Image(), 0, 0); // Hide default drag image
                            }}
                            onDrag={(e) => {
                                if (e.clientX === 0 && e.clientY === 0) return; // Ignore end event
                                const canvas = canvasRef.current;
                                if (!canvas) return;
                                const rect = canvas.getBoundingClientRect();
                                const scaleX = canvas.width / rect.width;
                                const scaleY = canvas.height / rect.height;
                                const newX = (e.clientX - rect.left) * scaleX;
                                const newY = (e.clientY - rect.top) * scaleY;
                                if (newX > 0 && newY > 0) {
                                    setTextPos({ x: newX, y: newY });
                                }
                            }}
                        >
                            <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                                <span>⊞</span> Drag to move
                            </div>
                            <input
                                type="text"
                                value={textValue}
                                onChange={(e) => setTextValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleTextSubmit();
                                    if (e.key === 'Escape') setShowTextInput(false);
                                }}
                                placeholder="Type text..."
                                className="w-48 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                style={{ color, fontSize: `${strokeWidth * 2 + 12}px` }}
                                autoFocus
                            />
                            <div className="flex gap-1 mt-1">
                                <button
                                    onClick={handleTextSubmit}
                                    className="flex-1 px-2 py-1 bg-primary-500 text-white text-xs rounded hover:bg-primary-600"
                                >
                                    Add
                                </button>
                                <button
                                    onClick={() => setShowTextInput(false)}
                                    className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Selection Overlay */}
                    {selection && (
                        <div
                            className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
                            style={{
                                left: selection.x,
                                top: selection.y,
                                width: selection.width,
                                height: selection.height
                            }}
                        >
                            {/* Selection action buttons */}
                            <div className="absolute -top-10 left-0 flex gap-1 pointer-events-auto">
                                <button
                                    onClick={handleCopySelection}
                                    className="px-2 py-1 bg-white text-xs font-medium text-slate-700 rounded shadow border border-slate-200 hover:bg-slate-50"
                                    title="Copy"
                                >
                                    Copy
                                </button>
                                <button
                                    onClick={handleCutSelection}
                                    className="px-2 py-1 bg-white text-xs font-medium text-slate-700 rounded shadow border border-slate-200 hover:bg-slate-50"
                                    title="Cut"
                                >
                                    Cut
                                </button>
                                <button
                                    onClick={handleDeleteSelection}
                                    className="px-2 py-1 bg-red-500 text-xs font-medium text-white rounded shadow hover:bg-red-600"
                                    title="Delete"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setSelection(null)}
                                    className="px-2 py-1 bg-slate-200 text-xs font-medium text-slate-700 rounded hover:bg-slate-300"
                                    title="Cancel"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}
                </div>
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
