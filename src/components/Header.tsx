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
                initial={{ opacity: 0, y: -120 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -120 }} 
                transition={{ 
                  type: 'spring', 
                  stiffness: titleSpringStiffness, 
                  damping: titleSpringDamping, 
                  mass: titleSpringMass 
                }}
                className="flex flex-col items-center w-full"
              >
                <div className="w-full flex justify-center items-center px-14 md:px-0">
                  <TextPressure text="Cookaracha's" minFontSize={24} />
                </div>
                <p className="text-[10px] md:text-[14px] tracking-[0.4em] md:tracking-[0.6em] text-neutral-600 uppercase mt-4 text-center px-6">
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