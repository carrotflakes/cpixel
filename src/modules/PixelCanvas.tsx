import { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasInput } from './hooks/useCanvasInput'
import { useTilt } from './hooks/useTilt'
import { useSettingsStore } from './settingsStore'
import { useAppStore } from './store'
import { drawBorder, drawGrid, drawHoverCell, drawSelectionOverlay, drawShapePreview, ensureHiDPICanvas, getCheckerCanvas } from './utils/canvasDraw'
import { compositeImageData } from './utils/composite'

const GRID_THRESHOLD = 8

export function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { shapePreview, interactionActive, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave } = useCanvasInput(canvasRef)
  const hover = useAppStore(s => s.hover)
  const view = useAppStore(s => s.view)
  const W = useAppStore(s => s.width)
  const H = useAppStore(s => s.height)
  const layers = useAppStore(s => s.layers)
  const mode = useAppStore(s => s.mode)
  const palette = useAppStore(s => s.palette)
  const transparentIndex = useAppStore(s => s.transparentIndex)
  const brushSize = useAppStore(s => s.brushSize)
  const checkerSize = useSettingsStore(s => s.checkerSize)
  const tiltEnabled = useSettingsStore(s => s.tiltParallaxEnabled)
  const tiltTrigger = useSettingsStore(s => s.tiltParallaxTrigger)
  const tiltAmount = useSettingsStore(s => s.tiltParallaxAmount)
  const tiltAlpha = useSettingsStore(s => s.tiltParallaxAlpha)
  const selection = useAppStore(s => s.selection)
  const shapeFill = useAppStore(s => s.shapeFill)

  const { rotationRate, rotationRateRef, motionPermission, requestMotionPermission } = useTilt({ enabled: tiltEnabled })
  const { active: parallaxActive, shiftOffsetRef, shiftTick } = useTiltParallax(rotationRate, rotationRateRef, { trigger: tiltTrigger, amount: tiltAmount, enabled: tiltEnabled && !interactionActive })

  const scaledW = W * view.scale
  const scaledH = H * view.scale
  // cache small helper canvases
  const checkerTile = useMemo(() => getCheckerCanvas(checkerSize, W, H), [checkerSize, W, H])
  const tmpImage = useMemo(() => new ImageData(W, H), [W, H])
  const tmpCanvas = useMemo(() => new OffscreenCanvas(W, H), [W, H])
  const floatCanvasRef = useRef<OffscreenCanvas | null>(null)
  const [antsPhase, setAntsPhase] = useState(0)
  const resizeTick = useWindowResizeRedraw(canvasRef)

  // Animate marching ants
  useEffect(() => {
    if (!selection.mask || !selection.bounds) {
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
  }, [selection.mask, selection.bounds])

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')!
    ensureHiDPICanvas(cvs, ctx)

    const rect = cvs.getBoundingClientRect()
    ctx.translate(Math.round(view.x + (rect.width - scaledW) / 2), Math.round(view.y + (rect.height - scaledH) / 2))

    ctx.drawImage(checkerTile, 0, 0, W, H, 0, 0, scaledW, scaledH)

    // If in shift mode, render each layer with offset, suppress overlays
    if (parallaxActive) {
      drawBorder(ctx, scaledW, scaledH)
      const tctx = tmpCanvas.getContext('2d', { willReadFrequently: true })!
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li]
        if (!layer.visible) continue
        compositeImageData([layer], mode, palette, transparentIndex, tmpImage)
        tctx.putImageData(tmpImage, 0, 0)
        const depth = li + 1
        const dx = -shiftOffsetRef.current.dx * depth / layers.length
        const dy = -shiftOffsetRef.current.dy * depth / layers.length
        const s = view.scale
        ctx.save()
        ctx.globalAlpha = tiltAlpha
        ctx.drawImage(tmpCanvas, 0, 0, W, H, dx * s, dy * s, scaledW, scaledH)
        ctx.restore()
      }
      return
    }

    // Normal composited rendering
    const tctx = tmpCanvas.getContext('2d', { willReadFrequently: true })!
    compositeImageData(layers, mode, palette, transparentIndex, tmpImage)
    tctx.putImageData(tmpImage, 0, 0)
    ctx.drawImage(tmpCanvas, 0, 0, W, H, 0, 0, scaledW, scaledH)

    // border and grid
    drawBorder(ctx, scaledW, scaledH)
    if (view.scale > GRID_THRESHOLD) {
      drawGrid(ctx, W, H, view.scale)
    }
    // hover highlight
    if (hover && hover.x >= 0 && hover.y >= 0 && hover.x < W && hover.y < H) {
      drawHoverCell(ctx, hover.x, hover.y, view.scale, brushSize)
    }
    // shape preview overlay
    if (shapePreview) {
      drawShapePreview(
        ctx,
        shapePreview.kind,
        shapePreview.startX,
        shapePreview.startY,
        shapePreview.curX,
        shapePreview.curY,
        view.scale,
        (shapePreview.kind === 'rect' || shapePreview.kind === 'ellipse') ? shapeFill : false,
      )
    }
    // selection overlay and floating
    if (selection.mask && selection.bounds) {
      drawSelectionOverlay(ctx, selection.mask, W, H, view.scale)
      const dx = (selection.offsetX ?? 0)
      const dy = (selection.offsetY ?? 0)
      const s = view.scale
      const left = (selection.bounds.left + dx) * s + 0.5
      const top = (selection.bounds.top + dy) * s + 0.5
      const width = (selection.bounds.right - selection.bounds.left + 1) * s - 1
      const height = (selection.bounds.bottom - selection.bounds.top + 1) * s - 1
      ctx.save()
      ctx.strokeStyle = '#000'
      ctx.setLineDash([4, 3])
      ctx.lineDashOffset = -antsPhase
      ctx.strokeRect(left, top, width, height)
      ctx.restore()
      if (selection.floating) {
        const bw = selection.bounds.right - selection.bounds.left + 1
        const bh = selection.bounds.bottom - selection.bounds.top + 1
        if (!floatCanvasRef.current) floatCanvasRef.current = new OffscreenCanvas(bw, bh)
        if (floatCanvasRef.current.width !== bw || floatCanvasRef.current.height !== bh) {
          floatCanvasRef.current.width = bw
          floatCanvasRef.current.height = bh
        }
        const fctx = floatCanvasRef.current.getContext('2d', { willReadFrequently: true })!
        const img = fctx.createImageData(bw, bh)
        const src = selection.floating
        for (let i = 0, p = 0; i < src.length; i++, p += 4) {
          const rgba = src[i] >>> 0
          img.data[p] = (rgba >>> 24) & 0xff
          img.data[p + 1] = (rgba >>> 16) & 0xff
          img.data[p + 2] = (rgba >>> 8) & 0xff
          img.data[p + 3] = rgba & 0xff
        }
        fctx.putImageData(img, 0, 0)
        ctx.drawImage(floatCanvasRef.current, 0, 0, bw, bh, (selection.bounds.left + dx) * s, (selection.bounds.top + dy) * s, bw * s, bh * s)
      }
    }
  }, [layers, palette, mode, transparentIndex, view, hover?.x, hover?.y, shapePreview, W, H, selection, antsPhase, resizeTick, checkerSize, parallaxActive, shiftTick, shapeFill])

  const overlay = (() => {
    if (parallaxActive) return null // hide selection UI in parallax mode
    if (!selection.mask || !selection.bounds) return null
    return (
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden={false}>
        <button
          onClick={() => useAppStore.getState().clearSelection()}
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
        onPointerDown={parallaxActive ? undefined : onPointerDown}
        onPointerMove={parallaxActive ? undefined : onPointerMove}
        onPointerUp={parallaxActive ? undefined : onPointerUp}
        onPointerLeave={parallaxActive ? undefined : onPointerLeave}
        onPointerCancel={parallaxActive ? undefined : onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block shadow cursor-crosshair focus:outline-2 focus:outline-blue-500"
        tabIndex={0}
        aria-label="Pixel canvas"
      />
      {overlay}

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
        <div>parallax: {parallaxActive ? 'ON' : 'off'}</div>
        <div>layers: {layers.length}</div>
        <div>perm: {motionPermission}</div>
        <div>off: {shiftOffsetRef.current.dx.toFixed(2)},{shiftOffsetRef.current.dy.toFixed(2)}</div>
      </div>)}
    </div>
  )
}

// Resize redraw counter using only ResizeObserver
function useWindowResizeRedraw(targetRef: React.RefObject<Element | null>) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTick(t => t + 1))
    ro.observe(el)
    // initial
    setTick(t => t + 1)
    return () => ro.disconnect()
  }, [targetRef?.current])
  return tick
}

function useTiltParallax(
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

  const [active, setActive] = useState(false)
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
        setActive(false)
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
    if (active) return
    const { alpha = 0, beta = 0 } = rotationRate
    if (Math.abs(alpha) + Math.abs(beta) < SHIFT_TRIGGER) return

    setActive(true)
    if (!rafShift.current) dampLoop.current()
    setShiftTick(0)
  }, [rotationRate.alpha, rotationRate.beta, active, SHIFT_TRIGGER, ENABLED])

  useEffect(() => () => { if (rafShift.current) cancelAnimationFrame(rafShift.current) }, [])

  return { active, shiftOffsetRef, shiftTick }
}
