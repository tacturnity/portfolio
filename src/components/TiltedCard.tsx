import { useRef, useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';
import React from 'react';

const springValues = { damping: 30, stiffness: 100, mass: 2 };

export default function TiltedCard({
  imageSrc,
  altText = 'Tilted card image',
  containerHeight = '100%',
  containerWidth = '100%',
  imageHeight = '300px',
  imageWidth = '300px',
  scaleOnHover = 1.05,
  rotateAmplitude = 3,
  onClick
}: any) {
  const ref = useRef<HTMLElement>(null);
  
  // 3D Tilt Values
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);

  // Monitor device hover support
  const [isHoverSupported, setIsHoverSupported] = useState(true);

  useEffect(() => {
    const hoverMediaQuery = window.matchMedia('(hover: hover)');
    setIsHoverSupported(hoverMediaQuery.matches);
  }, []);

  function handleMouse(e: React.MouseEvent) {
    if (!ref.current || !isHoverSupported) return;

    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
    const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude;

    rotateX.set(rotationX);
    rotateY.set(rotationY);
  }

  function handleMouseLeave() {
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <figure
      ref={ref}
      className="relative w-full h-full flex items-center justify-center [perspective:1000px] cursor-pointer"
      style={{ height: containerHeight, width: containerWidth }}
      onMouseMove={handleMouse}
      onMouseEnter={() => scale.set(scaleOnHover)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <motion.div
        className="relative [transform-style:preserve-3d] w-full h-full"
        // Hyper-efficient: Turn off heavy calculations and GPU CSS 3D transforms on touchscreen viewers
        style={isHoverSupported ? { rotateX, rotateY, scale } : { scale }}
      >
        <img
          src={imageSrc}
          alt={altText}
          // Removed loading="lazy" completely to fix standard WebKit/Chrome absolute-grid loading bugs [3]
          decoding="async"   
          className="absolute top-0 left-0 object-cover rounded-[24px] shadow-2xl border border-white/5"
          style={{ width: '100%', height: '100%' }}
        />
      </motion.div>
    </figure>
  );
}