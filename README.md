# Roach-folio

A single-page photography portfolio for **Cookaracha**. It is a React + TypeScript app with two
very different ways of showing the same photo set: a WebGL "wall" of photo cards arranged on a
slowly rotating sphere, and a conventional DOM masonry grid. Both surfaces are driven by one
shared tab state, so switching tabs morphs between them.

Published with GitHub Pages at <https://tacturnity.github.io/portfolio/>.

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Tech stack](#2-tech-stack)
3. [Getting started](#3-getting-started)
4. [Project layout](#4-project-layout)
5. [How the app works](#5-how-the-app-works)
6. [Feature reference](#6-feature-reference)
7. [File-by-file reference](#7-file-by-file-reference)
8. [Photo data and the image pipeline](#8-photo-data-and-the-image-pipeline)
9. [Performance notes](#9-performance-notes)
10. [Deployment](#10-deployment)
11. [Known issues and gotchas](#11-known-issues-and-gotchas)
12. [How to add a photo or a tab](#12-how-to-add-a-photo-or-a-tab)
13. [Console logs cheat sheet](#13-console-logs-cheat-sheet)

---

## 1. What this is

The site has **no router**. It is one URL with seven tabs held in React state:

```ts
// src/App.tsx
const NAV_ITEMS = ['Home', 'All Work', 'Animals', 'Misc', 'People', 'Panos', 'About Me'];
```

The tabs fall into three kinds, and the kind decides what gets rendered:

| Tab | Kind | Rendered surface |
| --- | --- | --- |
| `Home` | sphere | `Wall3D` (WebGL) — full photo set as a rotating card sphere |
| `All Work` | category | `Masonry` (DOM) — every photo |
| `Animals`, `Misc`, `People`, `Panos` | category | `Masonry` (DOM) — filtered by `photo.category` |
| `About Me` | sphere | `Wall3D` in a "ghost" mode (cards faded to 5 % opacity) with `About` on top |

A category tab is anything that is not `Home` and not `About Me`. That rule is repeated in three
places (`App.tsx` for transitions, `Wall3d.tsx` twice for layout and filtering), so keep it in mind
when you add a tab.

Two surfaces exist for the same content because the WebGL wall is expensive: it mounts a `<Canvas>`,
uploads a texture per photo (284 at the time of writing) and runs a `useFrame` loop over every card.
The masonry grid is plain DOM and cheap. Which one you land on is decided per device — see
[5.4](#54-landing-view-per-device).

---

## 2. Tech stack

| Area | Choice | Notes |
| --- | --- | --- |
| Framework | React 19 (`react`, `react-dom`) | Function components + hooks throughout |
| Language | TypeScript ~5.9 | `tsconfig.app.json`, strict, `noUnusedLocals` |
| Build | Vite 8 (beta, rolldown) | `vite.config.ts`, `base: '/portfolio/'` |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` | Config-in-CSS: `src/index.css` has the `@theme` block; `tailwind.config.js` is the legacy-style content config |
| UI animation | `framer-motion` | Tab transitions, masonry reveal, dock magnification |
| 3D | `three` 0.183 + `@react-three/fiber` 9 + `@react-three/drei` 10 | `Wall3d.tsx` |
| 3D easing | `maath` (`easing.damp3` / `dampQ` / `damp`) | Frame-rate-independent damping |
| Shader | `ogl` | `LightRays.tsx` raw WebGL background |
| Scroll animation | `gsap` + `ScrollTrigger` | `AnimatedContent.tsx` only |
| Fonts | Lexend, loaded from Google Fonts in `src/index.css` | Variable font; `TextPressure` animates `wght`/`wdth` |
| Deploy | GitHub Actions + `actions/deploy-pages` | `.github/workflows/deploy.yaml` |

Declared in `package.json` but **not imported anywhere in `src/`** (verified by search): `leva`,
`lucide-react`, `@react-three/rapier`, `meshline`, and the `motion` package (the code imports
`framer-motion` instead). `leva` leaves one trace: `App.tsx` still excludes `#leva__root` from its
swipe handler, a leftover from a removed debug GUI. Safe to remove, and worth doing before the next
dependency audit.

---

## 3. Getting started

```bash
npm install        # use install, not ci (see 11.3)
npm run dev        # Vite dev server; site is served at /portfolio/ because of base
npm run build      # production build into dist/
npm run preview    # serve dist/ locally (http://localhost:4173/portfolio/)
npm run lint       # ESLint; currently exits non-zero, see 11.2
npx tsc --noEmit -p tsconfig.app.json   # type check; currently reports errors, see 11.1
```

Node 20 is what CI uses (`.github/workflows/deploy.yaml`).

Because `vite.config.ts` sets `base: '/portfolio/'`, the dev server URL is
`http://localhost:5173/portfolio/`, not `/`. Dropping the prefix gives a blank page.

---

## 4. Project layout

```
portfolio-deploy/
├─ .github/workflows/deploy.yaml   CI: build on push to main, publish dist/ to Pages
├─ index.html                      Single HTML entry; viewport, OG/Twitter meta, favicon
├─ public/
│  ├─ optimized2/                  852 processed photos, 3 renditions each (see section 8)
│  │  ├─ animals/  misc/  people/  panos/
│  │  │  └─ thumb/  medium/  large/
│  ├─ og-image.png, og-image.webp  Social preview images (og-image.webp is ~5.3 MB)
│  └─ vite.svg                     Favicon
├─ src/
│  ├─ main.tsx                     React root + top-level ErrorBoundary
│  ├─ App.tsx                      All state: tabs, transitions, gestures, layout shell
│  ├─ index.css                    Tailwind import, theme, body font, .no-scrollbar
│  ├─ photos.json                  The photo database (284 records, untyped)
│  ├─ types.ts                     Photo interface (only Lightbox imports it)
│  ├─ lib/masonry.ts               Shared column-packing engine (DOM grid + WebGL grid)
│  └─ components/
│     ├─ Wall3d.tsx                WebGL photo sphere, transitions, ROACH easter egg
│     ├─ Masonry.tsx               DOM masonry grid with staggered reveal
│     ├─ TiltedCard.tsx            Per-card pointer tilt wrapper used by Masonry
│     ├─ DockNav.tsx               Bottom floating tab bar
│     ├─ Header.tsx                Site title (hidden on Home)
│     ├─ TextPressure.tsx          Variable-font title that reacts to the cursor
│     ├─ About.tsx                 About Me tab layout
│     ├─ ProfileCard.tsx / .css    Holographic trading-card profile widget
│     ├─ AnimatedContent.tsx       GSAP ScrollTrigger reveal wrapper
│     ├─ Lightbox.tsx              Full-screen photo viewer (zoom / pan / swipe)
│     ├─ LightRays.tsx / .css      OGL shader background
│     ├─ GradualBlur.tsx           Layered blur + vignette above the dock
│     ├─ PerfCounter.tsx           Click-through performance HUD
│     ├─ ErrorBoundary.tsx         Crash fallback UI
│     ├─ pfp.webp, pfp2.webp       Profile photos used by About
│     └─ (no test files — this project has no test runner)
└─ vite.config.ts, tailwind.config.js, postcss.config.js, eslint.config.js, tsconfig*.json
```

---

## 5. How the app works

### 5.1 One page, two surfaces, one state

`App.tsx` holds the whole application state:

| State | Meaning |
| --- | --- |
| `activeView` | The tab the user is on. Drives `filteredPhotos`, the dock highlight and which surface is visible |
| `pendingView` | Set at the start of a transition, cleared when it finishes. The dock highlights `pendingView \|\| activeView` so the highlight moves immediately without waiting for the animation |
| `wallState` | What the WebGL wall is currently doing. In practice only ever `'Home'` or `'About Me'` (see 11.10) |
| `isCanvasMounted` | Whether `<Wall3D>` exists in the tree at all. `false` unmounts the whole WebGL context |
| `isMasonryVisible` | Drives opacity + `pointer-events` on both the canvas wrapper and the `<main>` element, so the two cross-fade |
| `direction` | `+1` / `-1` tab direction, used by the slide variants and the masonry stagger order |
| `landingView` | The tab this page load started on. Read once, never changes (see 5.4) |
| `selectedPhoto` | The photo shown in the Lightbox, or `null` |

Both surfaces are always siblings in the DOM when mounted, stacked with `grid-area` / fixed
positioning, and cross-fade via CSS `opacity` transitions (900 ms when the masonry is appearing,
1450 ms when the canvas is appearing). The canvas is `pointer-events-none` while faded out, so clicks
always reach the visible surface.

### 5.2 Why the canvas is unmounted, not just hidden

Keeping a `<Canvas>` alive in the background costs a WebGL context, GPU memory for 284 textures and
a running render loop. `isCanvasMounted` therefore goes to `false` as soon as a category tab finishes
appearing, and back to `true` only when `Home` or `About Me` is requested. `Wall3d.tsx` and
`App.tsx` both log mount/unmount to the console so you can verify this in a real browser
([section 13](#13-console-logs-cheat-sheet)).

### 5.3 The tab transition state machine

Everything funnels through one async function, `handleViewChange(newView)` in `App.tsx`. It sets
`isAnimating.current = true` for its whole duration, and every entry point (dock click, keyboard-free
drag, swipe) calls it, so concurrent transitions cannot overlap. The first thing it does is
`await scrollToTop()` — if the page is scrolled down it glides back to the top before the animation
starts, and the promise resolves instantly when already near the top.

The timings below are the actual `sleep()` values in the function. They are magic numbers, tuned by
eye; if you change one, re-check the cross-fade durations on the two wrappers in the same file.

| From → To | What happens |
| --- | --- |
| category → category (includes `About Me`) | Nothing but a slide. `isMasonryVisible = true`, then `activeView = newView`. Cards animate out/in via Framer Motion variants. 500 ms lock |
| Home → category | Canvas already mounted, set to `'About Me'` (cards fade to 5 %), 1000 ms, then `activeView = newView` and reveal the masonry, 800 ms, then unmount the canvas |
| Home → `About Me` | Same as above; the canvas stays mounted in the ghost state, `About` fades in over it |
| category → Home | Mount the canvas at `'About Me'`, 50 ms, set `activeView = 'Home'` and hide the masonry, 600 ms, then `wallState = 'Home'` which triggers the inward burst of cards, 1500 ms, clear `pendingView` |
| `About Me` → Home | Identical to category → Home |

The `'About Me'` wall state is deliberately reused as an intermediate "dark, dispersed" frame in
transitions. In `Wall3d.tsx`, `wallState === 'About Me'` sets card `targetOpacity` to `0.05`, which is
why the sphere appears empty for a moment before the cards fly in.

`direction` is derived from the index difference in `NAV_ITEMS`, and `customKey` (passed to the
Framer Motion variants) packs `direction`, `transitionType` and whether the view is `About Me` into a
`_`-joined string. `Masonry.tsx` packs seven values the same way; `parseCustom` / `parseCardCustom`
decode them. That string-passing is the one genuinely fragile part of the animation code — adding a
field means updating both the encoder and the decoder.

### 5.4 Landing view per device

The Home tab mounts the heavy WebGL wall. Phones therefore land somewhere cheaper:

```ts
// src/App.tsx
const MOBILE_BREAKPOINT = 768;
const DESKTOP_LANDING_VIEW = 'Home';
const MOBILE_LANDING_VIEW = 'All Work';

const resolveLandingView = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
    ? MOBILE_LANDING_VIEW
    : DESKTOP_LANDING_VIEW;
```

It is read once per page load via a lazy `useState` initializer and seeds `activeView`, `wallState`,
`isCanvasMounted` (`false` on mobile) and `isMasonryVisible` (`true` on mobile). So on a phone the
canvas never mounts at load and the visitor gets the masonry grid immediately. Desktop behaviour is
unchanged. Resizing or rotating mid-session does not switch the view — that is intentional, so the
tab never disappears from under the reader. A phone user who taps `Home` still gets the full 3D
sphere on demand.

`768` matches the `md:` breakpoint used across the layout and the existing
`window.innerWidth < 768` checks in `LightRays.tsx` and `TextPressure.tsx`.

### 5.5 Grid options: crop and pano span

`App.tsx` holds two flags that are passed to both surfaces:

- `enableCrop` — when true, the packing engine forces each card to a 4:3 or 3:4 box and balances
  landscape/portrait counts across columns instead of honouring each photo's natural aspect ratio.
- `enablePanoSpan` — when true, photos whose category is `Panos` span every column.

Both default to `false`, and **nothing in the UI currently sets them** (`setEnableCrop` and
`setEnablePanoSpan` are never called, which is why `tsc` flags them). The features are complete but
unreachable; adding a toggle in `DockNav` or a query parameter is all that is missing.

---

## 6. Feature reference

### 6.1 The WebGL photo sphere (`Home`)

`Wall3d.tsx` lays every photo out on a Fibonacci-sphere distribution: `idx` maps to `phi`/`theta`
angles, and a `seededRandom(item.id + 500)` multiplier (0.75–1.25) pushes each card off the perfect
sphere so the wall looks uneven and hand-hung rather than geometric. Positions are then stretched
independently on X and Y to match the viewport, so the sphere always fills the screen. Each card is a
`boxGeometry` with the photo on the front face and dark material on the other five faces, plus a
separate back plate for the easter egg (6.2). Cards `castShadow` and `receiveShadow`, and one spot
light is re-aimed at the sphere every frame from just behind the camera, so the cards shade each
other as you orbit.

Card size comes from `homeProportionalScale`, which folds in viewport height, a hard-coded
`HOME_IMAGE_SCALE` (46 on width < 1024, 18 above) and `size.width / 3840`. Those three numbers are
the main dial for how "full" the sphere looks; the code comments record that they were raised from
8.7/28.

Interaction: `OrbitControls` gives free orbit and zoom with damping, clamped to
`ORBIT_MIN_DISTANCE = 48` (the sphere radius is about 45, so you cannot clip through it) and
`ORBIT_MAX_DISTANCE = 320`. Hovering a card scales it 1.15× and sets the cursor to `pointer`; clicking
opens the Lightbox.

### 6.2 Cinematic entrance, transitions and the camera exclusion zone

- **Entrance.** `intro` ramps 0→1 over `INTRO_DURATION = 1.9 s`; light intensities are
  `something * (0.5 + 0.5 * intro)`, so the scene fades up from black. A `setTimeout` fallback forces
  `intro = 1` after `INTRO_DURATION * 1000 + 1200` ms so a stalled frame loop can never leave the
  scene dark. `CameraDolly` starts the camera at `CAM_HOME_Z * 1.9` and eases it to `CAM_HOME_Z = 134`;
  the dolly is switched off permanently the first time the user touches the orbit controls, so the
  camera never snaps back after a drag.
- **Card burst.** Leaving Home sets `explodeRef = { amt: 0, dir: 1, active: true }`: every card flies
  outward along its own radial direction by `EXPLODE_DISTANCE = 140` units over
  `EXPLODE_DURATION = 0.55 s`, and while they are dispersed their photo faces fade down
  (`starOpacity = clamp(1 - burst)`) so the wall reads as a dim starfield. Entering Home runs the same
  ramp in reverse (`dir: -1`), so cards implode inward from outer space, fading up as they land. On the
  first frame of an entry the card is snapped straight to its dispersed position rather than damped
  toward it, which is what prevents the "double explosion" artefact the comments describe.
- **Exclusion zone.** Cards whose centres fall inside a 2000-wide box in front of the camera fade to
  0 % opacity (with a smooth `smoothstep` blend at the edges), so no card can ever block the view into
  the sphere.

### 6.3 The `ROACH` easter egg

Card backs carry a single letter each. Cards are sorted by their longitude angle around the sphere and
split into 20 bands (`4` cycles of the 5 letters `R O A C H`), so as the sphere rotates you read the
word repeatedly. The letter sequence is reversed when assigning bands, because the sphere spins the
other way. Letters are rendered with drei `<Text>`, counter-scaled every frame to keep a constant world
size, and during the entrance burst they stay bright while the photo faces dim — the letters are the
"stars". Set `ROACH_LETTERS`, `ROACH_FONT_SCALE` or `cycles` to change the message.

### 6.4 The masonry grid

`Masonry.tsx` measures its own width with a `ResizeObserver` and picks 2 / 3 / 4 / 5 columns at
< 768 / < 1000 / < 1500 / ≥ 1500 px, with a 10 px gap below 768 px and 20 px above. Layout comes from
the shared `computeMasonryLayout` (section 7). Cards are absolutely positioned, hardware-accelerated
(`translate3d`, `backfaceVisibility: hidden`) `motion.div`s that reveal with `whileInView` and a
per-column stagger (`staggerDelay = 0.07 s`), so a category change reads as a wave rather than a flash.
Each card is wrapped in `TiltedCard`, which adds pointer-driven 3D tilt and is automatically disabled on
devices without hover. Panos in the grid use the full-resolution `large` file only when pano spanning
is on; otherwise everything uses the `medium` rendition.

### 6.5 The tab dock

`DockNav.tsx` is the bottom pill. On pointer move, each item is scaled by a spring driven by its
distance from the cursor (up to 1.25×) and items further away are blurred by `blurAmount`. A single
"focus frame" (four corner brackets) springs to the active item's offset and width; the corner radius
switches when the active item is the first or last, so the brackets follow the pill's curve. The
container scrolls horizontally with hidden scrollbars and auto-centres the active item, which is what
makes seven tabs usable on a phone.

### 6.6 Lightbox

Full-screen viewer with two zoom paths. Desktop: wheel zooms 1–5×, a single click toggles 2.5×, and
dragging pans once zoomed past 1×. Touch: pinch zooms 1–5×, dragging pans, and a horizontal swipe at
1× scale goes to the next/previous photo. `Escape`, `ArrowLeft` and `ArrowRight` work; the arrow
buttons are hidden while zoomed. Body scroll is locked while open, and clicking the backdrop closes.
The metadata card shows filename, date, ISO, aperture and shutter. Below 1024 px wide it loads
`gridSrc` (`medium`) instead of `editedSrc` (`large`) to save bandwidth.

### 6.7 About Me

`About.tsx` pairs a `ProfileCard` (a holographic trading-card widget: layered shine/glare gradients,
grain overlay, and a pointer-driven tilt engine that writes `--pointer-x`, `--rotate-x` etc. as CSS
custom properties, all defined in `ProfileCard.css`) with scroll-triggered `AnimatedContent` blocks.
The card's buttons are `eBird` (opens a `mailto:` link) and `inskergam` (opens Instagram), both wired
in `About.tsx`.

### 6.8 Ambient background, blur and the performance HUD

- **`LightRays`** is a raw WebGL fragment shader on a single full-screen triangle (`ogl`), drawing two
  layered light rays from `top-center` in rose (`#fb7185`). The ray direction bends toward the cursor
  (`followMouse`, smoothed each frame). It is mounted permanently at `z-0` and fades out while the 3D
  wall is on screen so the sphere floats in pure black. `dpr` is capped at `0.75` on mobile and
  `devicePixelRatio` (max 2) on desktop, and the whole renderer is created lazily via an
  `IntersectionObserver` and destroyed with `WEBGL_lose_context` on cleanup.
- **`GradualBlur`** stacks six `backdrop-filter: blur()` layers (1 → 24 px) masked to the lower part of
  the screen, plus a dark graded vignette, over a fixed band at the bottom (`height="15vh"` and
  `strength={10}` as used by `App.tsx`, z-index 30). It sits under the dock (z-50) and above the
  content, giving photos a soft fade-out at the bottom instead of a hard cut.
- **`PerfCounter`** renders `CPU nn% GPU nn% FPS nnn` in the top-right. It is hidden by default;
  clicking cycles scroll → pinned → hidden. Note that the CPU and GPU figures are **heuristics derived
  from frame delta and FPS**, not real hardware telemetry — treat them as an animation-smoothness
  indicator, not instrumentation. While hidden it skips all sampling.

### 6.9 Gestures

Three independent gesture paths exist, which is easy to trip over:

| Gesture | Where | Behaviour |
| --- | --- | --- |
| Horizontal swipe on the page | `App.tsx` (`onTouchStart/Move/End`) | Moves one tab left/right in `NAV_ITEMS`. Ignored when the touch starts inside a button, link, `nav`, `.gradual-blur` element or `#leva__root`. Needs ≥ 80 px horizontal travel and must be more horizontal than vertical |
| Drag on a card/grid | Framer Motion `drag="x"` in `App.tsx` | Same tab change, with 120 px / 400 px·s⁻¹ thresholds. Applies to the masonry and About wrappers only |
| Pinch / swipe inside the Lightbox | `Lightbox.tsx` | Zoom, pan, next/previous. These handlers `stopPropagation()` so they never reach `App.tsx` |

Mobile-only extras: `CameraController` in `Wall3d.tsx` reads `deviceorientation` for a gyroscope
parallax effect at camera widths < 1024 px (only while `wallState === 'Home'`), including the iOS 13+
`DeviceOrientationEvent.requestPermission()` flow triggered on the first tap.

### 6.10 Device-aware performance trim

| Lever | Mobile | Desktop |
| --- | --- | --- |
| Landing tab | `All Work` (masonry) | `Home` (WebGL sphere) |
| Light rays resolution | `dpr = 0.75` | `min(devicePixelRatio, 2)` |
| Wall3D card scale | `HOME_IMAGE_SCALE = 46` (< 1024 px) | `18` |
| Grid gap / columns | 10 px, 2 columns | 20 px, up to 5 |
| Lightbox source | `medium` below 1024 px | `large` |
| Card tilt | `TiltedCard` disables tilt when `(hover: hover)` does not match | enabled |

### 6.11 Error boundaries

`ErrorBoundary.tsx` is a class component that renders the error and component stack in a red monospace
panel. Three are in use: the outermost one in `main.tsx` (catches root crashes), one around the
`<Canvas>` wrapper, and one around `<main>`. A third-party/library crash in the WebGL scene therefore
shows the fallback panel without taking the rest of the page down.

---

## 7. File-by-file reference

### `src/main.tsx` (15 lines)

`createRoot` on `#root`, wraps `<App />` in `<ErrorBoundary>` inside `<StrictMode>`. Note that
`StrictMode` double-invokes effects in development, so the mount/unmount lifecycle logs appear twice
per mount in `npm run dev` but once in a production build.

### `src/App.tsx` (485 lines)

The container. Owns all state (5.1), the transition state machine (5.3), the landing-view resolver
(5.4), the gesture handlers (6.9), the photo normalisation memo, and the whole layout shell.

Key pieces:

- `NAV_ITEMS` — the tab list; also the ordering used by swipe/arrow navigation.
- `scrollToTop()` — promise-based smooth scroll with `scrollend` support and an 800 ms safety timeout.
- `parseCustom()` — decodes the `direction_transitionType_isAbout` string used by the view variants.
- `handleViewChange()` — the async transition driver (5.3).
- `allPhotos` — memo that normalises `photos.json` into the shape the UI expects (section 8) and sorts
  newest first.
- `filteredPhotos` — `All Work`, `Home` and `About Me` return everything; any other tab filters on
  `photo.category` (case-insensitive).
- The render tree: `LightRays` backdrop → `Header` + `PerfCounter` → canvas wrapper → `<main>` with the
  `AnimatePresence` view switch → `DockNav` → `GradualBlur` → `Lightbox`.

Roughly half the file is the two `motion.div` wrappers whose `variants`, `custom={customKey}`,
`drag` and `onDragEnd` differ only in a slider threshold, measured in px of drag before it counts as a
swipe. This is very much the "compose to your own risk" area of the codebase. It works, but it is
easier to write a new variant than to thread a new behaviour through this tree.

### `src/index.css` (23 lines)

Imports the Lexend webfont and Tailwind, declares `--font-lexend` in an `@theme` block (Tailwind v4
style), styles `body` (black background, antialiased) and defines `.no-scrollbar`, used by the dock.

### `src/types.ts` (15 lines)

The `Photo` interface. Only `Lightbox.tsx` imports it, and it does **not** match `photos.json`
directly — see 11.4. `App.tsx` uses its own inferred shape from `photoData.map(...)` instead.

### `src/photos.json` (4 262 lines, 284 records)

Flat array of records with this shape:

```json
{
  "url_large":  "/portfolio/optimized2/misc/large/DJI--107.webp",
  "url_medium": "/portfolio/optimized2/misc/medium/DJI--107.webp",
  "url_thumb":  "/portfolio/optimized2/misc/thumb/DJI--107.webp",
  "brightness": 0.22791613169669875,
  "category": "Misc",
  "title": "Dji  107",
  "date": "2026-10-01",
  "iso": "100",
  "aperture": "f/2",
  "shutter": "1/8",
  "width": 7680,
  "height": 4320,
  "id": 1
}
```

`id` is a number here while `Photo.id` is declared as `string`; both are used as React keys and Map
keys, which works because they stay consistent within each surface. `width`/`height` are the *source*
pixel dimensions and drive aspect ratios everywhere. `brightness` exists in the data but is never read
by any component. Categories present in the data: `Animals`, `Misc`, `People`, `Panos`.

### `src/lib/masonry.ts` (153 lines)

The single column-packing engine, extracted so the DOM grid and the WebGL grid cannot drift apart
(the header comment records that it used to be copy-pasted).

- `computeMasonryLayout(items, config) -> PackedSlot[]` — greedy shortest-column packing. It derives
  column width from container width and gap, then walks items in order, placing each in the shortest
  column. With `enableCrop`, photos are forced to 4:3 or 3:4 and a pre-computed `balanceCounter` spreads
  landscape/portrait evenly; panos span all columns when `enablePanoSpan` is set. Natural aspect ratio
  is used when cropping is off.
- `totalMasonryHeight(slots)` — the tallest bottom edge, used to reserve container height.

Both `Masonry.tsx` and `Wall3d.tsx` call this, so a change here affects the 3D layout too.

### `src/components/Wall3d.tsx` (909 lines)

The largest and most intricate file. Read it in this order:

| Lines | Contents |
| --- | --- |
| 1–95 | Tunable constants: `ROACH_LETTERS`, `CAM_HOME_Z`, orbit clamps, intro/explode timings, the camera exclusion box, pooled `THREE.Vector3/Quaternion/Matrix4` scratch objects, `seededRandom` |
| 98–119 | `CameraDolly` — one-shot entrance dolly |
| 126–182 | `SpotlightRig` — the shadow-casting spotlight that follows the camera |
| 188–249 | `CameraController` — mobile gyroscope parallax + iOS permission flow |
| 256–580 | `PhotoPlane` — one card: materials, texture, per-frame targets, pooling, explosion, occlusion fade, ROACH text |
| 586–888 | `PackedWall` — sphere layout, masonry-in-3D layout, lights, `OrbitControls`, card list |
| 890–909 | `Wall3D` default export — the `<Canvas>` |

Notable details for future editors:

- The **pooled scratch vectors** at the top exist because the original code allocated new
  `Vector3`/`Quaternion` objects every frame for every card. Do not add `new THREE.*` inside `useFrame`
  without checking whether a pooled buffer already exists.
- `delta` is clamped to 0.05 s per card, so a stutter cannot make damping or the explosion jump.
- Cards only mount if they belong to the active category
  (`if (isCategory && !belongsToActiveCategory) return null`), which keeps the React tree small. That
  condition exists specifically so hooks are never called conditionally inside `PhotoPlane`. Note that
  the whole category path is currently unreachable — see 11.10.
- The 3D grid positions are derived from the DOM grid by converting CSS pixels to 3D units, using the
  same `148 / 272` px top padding and `16 / 32` px side padding as `<main>` in `App.tsx`. **Those four
  numbers are coupled across two files.** Change the padding in `App.tsx` and the in-canvas grid will
  misalign.
- Animation telemetry (`telemetryBegin` / `telemetrySample`) logs the tracked card's position, target
  and camera for the first 30 frames of every entrance and tab change. It is on by default; delete or
  gate it behind a flag if console noise is unwanted in production.

### `src/components/Masonry.tsx` (196 lines)

The DOM grid (6.4). Props: `items`, `onPhotoClick`, `enableCrop`, `enablePanoSpan`, `direction`,
`staggerDelay`, `slideDuration`, `slideOffset`, `transitionType`. Contains `parseCardCustom()` and the
`cardVariants` object (`hidden` / `visible` / `exit`), which honours the `cascade`, `dissolve` and
`instant` transition types. Card custom strings are built as
`` `${index}_${direction}_${slideOffset}_${staggerDelay}_${slideDuration}_${transitionType}_${columns}` ``
— encoder and decoder must stay in sync.

### `src/components/TiltedCard.tsx` (79 lines)

Generic pointer-tilt image card built on Framer Motion springs, used by `Masonry` for every photo.
`rotateAmplitude = 3`, `scaleOnHover = 1.05`. Tilt is skipped entirely when
`matchMedia('(hover: hover)')` does not match, so phones get a plain image and no wasted work.

### `src/components/DockNav.tsx` (175 lines)

The tab bar (6.5). Props: `items`, `activeItem` (App passes `pendingView || activeView`),
`onItemClick`, `blurAmount` (default 1), `borderColor` (default `#fb7185`). `DockItem` is a
`forwardRef` motion button because the parent needs each item's DOM node to measure width and offset.

### `src/components/Header.tsx` (56 lines)

Centred header with the `TextPressure` title and a "Photography Portfolio" subtitle, rendered only
while `showTitle` is true. `App.tsx` passes `showTitle={activeView !== 'Home'}`, so the title is hidden
on the Home sphere. `titleSpringStiffness` / `titleSpringDamping` / `titleSpringMass` are declared and
passed by `App.tsx` but never read inside the component (pre-existing `tsc` error, 11.1).

### `src/components/TextPressure.tsx` (105 lines)

Splits the title into one `<span>` per character and, on every animation frame, sets
`fontVariationSettings` (`wght` up to 900, `wdth` 60–150) from each character's distance to a smoothed
cursor position. Font size is recomputed from viewport width on resize, clamped 24–40 px on mobile and
24–120 px on desktop.

### `src/components/About.tsx` (80 lines)

The About Me layout: `ProfileCard` on one side, three `AnimatedContent` blocks on the other (name,
bio paragraph, Location/Focus footer). Handlers: `handleEmail` (`mailto:`) and `handleInsta`
(Instagram, opened in a new tab). **The email address is currently the literal placeholder
`mailto:[EMAIL]`** — see 11.5.

### `src/components/ProfileCard.tsx` (219 lines) + `ProfileCard.css` (466 lines)

The holographic card. The TSX builds a tilt engine in a `useMemo`: a requestAnimationFrame loop that
damps pointer position toward a target and writes CSS custom properties (`--pointer-x`, `--pointer-y`,
`--rotate-x`, `--rotate-y`, `--background-x/y`, `--pointer-from-center`, …) onto the wrapper. All the
visual work (shine, glare, grain, inner gradient, behind-glow) lives in the CSS file, sized in `cqw`
units, so the card scales with its container. Props of note: `enableTilt`, `behindGlowEnabled`,
`mobileTiltSensitivity` (declared but unused — tilt uses pointer events, which do not fire on touch
without a preceding tap), and the two callbacks `onContactClick` / `onInstaClick`. Exported as
`React.memo`.

### `src/components/AnimatedContent.tsx` (116 lines)

GSAP wrapper: sets the child off-axis, then plays a timeline when a `ScrollTrigger` (`once: true`,
`threshold = 0.1`) fires, with optional auto-disappearance after `disappearAfter` seconds. Props
include `distance`, `direction`, `reverse`, `duration`, `ease`, `scale`, `delay`. Registers
`ScrollTrigger` at module load.

### `src/components/LightRays.tsx` (271 lines) + `LightRays.css` (10 lines)

The OGL shader background (6.8). The fragment shader is a `rayStrength()` function summed over two
seeds, with per-channel brightness falloff, optional noise and saturation, and mouse-directed ray
bending. The CSS file simply makes the container a fixed, full-viewport, `pointer-events: none`,
`z-index: 0` block on `#050505`.

### `src/components/Lightbox.tsx` (291 lines)

The photo viewer (6.6). Keeps `scale`, `pos`, `isDragging` state plus refs for mouse-down / drag-start /
pinch state. Metadata is rendered by the small local `MetadataRow` component. Zoom is clamped 1–5×.
`photo` may be `null`, in which case the component returns `null` (it is conditionally rendered by
`App.tsx` anyway).

### `src/components/GradualBlur.tsx` (90 lines)

Six memoised blur layers with a linear mask, plus a graded vignette (6.8). Exported as `React.memo`.

### `src/components/PerfCounter.tsx` (105 lines)

The HUD (6.8). Samples frame timing on a `requestAnimationFrame` loop, updates 5×/second, and derives
the displayed CPU/GPU figures from frame lag and FPS. Leave it hidden if you do not want the loop
running.

### `src/components/ErrorBoundary.tsx` (51 lines)

Class error boundary with a readable fallback panel (6.11).

### Config files

| File | Purpose |
| --- | --- |
| `vite.config.ts` | React plugin, `base: '/portfolio/'`, `.glb` in `assetsInclude` (no longer used), dev server `host: true` + polling watcher |
| `tailwind.config.js` | Legacy-style content globs and the `Lexend` sans font family |
| `postcss.config.js` | `@tailwindcss/postcss` + `autoprefixer` |
| `eslint.config.js` | Flat config: `js.recommended`, `tseslint.recommended`, `react-hooks` flat recommended, `react-refresh` vite preset, browser globals |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | Project references; the app config is strict with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` |
| `.github/workflows/deploy.yaml` | Build + deploy to Pages (section 10) |

---

## 8. Photo data and the image pipeline

`photos.json` is the only source of truth. `App.tsx` normalises it into the shape the components
consume:

```ts
// src/App.tsx — allPhotos
{
  ...raw,
  thumbSrc: raw.url_thumb || raw.url_medium,  // not used by the grid today
  gridSrc:  raw.url_medium,                  // masonry + WebGL textures + mobile lightbox
  editedSrc: raw.url_large,                  // desktop lightbox
  dateCaptured: raw.date || 'Unknown',       // Lightbox "Date" row
  shutterSpeed: raw.shutter,                 // Lightbox "Shutter" row
}
```
…then sorted newest-first by `new Date(dateCaptured)`.

Files live in `public/optimized2/<category>/<size>/<name>.webp`:

| Folder | Files | Average size |
| --- | --- | --- |
| `thumb/` | 1 per photo | smallest; generated but not currently referenced by any component (`thumbSrc` is computed and unused) |
| `medium/` | 1 per photo | roughly 40–60 KB; this is what the grid and the 3D wall render |
| `large/` | 1 per photo | full resolution; only the desktop Lightbox uses it |

The `public/` paths in `photos.json` already include the `/portfolio/` base prefix and are used as
plain `<img src>` strings, so they are **not** rewritten by Vite. If the site ever moves to a different
base path, both `vite.config.ts` and every URL in `photos.json` must change together.

Counts at the time of writing: 284 photos — `animals` 56, `misc` 97, `people` 103, `panos` 28 —
852 files in total (3 renditions each). `public/og-image.png` (256 KB) is the social preview image;
`public/og-image.webp` (5.3 MB) is a much larger WebP variant that is not referenced anywhere in the
HTML and is therefore shipped unused into `dist/`.

---

## 9. Performance notes

Things that are already handled, so you do not re-solve them:

1. **The canvas is unmounted** outside `Home` / `About Me` (5.2), which releases the WebGL context.
2. **Phones land on the masonry grid** instead of the sphere (5.4).
3. **One texture per photo, at `medium` resolution**, cached by `useTexture` (drei caches by URL).
4. **Pooled scratch objects** in `Wall3d.tsx` avoid per-frame allocation for 284 cards.
5. **Hidden cards are unmounted**, not rendered transparent.
6. **`LightRays` renderer is created only when visible** and is torn down with `WEBGL_lose_context`.
7. **Card tilt and hover magnification are disabled without a hover-capable pointer**, which also
   avoids a pointless spring animation loop on touch devices.
8. **`PerfCounter` does no sampling while hidden.**

Known remaining costs, in priority order:

1. **One JavaScript bundle, no code splitting.** The production build emits a single ~1.64 MB JS file
   (~470 KB gzipped), and it includes `three`/`drei` because `Wall3d` is a static import in `App.tsx`.
   A phone that never opens `Home` still downloads all of it. Converting `Wall3d` to
   `React.lazy()` + `Suspense` is the obvious next win.
2. **`public/og-image.webp`** is 5.3 MB and unreferenced; deleting it shrinks the deployed artifact.
3. **`public/optimized2/*/large`** is only needed for the desktop Lightbox but is deployed as-is.
4. The WebGL wall uploads 284 medium textures at once when it mounts, so the first `Home` visit on a
   slow connection shows a burst of network activity and the intro animation may start before textures
   finish. `Suspense fallback={null}` inside the canvas means you see the black void during that gap.

---

## 10. Deployment

`.github/workflows/deploy.yaml` runs on every push to `main`:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with Node 20 and npm caching
3. `npm install` — note: **not `npm ci`**, because the lockfile currently fails the stricter `ci` check
4. `npm run build` — this is `vite build` only, **there is no type check or lint step in CI**, so the
   errors in 11.1 and 11.2 do not block a deploy
5. `actions/upload-pages-artifact@v3` with `path: ./dist`
6. `actions/deploy-pages@v4`, publishing to the `github-pages` environment

Expected live URL: <https://tacturnity.github.io/portfolio/> (also declared in `package.json`
`homepage` and in the `og:` meta tags in `index.html`).

Vite rewrites the favicon to `/portfolio/vite.svg` in the built HTML, so the base path is applied
consistently for bundled assets and `public/` files.

---

## 11. Known issues and gotchas

Read this before you start editing; most of these are pre-existing and none of them block a deploy.

### 11.1 The type check fails (and CI does not run it)

`npx tsc --noEmit -p tsconfig.app.json` reports roughly 30 errors on a clean checkout. The ones in
`App.tsx` and `Header.tsx`:

| Error | Where | Reality |
| --- | --- | --- |
| TS6133 `'setEnableCrop' / 'setEnablePanoSpan' is declared but never read` | `App.tsx` | Real: the crop/pano features have no UI (11.6) |
| TS6133 `'event' is declared but never read` | `App.tsx`, both `onDragEnd` handlers | Cosmetic; rename to `_event` to silence |
| TS6133 title spring props never read | `Header.tsx` | `App.tsx` passes them, `Header` ignores them |
| TS2339 `Property 'gridSrc' does not exist on type 'Photo'` | `Lightbox.tsx:198` | Real drift, see 11.4 |
| TS7006 implicit `any` on `max` / `i` | `Masonry.tsx:91` | Cosmetic, add types |
| TS2322 variants not assignable to `Variants` | `Masonry.tsx:166` | Framer Motion typings dislike the `transition` union; runtime is fine |

`npm run build` runs `vite build` only and **succeeds**, and the deploy workflow does not type check,
so these errors have never blocked shipping. Fix them opportunistically rather than all at once.

### 11.2 ESLint exits non-zero

`npm run lint` reports 71 problems (68 errors, 3 warnings). The overwhelming majority are
`@typescript-eslint/no-explicit-any` in `Wall3d.tsx`, which is written with `any` props deliberately.
There is also a `react-hooks/set-state-in-effect` error in `Wall3d.tsx` around line 647, where
`setExplodeAmt(1)` is called inside an effect — that call is intentional (it mirrors the ref on frame
one, and the comment says so), but the rule cannot know that. Two of the errors are auto-fixable.

### 11.3 `npm ci` fails, so use `npm install`

`npm ci` errors with peer-dependency resolution (`ERESOLVE`, React 18 vs 19 conflicts pulled in through
`leva` → Radix UI). The lockfile is also not perfectly in sync with `package.json`. `npm install`
works. If you want `ci` back, either drop the unused `leva` dependency or add an npm `overrides` entry
for the conflicting Radix packages. Never "fix" this by deleting `package-lock.json` and redeploying
without checking the resulting build.

### 11.4 `types.ts` does not describe `photos.json`

The raw records use `date` and `shutter`, and carry `url_thumb` / `url_medium` / `url_large`;
`src/types.ts` declares `dateCaptured`, `shutterSpeed`, `editedSrc`, plus `gridSrc`/`thumbSrc` that do
not exist in either place. `App.tsx` bridges the two by mapping fields, which is why `Lightbox.tsx`
compiles only if you ignore its one type error. If you ever type `photos.json` properly, do it here
first and keep the mapping in `App.tsx` as the single normalisation point.

### 11.5 Placeholder content in About

`About.tsx` sets `window.location.href = "mailto:[EMAIL]"`. That is a literal placeholder — the eBird
button currently opens a mail client with an invalid address. The visible copy on the page
(`pimpilinpausa`, `COMERA GO BEEP BOOP`, `very bad typos`, `studnet`, `idk`) is intentional joke copy,
not a typo to fix; change it only if the owner asks.

### 11.6 Disabled features

`enableCrop` and `enablePanoSpan` are wired all the way through both surfaces but nothing sets them
(5.5). Photos are therefore shown at their natural aspect ratio and panos are not stretched across the
grid.

### 11.7 Magic numbers shared between files

Some layout values must match in two places: the `pt-[148px] md:pt-[272px]` / `px-4 md:px-8` padding in
`App.tsx` and the `topPadding`/`leftPadding` in `Wall3d.tsx` (6.4, and the note in section 7). The
`md:` breakpoint (768 px) and the `< 1024` / `< 1500` thresholds are repeated in `Masonry.tsx`,
`Wall3d.tsx`, `Lightbox.tsx`, `LightRays.tsx`, `TextPressure.tsx` and `App.tsx`. If you centralise
these, do it as a small constants module and check every call site — the WebGL and DOM grids must agree
exactly or the transition will land cards in the wrong place.

### 11.8 Debug instrumentation is left on

The 30-frame telemetry logging in `Wall3d.tsx` and the `[Lifecycle]` console logs in both `App.tsx`
and `Wall3d.tsx` run in production. They are diagnostic, not part of any feature. In development,
`<StrictMode>` makes each mount log twice, which is expected and not a bug.

### 11.9 No tests, no visual regression harness

There is no test runner, no snapshot tooling and no CI check beyond "does it build". For a change to
transitions, the practical verification loop is `npm run build` + `npm run preview` + a real browser at
a phone viewport and a desktop viewport, watching the console for the lifecycle and tab-change logs
(section 13).

### 11.10 The category branch inside `Wall3d.tsx` is unreachable

`Wall3d.tsx` contains a complete second layout: when `wallState` is a category name it packs cards into
the in-canvas equivalent of the masonry grid, filtered to that category (using the shared
`computeMasonryLayout`, plus the DOM padding values mentioned in 11.7). **No code path can reach it.**
Every `setWallState` call in `App.tsx` passes only `'About Me'` or `'Home'`; the category path was used
by an earlier design where the wall itself performed the grid transition, and the DOM `Masonry` surface
replaced it. Treat it as dead code: useful as a reference, but do not assume it is exercised or tested,
and do not describe it as current behaviour. If you re-enable it, verify the padding constants still
match `App.tsx` and that `enableCrop` / `enablePanoSpan` are passed through consistently.

---

## 12. How to add a photo or a tab

### Adding a photo

1. Export three WebP renditions and drop them in
   `public/optimized2/<category>/thumb|medium|large/`, using the same file name for all three.
2. Append a record to `src/photos.json` with absolute public paths (including `/portfolio/`), the
   source `width`/`height`, and `id` set to a value not already used.
3. Nothing else — `App.tsx` normalises the record, the grid re-packs, the sphere re-distributes, and
   the `ROACH` band assignment re-runs on the next load.

Watch out for two things: the `id` must be unique (it is the React key and the masonry slot key), and
`width`/`height` must be the real source dimensions or aspect ratios will be wrong in both surfaces.
Because `App.tsx` sorts by date descending, an old date places the photo far down the list.

### Adding a tab

1. Append the name to `NAV_ITEMS` in `App.tsx`.
2. If it is a photo category, make sure `photo.category` in `photos.json` matches the name
   case-insensitively; `filteredPhotos` compares lowercased values.
3. If the tab needs a new surface, remember the places that classify tabs: the transition branches
   in `handleViewChange` and the two `['Home', 'About Me'].includes(wallState)` checks in `Wall3d.tsx`
   (the latter are unreachable today — 11.10).
4. Re-check the dock: seven items already scroll on a phone, and each `DockItem` measures itself, so
   more items cost layout work on every transition.

### Changing the mobile landing tab

Edit `MOBILE_LANDING_VIEW` (and/or `MOBILE_BREAKPOINT`) in `src/App.tsx`. Valid values are any entry in
`NAV_ITEMS`. Choosing a category lands on the cheap masonry grid; choosing `Home` or `About Me` lands
on the WebGL sphere, which defeats the purpose on a phone.

---

## 13. Console logs cheat sheet

Everything below is printed to the browser console at runtime and is the fastest way to confirm what
the app is actually doing:

| Log | Emitted by | Meaning |
| --- | --- | --- |
| `[Lifecycle] App: Wall3D MOUNTED / UNMOUNTED (isCanvasMounted=…)` | `App.tsx` | Whether a `<Canvas>` is in the React tree |
| `[Lifecycle] Wall3D MOUNTED / UNMOUNTED` | `Wall3d.tsx` | The canvas component itself mounting / unmounting |
| `[Lifecycle] PackedWall (Canvas scene) MOUNTED / UNMOUNTED` | `Wall3d.tsx` | The scene inside the canvas; proves the 3D content was really torn down |
| `[Tab Change] { from, to, wallState }` | both | A tab transition starting, logged from the app state and from the wall state separately. If the two disagree, that is the source of a desync |
| `[Telemetry] capture started — <reason>` / `[Telemetry] frame N` / `[Telemetry] capture complete (30 frames)` | `Wall3d.tsx` | Per-frame position, target and camera for one tracked card during an entrance or transition. Use it when a card lands in the wrong place |
| `Uncaught rendering error: …` | `ErrorBoundary.tsx` | A subtree threw; the fallback panel is now on screen |

A quick sanity check on the two landing modes, in a real browser with the console open:

- Phone viewport (< 768 px), load the page → the dock shows **All Work** selected, `main` has
  `opacity-100`, and you see `App: Wall3D UNMOUNTED (isCanvasMounted=false)` with no
  `Wall3D MOUNTED` line.
- Desktop viewport, load the page → the dock shows **Home**, and you see
  `Wall3D MOUNTED` → `App: Wall3D MOUNTED (isCanvasMounted=true)` → `PackedWall (Canvas scene) MOUNTED`.
