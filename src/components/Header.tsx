import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TextPressure from './TextPressure';

interface HeaderProps {
  showTitle: boolean;
  titleSpringStiffness?: number;
  titleSpringDamping?: number;
  titleSpringMass?: number;
}

const Header: React.FC<HeaderProps> = ({ 
  showTitle,
  titleSpringStiffness = 50,
  titleSpringDamping = 14,
  titleSpringMass = 5.0
}) => {
  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }} 
      transition={{ duration: 0.3 }}
      className="absolute top-0 left-0 right-0 z-[100] pt-[10px] md:pt-[52px] pb-10 pointer-events-none"
    >
      <div className="relative w-full flex justify-center items-center min-h-[120px] px-4 md:px-10">
        <div className="w-full max-w-[90vw] md:max-w-[800px] flex flex-col items-center justify-center relative">
          <AnimatePresence mode="wait">
            {showTitle ? (
              <motion.div 
                key="branding" 
                initial={{ opacity: 0, y: -40, scale: 0.98 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: -30, scale: 0.98 }} 
                transition={{ 
                  type: 'spring', 
                  stiffness: 260, 
                  damping: 26, 
                  mass: 0.8 
                }}
                className="flex flex-col items-center w-full"
              >
                <div className="w-full flex justify-center items-center px-14 md:px-0 tracking-tight">
                  <TextPressure text="Cookaracha's" minFontSize={24} />
                </div>
                <p className="text-[10px] md:text-[13px] tracking-[0.25em] md:tracking-[0.35em] text-neutral-400 font-medium uppercase mt-3 text-center px-6 antialiased">
                  Photography Portfolio
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;