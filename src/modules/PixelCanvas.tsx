import { useEffect, useRef, useState } from 'react'
import { usePixelStore, MIN_SIZE, MAX_SIZE } from './store'
import { compositeImageData } from './utils/composite'
import { drawBorder, drawChecker, drawGrid, drawHoverCell, drawShapePreview, ensureHiDPICanvas, getCheckerPatternCanvas, drawSelectionOverlay } from './utils/canvasDraw'
import { useCanvasInput } from './hooks/useCanvasInput'

export function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { hoverCell, shapePreview, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onTouchStart, onTouchMove, onTouchEnd } = useCanvasInput(canvasRef)
  const size = usePixelStore(s => s.pixelSize)
  const W = usePixelStore(s => s.width)
  const H = usePixelStore(s => s.height)
  const layers = usePixelStore(s => s.layers)
  const mode = usePixelStore(s => s.mode)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const viewX = usePixelStore(s => s.viewX)
  const viewY = usePixelStore(s => s.viewY)
  const setPixelSizeRaw = usePixelStore(s => s.setPixelSizeRaw)
  const setView = usePixelStore(s => s.setView)
  const selectionMask = usePixelStore(s => s.selectionMask)
  const selectionBounds = usePixelStore(s => s.selectionBounds)
  const selectionOffsetX = usePixelStore(s => s.selectionOffsetX)
  const selectionOffsetY = usePixelStore(s => s.selectionOffsetY)
  const selectionFloating = usePixelStore(s => s.selectionFloating)
  const clearSelection = usePixelStore(s => s.clearSelection)

  const scaledW = W * size
  const scaledH = H * size
  // cache small helper canvases
  const checkerTileRef = useRef<HTMLCanvasElement | null>(null)
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const floatCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [antsPhase, setAntsPhase] = useState(0)
  const resizeTick = useWindowResizeRedraw()

  // One-time init: restore previous view/zoom or center initially
  const inited = useRef(false)
  useEffect(() => {
    if (inited.current) return
    const cvs = canvasRef.current
    if (!cvs) return
    // try restore from session
    try {
      const raw = sessionStorage.getItem('cpixel:view')
      if (raw) {
        const saved = JSON.parse(raw) as { size: number; viewX: number; viewY: number } | null
        if (saved && isFinite(saved.size) && isFinite(saved.viewX) && isFinite(saved.viewY)) {
          const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
          const s = clamp(saved.size, MIN_SIZE, MAX_SIZE)
          setPixelSizeRaw(s)
          setView(Math.round(saved.viewX), Math.round(saved.viewY))
          inited.current = true
          return
        }
      }
    } catch { }
    // center if no saved state
    const rect = cvs.getBoundingClientRect()
    const vw = rect.width
    const vh = rect.height
    const cw = W * size
    const ch = H * size
    const cx = Math.round((vw - cw) / 2)
    const cy = Math.round((vh - ch) / 2)
    setView(cx, cy)
    inited.current = true
  }, [size, setPixelSizeRaw, setView])

  // Persist view/zoom to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('cpixel:view', JSON.stringify({ size, viewX, viewY }))
    } catch { }
  }, [size, viewX, viewY])

  // Animate marching ants
  useEffect(() => {
    if (!selectionMask || !selectionBounds) {
      setAntsPhase(0)
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = t - last
      if (dt > 80) { setAntsPhase(p => (p + 1) % 1000); last = t }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selectionMask, selectionBounds])

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d', { willReadFrequently: true })!
    ensureHiDPICanvas(cvs, ctx)
    // translate to current view (rounded for crisper grid in CSS px space)
    const vx = Math.round(viewX)
    const vy = Math.round(viewY)
    // draw checkerboard in content space so it follows pan/zoom (cached tile)
    if (!checkerTileRef.current) checkerTileRef.current = getCheckerPatternCanvas(4)
    ctx.translate(vx, vy)
    drawChecker(ctx, scaledW, scaledH, checkerTileRef.current, 0, 0, size)
    // draw bitmap on top (alpha respected)
    const img = compositeImageData(layers, mode, palette, transparentIndex, ctx, W, H)
    if (!tmpCanvasRef.current) {
      const t = document.createElement('canvas')
      t.width = W
      t.height = H
      tmpCanvasRef.current = t
    } else if (tmpCanvasRef.current.width !== W || tmpCanvasRef.current.height !== H) {
      tmpCanvasRef.current.width = W
      tmpCanvasRef.current.height = H
    }
    tmpCanvasRef.current.getContext('2d')!.putImageData(img, 0, 0)
    ctx.drawImage(tmpCanvasRef.current, 0, 0, W, H, 0, 0, scaledW, scaledH)

    // border and grid
    drawBorder(ctx, scaledW, scaledH)
    drawGrid(ctx, W, H, size)
  // hover highlight
    if (hoverCell && hoverCell.x >= 0 && hoverCell.y >= 0 && hoverCell.x < W && hoverCell.y < H) {
      drawHoverCell(ctx, hoverCell.x, hoverCell.y, size)
    }
    // shape preview overlay
    if (shapePreview.kind) {
      drawShapePreview(
        ctx,
        shapePreview.kind,
        shapePreview.startX,
        shapePreview.startY,
        shapePreview.curX,
        shapePreview.curY,
        size,
      )
    }

    // selection overlay and floating
    if (selectionMask && selectionBounds) {
      // Optional: dim outside selection
      drawSelectionOverlay(ctx, selectionMask, W, H, size)
      // Draw marching ants rect at current offset
      const dx = (selectionOffsetX ?? 0)
      const dy = (selectionOffsetY ?? 0)
      const s = size
      const left = (selectionBounds.left + dx) * s + 0.5
      const top = (selectionBounds.top + dy) * s + 0.5
      const width = (selectionBounds.right - selectionBounds.left + 1) * s - 1
      const height = (selectionBounds.bottom - selectionBounds.top + 1) * s - 1
      ctx.save()
      ctx.strokeStyle = '#000'
      ctx.setLineDash([4, 3])
      ctx.lineDashOffset = -antsPhase
      ctx.strokeRect(left, top, width, height)
      ctx.restore()

      // draw floating pixels if any
      if (selectionFloating) {
        const bw = selectionBounds.right - selectionBounds.left + 1
        const bh = selectionBounds.bottom - selectionBounds.top + 1
        if (!floatCanvasRef.current) floatCanvasRef.current = document.createElement('canvas')
        if (floatCanvasRef.current.width !== bw || floatCanvasRef.current.height !== bh) {
          floatCanvasRef.current.width = bw
          floatCanvasRef.current.height = bh
        }
        const fctx = floatCanvasRef.current.getContext('2d')!
        const img = fctx.createImageData(bw, bh)
        const src = selectionFloating
        for (let i = 0, p = 0; i < src.length; i++, p += 4) {
          const rgba = src[i] >>> 0
          img.data[p] = (rgba >>> 24) & 0xff
          img.data[p + 1] = (rgba >>> 16) & 0xff
          img.data[p + 2] = (rgba >>> 8) & 0xff
          img.data[p + 3] = rgba & 0xff
        }
        fctx.putImageData(img, 0, 0)
        ctx.drawImage(floatCanvasRef.current, 0, 0, bw, bh, (selectionBounds.left + dx) * s, (selectionBounds.top + dy) * s, bw * s, bh * s)
      }
    }
  }, [layers, palette, mode, transparentIndex, size, viewX, viewY, hoverCell?.x, hoverCell?.y, shapePreview.kind, shapePreview.curX, shapePreview.curY, W, H, selectionMask, selectionBounds?.left, selectionBounds?.top, selectionBounds?.right, selectionBounds?.bottom, selectionOffsetX, selectionOffsetY, selectionFloating, antsPhase, resizeTick])

  const overlay = (() => {
    if (!selectionMask || !selectionBounds) return null
    return (
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden={false}>
        <button
          onClick={clearSelection}
          className="pointer-events-auto absolute z-20 px-2 py-1 text-xs sm:text-sm bg-surface border border-border rounded shadow hover:bg-surface-muted"
          style={{ left: '50%', top: 12, transform: 'translateX(-50%)' }}
          title="Clear selection"
          aria-label="Clear selection"
        >
          Clear selection
        </button>
      </div>
    )
  })()

  return (
    <div className="relative w-full h-full bg-surface-muted touch-none">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="w-full h-full block shadow cursor-crosshair focus:outline-2 focus:outline-blue-500"
        tabIndex={0}
        aria-label="Pixel canvas"
      />
      {overlay}
    </div>
  )
}

// Custom hook: returns a counter that increments on window resize (RAF-throttled)
function useWindowResizeRedraw() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let raf = 0
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setTick(t => t + 1))
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return tick
}
