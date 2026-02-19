import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import photoData from './photos.json';

// Component Imports
import Header from './components/Header';
import Masonry from './components/Masonry';
import DockNav from './components/DockNav';
import About from './components/About';
import Lightbox from './components/Lightbox';
import GradualBlur from './components/GradualBlur';
import LightRays from './components/LightRays'; 

const NAV_ITEMS = ['All Work', 'Animals', 'Misc', 'People', 'Panos', 'About Me'];

export default function App() {
  // 1. UI & Navigation State
  const [activeView, setActiveView] = useState('All Work');
  const [direction, setDirection] = useState(0); 
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  
  // 2. Settings State
  const [enableCrop, setEnableCrop] = useState(false);
  const [enablePanoSpan, setEnablePanoSpan] = useState(false);

  // 3. Navigation Logic
  const handleViewChange = (newView: string) => {
    const newIdx = NAV_ITEMS.indexOf(newView);
    const oldIdx = NAV_ITEMS.indexOf(activeView);
    setDirection(newIdx > oldIdx ? 1 : -1);
    setActiveView(newView);
  };

  // 4. Process Photo Data (With shutterSpeed mapping)
  const allPhotos = useMemo(() => {
    return photoData.map((p: any) => ({
      ...p,
      gridSrc: p.url_medium,
      editedSrc: p.url_large,
      dateCaptured: p.date || "Unknown",
      shutterSpeed: p.shutter, // Maps JSON "shutter" to "shutterSpeed"
    })).sort((a: any, b: any) => 
      new Date(b.dateCaptured).getTime() - new Date(a.dateCaptured).getTime()
    );
  }, []);

  // 5. Filter Logic
  const filteredPhotos = useMemo(() => {
    if (activeView === 'All Work' || activeView === 'About Me') return allPhotos;
    return allPhotos.filter(p => p.category.toLowerCase() === activeView.toLowerCase());
  }, [activeView, allPhotos]);

  // 6. Index Logic for Lightbox
  const currentIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
  }, [filteredPhotos, selectedPhoto]);

  // 7. Content Animation Variants
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -100 : 100,
      opacity: 0,
    })
  };

  return (
    <div className="min-h-screen text-white relative">
      
      {/* BACKGROUND LAYER */}
      <LightRays 
        raysColor="#fb7185" 
        raysSpeed={0.2}
        raysOrigin="top-center"
        lightSpread={0.5}
        rayLength={0.8}
        maskStrength={0.5}
      />

      {/* 1. HEADER */}
      <AnimatePresence>
        {!selectedPhoto && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 w-full z-50"
          >
            <Header 
              enableCrop={enableCrop} 
              setEnableCrop={setEnableCrop}
              enablePanoSpan={enablePanoSpan}
              setEnablePanoSpan={setEnablePanoSpan}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MAIN CONTENT (37 mobile / 52 desktop) */}
      <main className="pt-37 md:pt-68 pb-40 px-4 md:px-8 relative z-10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeView}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="w-full"
          >
            {activeView === 'About Me' ? (
              <About />
            ) : (
              <Masonry 
                items={filteredPhotos} 
                onPhotoClick={setSelectedPhoto} 
                enableCrop={enableCrop}
                enablePanoSpan={enablePanoSpan}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 3. NAVIGATION */}
      <DockNav 
        items={NAV_ITEMS}
        activeItem={activeView}
        onItemClick={handleViewChange}
      />

      <GradualBlur height="15vh" strength={10} />

      {/* 4. LIGHTBOX (FIXED PREVIDX ERROR) */}
      {selectedPhoto && (
        <Lightbox 
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onNext={() => {
            const nextIdx = (currentIndex + 1) % filteredPhotos.length;
            setSelectedPhoto(filteredPhotos[nextIdx]);
          }}
          onPrev={() => {
            const prevIdx = (currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
            setSelectedPhoto(filteredPhotos[prevIdx]);
          }}
          hasNext={filteredPhotos.length > 1}
          hasPrev={filteredPhotos.length > 1}
        />
      )}
    </div>
  );
}