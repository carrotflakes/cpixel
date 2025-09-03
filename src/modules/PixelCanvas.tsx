import { useEffect, useRef } from 'react'
import { usePixelStore, WIDTH, HEIGHT, MIN_SIZE, MAX_SIZE } from './store'

export function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const size = usePixelStore(s => s.pixelSize)
  const color = usePixelStore(s => s.color)
  const setAt = usePixelStore(s => s.setAt)
  const data = usePixelStore(s => s.data)
  const viewX = usePixelStore(s => s.viewX)
  const viewY = usePixelStore(s => s.viewY)
  const setPixelSize = usePixelStore(s => s.setPixelSize)
  const setPixelSizeRaw = usePixelStore(s => s.setPixelSizeRaw)
  const setView = usePixelStore(s => s.setView)
  const panBy = usePixelStore(s => s.panBy)

  const scaledW = WIDTH * size
  const scaledH = HEIGHT * size

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d', { willReadFrequently: true })!

    // ensure backing store matches CSS size * DPR
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const rect = cvs.getBoundingClientRect()
    const needW = Math.max(1, Math.round(rect.width * dpr))
    const needH = Math.max(1, Math.round(rect.height * dpr))
    if (cvs.width !== needW || cvs.height !== needH) {
      cvs.width = needW
      cvs.height = needH
    }

    ctx.setTransform(1,0,0,1,0,0)
    ctx.clearRect(0, 0, cvs.width, cvs.height)
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingEnabled = false
  // translate to current view (rounded for crisper grid in CSS px space)
  const vx = Math.round(viewX)
  const vy = Math.round(viewY)
  // draw checkerboard in screen space so it doesn't follow pan/zoom
  const light = '#f0f0f0'
  const dark = '#d7d7d7'
  const tile = 12 // CSS px per checker tile
  const patt = document.createElement('canvas')
  patt.width = tile * 2
  patt.height = tile * 2
  const pctx = patt.getContext('2d')!
  pctx.fillStyle = light
  pctx.fillRect(0, 0, tile, tile)
  pctx.fillRect(tile, tile, tile, tile)
  pctx.fillStyle = dark
  pctx.fillRect(tile, 0, tile, tile)
  pctx.fillRect(0, tile, tile, tile)
  const pattern = ctx.createPattern(patt, 'repeat')!
  ctx.fillStyle = pattern
  ctx.fillRect(vx, vy, scaledW, scaledH)
  // now translate for drawing content and grid
  ctx.translate(vx, vy)
    // draw bitmap on top (alpha respected)
    const img = ctx.createImageData(WIDTH, HEIGHT)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const i = (y * WIDTH + x) * 4
        const rgba = data[y * WIDTH + x]
        img.data[i+0] = (rgba >>> 24) & 0xff
        img.data[i+1] = (rgba >>> 16) & 0xff
        img.data[i+2] = (rgba >>> 8) & 0xff
        img.data[i+3] = (rgba >>> 0) & 0xff
      }
    }
    const tmp = document.createElement('canvas')
    tmp.width = WIDTH
    tmp.height = HEIGHT
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    ctx.drawImage(tmp, 0, 0, WIDTH, HEIGHT, 0, 0, scaledW, scaledH)

  // border around pixel area
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, scaledW-1, scaledH-1)

    // grid
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 1
    for (let x = 0; x <= WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x*size+0.5, 0)
      ctx.lineTo(x*size+0.5, scaledH)
      ctx.stroke()
    }
    for (let y = 0; y <= HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y*size+0.5)
      ctx.lineTo(scaledW, y*size+0.5)
      ctx.stroke()
    }
  }, [data, size, viewX, viewY])

  const pickPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.floor((clientX - rect.left - viewX) / size)
    const y = Math.floor((clientY - rect.top - viewY) / size)
    return { x, y }
  }

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return // do not draw on touch; handled via touch events
    const { x, y } = pickPoint(e.clientX, e.clientY)
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return
    if (e.buttons & 1) {
      setAt(x, y, parseCSSColor(color))
    } else if (e.buttons & 2) {
      setAt(x, y, 0x00000000) // erase
    }
  }

  const dragState = useRef<{ lastX: number; lastY: number; panning: boolean }>({ lastX: 0, lastY: 0, panning: false })
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1) {
      dragState.current = { lastX: e.clientX, lastY: e.clientY, panning: true }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }
    onPointer(e)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragState.current.panning) {
      const dx = e.clientX - dragState.current.lastX
      const dy = e.clientY - dragState.current.lastY
      dragState.current.lastX = e.clientX
      dragState.current.lastY = e.clientY
      panBy(dx, dy)
      e.preventDefault()
      return
    }
    onPointer(e)
  }
  const onPointerUp = () => { dragState.current.panning = false }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const Cx = e.clientX - rect.left
    const Cy = e.clientY - rect.top
    const delta = e.deltaY
    const k = delta > 0 ? 0.9 : 1.1
    const nextSize = clamp(Math.round(size * k), MIN_SIZE, MAX_SIZE)
    if (nextSize === size) { e.preventDefault(); return }
    const ratio = nextSize / size
    const newVX = viewX - (Cx - viewX) * (ratio - 1)
    const newVY = viewY - (Cy - viewY) * (ratio - 1)
    setPixelSize(nextSize)
    setView(Math.round(newVX), Math.round(newVY))
    e.preventDefault()
  }

  // touch: one-finger draw (tap, hold, or move threshold), two-finger pan/pinch
  const TOUCH_HOLD_MS = 150
  const TOUCH_MOVE_PX = 8
  const touches = useRef<{
    id1?: number
    id2?: number
    lastDist?: number
    lastX?: number
    lastY?: number
    isDrawing?: boolean
    startX?: number
    startY?: number
    startTime?: number
    timer?: number
    lastPixX?: number
    lastPixY?: number
  multi?: boolean
  }>({})
  const getTouchById = (e: React.TouchEvent, id?: number) => Array.from(e.touches).find(t => t.identifier === id)
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      // prepare delayed draw for tap/hold
      const t = e.touches[0]
      if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      touches.current.isDrawing = false
      touches.current.multi = false
      touches.current.startX = t.clientX
      touches.current.startY = t.clientY
      touches.current.startTime = performance.now()
      touches.current.lastPixX = undefined
      touches.current.lastPixY = undefined
      touches.current.timer = window.setTimeout(() => {
        // start drawing after hold
        if (touches.current.isDrawing) return
        if (touches.current.multi) return // suppressed by multi-touch
        touches.current.isDrawing = true
        const { x, y } = pickPoint(touches.current.startX!, touches.current.startY!)
        if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) {
          setAt(x, y, parseCSSColor(color))
          touches.current.lastPixX = x
          touches.current.lastPixY = y
        }
      }, TOUCH_HOLD_MS)
    } else if (e.touches.length === 2) {
      // cancel any drawing and switch to gesture
      if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      touches.current.isDrawing = false
      touches.current.multi = true
      touches.current = { ...touches.current, id1: e.touches[0].identifier, id2: e.touches[1].identifier }
      touches.current.lastDist = dist(e.touches[0].clientX, e.touches[0].clientY, e.touches[1].clientX, e.touches[1].clientY)
      touches.current.lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      touches.current.lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      e.preventDefault()
    }
  }
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && touches.current.id1 === undefined) {
      const t = e.touches[0]
      const dx0 = (touches.current.startX ?? t.clientX) - t.clientX
      const dy0 = (touches.current.startY ?? t.clientY) - t.clientY
      const moved = Math.hypot(dx0, dy0)
      // if moved enough, start drawing immediately
      if (!touches.current.isDrawing && moved >= TOUCH_MOVE_PX) {
        touches.current.isDrawing = true
        if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      }
      if (touches.current.isDrawing) {
        const { x, y } = pickPoint(t.clientX, t.clientY)
        if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) {
          if (x !== touches.current.lastPixX || y !== touches.current.lastPixY) {
            setAt(x, y, parseCSSColor(color))
            touches.current.lastPixX = x
            touches.current.lastPixY = y
          }
        }
        e.preventDefault()
      }
      return
    }
    const t1 = getTouchById(e, touches.current.id1)
    const t2 = getTouchById(e, touches.current.id2)
    if (t1 && t2 && touches.current.lastDist && touches.current.lastX !== undefined && touches.current.lastY !== undefined) {
      // two-finger pan + pinch zoom
      touches.current.multi = true
      const cx = (t1.clientX + t2.clientX) / 2
      const cy = (t1.clientY + t2.clientY) / 2
      const d = dist(t1.clientX, t1.clientY, t2.clientX, t2.clientY)
      const rect = canvasRef.current!.getBoundingClientRect()
      const Cx = cx - rect.left
      const Cy = cy - rect.top
      const dx = cx - touches.current.lastX
      const dy = cy - touches.current.lastY
      const k = d / touches.current.lastDist
  const nextSize = clamp(size * k, MIN_SIZE, MAX_SIZE)
  const ratio = nextSize / size

      const v1x = viewX + dx
      const v1y = viewY + dy
      const newVX = v1x - (Cx - v1x) * (ratio - 1)
      const newVY = v1y - (Cy - v1y) * (ratio - 1)

  setPixelSizeRaw(nextSize)
      setView(Math.round(newVX), Math.round(newVY))
      touches.current.lastDist = d
      touches.current.lastX = cx
      touches.current.lastY = cy
      e.preventDefault()
    }
  }
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Final finger lifted
    if (e.touches.length === 0) {
      if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      // Only treat as tap if never multi-touch and drawing hasn't started
      if (!touches.current.multi && !touches.current.isDrawing) {
        const t = e.changedTouches[0]
        const { x, y } = pickPoint(t.clientX, t.clientY)
        if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) {
          setAt(x, y, parseCSSColor(color))
        }
      }
      touches.current = {}
    }
  }

  return (
    <div className="w-full h-full bg-gray-300">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="w-full h-full block shadow rounded touch-none"
      />
    </div>
  )
}

function parseCSSColor(css: string): number {
  // expects #rrggbb or #rrggbbaa
  if (css.startsWith('#')) {
    const hex = css.slice(1)
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0,2),16)
      const g = parseInt(hex.slice(2,4),16)
      const b = parseInt(hex.slice(4,6),16)
      return (r<<24)|(g<<16)|(b<<8)|0xff
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0,2),16)
      const g = parseInt(hex.slice(2,4),16)
      const b = parseInt(hex.slice(4,6),16)
      const a = parseInt(hex.slice(6,8),16)
      return (r<<24)|(g<<16)|(b<<8)|a
    }
  }
  // fallback black
  return 0x000000ff
}
