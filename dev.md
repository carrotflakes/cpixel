# cpixel – Developer Notes

This document captures the current state of the project, key design decisions, and practical guidance for future development.

## Overview
- Goal: Simple pixel-art editor built on the same stack style as cpaint.
- Current status: Minimal but solid editor with draw/erase, pan/zoom (mouse + touch), transparent checker, PNG export.

## Tech stack
- Vite + React + TypeScript
- Tailwind CSS v4 (plugin: `@tailwindcss/vite`)
- Zustand for state management
- Canvas 2D rendering (DPR-aware)
- Package manager: pnpm

Conventions
- Strongly-typed, immutable updates (clone arrays before writing)
- English for comments, docs, and UI
- Performance matters: avoid unnecessary re-renders and heavy allocations in hot paths

## Key files
- `src/modules/store.ts` – Global state (pixels, color, view, pixel size, actions)
- `src/modules/PixelCanvas.tsx` – Canvas rendering and interactions
- `src/modules/TopBar.tsx` – Header UI (color, clear, export)

## State model (store)
- Canvas size: `WIDTH = 64`, `HEIGHT = 64`
- Pixel buffer: `Uint32Array(WIDTH*HEIGHT)` with RGBA packed as `0xRRGGBBAA`
- View:
  - `pixelSize: number` – CSS px per pixel (may be fractional during pinch)
  - `viewX, viewY: number` – CSS px offsets for the top-left of the pixel content
- Actions:
  - `setAt(x, y, rgba)` – immutable write to a new `Uint32Array`
  - `setPixelSize(n)` – clamps and rounds to an integer (wheel-driven)
  - `setPixelSizeRaw(n)` – clamps without rounding (pinch-driven)
  - `setView(x, y)`, `panBy(dx, dy)`
  - `clear()`, `exportPNG()`

Limits and defaults
- `MIN_SIZE = 4`, `MAX_SIZE = 40`, default `pixelSize = 10`

## Rendering pipeline (PixelCanvas)
- DPR-aware backing store sizing: `canvas.width/height = CSS * devicePixelRatio`
- Reset transform, clear, then `scale(dpr, dpr)`; `imageSmoothingEnabled = false`
- Checkerboard:
  - Drawn in screen space (before translating to view) to ensure it does not follow pan/zoom
  - Filled via a small pattern canvas tiled over the pixel content rect
- Translate by rounded view: `vx = round(viewX)`, `vy = round(viewY)` for crisp grid/border
- Draw the pixel data:
  - Compose `ImageData(WIDTH, HEIGHT)` from the `Uint32Array`
  - Put onto a temp canvas, then `drawImage` scaled to `scaledW = WIDTH*pixelSize`, `scaledH = HEIGHT*pixelSize`
- Border and grid:
  - 1px border with 0.5 offset
  - Grid lines at `x*pixelSize + 0.5`, `y*pixelSize + 0.5`

Notes
- Fractional `pixelSize` is supported (from pinch). At some scales the grid may look softer; this is acceptable.
- Rounding `viewX/Y` helps keep strokes and the grid visually crisp at common zoom levels.

## Interaction model
Mouse
- Left button: draw; Right button: erase
- Middle button drag: pan
- Wheel: zoom in/out anchored to cursor
  - Uses integer-stepped sizes via `setPixelSize()`

Touch
- Single finger: draw with tap/hold/move-threshold semantics
  - Tap: draw one pixel on release if no hold/move occurred
  - Hold: start drawing after `TOUCH_HOLD_MS` (150ms)
  - Move: if movement exceeds `TOUCH_MOVE_PX` (8px), start continuous drawing
- Two fingers: pan + pinch zoom
  - Pinch zoom uses `setPixelSizeRaw()` for fractional sizes
- Multi-touch guard: any two-finger interaction cancels tap/hold drawing and prevents a tap on lift

CSS/DOM
- Canvas has `touch-action: none` via Tailwind’s `touch-none` utility to allow proper gesture handling
- Context menu disabled to allow right-click erase

## Tunables (current values)
- Canvas: `WIDTH = 64`, `HEIGHT = 64`
- Pixel size: `MIN_SIZE = 4`, `MAX_SIZE = 40`, default `10`
- Touch: `TOUCH_HOLD_MS = 150`, `TOUCH_MOVE_PX = 8`

If you need to expose these as settings later, prefer keeping store constants as the single source of truth.

## Gotchas and best practices
- Checkerboard must NOT follow pan or zoom; draw it in screen space before translating
- Keep `imageSmoothingEnabled = false` to preserve sharp pixels
- When changing pixel size:
  - Use `setPixelSizeRaw()` for continuous gestures (pinch)
  - Use `setPixelSize()` for discrete inputs (wheel, buttons) to keep integer steps
- Always clamp sizes to `[MIN_SIZE, MAX_SIZE]`
- Round `viewX/viewY` when applying the canvas transform to keep 1px lines aligned
- Avoid frequent allocations inside hot pointer/touch move loops (reuse refs/objects)
- Immutable pixel writes: copy the `Uint32Array` before modifying

## Potential improvements (future work)
- Initial centering: on first mount, center the content in the viewport
- View clamping: optionally constrain panning so content stays near view
- Performance: cache the checker pattern canvas across frames; reuse temp canvases
- Persistence: localStorage or file open/save for projects
- Keyboard shortcuts: pan/zoom, undo/redo, color picker, etc.
- ESLint/Prettier alignment (optional; test coverage not required for now)

## Changelog (high level)
- Scaffolded Vite + React + TS + Tailwind + Zustand project
- Implemented pixel buffer with immutable updates and export to PNG
- Canvas rendering with DPR handling and a fixed-in-screen checkerboard
- Grid and border rendering aligned to half-pixels for crispness
- Mouse: draw/erase, middle-button pan, wheel zoom (integer steps)
- Touch: single-finger draw with tap/hold/move threshold; two-finger pan+pinch
- Prevent accidental taps during two-finger gestures
- Removed pixel size control from header; wheel/pinch control zoom
- Pinch zoom allows fractional pixel sizes (wheel remains integer)

## Notes for contributors
- Use pnpm for installing and running scripts
- Follow existing code style and the patterns in `store.ts` and `PixelCanvas.tsx`
- Keep comments and docs in English
- Prefer small, focused components and immutable updates

## Roadmap

This roadmap is organized by phases. Each phase can be split into small PRs.

Phase 1 – Core editor polish (UX/stability)
- Initial centering and sane defaults: center content on first mount; remember last view in sessionStorage
- Cursor feedback: show crosshair; change cursor on pan (grabbing) and erase (contextmenu/right-button)
- View limits: optional soft clamping to keep canvas near viewport; inertial panning off by default
- Performance micro-opts: cache checker pattern; reuse temp canvases; avoid re-creating ImageData each frame when unchanged
- Accessibility: keyboard focus ring on canvas; ARIA labels for header buttons

Phase 2 – Drawing tools and ergonomics
- Eyedropper: press and hold a modifier (e.g., Alt/Ctrl) to pick color from canvas
- Line/Rectangle/Ellipse tools (pixel-perfect Bresenham variants); fill tool (flood fill)
- Brush preview: hover cell highlight and active tool preview
- Undo/Redo: history stack (bounded), coalesce strokes; keyboard shortcuts (Ctrl/Cmd+Z/Y)
- Color palette: swatches, add/remove, recent colors

Phase 2b – Color management: Indexed + Truecolor (dual-mode)
- Store: add `colorModel: 'truecolor' | 'indexed'`, keep RGBA buffer; add index buffer + palette
- Rendering: in `indexed` mode map indices → RGBA; cache by palette version
- Tools: draw/eyedropper operate on indices in indexed mode; fill/line/shape work with indices
- Palette UI: add/remove/reorder, set color, import/export; alpha supported
- Conversion: truecolor→indexed (simple quantize first), indexed→truecolor (expand)
- I/O: PNG stays RGBA; project JSON includes `{ mode, palette, pixels }`
- Limits: `MAX_COLORS` (e.g., 16/32/64/256)

Phase 3 – File I/O and persistence
- Local persistence: autosave latest canvas to localStorage
- Import/Export: PNG import (reads pixels into buffer), JSON project format (pixels + metadata)
- Share: copy PNG to clipboard (Clipboard API) with fallback download

Phase 4 – Layers and blending (lightweight)
- Single background layer + one drawable layer to start; later N layers
- Layer operations: add/remove/reorder, toggle visibility, opacity per layer

Phase 5 – UI/Workflow
- Toolbar component with tools and active-state management
- Status bar: zoom %, cursor pixel coordinates, color under cursor
- Settings panel: tweak MIN/MAX size, grid visibility, checker tile size
- Mobile UX: larger hit targets, long-press durations configurable

Phase 6 – Quality & tooling
- ESLint + Prettier setup aligned with cpaint conventions
- Vitest for small utility tests (color parse/pack, flood fill, line rasterization)
- Playwright happy-path smoke tests (load, draw pixel, export)

Phase 7 – Advanced (optional)
- Tile mode (repeat preview), symmetry drawing (X/Y mirror)
- Animation/timelapse capture of strokes
- Export spritesheet and GIF with frame timing

Implementation notes
- Maintain the non-scaling checker; all layers/tools should render after translating to view
- Keep pixel math integer-stable; prefer rounding view before drawing borders/grids
- Coalesce store updates within a frame (e.g., requestAnimationFrame) for heavy tools

## Cross-device support (PC / Phone / Tablet)

Input
- Pointer Events already unify mouse/touch; continue to use `touch-action: none` on the canvas to own gestures
- Desktop: wheel zoom + middle-button pan; consider Ctrl+left-drag pan for trackpads without middle button
- Mobile/Tablet: one-finger draw (tap/hold/move), two-finger pan+pinch; avoid accidental taps during multi-touch (implemented)

Responsive UI
- Header buttons get larger hit targets on small screens (min 40–48px touch area)
- Optional compact toolbar for tools; collapsible panels on narrow widths
- Status indicators (zoom %, coords) adapt to smaller screens (icons over text)

Performance
- Keep allocations low in move handlers; reuse canvases (done for checker/tmp)
- Test on mid-range Android/iOS devices; aim for 60fps during pan/zoom/draw

Platform nuances
- iOS Safari: verify passive listeners aren’t required where `preventDefault()` is called; keep viewport meta to prevent zoom on inputs
- Android Chrome: ensure pinch works consistently with two-finger gestures
- Desktop trackpads: consider smooth wheel deltas and fractional zoom steps if desired

Roadmap additions
- Add trackpad-friendly pan alternative (e.g., Space+drag or Ctrl+drag)
- Mobile-friendly tool switching UI and quick color swatches
- Per-device tuning for touch thresholds (hold/move) and hit targets

