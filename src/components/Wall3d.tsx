// Wall3d.tsx
import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image as DreiImage } from '@react-three/drei';
import * as THREE from 'three';
import { easing } from 'maath';

// Camera Controller (Parallax look-at on the uneven 3D sphere)
function CameraController({ wallState }) {
  const { camera, size } = useThree();
  const mousePos = useRef({ x: 0, y: 0 });
  const gyroPos = useRef({ x: 0, y: 0 });
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handleGyro = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        gyroPos.current.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
        gyroPos.current.y = THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    // iOS 13+ Gyroscope Permission Handling required for mobile Safari
    const requestGyroPermission = async () => {
      if (
        typeof window !== 'undefined' &&
        typeof (window as any).DeviceOrientationEvent !== 'undefined' &&
        typeof (window as any).DeviceOrientationEvent.requestPermission === 'function'
      ) {
        try {
          const permissionState = await (window as any).DeviceOrientationEvent.requestPermission();
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleGyro);
          }
        } catch (error) {
          console.warn("Gyroscope permission request rejected:", error);
        }
      } else {
        // Fallback for Android or standard devices
        window.addEventListener('deviceorientation', handleGyro);
      }
      
      // Cleanup permissions handlers once attempted
      window.removeEventListener('click', requestGyroPermission);
      window.removeEventListener('touchstart', requestGyroPermission);
    };

    window.addEventListener('click', requestGyroPermission);
    window.addEventListener('touchstart', requestGyroPermission);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', requestGyroPermission);
      window.removeEventListener('touchstart', requestGyroPermission);
      window.removeEventListener('deviceorientation', handleGyro);
    };
  }, []);

  useFrame((state, delta) => {
    // cameraZHome = 134
    const targetZ = 134;

    const combinedX = Math.max(-1, Math.min(1, mousePos.current.x + gyroPos.current.x));
    const combinedY = Math.max(-1, Math.min(1, mousePos.current.y + gyroPos.current.y));
    
    const isMobile = size.width < 1024; // iPhone and iPad

    // Disable touch-based camera tilting on mobile devices, relying purely on the gyroscope
    const lookX = wallState === 'Home' 
      ? (isMobile ? gyroPos.current.x * 30.0 : combinedX * 15.0) 
      : 0; 
    const lookY = wallState === 'Home' 
      ? (isMobile ? gyroPos.current.y * 30.0 : combinedY * 15.0) 
      : 0;

    // cameraAnimDamping = 0.50
    easing.damp3(camera.position, [0, 0, targetZ], 0.50, delta);
    easing.damp3(lookTarget.current, [lookX, lookY, 0], 0.50, delta);
    camera.lookAt(lookTarget.current);
  });

  return null;
}

// Individual Photo Plane positioning on the rotating, uneven sphere surface
function PhotoPlane({ 
  item, 
  homePos, 
  homeImageScale, 
  sphereRotation, 
  onPhotoClick, 
  wallState,
  masonryLayout
}: any) {
  const ref = useRef<any>();
  const [hovered, setHovered] = useState(false);
  const { size, camera } = useThree();

  const aspect = Math.max(0.5, Math.min(4.0, item.width / item.height));
  const baseWidth = aspect; 
  const baseHeight = 1;

  // Globally use the medium resolution gridSrc from start to finish
  const imageUrl = item.gridSrc || item.thumbSrc;

  useFrame((state, delta) => {
    if (!ref.current) return;

    // Treated "All Work" as an active category layout in 3D Wall
    const isCategory = !['Home', 'About Me'].includes(wallState);
    const belongsToActiveCategory = isCategory && (wallState === 'All Work' || item.category?.toLowerCase() === wallState.toLowerCase());

    const targetPosition = new THREE.Vector3();
    const targetRotation = new THREE.Quaternion();
    const targetScale = new THREE.Vector3();
    let targetOpacity = 1.0;
    
    let targetRadius = 0.035;

    // Default Sphere Home position values
    const posVec = new THREE.Vector3(...homePos).applyEuler(sphereRotation.current);

    if (isCategory) {
      if (belongsToActiveCategory) {
        const layout = masonryLayout.get(item.id);
        if (layout) {
          const fovRad = (camera.fov * Math.PI) / 180;
          const visibleHeight = 2 * Math.tan(fovRad / 2) * camera.position.z;
          const pxTo3D = visibleHeight / size.height;

          const leftPadding = size.width < 768 ? 16 : 32;
          const topPadding = size.width < 768 ? 148 : 272;
          
          const domX = leftPadding + layout.x;
          const domY = topPadding + layout.y;

          const webglX = (domX + layout.w / 2 - size.width / 2) * pxTo3D;
          const webglY = -(domY + layout.h / 2 - size.height / 2) * pxTo3D;
          const webglW = layout.w * pxTo3D;
          const webglH = layout.h * pxTo3D;

          targetPosition.set(webglX, webglY, 2);
          targetScale.set(webglW, webglH, 1);
          
          targetRotation.set(0, 0, 0, 1);
          targetOpacity = 1.0;

          targetRadius = 16 * pxTo3D;
        } else {
          targetPosition.copy(posVec);
          targetScale.set(baseWidth * homeImageScale, baseHeight * homeImageScale, 1);
          targetOpacity = 0.0;
        }
      }
    } else {
      // Sphere mode (Home / About Me)
      targetPosition.copy(posVec);
      
      // CRITICAL BUG FIX: Added ref.current validation check before evaluating z-positions during mount
      if (wallState === 'Home' && ref.current && ref.current.position.z > targetPosition.z) {
        const currentXY = new THREE.Vector2(ref.current.position.x, ref.current.position.y);
        const targetXY = new THREE.Vector2(targetPosition.x, targetPosition.y);
        const distXY = currentXY.distanceTo(targetXY);
        const elevation = Math.min(25, distXY * 0.5);
        targetPosition.z += elevation;
      }

      const customWidth = baseWidth * homeImageScale;
      const customHeight = baseHeight * homeImageScale;
      const hoverMult = hovered ? 1.15 : 1;
      targetScale.set(customWidth * hoverMult, customHeight * hoverMult, 1);

      const m = new THREE.Matrix4();
      const outwardDir = posVec.clone().normalize();
      m.lookAt(new THREE.Vector3(0,0,0), outwardDir, new THREE.Vector3(0, 1, 0));
      targetRotation.setFromRotationMatrix(m);

      targetOpacity = wallState === 'About Me' ? 0.05 : 1.0;
    }

    // Direct, uninterrupted morph transitions from sphere paths to grid positions
    // cardAnimDamping = 0.30, hoverAnimDamping = 0.05
    easing.damp3(ref.current.position, targetPosition, 0.30, delta);
    easing.dampQ(ref.current.quaternion, targetRotation, 0.30, delta);
    easing.damp(ref.current.material, 'opacity', targetOpacity, 0.30, delta);
    easing.damp3(ref.current.scale, targetScale, 0.05, delta);

    if (!ref.current.radiusVal) {
      ref.current.radiusVal = { value: 0.035 };
    }
    easing.damp(ref.current.radiusVal, 'value', targetRadius, 0.30, delta);
    ref.current.material.radius = ref.current.radiusVal.value;

    if (ref.current.material && ref.current.material.uniforms && ref.current.material.uniforms.scale) {
      ref.current.material.uniforms.scale.value.set(ref.current.scale.x, ref.current.scale.y);
    }
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);

  return (
    <DreiImage
      ref={ref}
      url={imageUrl} 
      transparent
      opacity={0}
      radius={0.035} 
      position={homePos}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onPhotoClick(item);
      }}
    />
  );
}

// Seeded random helper
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Canvas layout component
function PackedWall({ items, onPhotoClick, wallState, enableCrop, enablePanoSpan }: any) {
  const { size, camera } = useThree();

  const sphereRotation = useRef(new THREE.Euler(0, 0, 0));

  useFrame((state, delta) => {
    sphereRotation.current.y += delta * 0.06; // Rotate sphere continuously
    sphereRotation.current.x = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.15; // Rocking motion
  });

  // Recreate Masonry layout calculation engine in WebGL space
  const masonryLayout = useMemo(() => {
    const isCategory = !['Home', 'About Me'].includes(wallState);
    if (!isCategory) return new Map();

    const displayItems = wallState === 'All Work' 
      ? items 
      : items.filter((p: any) => p.category?.toLowerCase() === wallState.toLowerCase());

    if (displayItems.length === 0) return new Map();

    const containerWidth = size.width < 768 ? size.width - 32 : size.width - 64;
    const columns = containerWidth >= 1500 ? 5 : containerWidth >= 1000 ? 4 : containerWidth >= 768 ? 3 : 2;
    const gap = size.width < 768 ? 10 : 20;
    const columnWidth = (containerWidth - (columns - 1) * gap) / columns;
    const colHeights = new Array(columns).fill(0);

    let balanceCounter = 0;
    let landscapeCount = 0;
    let portraitCount = 0;

    if (enableCrop) {
      displayItems.forEach((item: any) => {
        const isPano = item.category?.toLowerCase() === 'panos';
        if (!isPano) {
          const w = parseFloat(item.width) || 1000;
          const h = parseFloat(item.height) || 1000;
          if (w >= h) landscapeCount++;
          else portraitCount++;
        }
      });
      balanceCounter = Math.round((landscapeCount - portraitCount) / 2);
    }

    const results = new Map();

    displayItems.forEach((item: any) => {
      const isPano = item.category?.toLowerCase() === 'panos';
      const naturalW = parseFloat(item.width) || 1000;
      const naturalH = parseFloat(item.height) || 1000;
      const isNaturalLandscape = naturalW >= naturalH;
      const naturalAspectRatio = naturalW / naturalH;

      let span = 1;
      let targetAspectRatio = naturalAspectRatio;

      if (enableCrop) {
        if (isPano && enablePanoSpan) {
          span = columns;
          targetAspectRatio = naturalAspectRatio;
        } else {
          let forceOrientation = isNaturalLandscape ? 'landscape' : 'portrait';
          if (!isPano) {
            if (balanceCounter > 0 && isNaturalLandscape) {
              forceOrientation = 'portrait';
              balanceCounter--;
            } else if (balanceCounter < 0 && !isNaturalLandscape) {
              forceOrientation = 'landscape';
              balanceCounter++;
            }
          }
          targetAspectRatio = forceOrientation === 'landscape' ? 4 / 3 : 3 / 4;
        }
      } else {
        if (isPano && enablePanoSpan) {
          span = columns;
        }
        targetAspectRatio = naturalAspectRatio;
      }

      const finalWidth = (columnWidth * span) + (gap * (span - 1));
      const targetHeight = finalWidth / targetAspectRatio;

      let targetCol = 0;
      let minY = Infinity;
      for (let i = 0; i <= columns - span; i++) {
        const maxHeightInRange = Math.max(...colHeights.slice(i, i + span));
        if (maxHeightInRange < minY) {
          minY = maxHeightInRange;
          targetCol = i;
        }
      }

      const x = targetCol * (columnWidth + gap);
      const y = minY;

      for (let i = targetCol; i < targetCol + span; i++) {
        colHeights[i] = y + targetHeight + gap;
      }

      results.set(item.id, {
        x,
        y,
        w: finalWidth,
        h: targetHeight
      });
    });

    return results;
  }, [items, wallState, size.width, size.height, enableCrop, enablePanoSpan]);

  const { itemsWithPositions, homeProportionalScale } = useMemo(() => {
    const totalItems = items.length;

    // Create a base unit structure with seeded random offsets to make it uneven and irregular
    const tempUnitPacked = items.map((item: any, idx: number) => {
      const phi = Math.acos(1 - 2 * (idx + 0.5) / totalItems);
      const theta = Math.PI * (1 + Math.sqrt(5)) * idx; 
      
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);

      const unevenFactor = 0.75 + seededRandom(item.id + 500) * 0.5;

      const aspectVal = Math.max(0.5, Math.min(4.0, item.width / item.height));
      return { 
        id: item.id, 
        unitX: x * unevenFactor, 
        unitY: y * unevenFactor, 
        unitZ: z * unevenFactor, 
        aspect: aspectVal 
      };
    });

    const fovRad = (camera.fov * Math.PI) / 180;
    const aspect = size.width / size.height;
    // cameraZHome = 134
    const viewportHeightAtHome = 2 * Math.tan(fovRad / 2) * 134;
    const viewportWidthAtHome = viewportHeightAtHome * aspect;

    // Stretch shape independently across X and Y axes to match screen boundaries
    const scaleX = (viewportWidthAtHome / 2) * 0.9;
    const scaleY = (viewportHeightAtHome / 2) * 0.9;
    const scaleZ = (scaleX + scaleY) / 2;

    // Dynamic resolution scaling factor mapped to screen resolution (relative to 4K / 3840px width)
    const resolutionFactor = size.width / 3840;

    // Hardcoded Mobile image scale set exactly to 18.5, and Desktop to 8.7
    const isMobileOrTablet = size.width < 1024;
    const HOME_IMAGE_SCALE = isMobileOrTablet ? 28 : 8.7; 

    const mapped = items.map((item: any, i: number) => {
      const unitData = tempUnitPacked[i];

      // homeSpacingX = 15.0, homeSpacingY = 3.6
      const hx = unitData.unitX * scaleX * (15.0 / 15.0);
      const hy = unitData.unitY * scaleY * (3.6 / 3.6);
      const hz = unitData.unitZ * scaleZ * (15.0 / 15.0);

      return { 
        ...item, 
        homePos: [hx, hy, hz]
      };
    });

    return { 
      itemsWithPositions: mapped, 
      homeProportionalScale: (viewportHeightAtHome / 110) * HOME_IMAGE_SCALE * resolutionFactor
    };
  }, [items, size.width, size.height]);

  return (
    <>
      <CameraController 
        wallState={wallState}
      />
      <ambientLight intensity={1.2} />
      <Suspense fallback={null}>
        {itemsWithPositions.map((item: any, i: number) => {
          const isCategory = !['Home', 'About Me'].includes(wallState);
          const belongsToActiveCategory = isCategory && (wallState === 'All Work' || item.category?.toLowerCase() === wallState.toLowerCase());

          // HYPER EFFICIENT: Filter & unmount non-category planes in the parent layout before they mount.
          // This prevents PhotoPlane from executing its inner hooks conditionally, keeping React stable.
          if (isCategory && !belongsToActiveCategory) {
            return null;
          }

          return (
            <PhotoPlane 
              key={item.id} 
              item={{ ...item, idxVal: i }} // Passed index mapping
              homePos={item.homePos}
              homeImageScale={homeProportionalScale}
              sphereRotation={sphereRotation}
              onPhotoClick={onPhotoClick}
              wallState={wallState}
              masonryLayout={masonryLayout}
            />
          );
        })}
      </Suspense>
    </>
  );
}

export default function Wall3D({ items, onPhotoClick, wallState, enableCrop, enablePanoSpan }: any) {
  return (
    <Canvas camera={{ position: [0, 0, 200], fov: 45 }}>
      <PackedWall
        items={items}
        onPhotoClick={onPhotoClick}
        wallState={wallState}
        enableCrop={enableCrop}
        enablePanoSpan={enablePanoSpan}
      />
    </Canvas>
  );
}