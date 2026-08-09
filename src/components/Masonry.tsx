
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TiltedCard from './TiltedCard';

// Helper to safely deserialize transition parameters to prevent stale closure cloning in Framer Motion
const parseCardCustom = (str: any) => {
  if (typeof str !== 'string') {
    return { index: 0, direction: 0, slideOffset: 300, staggerDelay: 0.07, slideDuration: 0.4, transitionType: 'cascade' as const, columns: 4 };
  }
  const [index, direction, slideOffset, staggerDelay, slideDuration, transitionType, columns] = str.split('_');
  return {
    index: parseInt(index, 10) || 0,
    direction: parseInt(direction, 10) || 0,
    slideOffset: parseInt(slideOffset, 10) || 300,
    staggerDelay: parseFloat(staggerDelay) || 0.07,
    slideDuration: parseFloat(slideDuration) || 0.4,
    transitionType: transitionType as 'cascade' | 'dissolve' | 'instant',
    columns: parseInt(columns, 10) || 4
  };
};

export default function Masonry({ 
  items, 
  onPhotoClick, 
  enableCrop, 
  enablePanoSpan,
  direction = 0,
  staggerDelay = 0.07,
  slideDuration = 0.4,
  slideOffset = 300,
  transitionType = 'cascade'
}: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // ResizeObserver continuously monitors container dimensions, adapting column counts as animations complete
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0) {
          setWidth(newWidth);
        }
      }
    });

    resizeObserver.observe(el);

    const initialWidth = el.offsetWidth;
    if (initialWidth > 0) setWidth(initialWidth);

    return () => {
      resizeObserver.disconnect();
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
      
      let displaySrc = item.gridSrc; 

      if (enableCrop) {
        if (isPano && enablePanoSpan) {
          span = columns;
          targetAspectRatio = naturalAspectRatio;
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

      return { ...item, x, y, w: finalWidth, h: targetHeight, displaySrc };
    });
  }, [items, columns, width, enableCrop, enablePanoSpan]);

  const totalHeight = Math.max(0, ...gridItems.map(i => i.y + i.h));

  const cardVariants = {
    hidden: (customStr: string) => {
      const { direction, transitionType } = parseCardCustom(customStr);
      const isDissolve = transitionType === 'dissolve';
      const isInstant = transitionType === 'instant';

      if (isInstant) {
        return { opacity: 1, x: 0, y: 0, scale: 1 };
      }

      return {
        opacity: 0,
        // Strictly horizontal entry sliding with unified 80px offset
        x: isDissolve ? 0 : (direction >= 0 ? 80 : -80), 
        y: 0, // Removed diagonal offset to keep motion purely horizontal
        scale: isDissolve ? 1 : 0.98,
      };
    },
    visible: (customStr: string) => {
      const { index, direction, staggerDelay, slideDuration, transitionType, columns: parsedCols } = parseCardCustom(customStr);
      const isDissolve = transitionType === 'dissolve';
      const isInstant = transitionType === 'instant';
      
      const colIndex = index % parsedCols;
      // Dynamically flip cascade delay order to flow in the swipe direction
      const localStaggerIndex = direction >= 0 ? colIndex : (parsedCols - 1 - colIndex);

      if (isInstant) {
        return { 
          opacity: 1, 
          x: 0, 
          y: 0, 
          scale: 1,
          transition: { duration: 0 }
        };
      }

      return {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        transition: {
          delay: isDissolve ? 0 : localStaggerIndex * staggerDelay,
          duration: isDissolve ? 0.35 : slideDuration,
          ease: isDissolve ? 'easeOut' : [0.16, 1, 0.3, 1],
        }
      };
    },
    exit: (customStr: string) => {
      const { direction, slideDuration, transitionType } = parseCardCustom(customStr);
      const isDissolve = transitionType === 'dissolve';
      const isInstant = transitionType === 'instant';

      if (isInstant) {
        return { opacity: 0, transition: { duration: 0.15 } };
      }

      return {
        opacity: 0,
        // Strictly horizontal exit sliding with unified 80px offset
        x: isDissolve ? 0 : (direction >= 0 ? -80 : 80), 
        y: 0, // Removed diagonal offset to keep motion purely horizontal
        scale: isDissolve ? 1 : 0.98,
        transition: {
          duration: isDissolve ? 0.25 : slideDuration * 0.4,
          ease: isDissolve ? 'easeIn' : [0.16, 1, 0.3, 1],
        }
      };
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: (totalHeight + 200) + 'px' }}>
      <AnimatePresence>
        {gridItems.map((item: any, index: number) => {
          const customStr = `${index}_${direction}_${slideOffset}_${staggerDelay}_${slideDuration}_${transitionType}_${columns}`;
          
          return (
            <motion.div
              key={item.id}
              custom={customStr}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: "150px 0px 150px 0px" }}
              exit="exit"
              className="absolute animate-gpu"
              style={{ 
                width: item.w + 'px', 
                height: item.h + 'px', 
                left: item.x + 'px', 
                top: item.y + 'px' 
              }}
            >
              <TiltedCard 
                imageSrc={item.displaySrc} 
                imageWidth="100%"
                imageHeight="100%"
                onClick={() => onPhotoClick(item)}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
