'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';

interface ImageCropperProps {
    imageUrl: string;
    onCrop: (croppedBase64: string) => void;
    onCancel: () => void;
}

export default function ImageCropper({ imageUrl, onCrop, onCancel }: ImageCropperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Crop percentages (0 to 1) from each edge
    const [crop, setCrop] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
    const [dragging, setDragging] = useState<'top' | 'right' | 'bottom' | 'left' | null>(null);
    const [imgLoaded, setImgLoaded] = useState(false);

    const handleReset = () => setCrop({ top: 0, right: 0, bottom: 0, left: 0 });

    const handleMouseDown = (side: 'top' | 'right' | 'bottom' | 'left') => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(side);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging || !containerRef.current || !imgRef.current) return;

        const rect = imgRef.current.getBoundingClientRect();
        const img = imgRef.current;

        if (dragging === 'top') {
            const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
            const pct = y / rect.height;
            setCrop(c => ({ ...c, top: Math.min(pct, 1 - c.bottom - 0.05) }));
        } else if (dragging === 'bottom') {
            const y = Math.max(0, Math.min(rect.bottom - e.clientY, rect.height));
            const pct = y / rect.height;
            setCrop(c => ({ ...c, bottom: Math.min(pct, 1 - c.top - 0.05) }));
        } else if (dragging === 'left') {
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const pct = x / rect.width;
            setCrop(c => ({ ...c, left: Math.min(pct, 1 - c.right - 0.05) }));
        } else if (dragging === 'right') {
            const x = Math.max(0, Math.min(rect.right - e.clientX, rect.width));
            const pct = x / rect.width;
            setCrop(c => ({ ...c, right: Math.min(pct, 1 - c.left - 0.05) }));
        }
    }, [dragging]);

    const handleMouseUp = useCallback(() => {
        setDragging(null);
    }, []);

    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragging, handleMouseMove, handleMouseUp]);

    const handleApplyCrop = () => {
        if (!imgRef.current) return;

        const img = imgRef.current;
        const canvas = document.createElement('canvas');

        // Calculate crop in natural image pixels
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

        const sx = Math.round(crop.left * natW);
        const sy = Math.round(crop.top * natH);
        const sw = Math.round((1 - crop.left - crop.right) * natW);
        const sh = Math.round((1 - crop.top - crop.bottom) * natH);

        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

        const base64 = canvas.toDataURL('image/png');
        onCrop(base64);
    };

    const hasCrop = crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Crop Image — drag edges to trim</span>
                <div className="flex items-center gap-1.5">
                    <button onClick={handleReset} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border hover:bg-gray-50" title="Reset crop">
                        <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                    <button onClick={onCancel} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border hover:bg-gray-50 text-red-600">
                        <X className="w-3 h-3" /> Cancel
                    </button>
                    <button
                        onClick={handleApplyCrop}
                        disabled={!hasCrop}
                        className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Check className="w-3 h-3" /> Apply Crop
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="relative inline-block w-full select-none"
                style={{ cursor: dragging ? (dragging === 'top' || dragging === 'bottom' ? 'ns-resize' : 'ew-resize') : 'default' }}
            >
                {/* The actual image */}
                <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="Crop preview"
                    className="w-full h-auto block"
                    crossOrigin="anonymous"
                    onLoad={() => setImgLoaded(true)}
                    draggable={false}
                />

                {imgLoaded && (
                    <>
                        {/* Dark overlays for cropped areas */}
                        {/* Top */}
                        {crop.top > 0 && (
                            <div className="absolute left-0 right-0 top-0 bg-black/50 pointer-events-none"
                                style={{ height: `${crop.top * 100}%` }} />
                        )}
                        {/* Bottom */}
                        {crop.bottom > 0 && (
                            <div className="absolute left-0 right-0 bottom-0 bg-black/50 pointer-events-none"
                                style={{ height: `${crop.bottom * 100}%` }} />
                        )}
                        {/* Left */}
                        {crop.left > 0 && (
                            <div className="absolute left-0 bg-black/50 pointer-events-none"
                                style={{
                                    top: `${crop.top * 100}%`,
                                    width: `${crop.left * 100}%`,
                                    height: `${(1 - crop.top - crop.bottom) * 100}%`
                                }} />
                        )}
                        {/* Right */}
                        {crop.right > 0 && (
                            <div className="absolute right-0 bg-black/50 pointer-events-none"
                                style={{
                                    top: `${crop.top * 100}%`,
                                    width: `${crop.right * 100}%`,
                                    height: `${(1 - crop.top - crop.bottom) * 100}%`
                                }} />
                        )}

                        {/* Draggable edge handles */}
                        {/* Top handle */}
                        <div
                            className="absolute left-0 right-0 flex justify-center cursor-ns-resize z-10 group"
                            style={{ top: `${crop.top * 100}%`, transform: 'translateY(-50%)' }}
                            onMouseDown={handleMouseDown('top')}
                        >
                            <div className={`w-16 h-1.5 rounded-full transition-colors ${dragging === 'top' ? 'bg-blue-500' : 'bg-blue-400 group-hover:bg-blue-500'}`} />
                        </div>

                        {/* Bottom handle */}
                        <div
                            className="absolute left-0 right-0 flex justify-center cursor-ns-resize z-10 group"
                            style={{ bottom: `${crop.bottom * 100}%`, transform: 'translateY(50%)' }}
                            onMouseDown={handleMouseDown('bottom')}
                        >
                            <div className={`w-16 h-1.5 rounded-full transition-colors ${dragging === 'bottom' ? 'bg-blue-500' : 'bg-blue-400 group-hover:bg-blue-500'}`} />
                        </div>

                        {/* Left handle */}
                        <div
                            className="absolute top-0 bottom-0 flex items-center cursor-ew-resize z-10 group"
                            style={{ left: `${crop.left * 100}%`, transform: 'translateX(-50%)' }}
                            onMouseDown={handleMouseDown('left')}
                        >
                            <div className={`w-1.5 h-16 rounded-full transition-colors ${dragging === 'left' ? 'bg-blue-500' : 'bg-blue-400 group-hover:bg-blue-500'}`} />
                        </div>

                        {/* Right handle */}
                        <div
                            className="absolute top-0 bottom-0 flex items-center cursor-ew-resize z-10 group"
                            style={{ right: `${crop.right * 100}%`, transform: 'translateX(50%)' }}
                            onMouseDown={handleMouseDown('right')}
                        >
                            <div className={`w-1.5 h-16 rounded-full transition-colors ${dragging === 'right' ? 'bg-blue-500' : 'bg-blue-400 group-hover:bg-blue-500'}`} />
                        </div>

                        {/* Crop area border */}
                        <div
                            className="absolute border-2 border-blue-400 border-dashed pointer-events-none"
                            style={{
                                top: `${crop.top * 100}%`,
                                left: `${crop.left * 100}%`,
                                right: `${crop.right * 100}%`,
                                bottom: `${crop.bottom * 100}%`,
                            }}
                        />
                    </>
                )}
            </div>

            {/* Dimensions info */}
            {imgLoaded && imgRef.current && hasCrop && (
                <div className="text-[10px] text-gray-400 text-center">
                    Cropped: {Math.round((1 - crop.left - crop.right) * (imgRef.current.naturalWidth || 0))} × {Math.round((1 - crop.top - crop.bottom) * (imgRef.current.naturalHeight || 0))} px
                </div>
            )}
        </div>
    );
}
