import { useEffect, useRef, useState } from 'react'
import { useTilt } from './hooks/useTilt'
import { useCanvasInput } from './hooks/useCanvasInput'
import { usePixelStore } from './store'
import { useSettingsStore } from './settingsStore'
import { drawBorder, drawChecker, drawGrid, drawHoverCell, drawSelectionOverlay, drawShapePreview, ensureHiDPICanvas, getCheckerPatternCanvas } from './utils/canvasDraw'
import { compositeImageData } from './utils/composite'

const GRID_THRESHOLD = 8

export function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { hoverCell, shapePreview, interactionActive, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onTouchStart, onTouchMove, onTouchEnd } = useCanvasInput(canvasRef)
  const view = usePixelStore(s => s.view)
  const W = usePixelStore(s => s.width)
  const H = usePixelStore(s => s.height)
  const layers = usePixelStore(s => s.layers)
  const mode = usePixelStore(s => s.mode)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const checkerSize = useSettingsStore(s => s.checkerSize)
  const tiltEnabled = useSettingsStore(s => s.tiltParallaxEnabled)
  const tiltTrigger = useSettingsStore(s => s.tiltParallaxTrigger)
  const setView = usePixelStore(s => s.setView)
  const selectionMask = usePixelStore(s => s.selectionMask)
  const selectionBounds = usePixelStore(s => s.selectionBounds)
  const selectionOffsetX = usePixelStore(s => s.selectionOffsetX)
  const selectionOffsetY = usePixelStore(s => s.selectionOffsetY)
  const selectionFloating = usePixelStore(s => s.selectionFloating)
  const clearSelection = usePixelStore(s => s.clearSelection)

  const { rotationRate, rotationRateRef, motionPermission, requestMotionPermission } = useTilt({enabled: tiltEnabled})
  const { shiftActive, shiftOffsetRef, shiftTick } = useLayerShift(rotationRate, rotationRateRef, { trigger: tiltTrigger, enabled: tiltEnabled && !interactionActive })

  const scaledW = W * view.scale
  const scaledH = H * view.scale
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

    const rect = cvs.getBoundingClientRect()
    const vw = rect.width
    const vh = rect.height
    const cw = W * view.scale
    const ch = H * view.scale
    const cx = Math.round((vw - cw) / 2)
    const cy = Math.round((vh - ch) / 2)
    setView(cx, cy, view.scale)
    inited.current = true
  }, [view.scale, setView])

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
    const vx = Math.round(view.x)
    const vy = Math.round(view.y)
    // draw checkerboard in content space so it follows pan/zoom (cached tile)
    if (!checkerTileRef.current || checkerTileRef.current.width !== checkerSize * 2) {
      checkerTileRef.current = getCheckerPatternCanvas(checkerSize)
    }
    ctx.translate(vx, vy)

    // If in shift mode, render each layer with offset, suppress overlays
    if (shiftActive) {
      drawChecker(ctx, scaledW, scaledH, checkerTileRef.current, 0, 0, view.scale)
      if (!tmpCanvasRef.current) {
        const t = document.createElement('canvas')
        t.width = W
        t.height = H
        tmpCanvasRef.current = t
      } else if (tmpCanvasRef.current.width !== W || tmpCanvasRef.current.height !== H) {
        tmpCanvasRef.current.width = W
        tmpCanvasRef.current.height = H
      }
      const layerCvs = tmpCanvasRef.current
      const lctx = layerCvs.getContext('2d')!
      // Draw bottom to top: store ordering has top-most first (new added at front) -> reverse
      const order = [...layers].reverse()
      for (let li = 0; li < order.length; li++) {
        const layer = order[li]
        if (!layer.visible) continue
        const single = compositeImageData([layer], mode, palette, transparentIndex, lctx, W, H)
        lctx.putImageData(single, 0, 0)
        const depth = layers.length - layers.findIndex(l => l === layer)
        const dx = -shiftOffsetRef.current.dx * depth / layers.length
        const dy = -shiftOffsetRef.current.dy * depth / layers.length
        const s = view.scale
        ctx.drawImage(layerCvs, 0, 0, W, H, dx * s, dy * s, scaledW, scaledH)
      }
      drawBorder(ctx, scaledW, scaledH)
      return
    }

    // Normal composited rendering
    drawChecker(ctx, scaledW, scaledH, checkerTileRef.current, 0, 0, view.scale)
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
    if (view.scale > GRID_THRESHOLD) {
      drawGrid(ctx, W, H, view.scale)
    }
    // hover highlight
    if (hoverCell && hoverCell.x >= 0 && hoverCell.y >= 0 && hoverCell.x < W && hoverCell.y < H) {
      drawHoverCell(ctx, hoverCell.x, hoverCell.y, view.scale)
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
        view.scale,
      )
    }
    // selection overlay and floating
    if (selectionMask && selectionBounds) {
      drawSelectionOverlay(ctx, selectionMask, W, H, view.scale)
      const dx = (selectionOffsetX ?? 0)
      const dy = (selectionOffsetY ?? 0)
      const s = view.scale
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
  }, [layers, palette, mode, transparentIndex, view, hoverCell?.x, hoverCell?.y, shapePreview.kind, shapePreview.curX, shapePreview.curY, W, H, selectionMask, selectionBounds?.left, selectionBounds?.top, selectionBounds?.right, selectionBounds?.bottom, selectionOffsetX, selectionOffsetY, selectionFloating, antsPhase, resizeTick, checkerSize, shiftActive, shiftTick])

  const overlay = (() => {
    if (shiftActive) return null // hide selection UI in shift mode
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
        onPointerDown={shiftActive ? undefined : onPointerDown}
        onPointerMove={shiftActive ? undefined : onPointerMove}
        onPointerUp={shiftActive ? undefined : onPointerUp}
        onPointerLeave={shiftActive ? undefined : onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={shiftActive ? undefined : onTouchStart}
        onTouchMove={shiftActive ? undefined : onTouchMove}
        onTouchEnd={shiftActive ? undefined : onTouchEnd}
        className="w-full h-full block shadow cursor-crosshair focus:outline-2 focus:outline-blue-500"
        tabIndex={0}
        aria-label="Pixel canvas"
      />
      {overlay}

      {shiftActive && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 px-2 py-1 text-xs bg-surface border border-border rounded shadow pointer-events-none select-none opacity-80">Layer shift</div>
      )}
      {/* Motion permission / enable button (iOS) */}
      {tiltEnabled && motionPermission === 'prompt' && (
        <button
          onClick={requestMotionPermission}
          className="absolute top-2 left-2 z-30 px-2 py-1 text-[11px] bg-blue-600 text-white rounded shadow active:scale-[0.97]"
        >Enable Motion</button>
      )}
      {motionPermission === 'denied' && (
        <div className="absolute top-2 left-2 z-30 px-2 py-1 text-[11px] bg-red-600 text-white rounded shadow">Motion denied</div>
      )}
      {/* Debug tilt info */}
      {false && (<div className="absolute bottom-8 left-2 max-w-[240px] whitespace-pre pointer-events-none text-[10px] leading-tight font-mono bg-surface/80 backdrop-blur border border-border rounded p-2 select-none">
        <div className="opacity-70">Tilt Debug</div>
        <div>rot α: {rotationRate.alpha !== undefined ? rotationRate.alpha.toFixed(1) : '-'} deg/s</div>
        <div>rot β: {rotationRate.beta !== undefined ? rotationRate.beta.toFixed(1) : '-'} deg/s</div>
        <div>rot γ: {rotationRate.gamma !== undefined ? rotationRate.gamma.toFixed(1) : '-'} deg/s</div>
        {/* orientation velocity removed */}
        <div>shift: {shiftActive ? 'ON' : 'off'}</div>
        <div>layers: {layers.length}</div>
        <div>perm: {motionPermission}</div>
        <div>off: {shiftOffsetRef.current.dx.toFixed(2)},{shiftOffsetRef.current.dy.toFixed(2)}</div>
      </div>)}
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

function useLayerShift(
  rotationRate: { alpha: number; beta: number; gamma: number },
  rotationRateRef: React.RefObject<{ alpha: number; beta: number; gamma: number }>,
  options?: {
    trigger?: number
    damping?: number
    amount?: number
    enabled?: boolean
  }
) {
  const ENABLED = options?.enabled ?? true
  const SHIFT_TRIGGER = options?.trigger ?? 180
  const STOP_ROTATION = SHIFT_TRIGGER * 0.25
  const DAMPING = options?.damping ?? 0.001
  const MIN_MAG = 1.0
  const AMOUNT = options?.amount ?? 0.5

  const [shiftActive, setShiftActive] = useState(false)
  const shiftOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const [shiftTick, setShiftTick] = useState(0)
  const rafShift = useRef<number>(0)

  const dampLoop = useRef<() => void>(() => { })
  dampLoop.current = () => {
    const time = performance.now()
    rafShift.current = requestAnimationFrame(() => {
      setShiftTick(t => t + 1)

      const elapsed = performance.now() - time
      const dt = elapsed / 1000

      const { beta, alpha } = rotationRateRef.current
      let { dx, dy } = shiftOffsetRef.current
      dx += beta * AMOUNT * dt
      dy += alpha * AMOUNT * dt

      const damp = Math.pow(DAMPING, dt)
      dx *= damp
      dy *= damp

      // Stop
      if (Math.abs(dx) + Math.abs(dy) < MIN_MAG && Math.abs(beta) + Math.abs(alpha) < STOP_ROTATION) {
        shiftOffsetRef.current = { dx: 0, dy: 0 }
        setShiftActive(false)
        rafShift.current = 0
        return
      }

      shiftOffsetRef.current = { dx, dy }
      dampLoop.current()
    })
  }

  // Trigger on threshold crossing when inactive
  useEffect(() => {
    if (!ENABLED) return
    if (shiftActive) return
    const { alpha = 0, beta = 0 } = rotationRate
    if (Math.abs(alpha) + Math.abs(beta) < SHIFT_TRIGGER) return

    setShiftActive(true)
    if (!rafShift.current) dampLoop.current()
    setShiftTick(0)
  }, [rotationRate.alpha, rotationRate.beta, shiftActive, SHIFT_TRIGGER, ENABLED])

  useEffect(() => () => { if (rafShift.current) cancelAnimationFrame(rafShift.current) }, [])

  return { shiftActive, shiftOffsetRef, shiftTick }
}
