// Wall3d.tsx
import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { easing } from 'maath';
import { computeMasonryLayout } from '../lib/masonry';

// ============================================================================
// Shared constants
// ============================================================================
// Back-of-card easter egg: adjacent cards along horizontal orbits spell ROACH.
const ROACH_LETTERS = ['R', 'O', 'A', 'C', 'H'];
// Font size of the ROACH corner letters, relative to card size (tweak this
// to resize the back-of-card text without distortion).
const ROACH_FONT_SCALE = 1;

// Camera rail bounds for the cinematic dolly-in / orbit.
const CAM_HOME_Z = 134; // where the camera settles on Home
const ORBIT_MIN_DISTANCE = 48; // never clip through the sphere (~r45)
const ORBIT_MAX_DISTANCE = 320;

// Entrance timings (seconds).
const INTRO_DURATION = 1.9;
const INTRO_STAGGER_WINDOW = 0.5; // how spread-out the card reveal wave is

// Explosive tab transitions: how far cards disperse and how fast they fly.
const EXPLODE_DISTANCE = 140; // radial burst distance (units)
const EXPLODE_DURATION = 0.55; // seconds for the burst to complete
const EXPLODE_SCALE_MULT = 1.8; // how much cards scale up while dispersing

// ============================================================================
// Animation / lifecycle telemetry (console debugging)
// Logs exactly what React/Three are doing during tab switches so animation
// desync can be diagnosed frame by frame in the browser console.
// ============================================================================
const TELEMETRY_MAX_FRAMES = 30; // sample the first 30 frames of a transition
const telemetry = {
  active: false,
  frames: 0,
  trackedIdx: 0, // card index to track (0 = first card)
};

function telemetryBegin(reason: string) {
  telemetry.active = true;
  telemetry.frames = 0;
  console.log(`[Telemetry] capture started — ${reason}`);
}

function telemetrySample(idx: number, data: any) {
  if (!telemetry.active) return;
  if (idx !== telemetry.trackedIdx) return;
  telemetry.frames += 1;
  console.log(`[Telemetry] frame ${telemetry.frames}`, data);
  if (telemetry.frames >= TELEMETRY_MAX_FRAMES) {
    telemetry.active = false;
    console.log('[Telemetry] capture complete (30 frames)');
  }
}

// Scratch / pooled objects: PhotoPlane.useFrame ran its math with fresh
// Vector3/Quaternion/Matrix4 allocations on every frame for every plane,
// which caused constant GC churn for a 280+ plane wall. These shared buffers
// are safe because each useFrame callback fully resolves its results before
// the next one runs (synchronously), and targets are (re)set every frame.
const _pos = new THREE.Vector3(); // posVec
const _target = new THREE.Vector3(); // targetPosition
const _scale = new THREE.Vector3(); // targetScale
const _quat = new THREE.Quaternion(); // targetRotation
const _mat = new THREE.Matrix4();
const _v2 = new THREE.Vector2();
const _v3 = new THREE.Vector2();
const _origin = new THREE.Vector3(0, 0, 0);
const _up = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _backOffset = new THREE.Vector3();
const _exploded = new THREE.Vector3();
const _explodeDir = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _localPos = new THREE.Vector3();
// Seeded random helper
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Camera rectangular exclusion zone: a card whose center is inside this
// camera-local box (in front of the lens) fades ALL of its materials to 0%
// opacity so it can never block the view into the sphere. Camera local space:
// +z points out of the lens, so cards in front have negative z.
const EXCLUDE_X = 1000; // horizontal half-width (units)
const EXCLUDE_Y = 1000; // vertical half-height (units)
const EXCLUDE_Z_MIN = -100; // front edge of the corridor (in front of lens)
const EXCLUDE_Z_MAX = 1600; // just in front of the lens plane
const EXCLUDE_BLEND = 10; // smooth fade band at the box boundary


// ---------------------------------------------------------------------------
// Camera dolly: eases the camera from far out to its home rail during the
// entrance only. It stops permanently once the intro finishes OR the instant
// the user starts dragging, so the camera NEVER snaps back on mouse release —
// wherever the user leaves it is where it stays.
// ---------------------------------------------------------------------------
function CameraDolly({ dollyEnabled }: { dollyEnabled: React.MutableRefObject<boolean> }) {
  const { camera } = useThree();
  const started = useRef(false);

  useFrame((_, delta) => {
    if (!dollyEnabled.current) return;
    if (!camera) return; // guard: camera must exist before moving it
    if (!started.current) {
      started.current = true;
      camera.position.set(0, 0, CAM_HOME_Z * 1.9);
    }
    easing.damp3(camera.position, [0, 0, CAM_HOME_Z], 0.4, delta);
  });

  return null;
}

// ---------------------------------------------------------------------------
// Camera Controller (mobile gyroscope parallax only). Desktop is handled by
// <OrbitControls>; this adds device-orientation look-at on touch devices.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SpotlightRig: the single shadow-casting spotlight lives BEHIND and slightly
// ABOVE the camera and points through the camera's line of sight into the
// sphere. Because it is re-aimed every frame, it follows the orbit camera, so
// front-facing card edges always cast visible shadows onto the cards behind.
// penumbra = 1 gives the maximum soft edge; SoftShadows blurs by distance.
// ---------------------------------------------------------------------------
function SpotlightRig({ intro, explodeAmt }: any) {
  const { camera, scene } = useThree();
  const lightRef = useRef<any>(null);
  const targetAdded = useRef(false);
  const _camDir = new THREE.Vector3();

  useFrame(() => {
    const light = lightRef.current;
    if (!light || !camera) return; // guards: never touch null refs in the loop

    // Ensure the light's target object lives in the scene so its world matrix
    // updates every frame (spotLight direction = position -> target).
    if (!targetAdded.current && light.target) {
      scene.add(light.target);
      targetAdded.current = true;
    }

    const camPos = camera.position;
    _camDir.copy(camPos).multiplyScalar(-1).normalize(); // from camera toward origin
    light.position.copy(camPos).addScaledVector(_camDir, 22);
    light.position.y += 10; // slightly above the camera's line of sight
    if (light.target) {
      light.target.position.set(0, 0, 0);
      light.target.updateMatrixWorld();
    }

    // Lights dim out while exploding away; fade in with the intro on entry.
    // Never drops below a small floor so the scene is never pitch black.
    const lightDim = Math.max(0, Math.min(1, intro * (1 - explodeAmt)));
    light.intensity = Math.max(400, 2800 * lightDim);
  });

  return (
    <spotLight
      ref={lightRef}
      angle={0.9}
      penumbra={1}
      intensity={0}
      distance={0}
      decay={2}
      color="#ffffff"
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-camera-near={5}
      shadow-camera-far={220}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  );
}

// ---------------------------------------------------------------------------
// Camera Controller (mobile gyroscope parallax only). Desktop is handled by
// <OrbitControls>; this adds device-orientation look-at on touch devices.
// ---------------------------------------------------------------------------
function CameraController({ wallState }) {
  const { camera, size } = useThree();
  const gyroPos = useRef({ x: 0, y: 0 });
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    const handleGyro = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        gyroPos.current.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
        gyroPos.current.y = THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1);
      }
    };

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
      window.removeEventListener('click', requestGyroPermission);
      window.removeEventListener('touchstart', requestGyroPermission);
      window.removeEventListener('deviceorientation', handleGyro);
    };
  }, []);

  useFrame((_, delta) => {
    const isMobile = size.width < 1024;
    if (!isMobile) return; // desktop uses OrbitControls
    if (wallState !== 'Home') return;

    const lookX = gyroPos.current.x * 30.0;
    const lookY = gyroPos.current.y * 30.0;

    easing.damp3(lookTarget.current, [lookX, lookY, 0], 0.50, delta);
    camera.lookAt(lookTarget.current);
  });

  return null;
}

// ---------------------------------------------------------------------------
// PhotoPlane: one photo card. A box with the photo on the front (+z) face, a
// clean matte backing on the rim/back, plus a back plate carrying the ROACH
// letter. castShadow + receiveShadow so cards shade each other in 3D.
// ---------------------------------------------------------------------------
function PhotoPlane({
  item,
  homePos,
  homeImageScale,
  sphereRotation,
  onPhotoClick,
  wallState,
  masonryLayout,
  roachLetter,
  intro,
  explodeAmt,
  explodeRef
}: any) {
  const ref = useRef<any>();
  const backRef = useRef<any>();
  const mountedRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const { size, camera } = useThree();

  const aspect = Math.max(0.5, Math.min(4.0, item.width / item.height));
  const baseWidth = aspect;
  const baseHeight = 1;

  // Globally use the medium resolution gridSrc from start to finish
  const imageUrl = item.gridSrc || item.thumbSrc;
  const texture = useTexture(imageUrl);

  // BoxGeometry face order: 0:+x 1:-x 2:+y 3:-y 4:+z(front) 5:-z(back).
  // The front face carries the photo; the other five faces are the dark rim.
  const cardMaterials = useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    const front = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.6,
      metalness: 0.0,
      transparent: true,
      opacity: 1,
    });
    const backing = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1a1a'),
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 1,
    });

    return [backing, backing, backing, backing, front, backing];
  }, [texture]);

  const backMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#161616'),
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0,
    });
  }, []);

  // ROACH bottom-right corner text (drei <Text>): anchored right/bottom, fixed
  // unscaled size, placed on the back plate just off the back face.
  const textRef = useRef<any>();


  useFrame((state, delta) => {
    if (!ref.current) return;

    // Clamp delta so a texture-loading stutter / dropped frame can never cause
    // the animation timers (damping, explosion) to skip ahead in a big jump.
    const safeDelta = Math.min(delta, 0.05);

    // Treated "All Work" as an active category layout in 3D Wall
    const isCategory = !['Home', 'About Me'].includes(wallState);
    const belongsToActiveCategory = isCategory && (wallState === 'All Work' || item.category?.toLowerCase() === wallState.toLowerCase());

    // Reset pooled targets to their frame-0 defaults (parity with the original
    // fresh allocations) so no stale value can leak across frames.
    _target.set(0, 0, 0);
    _scale.set(0, 0, 0);
    _quat.set(0, 0, 0, 1);
    let targetOpacity = 1.0;

    // Default Sphere Home position, rotated by the rolling sphere.
    _pos.set(...homePos).applyEuler(sphereRotation.current);

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

          _target.set(webglX, webglY, 2);
          _scale.set(webglW, webglH, 1);
          _quat.set(0, 0, 0, 1);
          targetOpacity = 1.0;
        } else {
          _target.copy(_pos);
          _scale.set(baseWidth * homeImageScale, baseHeight * homeImageScale, 1);
          targetOpacity = 0.0;
        }
      }
    } else {
      // Sphere mode (Home / About Me)
      _target.copy(_pos);

      // CRITICAL BUG FIX: Added ref.current validation check before evaluating z-positions during mount
      if (wallState === 'Home' && ref.current && ref.current.position.z > _target.z) {
        _v2.set(ref.current.position.x, ref.current.position.y);
        _v3.set(_target.x, _target.y);
        const distXY = _v2.distanceTo(_v3);
        const elevation = Math.min(25, distXY * 0.5);
        _target.z += elevation;
      }

      const customWidth = baseWidth * homeImageScale;
      const customHeight = baseHeight * homeImageScale;
      const hoverMult = hovered ? 1.15 : 1;
      _scale.set(customWidth * hoverMult, customHeight * hoverMult, 1);

      _pos.normalize();
      _mat.lookAt(_origin, _pos, _up);
      _quat.setFromRotationMatrix(_mat);

      targetOpacity = wallState === 'About Me' ? 0.05 : 1.0;
    }

    // Card thickness: subtle depth relative to the card's short edge so the
    // plaque has real physical thickness without dominating the layout.
    const cardDepth = Math.max(0.4, Math.min(2.5, Math.min(_scale.x, _scale.y) * 0.06));
    _scale.z = cardDepth;

    // Cinematic entrance: cards are ALWAYS full size (no scale-from-0 reveal).
    // Entry is a STRICTLY inward motion driven only by the explosion below, so
    // returning to Home never shows an outward burst.
    //
    // IMPORTANT: read the burst amount from the MUTABLE explodeRef (set to 1 on
    // mount/entry immediately) instead of the React state prop explodeAmt, which
    // lags by a frame — a stale 0 on Frame 1 would briefly render the card on
    // the sphere before it teleports outward (the "double explosion" bug).
    const burst = explodeRef ? explodeRef.current.amt : (explodeAmt || 0);
    if (burst > 0) {
      _explodeDir.copy(_target).normalize();
      _exploded.copy(_target).addScaledVector(_explodeDir, EXPLODE_DISTANCE * burst);
      const burstScale = 1 + EXPLODE_SCALE_MULT * burst;
      _scale.multiplyScalar(burstScale);
      _target.copy(_exploded);

      // FIRST FRAME: snap directly to the dispersed "outer space" position so
      // the card never dampens outward from homePos — it starts as a star and
      // only implodes inward from there.
      if (!mountedRef.current) {
        ref.current.position.copy(_target);
        ref.current.scale.copy(_scale);
        mountedRef.current = true;
      }
    }

    // Direct, uninterrupted morph transitions from sphere paths to grid positions
    // cardAnimDamping = 0.30, hoverAnimDamping = 0.05 (clamped delta)
    easing.damp3(ref.current.position, _target, 0.30, safeDelta);
    easing.dampQ(ref.current.quaternion, _quat, 0.30, safeDelta);
    easing.damp3(ref.current.scale, _scale, 0.05, safeDelta);

    // Telemetry: log the tracked card's actual trajectory vs its target for the
    // first 30 frames of the entrance / tab transition so desync is visible.
    telemetrySample(item.idxVal, {
      burst: +burst.toFixed(3),
      intro: +intro.toFixed(3),
      pos: [
        +ref.current.position.x.toFixed(2),
        +ref.current.position.y.toFixed(2),
        +ref.current.position.z.toFixed(2),
      ],
      target: [+_target.x.toFixed(2), +_target.y.toFixed(2), +_target.z.toFixed(2)],
      cam: [+camera.position.x.toFixed(2), +camera.position.y.toFixed(2), +camera.position.z.toFixed(2)],
    });

    // Starfield entrance: while the cards are dispersed in outer space their
    // photo faces stay dim (constellation), then fade up as they fly inward.
    // 0 = dim/dispersed, 1 = settled/full brightness.
    const starOpacity = THREE.MathUtils.clamp(1 - burst / 1, 0, 1);

    // Camera rectangular exclusion zone: transform the card's world position
    // into camera local space and check a rectangular corridor centered on the
    // camera lens (in front of it). Cards inside the box fade EVERY material
    // (photo face, rim/sides, back plate, text) to 0% opacity so the view into
    // the sphere is never blocked by a solid card.
    let occlusion = 1; // 1 = fully visible, 0 = invisible
    if (!isCategory) {
      ref.current.getWorldPosition(_worldPos);
      camera.worldToLocal(_localPos.copy(_worldPos));
      // In camera space +z points out of the lens; cards in front have z < 0.
      const inX = Math.abs(_localPos.x) < EXCLUDE_X;
      const inY = Math.abs(_localPos.y) < EXCLUDE_Y;
      const inZ = _localPos.z < EXCLUDE_Z_MAX && _localPos.z > EXCLUDE_Z_MIN;
      if (inX && inY && inZ) {
        // Fade in toward the box boundary for a smooth (non-popping) window.
        const dx = THREE.MathUtils.smoothstep(Math.abs(_localPos.x), EXCLUDE_X - EXCLUDE_BLEND, EXCLUDE_X);
        const dy = THREE.MathUtils.smoothstep(Math.abs(_localPos.y), EXCLUDE_Y - EXCLUDE_BLEND, EXCLUDE_Y);
        const dz = THREE.MathUtils.smoothstep(Math.abs(_localPos.z + (EXCLUDE_Z_MIN + EXCLUDE_Z_MAX) / 2), (EXCLUDE_Z_MAX - EXCLUDE_Z_MIN) / 2 - EXCLUDE_BLEND, (EXCLUDE_Z_MAX - EXCLUDE_Z_MIN) / 2);
        occlusion = Math.min(dx, dy, dz);
      }
    }

    // Fade EVERY face of the card (photo face + all rim/back faces) to the
    // occlusion factor. About Me dims to 0.05; the exclusion zone fades to 0;
    // the starfield keeps dispersed cards dim until they fly in.
    const mats = Array.isArray(ref.current.material) ? ref.current.material : [ref.current.material];
    for (let mi = 0; mi < mats.length; mi++) {
      easing.damp(mats[mi], 'opacity', targetOpacity * starOpacity * occlusion, 0.25, safeDelta);
    }

    // Sync the ROACH back plate: same position/rotation, uniform scale matching
    // the card's front face, offset to sit on the card's back surface.
    if (backRef.current) {
      // World-space offset to the back face: -localZ * (depth / 2), rotated by the card quaternion.
      _backOffset.copy(_zAxis).multiplyScalar(-(ref.current.scale.z / 2)).applyQuaternion(_quat).add(_target);
      easing.damp3(backRef.current.position, _backOffset, 0.30, safeDelta);
      easing.dampQ(backRef.current.quaternion, _quat, 0.30, safeDelta);
      easing.damp3(backRef.current.scale, [ref.current.scale.x, ref.current.scale.y, 1], 0.05, safeDelta);
      easing.damp(backMaterial, 'opacity', targetOpacity * starOpacity * occlusion, 0.25, safeDelta);

      // ROACH center text: fixed size, counter-scaled to the card so it stays
      // the same world size, centered on the back face. The negative X
      // counter-scale mirrors it back to readable orientation.
      // During the starfield entrance the letters stay bright (they ARE the
      // stars); they only fade when the card itself is excluded near the lens.
      if (textRef.current) {
        const bs = backRef.current.scale;
        textRef.current.position.set(0, 0, -0.005);
        textRef.current.scale.set(
          -ROACH_FONT_SCALE / Math.max(0.001, bs.x),
          ROACH_FONT_SCALE / Math.max(0.001, bs.y),
          1
        );
        if (textRef.current.material) {
          easing.damp(textRef.current.material, 'opacity', targetOpacity * occlusion, 0.25, safeDelta);
          textRef.current.visible = (targetOpacity * occlusion) > 0.01;
        }
      }
    }
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);

  // Reset the first-frame snap marker whenever we leave Home, so that on the
  // next entry into Home the card snaps straight to outer space on Frame 1
  // (never renders on the resting sphere first).
  useEffect(() => {
    if (wallState !== 'Home') {
      mountedRef.current = false;
    }
  }, [wallState]);

  const isSphereMode = wallState === 'Home' || wallState === 'About Me';


  return (
    <>
      <mesh
        ref={ref}
        position={homePos}
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onPhotoClick(item);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={cardMaterials} attach="material" />
      </mesh>

      {isSphereMode && (
        <mesh
          ref={backRef}
          position={homePos}
          castShadow
          receiveShadow
          raycast={() => null}
        >
          <planeGeometry args={[1, 1]} />
          <primitive object={backMaterial} attach="material" />

          {/* ROACH centered text: anchored center/middle, fixed size,
              counter-scaled per frame to stay the same world size on every
              card. Sits just off the back face (-z) to avoid z-fighting. */}
          <Text
            ref={textRef}
            position={[0, 0, -0.005]}
            anchorX="center"
            anchorY="middle"
            fontSize={1}
            letterSpacing={0.08}
            color="#ffffff"
            outlineWidth={0.06}
            outlineColor="#ffffff"
            material-toneMapped={false}
          >
            {roachLetter || '?'}
          </Text>
        </mesh>
      )}
    </>
  );
}


// ---------------------------------------------------------------------------
// PackedWall: sphere layout, cinematic entrance, ROACH assignment and lights.
// ---------------------------------------------------------------------------
function PackedWall({ items, onPhotoClick, wallState, enableCrop, enablePanoSpan }: any) {
  const { size, camera } = useThree();

  const sphereRotation = useRef(new THREE.Euler(0, 0, 0));
  // Single source of truth for the entrance: introRef drives the per-frame card
  // animation, and a mirrored state value re-renders the lights so their JSX
  // intensities actually update as the scene fades in.
  const introRef = useRef(0);
  const [intro, setIntro] = useState(0);

  // Explosion state for the tab transitions.
  // explodeRef.current = { amt: 0..1 (how dispersed), dir: 1 (out) | -1 (in), active }
  const explodeRef = useRef({ amt: 0, dir: 1, active: false });
  // Mirror of the amount as React state so the JSX light intensities re-render
  // as the cards burst out / fly in.
  const [explodeAmt, setExplodeAmt] = useState(0);

  // The dolly is disabled forever the moment the user grabs the orbit controls,
  // so the camera never snaps back after a drag/zoom.
  const dollyEnabled = useRef(true);
  const controls = useThree((s) => s.controls);

  useEffect(() => {
    if (!controls) return;
    const stop = () => { dollyEnabled.current = false; };
    controls.addEventListener('start', stop);
    return () => { controls.removeEventListener('start', stop); };
  }, [controls]);

  // The entrance MUST fire on mount (Home is the initial tab): kick it off
  // immediately and provide a hard fallback that forces full reveal so the
  // scene can never be stuck in the dark, even if the frame loop hiccups.
  // Entry is a SINGLE inward motion: cards start fully dispersed (amt = 1)
  // and fly in to settle on the sphere. No outward burst on the mount phase.
  useEffect(() => {
    console.log('[Lifecycle] PackedWall (Canvas scene) MOUNTED');
    telemetryBegin('entrance on mount (Home)');
    explodeRef.current = { amt: 1, dir: -1, active: true };
    setExplodeAmt(1); // mirror the ref immediately so lights/cards agree on Frame 1
    introRef.current = 0.001;
    setIntro(0.001);
    const fallback = window.setTimeout(() => {
      introRef.current = 1;
      setIntro(1);
    }, INTRO_DURATION * 1000 + 1200);
    return () => {
      window.clearTimeout(fallback);
      console.log('[Lifecycle] PackedWall (Canvas scene) UNMOUNTED');
    };
  }, []);

  // Watch wallState: leaving Home -> burst OUT; entering Home -> burst IN + re-intro.
  const prevWall = useRef(wallState);
  useEffect(() => {
    const prev = prevWall.current;
    if (prev !== wallState) {
      console.log('[Tab Change]', { from: prev, to: wallState, wallState });
      telemetryBegin(`tab transition ${prev} -> ${wallState}`);
      if (wallState === 'Home') {
        // Entering Home: start dispersed and fly in as the light turns on.
        explodeRef.current = { amt: 1, dir: -1, active: true };
        setExplodeAmt(1); // mirror immediately — no delayed state for Frame 1
        introRef.current = 0;
        setIntro(0);
      } else if (prev === 'Home') {
        // Leaving Home: burst outward as the lights dim into the void.
        explodeRef.current = { amt: 0, dir: 1, active: true };
      }
    }
    prevWall.current = wallState;
  }, [wallState]);

  useFrame((state, delta) => {
    sphereRotation.current.y += delta * 0.06; // Rotate sphere continuously
    sphereRotation.current.x = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.15; // Rocking motion

    // Cinematic entrance progress: 0 (pitch black) -> 1 (fully lit + revealed).
    // The ref is updated imperatively every frame (cards read it per-frame), and
    // the state is mirrored so the light JSX intensities re-render.
    const prevIntro = introRef.current;
    const next = THREE.MathUtils.clamp(prevIntro + (1 - prevIntro) * Math.min(1, delta / (INTRO_DURATION * 0.35)), 0, 1);
    introRef.current = next;
    if (Math.abs(next - prevIntro) > 0.0001) {
      setIntro(next);
    }

    // Drive the explosion: dir=1 ramps 0->1 (out), dir=-1 ramps 1->0 (in).
    const ex = explodeRef.current;
    if (ex.active) {
      const step = (delta / EXPLODE_DURATION) * ex.dir;
      const next = THREE.MathUtils.clamp(ex.amt + step, 0, 1);
      if (Math.abs(next - ex.amt) > 0.0001) {
        ex.amt = next;
        setExplodeAmt(next); // re-render lights with the new amount
      }
      if ((ex.dir === 1 && ex.amt >= 1) || (ex.dir === -1 && ex.amt <= 0)) {
        ex.active = false;
      }
    }
  });

  // Reuse the single shared masonry packing engine (also used by the DOM grid).
  const masonryLayout = useMemo(() => {
    const isCategory = !['Home', 'About Me'].includes(wallState);
    if (!isCategory) return new Map<string, { x: number; y: number; w: number; h: number }>();

    const displayItems = wallState === 'All Work'
      ? items
      : items.filter((p: any) => p.category?.toLowerCase() === wallState.toLowerCase());

    if (displayItems.length === 0) return new Map();

    const containerWidth = size.width < 768 ? size.width - 32 : size.width - 64;
    const columns = containerWidth >= 1500 ? 5 : containerWidth >= 1000 ? 4 : containerWidth >= 768 ? 3 : 2;
    const gap = size.width < 768 ? 10 : 20;

    const results = new Map<string, { x: number; y: number; w: number; h: number }>();
    const slots = computeMasonryLayout(displayItems, {
      containerWidth,
      columns,
      gap,
      enableCrop,
      enablePanoSpan,
    });
    for (const slot of slots) {
      results.set(slot.id, { x: slot.x, y: slot.y, w: slot.w, h: slot.h });
    }
    return results;
  }, [items, wallState, size.width, size.height, enableCrop, enablePanoSpan]);

  const { itemsWithPositions, homeProportionalScale, roachByItem } = useMemo(() => {
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

    // Mobile / desktop photo card scale on the hero wall (bumped from 8.7/28 so
    // the sphere reads as a full wall of photographs instead of faint dots).
    const isMobileOrTablet = size.width < 1024;
    const HOME_IMAGE_SCALE = isMobileOrTablet ? 46 : 18;

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

    // ROACH easter egg: cards are grouped by horizontal longitude (angle around
    // the Y axis). The word completes 4 full cycles around the 360° sphere
    // (20 longitude bands -> R O A C H R O A C H ...), so from any single
    // viewing angle (~180°) the viewer can always read the full word.
    const roach = new Map<string, string>();
    if (totalItems > 0) {
      // Build seq by repeating the clean 5-letter array, then set bands to
      // seq.length exactly — guaranteeing seq[seq.length - 1 - band] is always
      // a valid index (never undefined, never the "?" placeholder).
      const cycles = 4;
      const seq: string[] = [];
      for (let c = 0; c < cycles; c++) {
        seq.push(...ROACH_LETTERS);
      }
      const bands = seq.length; // 20 bands

      const byAngle = mapped
        .map((m: any, idx: number) => ({
          id: m.id,
          angle: Math.atan2(m.homePos[0], m.homePos[2])
        }))
        .sort((a: any, b: any) => a.angle - b.angle);

      byAngle.forEach((entry: any, idx: number) => {
        const band = Math.min(bands - 1, Math.floor((idx / byAngle.length) * bands));
        // Reverse the letter order along the horizontal axis: the sphere rotates
        // left-to-right, so mapping low-angle cards to the LATER letters makes
        // the word read forward (R -> O -> A -> C -> H) as cards orbit past.
        roach.set(entry.id, seq[seq.length - 1 - band]);
      });
    }

    return {
      itemsWithPositions: mapped,
      homeProportionalScale: (viewportHeightAtHome / 110) * HOME_IMAGE_SCALE * resolutionFactor,
      roachByItem: roach
    };
  }, [items, size.width, size.height]);


  return (
    <>
      {/* Pure black void background — no floor, no glow. The sphere floats in a
          pitch-black abyss; cards only catch each other's shadows. */}
      <color attach="background" args={['#000000']} />

      <CameraController
        wallState={wallState}
      />
      <CameraDolly dollyEnabled={dollyEnabled} />

      {/* Cinematic lights: ambient is ALWAYS on as a baseline so the scene is
          never pitch black; the other lights fade in with the intro and dim
          while the cards explode away. */}
      <ambientLight intensity={0.5 * (0.55 + 0.45 * intro) * (1 - explodeAmt)} />

      {/* Soft fill key from the camera-ish direction so visible faces stay lit */}
      <directionalLight
        position={[20, 60, 30]}
        intensity={1.2 * (0.5 + 0.5 * intro) * (1 - explodeAmt)}
      />

      {/* Gentle upward fill so unlit undersides are never pitch black */}
      <hemisphereLight args={['#ffffff', '#1a1a1a', 0.6 * (0.5 + 0.5 * intro) * (1 - explodeAmt)]} />

      {/* Shadow-casting spotlight sits behind + above the camera and points
          through its line of sight into the sphere (penumbra = 1 max soft). */}
      <SpotlightRig
        intro={intro}
        explodeAmt={explodeAmt}
      />

      {/* Free orbit + zoom; damping for a smooth, weighted feel. The camera
          stays exactly where the user leaves it (dolly stops on first drag). */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={ORBIT_MIN_DISTANCE}
        maxDistance={ORBIT_MAX_DISTANCE}
        enablePan={false}
        target={[0, 0, 0]}
      />

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
              roachLetter={roachByItem.get(item.id) || ''}
              intro={intro}
              explodeAmt={explodeAmt}
              explodeRef={explodeRef}
            />
          );
        })}
      </Suspense>
    </>
  );
}

export default function Wall3D({ items, onPhotoClick, wallState, enableCrop, enablePanoSpan }: any) {
  // Lifecycle telemetry: proves whether App remounts the canvas on tab switches.
  useEffect(() => {
    console.log('[Lifecycle] Wall3D MOUNTED');
    return () => console.log('[Lifecycle] Wall3D UNMOUNTED');
  }, []);

  return (
    <Canvas shadows="soft" camera={{ position: [0, 0, CAM_HOME_Z], fov: 45 }}>
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

