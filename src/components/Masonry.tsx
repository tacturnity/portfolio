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

    // --- 1. PRE-CALCULATE BALANCE (The Equalizer) ---
    // We need to know the total imbalance before we start looping.
    // Positive balance = Too many Landscapes (Need to swap Land -> Port)
    // Negative balance = Too many Portraits (Need to swap Port -> Land)
    let balanceCounter = 0;
    
    if (enableCrop) {
      items.forEach((item: any) => {
        const isPano = item.category?.toLowerCase() === 'panos';
        // We exclude Panos from the equalizer count to protect them
        if (!isPano) {
          const w = parseFloat(item.width) || 1000;
          const h = parseFloat(item.height) || 1000;
          if (w >= h) balanceCounter++; // Found a Landscape
          else balanceCounter--;        // Found a Portrait
        }
      });
      // We divide by 2 because swapping 1 image changes the relative difference by 2
      balanceCounter = Math.round(balanceCounter / 2);
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

      if (enableCrop) {
        // --- EQUALIZED CROP LOGIC ---

        if (isPano && enablePanoSpan) {
          // Exception: Panos span full width if enabled
          span = columns;
          targetAspectRatio = naturalAspectRatio;
        } else {
          // Determine if we need to force a swap to equalize
          let forceOrientation = isNaturalLandscape ? 'landscape' : 'portrait';

          if (!isPano) {
            if (balanceCounter > 0 && isNaturalLandscape) {
              // We have too many Landscapes, force this one to Portrait
              forceOrientation = 'portrait';
              balanceCounter--; 
            } else if (balanceCounter < 0 && !isNaturalLandscape) {
              // We have too many Portraits, force this one to Landscape
              forceOrientation = 'landscape';
              balanceCounter++;
            }
          }

          // Apply 4:3 or 3:4 Ratios based on result
          if (forceOrientation === 'landscape') {
             targetAspectRatio = 4 / 3;
          } else {
             targetAspectRatio = 3 / 4;
          }
        }
      } else {
        // --- NATURAL LOGIC (Crop OFF) ---
        if (isPano && enablePanoSpan) {
          span = columns;
        }
        targetAspectRatio = naturalAspectRatio;
      }

      // 3. Calculate Dimensions
      const finalWidth = (columnWidth * span) + (gap * (span - 1));
      const targetHeight = finalWidth / targetAspectRatio;

      // 4. Waterfall Placement
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

      // 5. Update heights
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