import React, { useEffect, useRef, useState, useCallback } from 'react';

interface TextPressureProps {
  text?: string;
  fontFamily?: string;
  width?: boolean;
  weight?: boolean;
  italic?: boolean;
  alpha?: boolean;
  flex?: boolean;
  textColor?: string;
  minFontSize?: number;
  scale?: boolean;
}

const TextPressure: React.FC<TextPressureProps> = ({
  text = 'Cookaracha',
  fontFamily = 'Lexend',
  width = true,
  weight = true,
  italic = false,
  alpha = false,
  flex = true,
  textColor = '#fb7185',
  minFontSize = 24,
  scale = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const spansRef = useRef<(HTMLSpanElement | null)[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const cursorRef = useRef({ x: 0, y: 0 });

  const [fontSize, setFontSize] = useState(minFontSize);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorRef.current.x = e.clientX;
      cursorRef.current.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Inside TextPressure.tsx - Update the setSize function
const setSize = useCallback(() => {
  if (!containerRef.current) return;
  const { width: containerW } = containerRef.current.getBoundingClientRect();
  
  // Adjusted logic: smaller multiplier for mobile
  const isMobile = window.innerWidth < 768;
  const multiplier = isMobile ? 0.8 : 1.5; 
  let newFontSize = (containerW / (text.length / multiplier));
  
  // Clamp the font size so it doesn't get ridiculously huge or tiny
  const clampedSize = Math.min(Math.max(newFontSize, minFontSize), isMobile ? 40 : 120);
  setFontSize(clampedSize);
}, [text, minFontSize]);
  useEffect(() => {
    setSize();
    window.addEventListener('resize', setSize);
    return () => window.removeEventListener('resize', setSize);
  }, [setSize]);

  useEffect(() => {
    let rafId: number;
    const animate = () => {
      mouseRef.current.x += (cursorRef.current.x - mouseRef.current.x) / 15;
      mouseRef.current.y += (cursorRef.current.y - mouseRef.current.y) / 15;

      if (titleRef.current) {
        const maxDist = titleRef.current.offsetWidth / 2;
        spansRef.current.forEach(span => {
          if (!span) return;
          const rect = span.getBoundingClientRect();
          const charCenter = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
          const d = Math.sqrt(Math.pow(mouseRef.current.x - charCenter.x, 2) + Math.pow(mouseRef.current.y - charCenter.y, 2));

          const getAttr = (dist: number, min: number, max: number) => Math.max(min, max - (max * dist) / maxDist + min);

          const wdth = width ? Math.floor(getAttr(d, 60, 150)) : 100;
          const wght = weight ? Math.floor(getAttr(d, maxDist, 900)) : 400;
          
          span.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}`;
          if (alpha) span.style.opacity = Math.max(0.2, 1 - d / maxDist).toString();
        });
      }
      rafId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(rafId);
  }, [width, weight, alpha]);

  return (
    <div ref={containerRef} className="w-full h-full bg-transparent overflow-visible pr-4" >
      <h1 ref={titleRef} className={flex ? 'flex justify-between w-full' : ''} style={{ fontFamily, fontSize: fontSize + 'px', color: textColor, textTransform: 'uppercase', margin: 0 }}>
        {text.split('').map((char, i) => (
          <span key={i} ref={el => { spansRef.current[i] = el; }} style={{ display: 'inline-block' }}>
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </h1>
    </div>
  );
};

export default TextPressure;