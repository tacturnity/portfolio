import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TextPressure from './TextPressure';

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
      // Applied requested 37px mobile / 52px desktop padding
      className="absolute top-0 left-0 right-0 z-[100] pt-[10px] md:pt-[52px] pb-10 pointer-events-none"
    >
      {/* 
        LAYOUT CONTAINER
      */}
      <div className="relative w-full flex justify-center items-center min-h-[120px] px-4 md:px-10">

        {/* 1. MENU BUTTON (Absolute & Vertically Centered) */}
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 z-[80] p-2 text-neutral-500 hover:text-rose-400 transition-colors pointer-events-auto"
        >
          {isSettingsOpen ? (
            <X className="w-7 h-7 md:w-8 md:h-8" /> 
          ) : (
            <Menu className="w-7 h-7 md:w-8 md:h-8" />
          )}
        </button>

        {/* 2. CENTERED CONTENT */}
        <div className="w-full max-w-[90vw] md:max-w-[800px] flex flex-col items-center justify-center relative">
          <AnimatePresence mode="wait">
            {!isSettingsOpen ? (
              <motion.div 
                key="branding" 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -5 }} 
                className="flex flex-col items-center w-full"
              >
                {/* 
                   UPDATED: Added px-14 on mobile to prevent text 
                   from hitting the hamburger button 
                */}
                <div className="w-full flex justify-center items-center px-14 md:px-0">
                  <TextPressure text="Cookaracha's" minFontSize={24} />
                </div>
                
                <p className="text-[10px] md:text-[14px] tracking-[0.4em] md:tracking-[0.6em] text-neutral-600 uppercase mt-4 text-center px-6">
                  Photography Portfolio
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key="settings" 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
                className="flex gap-4 md:gap-16 items-center pointer-events-auto bg-black/60 backdrop-blur-md p-4 md:p-6 rounded-2xl border border-white/5 shadow-2xl"
              >
                <div className="flex flex-col items-center gap-2 md:gap-4">
                  <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-neutral-400">Auto Crop</span>
                  <CustomSwitch checked={enableCrop} onChange={() => setEnableCrop(!enableCrop)} />
                </div>
                <div className="flex flex-col items-center gap-2 md:gap-4">
                  <span className="text-[8px] md:text-[10px] uppercase tracking-widest text-neutral-400">Pano Span</span>
                  <CustomSwitch checked={enablePanoSpan} onChange={() => setEnablePanoSpan(!enablePanoSpan)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </motion.header>
  );
};

export default Header;