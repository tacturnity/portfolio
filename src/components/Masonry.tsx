import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TiltedCard from './TiltedCard';
import { computeMasonryLayout } from '../lib/masonry';

// Helper to safely deserialize transition parameters for Framer Motion
const parseCardCustom = (str: any) => {
  if (typeof str !== 'string') {
    return { 
      index: 0, 
      direction: 0, 
      slideOffset: 300, 
      staggerDelay: 0.07, 
      slideDuration: 0.4, 
      transitionType: 'cascade' as const, 
      columns: 4 
    };
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

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (newWidth > 0) setWidth(newWidth);
      }
    });

    resizeObserver.observe(el);
    if (el.offsetWidth > 0) setWidth(el.offsetWidth);

    return () => resizeObserver.disconnect();
  }, []);

  const columns = width >= 1500 ? 5 : width >= 1000 ? 4 : width >= 768 ? 3 : 2;

  const gridItems = useMemo(() => {
    if (width === 0 || !items || items.length === 0) return [];

    const gap = width < 768 ? 10 : 20;
    const slots = computeMasonryLayout(items, {
      containerWidth: width,
      columns,
      gap,
      enableCrop,
      enablePanoSpan,
    });
    const slotById = new Map(slots.map(s => [s.id, s]));

    return items.map((item: any) => {
      const slot = slotById.get(item.id) ?? { x: 0, y: 0, w: 0, h: 0 };
      const isPano = item.category?.toLowerCase() === 'panos';

      // Pano crops hire the full-resolution source; everything else uses medium.
      let displaySrc = item.gridSrc || item.url_medium || item.url_large;
      if (isPano && enablePanoSpan) {
        displaySrc = item.editedSrc || item.url_large;
      }

      return { ...item, x: slot.x, y: slot.y, w: slot.w, h: slot.h, displaySrc };
    });
  }, [items, columns, width, enableCrop, enablePanoSpan]);

  const totalHeight = gridItems.reduce((max, i) => Math.max(max, i.y + i.h), 0);

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
        x: isDissolve ? 0 : (direction >= 0 ? 80 : -80), 
        y: 0,
        scale: 1,
      };
    },
    visible: (customStr: string) => {
      const { index, direction, staggerDelay, slideDuration, transitionType, columns: parsedCols } = parseCardCustom(customStr);
      const isDissolve = transitionType === 'dissolve';
      const isInstant = transitionType === 'instant';
      
      const colIndex = index % parsedCols;
      const localStaggerIndex = direction >= 0 ? colIndex : (parsedCols - 1 - colIndex);

      if (isInstant) {
        return { opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: 0 } };
      }

      return {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        transition: {
          delay: isDissolve ? 0 : localStaggerIndex * staggerDelay,
          duration: isDissolve ? 0.35 : slideDuration,
          ease: isDissolve ? 'easeOut' : [0.2, 0.9, 0.3, 1],
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
        x: isDissolve ? 0 : (direction >= 0 ? -80 : 80), 
        y: 0,
        scale: 1,
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
              /* Set to 80px so cards begin animating just as they reach the screen edge */
              viewport={{ once: false, margin: "80px 0px 80px 0px" }}
              exit="exit"
              className="absolute animate-gpu"
              style={{ 
                width: item.w + 'px', 
                height: item.h + 'px', 
                left: item.x + 'px', 
                top: item.y + 'px',
                /* Hardware acceleration without breaking Framer Motion layout */
                transform: 'translate3d(0, 0, 0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
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