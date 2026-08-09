import React, { useEffect, useCallback, useState } from 'react';
import type { Photo } from '../types';

interface LightboxProps {
  photo: Photo | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

// Updated with a shrink-resistant dt and text truncation to elegantly support wide filenames
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
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    if (e.targetTouches.length > 0) {
      setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.targetTouches.length > 0) {
      setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    }
  };

  const onTouchEndEvent = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    
    if (Math.abs(distanceY) > Math.abs(distanceX)) return;

    if (distanceX > 50 && hasNext) onNext();
    if (distanceX < -50 && hasPrev) onPrev();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && hasNext) onNext();
    if (e.key === 'ArrowLeft' && hasPrev) onPrev();
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

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

  // Load medium-res images on mobile/tablet to ensure instant switching performance
  const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1024;
  const imageSrc = isMobileOrTablet ? photo.gridSrc : photo.editedSrc;

  return (
    <div 
      // Restructured using standard absolute overlay positions to remove flex container positioning bugs on siblings
      className="fixed inset-0 bg-black/95 z-50 select-none animate-fade-in"
      onClick={onClose}
      // Isolated touch events completely from bubbling up to App.tsx's global swipe handler
      onTouchStart={(e) => { e.stopPropagation(); onTouchStart(e); }}
      onTouchMove={(e) => { e.stopPropagation(); onTouchMove(e); }}
      onTouchEnd={(e) => { e.stopPropagation(); onTouchEndEvent(); }}
      role="dialog"
      aria-modal="true"
    >
      {/* Central image container with z-10 and pointer-events-none so it doesn't block sibling actions */}
      <div 
        className="absolute inset-0 flex items-center justify-center p-4 md:p-12 z-10 pointer-events-none"
        onClick={e => e.stopPropagation()}
      >
        <img 
          src={imageSrc} 
          alt={photo.title} 
          className="max-w-full max-h-full object-contain shadow-2xl pointer-events-auto"
        />
      </div>

      {/* 
        Strictly rely on single onClick handlers with propagation stops. 
        Removing duplicate touchstart handlers completely resolves iOS double-dispatch blocks.
      */}
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
      
      {hasPrev && (
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
      {hasNext && (
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

      <div 
        className="absolute top-4 left-4 md:top-6 md:left-6 w-64 md:w-80 max-w-[70vw] bg-black/30 backdrop-blur-xl rounded-xl md:rounded-2xl p-3 md:p-5 text-white border border-white/10 shadow-2xl animate-fade-in-short z-40"
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