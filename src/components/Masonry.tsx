// Inside src/components/Masonry.tsx

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

  const columns = width >= 1500 ? 5 : width >= 1000 ? 4 : width >= 768 ? 3 : 2;
  const gridItems = useMemo(() => {
    if (width === 0 || !items || items.length === 0) return [];
    
    const gap = width < 768 ? 10 : 20;
    const columnWidth = (width - (columns - 1) * gap) / columns;
    const colHeights = new Array(columns).fill(0);
    
    return items.map((item: any) => {
      // SAFETY FIX: Convert strings to numbers and provide fallback
      const w = parseFloat(item.width) || 1000;
      const h = parseFloat(item.height) || 1000;
      const aspectRatio = w / h;

      let span = 1;
      if (enablePanoSpan) {
        const isPano = item.category?.toLowerCase() === 'panos';
        const isLandscape = aspectRatio > 1.2;
        if (isPano && isLandscape) span = columns;
        else if (isPano && !isLandscape) span = Math.min(2, columns);
      }

      let targetCol = 0;
      let minY = Infinity;
      for (let i = 0; i <= columns - span; i++) {
        const maxHeightInRange = Math.max(...colHeights.slice(i, i + span));
        if (maxHeightInRange < minY) {
          minY = maxHeightInRange;
          targetCol = i;
        }
      }

      const x = targetCol * (columnWidth + gap);
      const y = minY;
      const finalWidth = (columnWidth * span) + (gap * (span - 1));
      let targetHeight = finalWidth / aspectRatio;

      // Smart Crop
      if (enableCrop && span === 1) {
        const leftNeighbor = targetCol > 0 ? colHeights[targetCol - 1] : minY;
        const rightNeighbor = targetCol < columns - 1 ? colHeights[targetCol + 1] : minY;
        const neighborY = Math.max(leftNeighbor, rightNeighbor);
        if (neighborY > minY) {
          const desiredHeight = neighborY - minY - gap;
          if (desiredHeight > targetHeight * 0.5 && desiredHeight < targetHeight * 1.5) {
            targetHeight = desiredHeight;
          }
        }
      }

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