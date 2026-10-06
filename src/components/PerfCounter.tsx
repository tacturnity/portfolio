// src/components/PerfCounter.tsx
import { useEffect, useState, useRef } from 'react';

export default function PerfCounter() {
  const [stats, setStats] = useState({ cpu: 0, gpu: 0, fps: 0 });
  // Modes: 'scroll' (moves with page) -> 'pinned' (fixed to screen) -> 'hidden' (dissolved)
  const [mode, setMode] = useState<'scroll' | 'pinned' | 'hidden'>('hidden');

  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const lastUpdate = useRef(performance.now());
  const lastFrameTimestamp = useRef(performance.now());

  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      frameCount.current += 1;

      const delta = now - lastFrameTimestamp.current;
      lastFrameTimestamp.current = now;

      // Update 5 times every second (every 200ms)
      const elapsedSinceUpdate = now - lastUpdate.current;
      if (elapsedSinceUpdate >= 200) {
        const calculatedFps = Math.round(
          (frameCount.current * 1000) / elapsedSinceUpdate
        );

        const targetFrameTime = 1000 / Math.max(calculatedFps, 60);
        const frameLag = Math.max(0, delta - targetFrameTime);
        
        const rawCpu = Math.min(
          99,
          Math.max(4, Math.round((frameLag / targetFrameTime) * 100 + (calculatedFps < 55 ? 30 : 10)))
        );

        const rawGpu = Math.min(
          99,
          Math.max(6, Math.round((delta / 16.6) * 35 + (calculatedFps < 50 ? 45 : 12)))
        );

        setStats({
          cpu: rawCpu,
          gpu: rawGpu,
          fps: Math.min(calculatedFps, 999)
        });

        frameCount.current = 0;
        lastUpdate.current = now;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleClick = () => {
    setMode((prev) => {
      if (prev === 'scroll') return 'pinned';
      if (prev === 'pinned') return 'hidden';
      return 'scroll';
    });
  };

  const formattedCpu = String(stats.cpu).padStart(2, '0');
  const formattedGpu = String(stats.gpu).padStart(2, '0');
  const formattedFps = String(stats.fps).padStart(3, '0');

  // Dynamic positioning & dissolve styles
  const positionClass = mode === 'pinned' ? 'fixed' : 'absolute';
  const visibilityClass = mode === 'hidden' ? 'opacity-0' : 'opacity-90 hover:opacity-100';

  return (
    <div
      onClick={handleClick}
      title={
        mode === 'scroll' 
          ? 'Click to pin to screen' 
          : mode === 'pinned' 
          ? 'Click to dissolve away' 
          : 'Click to restore'
      }
      className={`
        ${positionClass} 
        ${visibilityClass}
        top-6 right-6 md:top-8 md:right-8 
        z-50 pointer-events-auto cursor-pointer select-none 
        font-mono text-xs tracking-wider text-white font-light
        transition-opacity duration-300 ease-out
      `}
    >
      {`CPU ${formattedCpu}% GPU ${formattedGpu}% FPS ${formattedFps}`}
    </div>
  );
}