// src/App.tsx
import React, { useState, useMemo, useRef, useEffect, startTransition } from 'react';
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
import Wall3D from './components/Wall3d';
import PerfCounter from './components/PerfCounter';
import ErrorBoundary from './components/ErrorBoundary';

const NAV_ITEMS = ['Home', 'All Work', 'Animals', 'Misc', 'People', 'Panos', 'About Me'];

// Landing view per device class. The Home view mounts the heavy 3D photo wall,
// so phones boot straight into the lightweight masonry grid ("All Work")
// instead, while desktops keep the 3D wall as the default.
// 768px matches the `md` breakpoint used across the layout and the existing
// `window.innerWidth < 768` mobile checks in LightRays/TextPressure.
const MOBILE_BREAKPOINT = 768;
const DESKTOP_LANDING_VIEW = 'Home';
const MOBILE_LANDING_VIEW = 'All Work';

// Resolved once per page load, so a mid-session resize or device rotation can
// never swap the view out from under the visitor.
const resolveLandingView = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
    ? MOBILE_LANDING_VIEW
    : DESKTOP_LANDING_VIEW;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Smoothly scroll the window back to the top and resolve once it has arrived.
// Resolves immediately if already at (or near) the top, so tab switches at
// the top of the page never add any delay. Includes a safety timeout so the
// promise can never hang if a scrollend/scroll event is missed.
const scrollToTop = (): Promise<void> =>
  new Promise((resolve) => {
    const scroller = () =>
      document.scrollingElement || document.documentElement;

    if (window.scrollY <= 20) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      resolve();
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', finish);
      window.clearTimeout(timer);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      resolve();
    };
    const onScroll = () => {
      if (scroller().scrollTop <= 2) finish();
    };
    const timer = window.setTimeout(finish, 800);

    if ('onscrollend' in window) {
      window.addEventListener('scrollend', finish, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  });

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

export default function App() {
  // Landing view is decided once per page load: mobile devices open on
  // "All Work" (masonry grid, no WebGL), desktops open on "Home" (3D wall).
  const [landingView] = useState<string>(resolveLandingView);
  const [activeView, setActiveView] = useState(landingView);
  const [pendingView, setPendingView] = useState<string | null>(null);
  const [wallState, setWallState] = useState(landingView);
  const [isCanvasMounted, setIsCanvasMounted] = useState(landingView === DESKTOP_LANDING_VIEW);
  const [direction, setDirection] = useState(0); 
  const [transitionType, setTransitionType] = useState<'cascade' | 'dissolve' | 'instant'>('dissolve');
  const isAnimating = useRef(false);
  // The masonry grid is the landing surface whenever we don't start on Home.
  const [isMasonryVisible, setIsMasonryVisible] = useState(landingView !== DESKTOP_LANDING_VIEW);
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

  // Lifecycle telemetry: does App keep the 3D canvas alive or fully unmount it?
  useEffect(() => {
    if (isCanvasMounted) {
      console.log('[Lifecycle] App: Wall3D MOUNTED (isCanvasMounted=true)');
    } else {
      console.log('[Lifecycle] App: Wall3D UNMOUNTED (isCanvasMounted=false)');
    }
  }, [isCanvasMounted]);

  const handleViewChange = async (newView: string) => {
    if (newView === activeView || isAnimating.current) return;
    isAnimating.current = true;

    // Tab transition state logger (from -> to -> wallState).
    console.log('[Tab Change]', { from: activeView, to: newView, wallState });

    // UX: if the page is scrolled down, smoothly glide back to the top first,
    // then start the tab transition so the exit/entry animations play cleanly.
    await scrollToTop();

    startTransition(() => {
      setPendingView(newView);
      setSelectedPhoto(null);
    });

    const newIdx = NAV_ITEMS.indexOf(newView);
    const oldIdx = NAV_ITEMS.indexOf(activeView);
    setDirection(newIdx > oldIdx ? 1 : -1);

    const isFromHome = activeView === 'Home';
    const isToHome = newView === 'Home';
    const isFromAbout = activeView === 'About Me';
    const isToAbout = newView === 'About Me';
    const isFromCategory = !['Home', 'About Me'].includes(activeView);
    const isToCategory = !['Home', 'About Me'].includes(newView);

    // Always use the directional slide/cascade for the outer view transitions,
    // including to/from "About Me" so it slides exactly like the other tabs.
    setTransitionType('cascade');

    if ((isFromCategory || isFromAbout) && (isToCategory || isToAbout)) {
      setIsMasonryVisible(true);
      
      startTransition(() => {
        setActiveView(newView);
        setPendingView(null);
      });
      
      await sleep(500); 

      isAnimating.current = false;
      return;
    }

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
    } else if (isFromHome && isToCategory) {
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
    } else if (isFromHome && isToAbout) {
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
    } else if (isFromAbout && isToHome) {
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
    <div 
      className="min-h-screen text-white relative overflow-x-hidden bg-black select-none" 
      onTouchStart={onTouchStart} 
      onTouchMove={onTouchMove} 
      onTouchEnd={onTouchEndEvent}
    >
      {/* LightRays backdrop: hidden while the 3D wall (Home) is mounted so the
          sphere floats in a pure pitch-black void; fades back in for masonry views. */}
      <div
        style={{
          transitionProperty: 'opacity',
          transitionDuration: '600ms',
          transitionTimingFunction: 'ease',
        }}
        className={`fixed inset-0 z-0 ${isCanvasMounted ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <LightRays 
          raysColor="#fb7185" 
          raysSpeed={0.2} 
          raysOrigin="top-center" 
          lightSpread={0.5} 
          rayLength={0.8} 
          maskStrength={0.5} 
        />
      </div>

      {/* Header & Performance Counter Container */}
      <AnimatePresence>
        {!selectedPhoto && (
          <div className="absolute top-0 left-0 w-full z-50 pointer-events-none">
            <Header 
              showTitle={activeView !== 'Home'} 
              titleSpringStiffness={50} 
              titleSpringDamping={14} 
              titleSpringMass={5.0} 
            />
            {/* Counter scrolls out of view naturally with the header */}
            <PerfCounter />
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
            <Wall3D 
              items={allPhotos} 
              onPhotoClick={setSelectedPhoto} 
              wallState={wallState} 
              enableCrop={enableCrop} 
              enablePanoSpan={enablePanoSpan} 
            />
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
          <div className="grid w-full">
            {(() => {
              const slideVariants = {
                enter: (customStr: string) => {
                  const { direction } = parseCustom(customStr);
                  return {
                    opacity: 0, 
                    x: direction * 80,
                    scale: 1,
                  };
                },
                center: { 
                  opacity: 1, 
                  x: 0,
                  scale: 1,
                },
                exit: (customStr: string) => {
                  const { direction } = parseCustom(customStr);
                  return {
                    opacity: 0, 
                    x: -direction * 80,
                    scale: 1,
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
                      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 1 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.4}
                      onDragEnd={(event, info) => {
                        const threshold = 120;
                        const velocityThreshold = 400;
                        if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
                          const currentIndex = NAV_ITEMS.indexOf(activeView);
                          if (currentIndex < NAV_ITEMS.length - 1) handleViewChange(NAV_ITEMS[currentIndex + 1]);
                        } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
                          const currentIndex = NAV_ITEMS.indexOf(activeView);
                          if (currentIndex > 0) handleViewChange(NAV_ITEMS[currentIndex - 1]);
                        }
                      }}
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
                      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 1 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.4}
                      onDragEnd={(event, info) => {
                        const threshold = 120;
                        const velocityThreshold = 400;
                        if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
                          const currentIndex = NAV_ITEMS.indexOf(activeView);
                          if (currentIndex < NAV_ITEMS.length - 1) handleViewChange(NAV_ITEMS[currentIndex + 1]);
                        } else if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
                          const currentIndex = NAV_ITEMS.indexOf(activeView);
                          if (currentIndex > 0) handleViewChange(NAV_ITEMS[currentIndex - 1]);
                        }
                      }}
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
        <Lightbox 
          photo={selectedPhoto} 
          onClose={() => setSelectedPhoto(null)} 
          onNext={() => setSelectedPhoto(filteredPhotos[(currentIndex + 1) % filteredPhotos.length])} 
          onPrev={() => setSelectedPhoto(filteredPhotos[(currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length])} 
          hasNext={filteredPhotos.length > 1} 
          hasPrev={filteredPhotos.length > 1} 
        />
      )}
    </div>
  );
}