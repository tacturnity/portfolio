import React, { useEffect, useCallback } from 'react';
import type { Photo } from '../types';

interface LightboxProps {
  photo: Photo | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

// UPDATED: More compact text sizing for mobile
const MetadataRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between text-[10px] md:text-sm">
    <dt className="text-gray-400 mr-4">{label}</dt>
    <dd className="text-white font-mono">{value}</dd>
  </div>
);

const Lightbox: React.FC<LightboxProps> = ({ photo, onClose, onNext, onPrev, hasNext, hasPrev }) => {
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

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
          className="w-full h-full flex items-center justify-center p-2 md:p-8"
          onClick={e => e.stopPropagation()}
      >
          <img 
            src={photo.editedSrc} 
            alt={photo.title} 
            className="max-w-full max-h-full object-contain shadow-2xl"
          />
      </div>

      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-30"
        aria-label="Close image viewer"
      >
        {/* Responsive icon size */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {hasPrev && (
        <button 
          onClick={(e) => { e.stopPropagation(); onPrev(); }} 
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 transition-colors z-20"
          aria-label="Previous image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button 
          onClick={(e) => { e.stopPropagation(); onNext(); }} 
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 transition-colors z-20"
          aria-label="Next image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* 
         UPDATED INFO BOX 
         - Positioned tighter to corner (top-4 left-4)
         - Auto width on mobile to fit content, fixed on desktop
         - Smaller padding (p-3 vs p-5)
      */}
      <div 
        className="absolute top-4 left-4 md:top-6 md:left-6 w-auto md:w-64 max-w-[70vw] bg-black/30 backdrop-blur-xl rounded-xl md:rounded-2xl p-3 md:p-5 text-white border border-white/10 shadow-2xl animate-fade-in-short z-20"
        onClick={e => e.stopPropagation()}
      >
        <dl className="space-y-1 md:space-y-3">
          {filename && <MetadataRow label="File" value={filename} />}
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