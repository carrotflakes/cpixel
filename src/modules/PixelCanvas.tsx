import { useEffect, useRef, useState } from 'react'
import { usePixelStore, WIDTH, HEIGHT, MIN_SIZE, MAX_SIZE } from './store'
import { parseCSSColor, rgbaToCSSHex } from './utils/color.ts'
import { clamp, clampViewToBounds } from './utils/view.ts'

export function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const size = usePixelStore(s => s.pixelSize)
  const color = usePixelStore(s => s.color)
  const setColor = usePixelStore(s => s.setColor)
  const setAt = usePixelStore(s => s.setAt)
  const fillBucket = usePixelStore(s => s.fillBucket)
  const beginStroke = usePixelStore(s => s.beginStroke)
  const endStroke = usePixelStore(s => s.endStroke)
  const undo = usePixelStore(s => s.undo)
  const redo = usePixelStore(s => s.redo)
  const data = usePixelStore(s => s.data)
  const mode = usePixelStore(s => s.mode)
  const indices = usePixelStore(s => s.indices)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const tool = usePixelStore(s => s.tool)
  const viewX = usePixelStore(s => s.viewX)
  const viewY = usePixelStore(s => s.viewY)
  const setPixelSize = usePixelStore(s => s.setPixelSize)
  const setPixelSizeRaw = usePixelStore(s => s.setPixelSizeRaw)
  const setView = usePixelStore(s => s.setView)
  const setHoverInfo = usePixelStore(s => s.setHoverInfo)
  const clearHoverInfo = usePixelStore(s => s.clearHoverInfo)
  // const panBy = usePixelStore(s => s.panBy)

  const scaledW = WIDTH * size
  const scaledH = HEIGHT * size
  // cache small helper canvases
  const checkerTileRef = useRef<HTMLCanvasElement | null>(null)
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const panModRef = useRef(false) // Space key held
  const dragShape = useRef<{
    kind: 'line' | 'rect' | null
    startX: number
    startY: number
    curX: number
    curY: number
  }>({ kind: null, startX: 0, startY: 0, curX: 0, curY: 0 })

  // view clamping now imported from utils

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
    } catch {}
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
    } catch {}
  }, [size, viewX, viewY])

  // Track Space key for pan modifier (desktop/trackpad friendly)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (!panModRef.current) {
          panModRef.current = true
          // indicate grab if not currently panning
          if (canvasRef.current && !dragState.current.panning) canvasRef.current.style.cursor = 'grab'
        }
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        panModRef.current = false
        if (canvasRef.current && !dragState.current.panning) canvasRef.current.style.cursor = 'crosshair'
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('keyup', onKeyUp, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as any)
      window.removeEventListener('keyup', onKeyUp, { capture: true } as any)
    }
  }, [])

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
  // draw checkerboard in screen space so it doesn't follow pan/zoom (cached tile)
  const light = '#f0f0f0'
  const dark = '#d7d7d7'
  const tile = 12 // CSS px per checker tile
  if (!checkerTileRef.current || checkerTileRef.current.width !== tile * 2) {
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
    checkerTileRef.current = patt
  }
  const pattern = ctx.createPattern(checkerTileRef.current!, 'repeat')!
  ctx.fillStyle = pattern
  ctx.fillRect(vx, vy, scaledW, scaledH)
  // now translate for drawing content and grid
  ctx.translate(vx, vy)
    // draw bitmap on top (alpha respected)
    const img = ctx.createImageData(WIDTH, HEIGHT)
    if (mode === 'truecolor') {
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
    } else {
      const idx = indices ?? new Uint8Array(WIDTH * HEIGHT)
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const p = y * WIDTH + x
          const pi = idx[p] ?? transparentIndex
          const rgba = palette[pi] ?? 0x00000000
          const i = p * 4
          img.data[i+0] = (rgba >>> 24) & 0xff
          img.data[i+1] = (rgba >>> 16) & 0xff
          img.data[i+2] = (rgba >>> 8) & 0xff
          img.data[i+3] = (rgba >>> 0) & 0xff
        }
      }
    }
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
    // hover highlight
    if (hoverCell && hoverCell.x >= 0 && hoverCell.y >= 0 && hoverCell.x < WIDTH && hoverCell.y < HEIGHT) {
      ctx.save()
      ctx.strokeStyle = 'rgba(0,128,255,0.9)'
      ctx.lineWidth = 2
      ctx.strokeRect(hoverCell.x * size + 0.5, hoverCell.y * size + 0.5, size - 1, size - 1)
      ctx.restore()
    }
    // shape preview overlay
    if (dragShape.current.kind) {
      ctx.save()
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'
      ctx.setLineDash([4, 3])
      const s = size
      const x0 = dragShape.current.startX * s + 0.5
      const y0 = dragShape.current.startY * s + 0.5
      const x1 = dragShape.current.curX * s + 0.5
      const y1 = dragShape.current.curY * s + 0.5
      if (dragShape.current.kind === 'rect') {
        const left = Math.min(x0, x1)
        const top = Math.min(y0, y1)
        const w = Math.abs(x1 - x0) + (s - 1)
        const h = Math.abs(y1 - y0) + (s - 1)
        ctx.strokeRect(left, top, w, h)
      } else if (dragShape.current.kind === 'line') {
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      }
      ctx.restore()
    }
  }, [data, indices, palette, mode, transparentIndex, size, viewX, viewY, hoverCell?.x, hoverCell?.y])

  const pickPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.floor((clientX - rect.left - viewX) / size)
    const y = Math.floor((clientY - rect.top - viewY) / size)
    return { x, y }
  }

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return // do not draw on touch; handled via touch events
    const { x, y } = pickPoint(e.clientX, e.clientY)
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) { setHoverCell(null); clearHoverInfo(); return }
  // track hover
  setHoverCell({ x, y })
  setHoverInfo(x, y, data[y * WIDTH + x])
    // Eyedropper: Alt to pick color under cursor (no drawing)
    if (e.altKey) {
      const rgba = mode === 'truecolor' ? data[y * WIDTH + x] : palette[(indices ?? new Uint8Array())[y * WIDTH + x] ?? transparentIndex] ?? 0x00000000
      setColor(rgbaToCSSHex(rgba))
      e.preventDefault()
      return
    }
    if (tool !== 'bucket') {
      if (e.buttons & 1) {
        setAt(x, y, parseCSSColor(color))
      } else if (e.buttons & 2) {
        setAt(x, y, 0x00000000) // erase
      }
    }
  }

  const dragState = useRef<{ lastX: number; lastY: number; panning: boolean }>({ lastX: 0, lastY: 0, panning: false })
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
  const wantPan = e.button === 1 || (e.button === 0 && (panModRef.current || e.ctrlKey))
  if (wantPan) {
      dragState.current = { lastX: e.clientX, lastY: e.clientY, panning: true }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  // visual feedback
  if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      e.preventDefault()
      return
    }
    // begin drawing stroke for history if starting to draw/erase
    const { x, y } = pickPoint(e.clientX, e.clientY)
    if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) {
      if (tool === 'line' || tool === 'rect') {
        // start shape drag; defer commit until mouse up
        dragShape.current = { kind: tool, startX: x, startY: y, curX: x, curY: y }
        beginStroke()
      } else {
        if (e.button === 0 || e.button === 2) beginStroke()
        const contiguous = !e.shiftKey
        if (e.button === 0) {
          if (tool === 'bucket') { fillBucket(x, y, parseCSSColor(color), contiguous) }
        } else if (e.button === 2) {
          if (tool === 'bucket') { fillBucket(x, y, 0x00000000, contiguous) }
        }
      }
    }
    onPointer(e)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragState.current.panning) {
      const dx = e.clientX - dragState.current.lastX
      const dy = e.clientY - dragState.current.lastY
      dragState.current.lastX = e.clientX
      dragState.current.lastY = e.clientY
  // soft clamp pan to keep content near viewport
  const rect = canvasRef.current!.getBoundingClientRect()
  const vw = rect.width
  const vh = rect.height
  const cw = WIDTH * size
  const ch = HEIGHT * size
  let nvx = viewX + dx
  let nvy = viewY + dy
  ;({ vx: nvx, vy: nvy } = clampViewToBounds(nvx, nvy, vw, vh, cw, ch))
  setView(Math.round(nvx), Math.round(nvy))
      e.preventDefault()
      return
    }
    if (dragShape.current.kind) {
      const { x, y } = pickPoint(e.clientX, e.clientY)
      dragShape.current.curX = clamp(x, 0, WIDTH - 1)
      dragShape.current.curY = clamp(y, 0, HEIGHT - 1)
      // trigger re-render via hover change
      setHoverCell((h) => h ? { ...h } : { x: -1, y: -1 })
      return
    }
    onPointer(e)
  }
  const onPointerUp = () => {
    dragState.current.panning = false
    if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair'
    if (dragShape.current.kind) {
      const s = dragShape.current
      const rgba = parseCSSColor(color)
      if (s.kind === 'line') {
        usePixelStore.getState().drawLine(s.startX, s.startY, s.curX, s.curY, rgba)
      } else if (s.kind === 'rect') {
        usePixelStore.getState().drawRect(s.startX, s.startY, s.curX, s.curY, rgba)
      }
      dragShape.current.kind = null
      endStroke()
      return
    }
    endStroke()
  }
  const onPointerLeave = () => { setHoverCell(null); clearHoverInfo() }

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
  // clamp to viewport after zoom
  const { vx: cvx, vy: cvy } = clampViewToBounds(newVX, newVY, rect.width, rect.height, WIDTH * nextSize, HEIGHT * nextSize)
  setPixelSize(nextSize)
  setView(Math.round(cvx), Math.round(cvy))
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
  // clamp imported from utils

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
        const { x, y } = pickPoint(touches.current.startX!, touches.current.startY!)
        if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) {
          beginStroke()
          if (tool === 'bucket') {
            fillBucket(x, y, parseCSSColor(color), true)
            endStroke()
          } else {
            touches.current.isDrawing = true
            setAt(x, y, parseCSSColor(color))
            touches.current.lastPixX = x
            touches.current.lastPixY = y
          }
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
        beginStroke()
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
  const { vx: cvx, vy: cvy } = clampViewToBounds(newVX, newVY, rect.width, rect.height, WIDTH * nextSize, HEIGHT * nextSize)
  setPixelSizeRaw(nextSize)
  setView(Math.round(cvx), Math.round(cvy))
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
          beginStroke()
          if (tool === 'bucket') {
            fillBucket(x, y, parseCSSColor(color), true)
          } else {
            setAt(x, y, parseCSSColor(color))
          }
          endStroke()
        }
      }
      if (touches.current.isDrawing) endStroke()
      touches.current = {}
    }
  }

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z for undo/redo; Cmd variants for macOS
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (!mod) return
      if (e.key.toLowerCase() === 'z') {
        if (e.shiftKey) { redo(); e.preventDefault() }
        else { undo(); e.preventDefault() }
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any)
  }, [undo, redo])

  return (
    <div className="w-full h-full bg-gray-300">
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
