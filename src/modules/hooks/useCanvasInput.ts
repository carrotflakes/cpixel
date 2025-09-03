import { useEffect, useRef, useState } from 'react'
import { usePixelStore, MIN_SIZE, MAX_SIZE } from '../store'
import { clamp, clampViewToBounds } from '../utils/view'
import { parseCSSColor, rgbaToCSSHex } from '../utils/color'
import { compositePixel } from '../utils/composite'

export type ShapePreview = {
  kind: 'line' | 'rect' | null
  startX: number
  startY: number
  curX: number
  curY: number
}

export function useCanvasInput(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const size = usePixelStore(s => s.pixelSize)
  const color = usePixelStore(s => s.color)
  const setColor = usePixelStore(s => s.setColor)
  const setAt = usePixelStore(s => s.setAt)
  const fillBucket = usePixelStore(s => s.fillBucket)
  const beginStroke = usePixelStore(s => s.beginStroke)
  const endStroke = usePixelStore(s => s.endStroke)
  const undo = usePixelStore(s => s.undo)
  const redo = usePixelStore(s => s.redo)
  const layers = usePixelStore(s => s.layers)
  const mode = usePixelStore(s => s.mode)
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
  const W = usePixelStore(s => s.width)
  const H = usePixelStore(s => s.height)

  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [shapePreview, setShapePreview] = useState<ShapePreview>({ kind: null, startX: 0, startY: 0, curX: 0, curY: 0 })

  const panModRef = useRef(false)
  const dragState = useRef<{ lastX: number; lastY: number; panning: boolean }>({ lastX: 0, lastY: 0, panning: false })
  const mouseStroke = useRef<{ lastX?: number; lastY?: number; active: boolean; erase: boolean }>({ active: false, erase: false })
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

  const pickPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.floor((clientX - rect.left - viewX) / size)
    const y = Math.floor((clientY - rect.top - viewY) / size)
    return { x, y }
  }

  // Pan mode while Space key is held
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (!panModRef.current) {
          panModRef.current = true
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
      window.removeEventListener('keydown', onKeyDown as any, { capture: true } as any)
      window.removeEventListener('keyup', onKeyUp as any, { capture: true } as any)
    }
  }, [canvasRef])

  // Undo/Redo keyboard shortcuts
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
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any)
  }, [undo, redo])

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return
  // If this were a touch-derived PointerEvent with multiple contacts, bail
  if ((e as any).isPrimary === false) return
  const { x, y } = pickPoint(e.clientX, e.clientY)
    if (x < 0 || y < 0 || x >= W || y >= H) { setHoverCell(null); clearHoverInfo(); return }
    setHoverCell({ x, y })
    const hov = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
    setHoverInfo(x, y, hov)
    if (e.altKey) {
      const rgba = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
      setColor(rgbaToCSSHex(rgba))
      e.preventDefault();
      return
    }
    if (tool !== 'bucket') {
      const left = (e.buttons & 1) !== 0
      const right = (e.buttons & 2) !== 0
      const pressed = left || right
      if (pressed) {
        const erase = right
        const rgba = erase ? 0x00000000 : parseCSSColor(color)
        if (!mouseStroke.current.active) {
          mouseStroke.current.active = true
          mouseStroke.current.erase = erase
          mouseStroke.current.lastX = x
          mouseStroke.current.lastY = y
          // seed first pixel
          setAt(x, y, rgba)
        } else {
          // if erase mode changed mid-stroke, reset seed
          if (mouseStroke.current.erase !== erase) {
            mouseStroke.current.erase = erase
            mouseStroke.current.lastX = x
            mouseStroke.current.lastY = y
            setAt(x, y, rgba)
          } else if (mouseStroke.current.lastX !== undefined && mouseStroke.current.lastY !== undefined) {
            usePixelStore.getState().drawLine(mouseStroke.current.lastX, mouseStroke.current.lastY, x, y, rgba)
            mouseStroke.current.lastX = x
            mouseStroke.current.lastY = y
          }
        }
      } else {
        // button released
        mouseStroke.current.active = false
        mouseStroke.current.lastX = undefined
        mouseStroke.current.lastY = undefined
      }
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return
    const wantPan = e.button === 1 || (e.button === 0 && (panModRef.current || e.ctrlKey))
    if (wantPan) {
      dragState.current = { lastX: e.clientX, lastY: e.clientY, panning: true }
        ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      e.preventDefault()
      return
    }
    const { x, y } = pickPoint(e.clientX, e.clientY)
  if (x >= 0 && y >= 0 && x < W && y < H) {
      if (tool === 'line' || tool === 'rect') {
        setShapePreview({ kind: tool, startX: x, startY: y, curX: x, curY: y })
        beginStroke()
      } else {
        if (e.button === 0 || e.button === 2) beginStroke()
        const contiguous = !e.shiftKey
        if (e.button === 0) {
          if (tool === 'bucket') { fillBucket(x, y, parseCSSColor(color), contiguous) }
          else {
            // start mouse stroke drawing
            mouseStroke.current.active = true
            mouseStroke.current.erase = false
            mouseStroke.current.lastX = x
            mouseStroke.current.lastY = y
            setAt(x, y, parseCSSColor(color))
          }
        } else if (e.button === 2) {
          if (tool === 'bucket') { fillBucket(x, y, 0x00000000, contiguous) }
          else {
            mouseStroke.current.active = true
            mouseStroke.current.erase = true
            mouseStroke.current.lastX = x
            mouseStroke.current.lastY = y
            setAt(x, y, 0x00000000)
          }
        }
      }
    }
    onPointer(e)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return
    if (dragState.current.panning) {
      const dx = e.clientX - dragState.current.lastX
      const dy = e.clientY - dragState.current.lastY
      dragState.current.lastX = e.clientX
      dragState.current.lastY = e.clientY
      const rect = canvasRef.current!.getBoundingClientRect()
      const vw = rect.width
      const vh = rect.height
  const cw = W * size
  const ch = H * size
      let nvx = viewX + dx
      let nvy = viewY + dy
        ; ({ vx: nvx, vy: nvy } = clampViewToBounds(nvx, nvy, vw, vh, cw, ch))
      setView(Math.round(nvx), Math.round(nvy))
      e.preventDefault()
      return
    }
    if (shapePreview.kind) {
      const { x, y } = pickPoint(e.clientX, e.clientY)
  setShapePreview((s) => ({ ...s, curX: clamp(x, 0, W - 1), curY: clamp(y, 0, H - 1) }))
      // force re-render via hover change to show dashed preview
      setHoverCell((h) => h ? { ...h } : { x: -1, y: -1 })
      return
    }
    onPointer(e)
  }

  const onPointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && e.pointerType === 'touch') return
    dragState.current.panning = false
    if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair'
    if (shapePreview.kind) {
      const s = shapePreview
      const rgba = parseCSSColor(color)
      if (s.kind === 'line') {
        usePixelStore.getState().drawLine(s.startX, s.startY, s.curX, s.curY, rgba)
      } else if (s.kind === 'rect') {
        usePixelStore.getState().drawRect(s.startX, s.startY, s.curX, s.curY, rgba)
      }
      setShapePreview({ kind: null, startX: 0, startY: 0, curX: 0, curY: 0 })
      endStroke()
      return
    }
    endStroke()
  mouseStroke.current.active = false
  mouseStroke.current.lastX = undefined
  mouseStroke.current.lastY = undefined
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
  const { vx: cvx2, vy: cvy2 } = clampViewToBounds(newVX, newVY, rect.width, rect.height, W * nextSize, H * nextSize)
  setPixelSize(nextSize)
  setView(Math.round(cvx2), Math.round(cvy2))
    e.preventDefault()
  }

  // Touch handlers
  const TOUCH_HOLD_MS = 150
  const TOUCH_MOVE_PX = 8
  const getTouchById = (e: React.TouchEvent, id?: number) => Array.from(e.touches).find(t => t.identifier === id)
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      // ignore if already in multi-touch gesture
      if (touches.current.multi) return
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
        if (touches.current.isDrawing) return
        if (touches.current.multi) return
        const { x, y } = pickPoint(touches.current.startX!, touches.current.startY!)
  if (x >= 0 && y >= 0 && x < W && y < H) {
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
      if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      // if a single-finger stroke was active, end it before switching to gesture
      if (touches.current.isDrawing) {
        endStroke()
      }
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
      if (touches.current.multi) return
      const t = e.touches[0]
      const dx0 = (touches.current.startX ?? t.clientX) - t.clientX
      const dy0 = (touches.current.startY ?? t.clientY) - t.clientY
      const moved = Math.hypot(dx0, dy0)
      if (!touches.current.isDrawing && moved >= TOUCH_MOVE_PX) {
        touches.current.isDrawing = true
        beginStroke()
        if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      }
      if (touches.current.isDrawing) {
        const { x, y } = pickPoint(t.clientX, t.clientY)
  if (x >= 0 && y >= 0 && x < W && y < H) {
          const rgba = parseCSSColor(color)
          const lx = touches.current.lastPixX
          const ly = touches.current.lastPixY
          if (lx === undefined || ly === undefined) {
            setAt(x, y, rgba)
          } else if (lx !== x || ly !== y) {
            usePixelStore.getState().drawLine(lx, ly, x, y, rgba)
          }
          touches.current.lastPixX = x
          touches.current.lastPixY = y
        }
        e.preventDefault()
      }
      return
    }
    const t1 = getTouchById(e, touches.current.id1)
    const t2 = getTouchById(e, touches.current.id2)
    if (t1 && t2 && touches.current.lastDist && touches.current.lastX !== undefined && touches.current.lastY !== undefined) {
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
  const { vx: cvx, vy: cvy } = clampViewToBounds(newVX, newVY, rect.width, rect.height, W * nextSize, H * nextSize)
      setPixelSizeRaw(nextSize)
      setView(Math.round(cvx), Math.round(cvy))
      touches.current.lastDist = d
      touches.current.lastX = cx
      touches.current.lastY = cy
      e.preventDefault()
    }
  }

  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      if (!touches.current.multi && !touches.current.isDrawing) {
        const t = e.changedTouches[0]
        const { x, y } = pickPoint(t.clientX, t.clientY)
  if (x >= 0 && y >= 0 && x < W && y < H) {
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

  return {
    hoverCell,
    shapePreview,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onWheel,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
