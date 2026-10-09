import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface DockNavProps {
  items: string[];
  activeItem: string;
  onItemClick: (item: string) => void;
  blurAmount?: number;
  borderColor?: string;
}

export default function DockNav({ 
  items, 
  activeItem, 
  onItemClick, 
  blurAmount = 1, 
  borderColor = '#fb7185' 
}: DockNavProps) {
  const mouseX = useMotionValue(Infinity);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  const [focusRect, setFocusRect] = useState({ x: 0, width: 0, opacity: 0 });

  const activeIndex = items.indexOf(activeItem);

  useEffect(() => {
    const activeEl = itemRefs.current[activeIndex];
    
    if (activeIndex !== -1 && activeEl) {
      const x = activeEl.offsetLeft;
      const width = activeEl.offsetWidth;

      setFocusRect({
        x: x,
        width: width,
        opacity: 1
      });

      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (container) {
          const containerWidth = container.offsetWidth;
          const targetScrollLeft = x - (containerWidth / 2) + (width / 2);
          
          container.scrollTo({
            left: targetScrollLeft,
            behavior: 'smooth'
          });
        }
      });
    }
  }, [activeItem, items, activeIndex]);

  return (
    <nav 
      style={{ transform: 'translate3d(0, 0, 100px)', transformStyle: 'preserve-3d' }}
      className="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none font-['Lexend']"
    >
      <motion.div
        ref={containerRef}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="pointer-events-auto relative flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-black/40 backdrop-blur-3xl border border-white/20 ring-1 ring-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.7)] h-14 overflow-x-auto no-scrollbar max-w-[95vw] sm:max-w-none"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          touchAction: 'pan-x'
        }}
      >
        {/* TRUE FOCUS FRAME */}
        <motion.div
          className="absolute pointer-events-none flex items-center justify-center px-1"
          initial={false}
          animate={{
            x: focusRect.x,
            width: focusRect.width,
            opacity: focusRect.opacity,
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          style={{ top: 0, bottom: 0, left: 0 }}
        >
          {/* 
            Four curved corner brackets hugging the text with dynamic pill rounding matching outer capsule curve 
          */}
          <div className="relative w-full h-[32px] mx-2"> 
            <span 
              className={`absolute border-t-2 border-l-2 transition-all duration-300 ${
                activeIndex === 0 
                  ? '-top-1 -left-1 w-3 h-3 rounded-tl-2xl' 
                  : '-top-1 -left-1 w-3 h-3 rounded-tl-md'
              }`} 
              style={{ borderColor }} 
            />
            <span 
              className={`absolute border-t-2 border-r-2 transition-all duration-300 ${
                activeIndex === items.length - 1 
                  ? '-top-1 -right-1 w-3 h-3 rounded-tr-2xl' 
                  : '-top-1 -right-1 w-3 h-3 rounded-tr-md'
              }`} 
              style={{ borderColor }} 
            />
            <span 
              className={`absolute border-b-2 border-l-2 transition-all duration-300 ${
                activeIndex === 0 
                  ? '-bottom-1 -left-1 w-3 h-3 rounded-bl-2xl' 
                  : '-bottom-1 -left-1 w-3 h-3 rounded-bl-md'
              }`} 
              style={{ borderColor }} 
            />
            <span 
              className={`absolute border-b-2 border-r-2 transition-all duration-300 ${
                activeIndex === items.length - 1 
                  ? '-bottom-1 -right-1 w-3 h-3 rounded-br-2xl' 
                  : '-bottom-1 -right-1 w-3 h-3 rounded-br-md'
              }`} 
              style={{ borderColor }} 
            />
          </div>
        </motion.div>

        {items.map((item, index) => (
          <DockItem
            key={item}
            ref={(el: HTMLButtonElement | null) => { itemRefs.current[index] = el; }}
            label={item}
            isActive={activeItem === item}
            onClick={() => onItemClick(item)}
            mouseX={mouseX}
            blurAmount={blurAmount}
          />
        ))}
      </motion.div>
    </nav>
  );
}

const DockItem = React.forwardRef<HTMLButtonElement, any>(({ label, isActive, onClick, mouseX, blurAmount }, ref) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  React.useImperativeHandle(ref, () => buttonRef.current!);

  const distance = 150;
  const magnification = 1.25;

  const mouseDistance = useTransform(mouseX, (val: number) => {
    const rect = buttonRef.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - rect.x - rect.width / 2;
  });

  const scaleSize = useSpring(
    useTransform(mouseDistance, [-distance, 0, distance], [1, magnification, 1]),
    { mass: 0.1, stiffness: 220, damping: 18 }
  );

  return (
    <motion.button
      ref={buttonRef}
      onClick={onClick}
      whileTap={{ scale: 0.91 }}
      transition={{ type: 'spring', stiffness: 600, damping: 25 }}
      style={{ 
        scale: scaleSize,
        filter: isActive ? 'blur(0px)' : `blur(${blurAmount}px)`,
        transformOrigin: 'center center'
      }}
      className={`
        relative z-10 px-3.5 h-full flex items-center justify-center text-[10px] md:text-[11px] 
        uppercase tracking-[0.18em] transition-[filter,color] duration-300 ease-out outline-none select-none active:opacity-70
        ${isActive ? 'text-white font-semibold' : 'text-white/40 hover:text-white/80'}
      `}
    >
      <span className="block leading-none">{label}</span>
    </motion.button>
  );
});
