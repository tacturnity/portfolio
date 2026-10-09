import React, { useEffect, useCallback, useState, useRef } from 'react';
import type { Photo } from '../types';

interface LightboxProps {
  photo: Photo | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

const MetadataRow: React.FC<{ label: string; value: string | number; truncate?: boolean }> = ({ label, value, truncate = false }) => (
  <div className="flex justify-between text-[10px] md:text-sm items-center gap-4 w-full">
    <dt className="text-gray-400 shrink-0">{label}</dt>
    <dd 
      className={`text-white font-mono text-right select-all ${truncate ? 'truncate max-w-[130px] sm:max-w-[200px]' : 'break-words'}`} 
      title={String(value)}
    >
      {value}
    </dd>
  </div>
);

const Lightbox: React.FC<LightboxProps> = ({ photo, onClose, onNext, onPrev, hasNext, hasPrev }) => {
  // Zoom & Pan State
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Desktop click vs drag tracking
  const isMouseDown = useRef(false);
  const hasDragged = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  // Mobile gestures tracking
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchScale = useRef<number>(1);

  // Reset zoom on photo change
  useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, [photo]);

  // Scroll wheel zoom (1x to 5x)
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    setScale((prevScale) => {
      const zoomFactor = -e.deltaY * 0.0025;
      const nextScale = Math.min(Math.max(1, prevScale + zoomFactor), 5);
      if (nextScale === 1) setPos({ x: 0, y: 0 });
      return nextScale;
    });
  };

  // Mouse pan & single-click toggle zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isMouseDown.current = true;
    hasDragged.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (Math.hypot(dx, dy) > 5) {
      hasDragged.current = true;
      if (scale > 1) {
        setIsDragging(true);
        setPos({
          x: posStart.current.x + dx,
          y: posStart.current.y + dy,
        });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;
    setIsDragging(false);

    // If mouse didn't drag, treat as a single click to toggle zoom
    if (!hasDragged.current) {
      e.stopPropagation();
      if (scale > 1) {
        setScale(1);
        setPos({ x: 0, y: 0 });
      } else {
        setScale(2.5);
      }
    }
  };

  // Touch: Pinch-to-zoom & Swipe
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.targetTouches.length === 2) {
      setIsDragging(false);
      initialPinchDist.current = getTouchDistance(e.targetTouches[0], e.targetTouches[1]);
      initialPinchScale.current = scale;
      return;
    }

    if (e.targetTouches.length === 1) {
      if (scale > 1) {
        setIsDragging(true);
        dragStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
        posStart.current = { ...pos };
      } else {
        setTouchEnd(null);
        setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.targetTouches.length === 2 && initialPinchDist.current !== null) {
      const currentDist = getTouchDistance(e.targetTouches[0], e.targetTouches[1]);
      const factor = currentDist / initialPinchDist.current;
      const nextScale = Math.min(Math.max(1, initialPinchScale.current * factor), 5);
      setScale(nextScale);
      if (nextScale === 1) setPos({ x: 0, y: 0 });
      return;
    }

    if (scale > 1 && isDragging && e.targetTouches.length === 1) {
      const dx = e.targetTouches[0].clientX - dragStart.current.x;
      const dy = e.targetTouches[0].clientY - dragStart.current.y;
      setPos({
        x: posStart.current.x + dx,
        y: posStart.current.y + dy,
      });
      return;
    }

    if (scale === 1 && e.targetTouches.length === 1) {
      setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    }
  };

  const onTouchEndEvent = (e: React.TouchEvent) => {
    if (e.targetTouches.length < 2) {
      initialPinchDist.current = null;
    }

    if (scale > 1) {
      if (e.targetTouches.length === 0) setIsDragging(false);
      return;
    }

    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    if (Math.abs(distanceY) > Math.abs(distanceX)) return;

    if (distanceX > 50 && hasNext) onNext();
    if (distanceX < -50 && hasPrev) onPrev();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (scale === 1) {
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
    }
  }, [onClose, onNext, onPrev, hasNext, hasPrev, scale]);

  useEffect(() => {
    if (photo) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [photo, handleKeyDown]);

  if (!photo) return null;

  const filename = photo.editedSrc.split('/').pop();
  const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1024;
  const imageSrc = isMobileOrTablet ? photo.gridSrc : photo.editedSrc;

  const cursorClass = scale > 1 
    ? (isDragging ? 'cursor-grabbing' : 'cursor-zoom-out') 
    : 'cursor-zoom-in';

  return (
    <div 
      className="fixed inset-0 bg-black/95 z-50 select-none animate-fade-in overflow-hidden"
      onClick={onClose}
      onTouchStart={(e) => { e.stopPropagation(); onTouchStart(e); }}
      onTouchMove={(e) => { e.stopPropagation(); onTouchMove(e); }}
      onTouchEnd={(e) => { e.stopPropagation(); onTouchEndEvent(e); }}
      role="dialog"
      aria-modal="true"
    >
      {/* Zoom / Pan Image Canvas */}
      <div 
        className="absolute inset-0 flex items-center justify-center p-4 md:p-12 z-10"
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <img 
          src={imageSrc} 
          alt={photo.title} 
          draggable={false}
          style={{
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            touchAction: 'none'
          }}
          className={`max-w-full max-h-full object-contain shadow-2xl pointer-events-auto select-none ${cursorClass}`}
        />
      </div>

      {/* Close Button */}
      <button 
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white hover:text-rose-400 transition-colors z-50 cursor-pointer p-3 bg-neutral-900/80 backdrop-blur-md rounded-full border border-white/20 shadow-2xl flex items-center justify-center pointer-events-auto"
        aria-label="Close image viewer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* Nav Buttons (1x scale only) */}
      {scale === 1 && hasPrev && (
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-neutral-900/80 backdrop-blur-md rounded-full text-white hover:text-rose-400 border border-white/20 shadow-2xl transition-colors z-50 cursor-pointer pointer-events-auto"
          aria-label="Previous image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {scale === 1 && hasNext && (
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-neutral-900/80 backdrop-blur-md rounded-full text-white hover:text-rose-400 border border-white/20 shadow-2xl transition-colors z-50 cursor-pointer pointer-events-auto"
          aria-label="Next image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Info Card */}
        <div 
          className="absolute top-4 left-4 md:top-6 md:left-6 w-[calc(100%-32px)] max-w-[280px] sm:max-w-[320px] md:w-80 bg-black/30 backdrop-blur-xl rounded-2xl md:rounded-3xl p-3 md:p-5 text-white border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-40 backdrop-blur-2xl pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
        <dl className="space-y-1 md:space-y-3">
          {filename && <MetadataRow label="File" value={filename} truncate={true} />}
          <MetadataRow label="Date" value={photo.dateCaptured} />
          <MetadataRow label="ISO" value={photo.iso} />
          <MetadataRow label="Aperture" value={photo.aperture} />
          <MetadataRow label="Shutter" value={photo.shutterSpeed} />
        </dl>
      </div>
    </div>
  );
};

export default Lightbox;