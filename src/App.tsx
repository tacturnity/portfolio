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
import LightRays from './components/LightRays'; // <-- Imported LightRays

const NAV_ITEMS = ['All Work', 'Animals', 'Misc', 'People', 'Panos', 'About Me'];

export default function App() {
  // 1. UI & Navigation State
  const [activeView, setActiveView] = useState('All Work');
  const [direction, setDirection] = useState(0); // 1 for right, -1 for left
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

  // 4. Process Photo Data
  const allPhotos = useMemo(() => {
    return photoData.map((p: any) => ({
      ...p,
      gridSrc: p.url_medium,
      editedSrc: p.url_large,
      dateCaptured: p.date || "Unknown",
    })).sort((a: any, b: any) => 
      new Date(b.dateCaptured).getTime() - new Date(a.dateCaptured).getTime()
    );
  }, []);

  // 5. Filter Logic
  const filteredPhotos = useMemo(() => {
    if (activeView === 'All Work' || activeView === 'About Me') return allPhotos;
    return allPhotos.filter(p => p.category.toLowerCase() === activeView.toLowerCase());
  }, [activeView, allPhotos]);

  // 6. Content Animation Variants
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

  const currentIndex = allPhotos.findIndex(p => p.id === selectedPhoto?.id);

  return (
    <div className="min-h-screen text-white relative">
      
      {/* BACKGROUND LAYER */}
      <LightRays 
        raysColor="#fb7185" // Your Rose-400 theme color
        raysSpeed={0.2}
        raysOrigin="top-center"
        lightSpread={0.5}
        rayLength={0.8}     // Longer rays
        maskStrength={0.5}
      />

      {/* 1. HEADER: Only shows if NO photo is selected */}
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

      {/* 2. MAIN CONTENT: Animated transitions between views */}
      {/* Added 'relative z-10' to ensure content sits ON TOP of the canvas and changed padding to pt-52 */}
      <main className="pt-52 pb-40 px-4 md:px-8 relative z-10">
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

      {/* 3. NAVIGATION & UI OVERLAYS */}
      {/* If these components also need to sit above the grid, ensure they have proper z-indexes in their respective files */}
      <DockNav 
        items={NAV_ITEMS}
        activeItem={activeView}
        onItemClick={handleViewChange}
      />

      <GradualBlur height="15vh" strength={10} />

      {/* 4. LIGHTBOX */}
      {selectedPhoto && (
        <Lightbox 
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onNext={() => setSelectedPhoto(allPhotos[(currentIndex + 1) % allPhotos.length])}
          onPrev={() => setSelectedPhoto(allPhotos[(currentIndex - 1 + allPhotos.length) % allPhotos.length])}
          hasNext={allPhotos.length > 1}
          hasPrev={allPhotos.length > 1}
        />
      )}
    </div>
  );
}