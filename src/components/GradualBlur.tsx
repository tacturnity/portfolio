import React, { useMemo } from 'react';

interface GradualBlurProps {
  height?: string;
  strength?: number;
  zIndex?: number;
  className?: string;
}

// 1. Shift the layers up so the blur reaches above the menu
const LAYERS = [
  { blur: 1,  start: 15, peak: 45 },
  { blur: 2,  start: 25, peak: 55 },
  { blur: 4,  start: 35, peak: 65 },
  { blur: 8,  start: 45, peak: 75 },
  { blur: 16, start: 55, peak: 85 },
  { blur: 24, start: 65, peak: 95 },
];

function GradualBlur({
  height = '46vh', // 2. Increased from 36vh to 46vh
  strength = 1,
  zIndex = 30,
  className = '',
}: GradualBlurProps) {
  const blurElements = useMemo(() => {
    return LAYERS.map((layer, index) => {
      const blurPx = layer.blur * strength;
      // Guarantees zero blur at the top; only ramps up in the lower half
      const mask = `linear-gradient(to bottom, 
        transparent 0%, 
        transparent ${layer.start}%, 
        black ${layer.peak}%, 
        black 100%)`;

      return (
        <div
          key={index}
          style={{
            position: 'absolute',
            inset: 0,
            WebkitBackdropFilter: `blur(${blurPx}px)`,
            backdropFilter: `blur(${blurPx}px)`,
            WebkitMaskImage: mask,
            maskImage: mask,
            pointerEvents: 'none',
          }}
        />
      );
    });
  }, [strength]);

  return (
    <div
      className={`gradual-blur ${className}`}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height,
        zIndex,
        pointerEvents: 'none',
        isolation: 'isolate',
      }}
    >
      {/* 1. Feathered blur layers */}
      {blurElements}

      {/* 2. Eased dark vignette with a deadband at the top to eliminate hard edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to top, 
            rgba(0, 0, 0, 0.90) 0%, 
            rgba(0, 0, 0, 0.65) 20%, 
            rgba(0, 0, 0, 0.35) 45%, 
            rgba(0, 0, 0, 0.12) 65%, 
            rgba(0, 0, 0, 0.02) 80%, 
            transparent 92%, 
            transparent 100%)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default React.memo(GradualBlur);