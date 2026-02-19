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

  useEffect(() => {
    const activeIndex = items.indexOf(activeItem);
    const activeEl = itemRefs.current[activeIndex];
    
    if (activeIndex !== -1 && activeEl) {
      // OffsetLeft is relative to the container, making it 100% accurate for X
      const x = activeEl.offsetLeft;
      const width = activeEl.offsetWidth;

      setFocusRect({
        x: x,
        width: width,
        opacity: 1
      });
    }
  }, [activeItem, items]);

  return (
    <nav className="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none font-['Lexend']">
      <motion.div
        ref={containerRef}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="pointer-events-auto relative flex items-center gap-2 px-4 py-3 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl h-14"
      >
        {/* TRUE FOCUS FRAME */}
        <motion.div
          className="absolute pointer-events-none flex items-center justify-center"
          initial={false}
          animate={{
            x: focusRect.x,
            width: focusRect.width,
            opacity: focusRect.opacity,
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          style={{ top: 0, bottom: 0, left: 0 }} // Align to the left of the parent
        >
          {/* 
            THE BRACKETS:
            We wrap them in a container that has horizontal padding 
            matching the button's padding (px-4 = 1rem = 16px).
            This makes the brackets hug the TEXT instead of the whole button.
          */}
          <div className="relative w-full h-[28px] mx-2"> 
            <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2" style={{ borderColor }} />
            <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2" style={{ borderColor }} />
            <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2" style={{ borderColor }} />
            <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2" style={{ borderColor }} />
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
  const magnification = 1.3;

  const mouseDistance = useTransform(mouseX, (val: number) => {
    const rect = buttonRef.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - rect.x - rect.width / 2;
  });

  const scaleSize = useSpring(
    useTransform(mouseDistance, [-distance, 0, distance], [1, magnification, 1]),
    { mass: 0.1, stiffness: 150, damping: 12 }
  );

  return (
    <motion.button
      ref={buttonRef}
      onClick={onClick}
      style={{ 
        scale: scaleSize,
        filter: isActive ? 'blur(0px)' : `blur(${blurAmount}px)`,
      }}
      // px-4 is our "cushion" - if you change this, change the mx-4 in the frame above
      className={`
        relative z-10 px-4 h-full flex items-center justify-center text-[10px] md:text-[11px] 
        uppercase tracking-[0.25em] transition-[filter] duration-700 ease-out outline-none
        ${isActive ? 'text-white font-bold' : 'text-white/30 hover:text-white/60'}
      `}
    >
      <span className="block leading-none">{label}</span>
    </motion.button>
  );
});