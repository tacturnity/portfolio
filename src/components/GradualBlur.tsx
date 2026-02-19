import React, { useRef, useMemo } from 'react';

const DEFAULT_CONFIG = {
  position: 'bottom',
  strength: 0,
  height: '35vh',     // Increased height to allow more room for feathering
  divCount: 10,       // More divs = smoother transition
  exponential: true,
  zIndex: 30,
  opacity: 0.5,
  className: '',
};

function GradualBlur(props: any) {
  const containerRef = useRef(null);
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...props }), [props]);

  const blurDivs = useMemo(() => {
    const divs = [];
    // Increase this value to move the blur START further down the screen
    const maskStartOffset = 5; 

    for (let i = 1; i <= config.divCount; i++) {
      const progress = i / config.divCount;
      
      // Calculate blur strength exponentially
      const blurValue = Math.pow(progress, 2) * config.strength;

      // Create a very smooth, long feather at the top
      // This starts transparent and slowly becomes solid black (the blur area)
      const p1 = maskStartOffset + (progress * 10);
      const p2 = p1 + 30; // 30% feathering zone for each layer

      const mask = `linear-gradient(to bottom, 
        transparent 0%, 
        transparent ${p1}%, 
        black ${p2}%, 
        black 100%)`;

      const divStyle: React.CSSProperties = {
        position: 'absolute',
        inset: '0',
        WebkitBackdropFilter: `blur(${blurValue.toFixed(2)}px)`,
        backdropFilter: `blur(${blurValue.toFixed(2)}px)`,
        WebkitMaskImage: mask,
        maskImage: mask,
        pointerEvents: 'none', // Critical: individual layers must ignore mouse
      };

      divs.push(<div key={i} style={divStyle} />);
    }
    return divs;
  }, [config]);

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: config.height,
    pointerEvents: 'none', // Critical: container must ignore mouse
    zIndex: config.zIndex,
    isolation: 'isolate',
  };

  return (
    <div ref={containerRef} className={`gradual-blur ${config.className}`} style={containerStyle}>
      <div className="gradual-blur-inner" style={{ position: 'relative', width: '100%', height: '100%', pointerEvents: 'none' }}>
        {blurDivs}
      </div>
    </div>
  );
}

export default React.memo(GradualBlur);