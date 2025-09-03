import { useEffect, useRef, useState } from 'react'
import { usePixelStore, WIDTH, HEIGHT, MIN_SIZE, MAX_SIZE } from '../store'
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

  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [shapePreview, setShapePreview] = useState<ShapePreview>({ kind: null, startX: 0, startY: 0, curX: 0, curY: 0 })

  const panModRef = useRef(false)
  const dragState = useRef<{ lastX: number; lastY: number; panning: boolean }>({ lastX: 0, lastY: 0, panning: false })
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
    const { x, y } = pickPoint(e.clientX, e.clientY)
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) { setHoverCell(null); clearHoverInfo(); return }
    setHoverCell({ x, y })
    const hov = compositePixel(layers, x, y, mode, palette, transparentIndex, WIDTH, HEIGHT)
    setHoverInfo(x, y, hov)
    if (e.altKey) {
      const rgba = compositePixel(layers, x, y, mode, palette, transparentIndex, WIDTH, HEIGHT)
      setColor(rgbaToCSSHex(rgba))
      e.preventDefault();
      return
    }
    if (tool !== 'bucket') {
      if (e.buttons & 1) setAt(x, y, parseCSSColor(color))
      else if (e.buttons & 2) setAt(x, y, 0x00000000)
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wantPan = e.button === 1 || (e.button === 0 && (panModRef.current || e.ctrlKey))
    if (wantPan) {
      dragState.current = { lastX: e.clientX, lastY: e.clientY, panning: true }
        ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      e.preventDefault()
      return
    }
    const { x, y } = pickPoint(e.clientX, e.clientY)
    if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) {
      if (tool === 'line' || tool === 'rect') {
        setShapePreview({ kind: tool, startX: x, startY: y, curX: x, curY: y })
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
      const rect = canvasRef.current!.getBoundingClientRect()
      const vw = rect.width
      const vh = rect.height
      const cw = WIDTH * size
      const ch = HEIGHT * size
      let nvx = viewX + dx
      let nvy = viewY + dy
        ; ({ vx: nvx, vy: nvy } = clampViewToBounds(nvx, nvy, vw, vh, cw, ch))
      setView(Math.round(nvx), Math.round(nvy))
      e.preventDefault()
      return
    }
    if (shapePreview.kind) {
      const { x, y } = pickPoint(e.clientX, e.clientY)
      setShapePreview((s) => ({ ...s, curX: clamp(x, 0, WIDTH - 1), curY: clamp(y, 0, HEIGHT - 1) }))
      // force re-render via hover change to show dashed preview
      setHoverCell((h) => h ? { ...h } : { x: -1, y: -1 })
      return
    }
    onPointer(e)
  }

  const onPointerUp = () => {
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
    const { vx: cvx, vy: cvy } = clampViewToBounds(newVX, newVY, rect.width, rect.height, WIDTH * nextSize, HEIGHT * nextSize)
    setPixelSize(nextSize)
    setView(Math.round(cvx), Math.round(cvy))
    e.preventDefault()
  }

  // Touch handlers
  const TOUCH_HOLD_MS = 150
  const TOUCH_MOVE_PX = 8
  const getTouchById = (e: React.TouchEvent, id?: number) => Array.from(e.touches).find(t => t.identifier === id)
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
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
    if (e.touches.length === 0) {
      if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
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
