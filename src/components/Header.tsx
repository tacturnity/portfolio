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
      exit={{ y: -50, opacity: 0 }} // Smoothly slides up and fades out when unmounting
      transition={{ duration: 0.3 }}
      className="absolute top-0 left-0 right-0 z-[100] pt-8 pb-10 pointer-events-none"
    >
      {/* Settings Toggle Button */}
      <button 
        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
        className="fixed top-8 right-10 z-[80] p-2 text-neutral-500 hover:text-rose-400 transition-colors pointer-events-auto"
      >
        {isSettingsOpen ? <X size={28} /> : <Menu size={28} />}
      </button>

      {/* Main Branding / Settings Container */}
      <div className="max-w-[80vw] md:max-w-[800px] mx-auto h-18 flex flex-col items-center justify-center relative">
        <AnimatePresence mode="wait">
          {!isSettingsOpen ? (
            <motion.div 
              key="branding" 
              initial={{ opacity: 0, y: 5 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -5 }} 
              className="flex flex-col items-center w-full"
            >
              <div className="w-full h-30">
                <TextPressure text="Cookaracha's" minFontSize={20} />
              </div>
              <p className="text-[14px] md:text-[18px] tracking-[0.6em] text-neutral-600 uppercase mt-2 text-center">
                Photography Portfolio
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="settings" 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="flex gap-8 md:gap-16 items-center pointer-events-auto bg-black/50 backdrop-blur-md p-6 rounded-2xl border border-white/5"
            >
              <div className="flex flex-col items-center gap-4">
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">Auto Crop</span>
                <CustomSwitch checked={enableCrop} onChange={() => setEnableCrop(!enableCrop)} />
              </div>
              <div className="flex flex-col items-center gap-4">
                <span className="text-[10px] uppercase tracking-widest text-neutral-400">Pano Span</span>
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