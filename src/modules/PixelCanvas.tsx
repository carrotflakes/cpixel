import { useEffect, useRef } from 'react'
import { usePixelStore, WIDTH, HEIGHT, MIN_SIZE, MAX_SIZE } from './store'
import { compositeImageData } from './utils/composite'
import { drawBorder, drawChecker, drawGrid, drawHoverCell, drawShapePreview, ensureHiDPICanvas, getCheckerPatternCanvas } from './utils/canvasDraw'
import { useCanvasInput } from './hooks/useCanvasInput'

export function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { hoverCell, shapePreview, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onWheel, onTouchStart, onTouchMove, onTouchEnd } = useCanvasInput(canvasRef)
  const size = usePixelStore(s => s.pixelSize)
  const layers = usePixelStore(s => s.layers)
  const mode = usePixelStore(s => s.mode)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const viewX = usePixelStore(s => s.viewX)
  const viewY = usePixelStore(s => s.viewY)
  const setPixelSizeRaw = usePixelStore(s => s.setPixelSizeRaw)
  const setView = usePixelStore(s => s.setView)

  const scaledW = WIDTH * size
  const scaledH = HEIGHT * size
  // cache small helper canvases
  const checkerTileRef = useRef<HTMLCanvasElement | null>(null)
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null)

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
    const cw = WIDTH * size
    const ch = HEIGHT * size
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

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d', { willReadFrequently: true })!
    ensureHiDPICanvas(cvs, ctx)
    // translate to current view (rounded for crisper grid in CSS px space)
    const vx = Math.round(viewX)
    const vy = Math.round(viewY)
    // draw checkerboard in screen space so it doesn't follow pan/zoom (cached tile)
    if (!checkerTileRef.current) checkerTileRef.current = getCheckerPatternCanvas(12)
    drawChecker(ctx, vx, vy, scaledW, scaledH, checkerTileRef.current)
    // now translate for drawing content and grid
    ctx.translate(vx, vy)
    // draw bitmap on top (alpha respected)
    const img = compositeImageData(layers, mode, palette, transparentIndex, ctx, WIDTH, HEIGHT)
    if (!tmpCanvasRef.current) {
      const t = document.createElement('canvas')
      t.width = WIDTH
      t.height = HEIGHT
      tmpCanvasRef.current = t
    } else if (tmpCanvasRef.current.width !== WIDTH || tmpCanvasRef.current.height !== HEIGHT) {
      tmpCanvasRef.current.width = WIDTH
      tmpCanvasRef.current.height = HEIGHT
    }
    tmpCanvasRef.current.getContext('2d')!.putImageData(img, 0, 0)
    ctx.drawImage(tmpCanvasRef.current, 0, 0, WIDTH, HEIGHT, 0, 0, scaledW, scaledH)

    // border and grid
    drawBorder(ctx, scaledW, scaledH)
    drawGrid(ctx, WIDTH, HEIGHT, size)
    // hover highlight
    if (hoverCell && hoverCell.x >= 0 && hoverCell.y >= 0 && hoverCell.x < WIDTH && hoverCell.y < HEIGHT) {
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
  }, [layers, palette, mode, transparentIndex, size, viewX, viewY, hoverCell?.x, hoverCell?.y, shapePreview.kind, shapePreview.curX, shapePreview.curY])

  return (
  <div className="w-full h-full bg-surface-muted">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="w-full h-full block shadow rounded touch-none cursor-crosshair focus:outline-2 focus:outline-blue-500"
        tabIndex={0}
        aria-label="Pixel canvas"
      />
    </div>
  )
}

// color helpers moved to utils/color
