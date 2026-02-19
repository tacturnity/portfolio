import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TextPressure from './TextPressure';

// 1. Custom Switch Component
const CustomSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`w-14 h-7 rounded-full p-1 transition-colors duration-300 pointer-events-auto ${
      checked ? 'bg-rose-500' : 'bg-neutral-800'
    }`}
  >
    <motion.div
      animate={{ x: checked ? 28 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="w-5 h-5 bg-white rounded-full shadow-sm"
    />
  </button>
);

interface HeaderProps {
  enableCrop: boolean;
  setEnableCrop: (val: boolean) => void;
  enablePanoSpan: boolean;
  setEnablePanoSpan: (val: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  enableCrop, 
  setEnableCrop, 
  enablePanoSpan, 
  setEnablePanoSpan 
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }} 
      transition={{ duration: 0.3 }}
      // Responsive padding top: 37px mobile, 52px desktop
      className="absolute top-0 left-0 right-0 z-[100] pt-[37px] md:pt-[52px] pb-10 pointer-events-none"
    >
      {/* Settings Toggle Button (Hamburger) */}
      <button 
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className="absolute top-4 right-4 md:top-8 md:right-10 z-[80] p-2 text-neutral-500 hover:text-rose-400 transition-colors pointer-events-auto"
      >
        {isSettingsOpen ? (
          <X className="w-7 h-7 md:w-9 md:h-9" /> 
        ) : (
          <Menu className="w-7 h-7 md:w-9 md:h-9" />
        )}
      </button>

      {/* Main Branding / Settings Container */}
      <div className="max-w-[90vw] md:max-w-[800px] mx-auto min-h-[120px] flex flex-col items-center justify-center relative">
        <AnimatePresence mode="wait">
          {!isSettingsOpen ? (
            <motion.div 
              key="branding" 
              initial={{ opacity: 0, y: 5 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -5 }} 
              className="flex flex-col items-center w-full px-4"
            >
              <div className="w-full flex justify-center items-center">
                {/* Scaled down slightly for mobile */}
                <TextPressure text="Cookaracha's" minFontSize={24} />
              </div>
              <p className="text-[10px] md:text-[14px] tracking-[0.4em] md:tracking-[0.6em] text-neutral-600 uppercase mt-4 text-center">
                Photography Portfolio
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="settings" 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="flex gap-6 md:gap-16 items-center pointer-events-auto bg-black/60 backdrop-blur-xl p-5 md:p-8 rounded-3xl border border-white/10 shadow-2xl"
            >
              <div className="flex flex-col items-center gap-3 md:gap-4">
                <span className="text-[9px] md:text-[11px] uppercase tracking-widest text-neutral-400 font-medium">Auto Crop</span>
                <CustomSwitch checked={enableCrop} onChange={() => setEnableCrop(!enableCrop)} />
              </div>
              <div className="flex flex-col items-center gap-3 md:gap-4">
                <span className="text-[9px] md:text-[11px] uppercase tracking-widest text-neutral-400 font-medium">Pano Span</span>
                <CustomSwitch checked={enablePanoSpan} onChange={() => setEnablePanoSpan(!enablePanoSpan)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};

export default Header;