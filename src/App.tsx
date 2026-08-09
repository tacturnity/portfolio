
// App.tsx
import React, { useState, useMemo, useRef, useEffect, Component, startTransition } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import photoData from './photos.json';
import { Sun } from 'lucide-react';
// Component Imports
import Header from './components/Header';
import Masonry from './components/Masonry';
import DockNav from './components/DockNav';
import About from './components/About';
import Lightbox from './components/Lightbox';
import GradualBlur from './components/GradualBlur';
import LightRays from './components/LightRays'; 
import Wall3D from './components/Wall3d';

const NAV_ITEMS = ['Home', 'All Work', 'Animals', 'Misc', 'People', 'Panos', 'About Me'];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const parseCustom = (str: any) => {
  if (typeof str !== 'string') {
    return { direction: 0, transitionType: 'cascade' as const, isAbout: false };
  }
  const [dir, type, about] = str.split('_');
  return {
    direction: parseInt(dir, 10) || 0,
    transitionType: type as 'cascade' | 'dissolve' | 'instant',
    isAbout: about === 'true'
  };
};

// --- REACT ERROR BOUNDARY COMPONENT ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught layout rendering error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-[#111] text-red-400 font-mono min-h-screen z-50 relative border-2 border-red-500 rounded-lg">
          <h1 className="text-2xl font-bold mb-4">🚨 Rendering Exception Caught!</h1>
          <p className="text-white text-lg mb-2">{this.state.error?.toString()}</p>
          <pre className="bg-black/80 p-4 rounded border border-zinc-800 text-xs text-zinc-300 overflow-auto">
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
// --------------------------------------

export default function App() {
  const [activeView, setActiveView] = useState('Home');
  const [pendingView, setPendingView] = useState<string | null>(null);
  const [wallState, setWallState] = useState('Home'); 
  const [isCanvasMounted, setIsCanvasMounted] = useState(true);
  const [direction, setDirection] = useState(0); 
  const [transitionType, setTransitionType] = useState<'cascade' | 'dissolve' | 'instant'>('dissolve');
  const isAnimating = useRef(false);
  const [isMasonryVisible, setIsMasonryVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [enableCrop, setEnableCrop] = useState(false);
  const [enablePanoSpan, setEnablePanoSpan] = useState(false);
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  const handleViewChange = async (newView: string) => {
    if (newView === activeView || isAnimating.current) return;
    isAnimating.current = true;
    
    // startTransition defers heavy background grid processing so the UI button press doesn't freeze
    startTransition(() => {
      setPendingView(newView);
      setSelectedPhoto(null);
    });

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.style.overflow = 'hidden';

    const newIdx = NAV_ITEMS.indexOf(newView);
    const oldIdx = NAV_ITEMS.indexOf(activeView);
    setDirection(newIdx > oldIdx ? 1 : -1);

    const isFromHome = activeView === 'Home';
    const isToHome = newView === 'Home';
    const isFromAbout = activeView === 'About Me';
    const isToAbout = newView === 'About Me';
    const isFromCategory = !['Home', 'About Me'].includes(activeView);
    const isToCategory = !['Home', 'About Me'].includes(newView);

    if (isToAbout || isFromAbout) {
      setTransitionType('dissolve');
    } else {
      setTransitionType('cascade');
    }

    // ==========================================
    // Category <-> Category OR Category <-> About (2D)
    // ==========================================
    if ((isFromCategory || isFromAbout) && (isToCategory || isToAbout)) {
      setIsMasonryVisible(true);
      
      startTransition(() => {
        setActiveView(newView);
        setPendingView(null);
      });
      
      await sleep(500); 

      document.body.style.overflow = '';
      isAnimating.current = false;
      return;
    }

    // ==========================================
    // Category -> Home
    // ==========================================
    if (isFromCategory && isToHome) {
      setIsCanvasMounted(true);
      setWallState('About Me'); 
      await sleep(50);

      startTransition(() => {
        setActiveView(newView);
      });
      setIsMasonryVisible(false);
      
      await sleep(600);

      setWallState('Home'); 
      await sleep(1500);

      setPendingView(null);
    }
    // ==========================================
    // Home -> Category 
    // ==========================================
    else if (isFromHome && isToCategory) {
      setIsCanvasMounted(true);
      setWallState('About Me'); 
      
      await sleep(1000);

      startTransition(() => {
        setActiveView(newView); 
      });
      setIsMasonryVisible(true);
      
      await sleep(800);
      setIsCanvasMounted(false);
      setPendingView(null);
    }
    // ==========================================
    // Home -> About Me
    // ==========================================
    else if (isFromHome && isToAbout) {
      setIsCanvasMounted(true);
      setWallState('About Me');
      await sleep(1000);

      startTransition(() => {
        setActiveView(newView);
      });
      setIsMasonryVisible(true);
      
      await sleep(800);
      setIsCanvasMounted(false);
      setPendingView(null);
    }
    // ==========================================
    // About Me -> Home
    // ==========================================
    else if (isFromAbout && isToHome) {
      setIsCanvasMounted(true);
      setWallState('About Me');
      await sleep(50);

      startTransition(() => {
        setActiveView(newView);
      });
      setIsMasonryVisible(false);

      await sleep(600);
      
      setWallState('Home');
      await sleep(1500);

      setPendingView(null);
    }

    document.body.style.overflow = '';
    isAnimating.current = false;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    const target = e.target as HTMLElement;

    if (
      target.closest('button') || 
      target.closest('a') || 
      target.closest('#leva__root') || 
      target.closest('nav') ||
      target.closest('.gradual-blur')
    ) {
      setTouchStart(null);
      return;
    }

    if (e.targetTouches.length > 0) {
      setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart && e.targetTouches.length > 0) {
      setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
    }
  };

  const onTouchEndEvent = () => {
    if (!touchStart || !touchEnd || selectedPhoto || isAnimating.current) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;

    if (Math.abs(distanceX) < 80 || Math.abs(distanceY) > Math.abs(distanceX) * 0.6) return;

    if (distanceX > 0 && (NAV_ITEMS.indexOf(activeView) < NAV_ITEMS.length - 1)) {
      handleViewChange(NAV_ITEMS[NAV_ITEMS.indexOf(activeView) + 1]);
    }
    if (distanceX < 0 && (NAV_ITEMS.indexOf(activeView) > 0)) {
      handleViewChange(NAV_ITEMS[NAV_ITEMS.indexOf(activeView) - 1]);
    }
  };

  const allPhotos = useMemo(() => {
    return photoData.map((p: any) => ({
      ...p,
      thumbSrc: p.url_thumb || p.url_medium,
      gridSrc: p.url_medium,
      editedSrc: p.url_large,
      dateCaptured: p.date || "Unknown",
      shutterSpeed: p.shutter, 
    })).sort((a: any, b: any) => new Date(b.dateCaptured).getTime() - new Date(a.dateCaptured).getTime());
  }, []);

  const filteredPhotos = useMemo(() => {
    if (activeView === 'All Work' || activeView === 'Home' || activeView === 'About Me') return allPhotos;
    return allPhotos.filter(p => p.category?.toLowerCase() === activeView.toLowerCase());
  }, [activeView, allPhotos]);

  const currentIndex = useMemo(() => {
    if (!selectedPhoto) return -1;
    return filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
  }, [filteredPhotos, selectedPhoto]);

  const customKey = `${direction}_${transitionType}_${activeView === 'About Me'}`;

  return (
    <div className="min-h-screen text-white relative overflow-x-hidden bg-black select-none" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndEvent}>
      
      <LightRays raysColor="#fb7185" raysSpeed={0.2} raysOrigin="top-center" lightSpread={0.5} rayLength={0.8} maskStrength={0.5} />

      <AnimatePresence>
        {!selectedPhoto && (
          <div className="absolute top-0 left-0 w-full z-50 pointer-events-none">
            <Header 
              showTitle={activeView !== 'Home'} 
              titleSpringStiffness={50} 
              titleSpringDamping={14} 
              titleSpringMass={5.0} 
            />
          </div>
        )}
      </AnimatePresence>

      <ErrorBoundary>
        {isCanvasMounted && (
          <div 
            style={{ 
              transitionProperty: 'opacity',
              transitionDuration: `${isMasonryVisible ? 900 : 1450}ms`,
              transitionTimingFunction: 'cubic-bezier(0.59, 1.0, 0.36, 1.0)'
            }}
            className={`fixed inset-0 z-0 touch-none ${isMasonryVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <Wall3D items={allPhotos} onPhotoClick={setSelectedPhoto} wallState={wallState} enableCrop={enableCrop} enablePanoSpan={enablePanoSpan} />
          </div>
        )}
      </ErrorBoundary>

      <ErrorBoundary>
        <main 
          style={{ 
            transitionProperty: 'opacity', 
            transitionDuration: `${isMasonryVisible ? 900 : 1450}ms`, 
            transitionTimingFunction: 'cubic-bezier(0.59, 1.0, 0.36, 1.0)' 
          }} 
          className={`pt-[148px] md:pt-[272px] pb-40 px-4 md:px-8 relative z-10 min-h-screen ${isMasonryVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        >
          {/* 
            Replaced popLayout with a CSS Grid trick. 
            Overlapping elements completely drops the layout calculation phase, removing the freezing lag! 
          */}
          <div className="grid w-full">
            {(() => {
              const slideVariants = {
                enter: (customStr: string) => {
                  const { direction, transitionType, isAbout } = parseCustom(customStr);
                  const isDissolve = transitionType === 'dissolve' || transitionType === 'instant';
                  return {
                    opacity: 0, 
                    x: isDissolve ? 0 : direction * 80,
                  };
                },
                center: { 
                  opacity: 1, 
                  x: 0,
                },
                exit: (customStr: string) => {
                  const { direction, transitionType, isAbout } = parseCustom(customStr);
                  const isDissolve = transitionType === 'dissolve' || transitionType === 'instant';
                  return {
                    opacity: 0, 
                    x: isDissolve ? 0 : -direction * 80,
                  };
                }
              };
              return (
                <AnimatePresence custom={customKey}>
                  {activeView === 'About Me' ? (
                    <motion.div 
                      key="about" 
                      custom={customKey} 
                      variants={slideVariants} 
                      initial="enter" 
                      animate="center" 
                      exit="exit" 
                      transition={{ type: "spring", stiffness: 450, damping: 38 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.5}
                      onDragEnd={(event, info) => {
                        const threshold = 150;
                        const velocityThreshold = 500;
                        if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
                          const currentIndex = NAV_ITEMS.indexOf(activeView);
                          if (currentIndex < NAV_ITEMS.length - 1) handleViewChange(NAV_ITEMS[currentIndex + 1]);
                        } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
                          const currentIndex = NAV_ITEMS.indexOf(activeView);
                          if (currentIndex > 0) handleViewChange(NAV_ITEMS[currentIndex - 1]);
                        }
                      }}
                      // Apply grid overlay technique
                      style={{ gridArea: '1 / 1' }}
                      className="w-full"
                    >
                      <About />
                    </motion.div>
                  ) : activeView !== 'Home' && isMasonryVisible ? (
                    <motion.div 
                      key={activeView} 
                      custom={customKey} 
                      variants={slideVariants} 
                      initial="enter" 
                      animate="center" 
                      exit="exit" 
                      transition={{ type: "spring", stiffness: 450, damping: 38 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.5}
                      onDragEnd={(event, info) => {
                        const threshold = 150;
                        const velocityThreshold = 500;
                        if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
                          const currentIndex = NAV_ITEMS.indexOf(activeView);
                          if (currentIndex < NAV_ITEMS.length - 1) handleViewChange(NAV_ITEMS[currentIndex + 1]);
                        } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
                          const currentIndex = NAV_ITEMS.indexOf(activeView);
                          if (currentIndex > 0) handleViewChange(NAV_ITEMS[currentIndex - 1]);
                        }
                      }}
                      // Apply grid overlay technique
                      style={{ gridArea: '1 / 1' }}
                      className="w-full"
                    >
                      <Masonry 
                        items={filteredPhotos} 
                        onPhotoClick={setSelectedPhoto} 
                        enableCrop={enableCrop} 
                        enablePanoSpan={enablePanoSpan} 
                        direction={direction}
                        staggerDelay={0.07}
                        slideDuration={0.4}
                        slideOffset={300}
                        transitionType={transitionType}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              );
            })()}
          </div>
        </main>
      </ErrorBoundary>

      <DockNav items={NAV_ITEMS} activeItem={pendingView || activeView} onItemClick={handleViewChange} />
      <GradualBlur height="15vh" strength={10} />

      {selectedPhoto && (
        <Lightbox photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} onNext={() => setSelectedPhoto(filteredPhotos[(currentIndex + 1) % filteredPhotos.length])} onPrev={() => setSelectedPhoto(filteredPhotos[(currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length])} hasNext={filteredPhotos.length > 1} hasPrev={filteredPhotos.length > 1} />
      )}
    </div>
  );
}
