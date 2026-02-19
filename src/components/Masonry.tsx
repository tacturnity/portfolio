import { useEffect, useMemo, useRef, useState } from 'react';
import TiltedCard from './TiltedCard';

export default function Masonry({ items, onPhotoClick, enableCrop, enablePanoSpan }: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const newWidth = containerRef.current.offsetWidth;
        if (newWidth > 0) setWidth(newWidth);
      }
    };
    updateWidth();
    const timeout = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      clearTimeout(timeout);
    };
  }, []);

  // Responsive column count
  const columns = width >= 1500 ? 5 : width >= 1000 ? 4 : width >= 768 ? 3 : 2;

  const gridItems = useMemo(() => {
    if (width === 0 || !items || items.length === 0) return [];
    
    const gap = width < 768 ? 10 : 20;
    const columnWidth = (width - (columns - 1) * gap) / columns;
    const colHeights = new Array(columns).fill(0);
    
    return items.map((item: any) => {
      // 1. Get Image Properties
      const isPano = item.category?.toLowerCase() === 'panos';
      const naturalW = parseFloat(item.width) || 1000;
      const naturalH = parseFloat(item.height) || 1000;
      const naturalAspectRatio = naturalW / naturalH;
      const isLandscape = naturalAspectRatio >= 1;

      // 2. Determine Span & Aspect Ratio
      let span = 1;
      let targetAspectRatio = naturalAspectRatio;

      if (enableCrop) {
        // --- QUANTIZED LOGIC ---
        
        if (isPano && enablePanoSpan) {
          // EXCEPTION: Pano spanning overrides quantization
          span = columns; // Span full width
          targetAspectRatio = naturalAspectRatio; // Keep natural shape
        } else {
          // STANDARD QUANTIZATION
          if (isLandscape) {
             // 2:1 Ratio (Wide and Short)
             // Width = 1 unit, Height = 0.5 units
             targetAspectRatio = 2 / 1;
          } else {
             // 1:2 Ratio (Narrow and Tall)
             // Width = 1 unit, Height = 2 units
             targetAspectRatio = 1 / 2;
          }
        }

      } else {
        // --- NATURAL LOGIC (Crop OFF) ---
        
        // Even if crop is off, we usually still want Panos to span if enabled
        if (isPano && enablePanoSpan) {
          span = columns;
        }
        targetAspectRatio = naturalAspectRatio;
      }

      // 3. Calculate Dimensions
      // Width is calculated based on how many columns it spans
      const finalWidth = (columnWidth * span) + (gap * (span - 1));
      
      // Height is derived from Width / Ratio
      const targetHeight = finalWidth / targetAspectRatio;

      // 4. Find the Shortest Column (Waterfall algorithm)
      let targetCol = 0;
      let minY = Infinity;
      
      // We only look at possible starting columns where the item fits (columns - span)
      for (let i = 0; i <= columns - span; i++) {
        // If spanning multiple columns, find the max height within that span
        const maxHeightInRange = Math.max(...colHeights.slice(i, i + span));
        if (maxHeightInRange < minY) {
          minY = maxHeightInRange;
          targetCol = i;
        }
      }

      const x = targetCol * (columnWidth + gap);
      const y = minY;

      // 5. Update column heights
      for (let i = targetCol; i < targetCol + span; i++) {
        colHeights[i] = y + targetHeight + gap;
      }

      return { ...item, x, y, w: finalWidth, h: targetHeight };
    });
  }, [items, columns, width, enableCrop, enablePanoSpan]);

  const totalHeight = Math.max(0, ...gridItems.map(i => i.y + i.h));

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: (totalHeight + 200) + 'px' }}>
      {gridItems.map((item: any) => (
        <div
          key={item.id}
          className="absolute will-change-transform transition-all duration-700 ease-out"
          style={{ 
            width: item.w + 'px', 
            height: item.h + 'px', 
            transform: `translate3d(${item.x}px, ${item.y}px, 0)` 
          }}
        >
          <TiltedCard 
            imageSrc={item.gridSrc} 
            imageWidth="100%"
            imageHeight="100%"
            onClick={() => onPhotoClick(item)}
          />
        </div>
      ))}
    </div>
  );
}