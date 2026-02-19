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

  // Columns breakpoint logic
  const columns = width >= 1500 ? 5 : width >= 1000 ? 4 : width >= 768 ? 3 : 2;

  const gridItems = useMemo(() => {
    if (width === 0 || !items || items.length === 0) return [];
    
    const gap = width < 768 ? 10 : 20;
    const columnWidth = (width - (columns - 1) * gap) / columns;
    const colHeights = new Array(columns).fill(0);

    // --- 1. EQUALIZER COUNTER ---
    let balanceCounter = 0;
    let landscapeCount = 0;
    let portraitCount = 0;

    if (enableCrop) {
      items.forEach((item: any) => {
        const isPano = item.category?.toLowerCase() === 'panos';
        if (!isPano) {
          const w = parseFloat(item.width) || 1000;
          const h = parseFloat(item.height) || 1000;
          if (w >= h) landscapeCount++;
          else portraitCount++;
        }
      });
      // Calculate how many swaps needed to reach equilibrium
      balanceCounter = Math.round((landscapeCount - portraitCount) / 2);
    }

    // --- 2. LAYOUT LOOP ---
    return items.map((item: any) => {
      const isPano = item.category?.toLowerCase() === 'panos';
      const naturalW = parseFloat(item.width) || 1000;
      const naturalH = parseFloat(item.height) || 1000;
      const isNaturalLandscape = naturalW >= naturalH;
      const naturalAspectRatio = naturalW / naturalH;

      let span = 1;
      let targetAspectRatio = naturalAspectRatio;
      
      // --- HI-RES LOGIC ---
      // Default to the optimized medium size
      let displaySrc = item.gridSrc; 

      if (enableCrop) {
        if (isPano && enablePanoSpan) {
          span = columns;
          targetAspectRatio = naturalAspectRatio;
          // IF SPANNING IS ON: Load the High-Res (editedSrc) version
          displaySrc = item.editedSrc; 
        } else {
          // EQUALIZER LOGIC
          let forceOrientation = isNaturalLandscape ? 'landscape' : 'portrait';

          if (!isPano) {
            if (balanceCounter > 0 && isNaturalLandscape) {
              forceOrientation = 'portrait';
              balanceCounter--; 
            } else if (balanceCounter < 0 && !isNaturalLandscape) {
              forceOrientation = 'landscape';
              balanceCounter++;
            }
          }

          if (forceOrientation === 'landscape') {
             targetAspectRatio = 4 / 3;
          } else {
             targetAspectRatio = 3 / 4;
          }
        }
      } else {
        // CROP DISABLED
        if (isPano && enablePanoSpan) {
          span = columns;
          // IF SPANNING IS ON: Load the High-Res version
          displaySrc = item.editedSrc;
        }
        targetAspectRatio = naturalAspectRatio;
      }

      const finalWidth = (columnWidth * span) + (gap * (span - 1));
      const targetHeight = finalWidth / targetAspectRatio;

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

      for (let i = targetCol; i < targetCol + span; i++) {
        colHeights[i] = y + targetHeight + gap;
      }

      // Return item with the dynamic 'displaySrc'
      return { ...item, x, y, w: finalWidth, h: targetHeight, displaySrc };
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
            // USE THE DYNAMIC SOURCE HERE
            imageSrc={item.displaySrc} 
            imageWidth="100%"
            imageHeight="100%"
            onClick={() => onPhotoClick(item)}
          />
        </div>
      ))}
    </div>
  );
}