import { useRef, useEffect, useMemo } from 'react';
import gsap from 'gsap';
import './DotGrid.css';

const DotGrid = ({
  dotSize = 2, // Made smaller for a subtle background
  gap = 40,    // Spaced out more
  baseColor = '#333', // Dark gray for background
  activeColor = '#fb7185', // Rose-400 to match your theme
  proximity = 100,
  className = '',
  style = {}
}: any) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<any[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Convert hex to rgb for interpolation
  const baseRgb = useMemo(() => {
    const c = parseInt(baseColor.slice(1), 16);
    return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
  }, [baseColor]);

  const activeRgb = useMemo(() => {
    const c = parseInt(activeColor.slice(1), 16);
    return { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 };
  }, [activeColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wrapper.clientWidth * dpr;
      canvas.height = wrapper.clientHeight * dpr;
      ctx.scale(dpr, dpr);

      const cols = Math.floor(wrapper.clientWidth / gap);
      const rows = Math.floor(wrapper.clientHeight / gap);
      
      dotsRef.current = [];
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          dotsRef.current.push({
            x: i * gap + (wrapper.clientWidth % gap) / 2,
            y: j * gap + (wrapper.clientHeight % gap) / 2,
            originX: i * gap + (wrapper.clientWidth % gap) / 2,
            originY: j * gap + (wrapper.clientHeight % gap) / 2,
            color: baseColor
          });
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      // Shockwave effect calculation
      dotsRef.current.forEach(dot => {
        const dx = mouseRef.current.x - dot.x;
        const dy = mouseRef.current.y - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < proximity) {
          const force = (proximity - dist) / proximity;
          const angle = Math.atan2(dy, dx);
          const pushX = Math.cos(angle) * force * 20; // Strength
          const pushY = Math.sin(angle) * force * 20;

          gsap.to(dot, {
            x: dot.originX - pushX,
            y: dot.originY - pushY,
            duration: 0.5,
            ease: "power2.out"
          });
        } else {
          gsap.to(dot, {
            x: dot.originX,
            y: dot.originY,
            duration: 1.5,
            ease: "elastic.out(1, 0.3)"
          });
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
      
      dotsRef.current.forEach(dot => {
        // Color interpolation based on distance to mouse
        const dx = mouseRef.current.x - dot.x;
        const dy = mouseRef.current.y - dot.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < proximity) {
          const t = 1 - dist / proximity;
          const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t);
          const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t);
          const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = baseColor;
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gap, dotSize, baseColor, baseRgb, activeRgb, proximity]);

  return (
    <div ref={wrapperRef} className={`dot-grid-container ${className}`} style={style}>
      <canvas ref={canvasRef} className="dot-grid-canvas" />
    </div>
  );
};

export default DotGrid;