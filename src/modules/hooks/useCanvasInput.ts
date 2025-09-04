import { useEffect, useRef, useState } from 'react'
import { usePixelStore, MIN_SIZE, MAX_SIZE } from '../store'
import { clamp, clampViewToBounds } from '../utils/view'
import { parseCSSColor, rgbaToCSSHex } from '../utils/color'
import { compositePixel } from '../utils/composite'
import { isPointInMask, polygonToMask } from '../utils/selection'

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
  const selectionMask = usePixelStore(s => s.selectionMask)
  const setSelectionRect = usePixelStore(s => s.setSelectionRect)
  const setSelectionMask = usePixelStore(s => s.setSelectionMask)
  const clearSelection = usePixelStore(s => s.clearSelection)
  const beginSelectionDrag = usePixelStore(s => s.beginSelectionDrag)
  const setSelectionOffset = usePixelStore(s => s.setSelectionOffset)
  const commitSelectionMove = usePixelStore(s => s.commitSelectionMove)
  const W = usePixelStore(s => s.width)
  const H = usePixelStore(s => s.height)

  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [shapePreview, setShapePreview] = useState<ShapePreview>({ kind: null, startX: 0, startY: 0, curX: 0, curY: 0 })

  const panModRef = useRef(false)
  const dragState = useRef<{ lastX: number; lastY: number; panning: boolean }>({ lastX: 0, lastY: 0, panning: false })
  const mouseStroke = useRef<{ lastX?: number; lastY?: number; active: boolean; erase: boolean }>({ active: false, erase: false })
  const selectionDrag = useRef<{ active: boolean; startX: number; startY: number }>({ active: false, startX: 0, startY: 0 })
  const rectSelecting = useRef<{ active: boolean; startX: number; startY: number }>({ active: false, startX: 0, startY: 0 })
  const lassoPath = useRef<{ x: number; y: number }[] | null>(null)
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
    // multi-tap detection (2 or 3 finger quick tap)
    multiCount?: number
    multiTapStart?: number
    multiTapMoved?: boolean
    multiStartCenterX?: number
    multiStartCenterY?: number
    multiStartDist?: number // for 2-finger tap movement/scale tolerance
    selDragging?: boolean
    selStartX?: number
    selStartY?: number
    selRect?: boolean
    lasso?: boolean
  }>({})

  // Helpers
  const pickPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.floor((clientX - rect.left - viewX) / size)
    const y = Math.floor((clientY - rect.top - viewY) / size)
    return { x, y }
  }
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  const rgbaFor = (erase: boolean) => (erase ? 0x00000000 : parseCSSColor(color))
  const isShapeTool = () => tool === 'line' || tool === 'rect'
  const isSelectionTool = () => tool === 'select-rect' || tool === 'lasso'
  const isBucketTool = () => tool === 'bucket'
  const updateHover = (x: number, y: number) => {
    const hov = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
    setHoverInfo(x, y, hov)
  }
  const pointInSelection = (x: number, y: number) => isPointInMask(selectionMask, W, H, x, y)
  const startShapeAt = (x: number, y: number) => {
    setShapePreview({ kind: tool as 'line' | 'rect', startX: x, startY: y, curX: x, curY: y })
    beginStroke()
  }
  const updateShapeTo = (x: number, y: number) => {
    setShapePreview((s) => ({ ...s, curX: clamp(x, 0, W - 1), curY: clamp(y, 0, H - 1) }))
    // force re-render via hover change to show dashed preview
    setHoverCell((h) => (h ? { ...h } : { x: -1, y: -1 }))
  }
  const commitShape = (erase = false) => {
    const s = shapePreview
    if (!s.kind) return
    const rgba = rgbaFor(erase)
    if (s.kind === 'line') usePixelStore.getState().drawLine(s.startX, s.startY, s.curX, s.curY, rgba)
    else if (s.kind === 'rect') usePixelStore.getState().drawRect(s.startX, s.startY, s.curX, s.curY, rgba)
    setShapePreview({ kind: null, startX: 0, startY: 0, curX: 0, curY: 0 })
    endStroke()
  }
  const startBrushAt = (x: number, y: number, erase: boolean) => {
    mouseStroke.current.active = true
    mouseStroke.current.erase = erase
    mouseStroke.current.lastX = x
    mouseStroke.current.lastY = y
    setAt(x, y, rgbaFor(erase))
  }
  const endBrush = () => {
    mouseStroke.current.active = false
    mouseStroke.current.lastX = undefined
    mouseStroke.current.lastY = undefined
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
      } else if (e.key === 'Escape') {
        clearSelection()
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
  }, [canvasRef, clearSelection])

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
    if (!inBounds(x, y)) { setHoverCell(null); clearHoverInfo(); return }
    setHoverCell({ x, y })
    updateHover(x, y)
    // Selection tools: only hover/update, do not paint via move
    if (isSelectionTool()) return
    if (e.altKey) {
      const rgba = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
      setColor(rgbaToCSSHex(rgba))
      e.preventDefault();
      return
    }
    if (!isBucketTool()) {
      const left = (e.buttons & 1) !== 0
      const right = (e.buttons & 2) !== 0
      const pressed = left || right
      if (pressed) {
        const erase = tool === 'eraser' ? left || right : right
        const rgba = rgbaFor(erase)
        if (!mouseStroke.current.active) {
          // seed first pixel
          startBrushAt(x, y, erase)
        } else {
          // if erase mode changed mid-stroke, reset seed
          if (mouseStroke.current.erase !== erase) {
            startBrushAt(x, y, erase)
          } else if (mouseStroke.current.lastX !== undefined && mouseStroke.current.lastY !== undefined) {
            usePixelStore.getState().drawLine(mouseStroke.current.lastX, mouseStroke.current.lastY, x, y, rgba)
            mouseStroke.current.lastX = x
            mouseStroke.current.lastY = y
          }
        }
      } else {
        // button released
        endBrush()
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
    if (inBounds(x, y)) {
      if (isSelectionTool()) {
        // drag move if inside selection, else start creating
        if (selectionMask && pointInSelection(x, y)) {
          beginStroke()
          beginSelectionDrag()
          selectionDrag.current = { active: true, startX: x, startY: y }
          e.preventDefault()
          return
        }
        if (tool === 'select-rect') {
          rectSelecting.current = { active: true, startX: x, startY: y }
          setSelectionRect(x, y, x, y)
          e.preventDefault()
          return
        } else if (tool === 'lasso') {
          lassoPath.current = [{ x, y }]
          const { mask, bounds } = polygonToMask(W, H, lassoPath.current)
          setSelectionMask(mask, bounds)
          e.preventDefault()
          return
        }
      }
      if (isShapeTool()) {
        startShapeAt(x, y)
      } else {
        if (e.button === 0 || e.button === 2) beginStroke()
        const contiguous = !e.shiftKey
        if (e.button === 0) {
          if (isBucketTool()) { fillBucket(x, y, parseCSSColor(color), contiguous) }
          else {
            // start mouse stroke drawing
            startBrushAt(x, y, tool === 'eraser')
          }
        } else if (e.button === 2) {
          if (isBucketTool()) { fillBucket(x, y, 0x00000000, contiguous) }
          else {
            startBrushAt(x, y, true)
          }
        }
      }
    }
    onPointer(e)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return
    // Selection drag/create
    if (selectionDrag.current.active) {
      const { x, y } = pickPoint(e.clientX, e.clientY)
      setSelectionOffset(x - selectionDrag.current.startX, y - selectionDrag.current.startY)
      e.preventDefault()
      return
    }
    if (rectSelecting.current.active && tool === 'select-rect') {
      const { x, y } = pickPoint(e.clientX, e.clientY)
      setSelectionRect(rectSelecting.current.startX, rectSelecting.current.startY, x, y)
      e.preventDefault()
      return
    }
    if (lassoPath.current && tool === 'lasso') {
      const { x, y } = pickPoint(e.clientX, e.clientY)
      const last = lassoPath.current[lassoPath.current.length - 1]
      if (!last || last.x !== x || last.y !== y) {
        lassoPath.current.push({ x, y })
        const { mask, bounds } = polygonToMask(W, H, lassoPath.current)
        setSelectionMask(mask, bounds)
      }
      e.preventDefault()
      return
    }
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
      updateShapeTo(x, y)
      return
    }
    onPointer(e)
  }

  const onPointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && e.pointerType === 'touch') return
    dragState.current.panning = false
    if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair'
    if (selectionDrag.current.active) {
      commitSelectionMove()
      endStroke()
      selectionDrag.current.active = false
      return
    }
    if (rectSelecting.current.active) {
      rectSelecting.current.active = false
      return
    }
    if (lassoPath.current) {
      const pts = lassoPath.current
      const { mask, bounds } = polygonToMask(W, H, pts)
      setSelectionMask(mask, bounds)
      lassoPath.current = null
      return
    }
    if (shapePreview.kind) {
      commitShape(tool === 'eraser')
      return
    }
    endStroke()
    endBrush()
  }

  const onPointerLeave = () => { setHoverCell(null); clearHoverInfo() }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const Cx = e.clientX - rect.left
    const Cy = e.clientY - rect.top
    const delta = e.deltaY
    const k = delta > 0 ? 0.9 : 1.1
    const nextSize = clamp(Math.round(size * k), MIN_SIZE, MAX_SIZE)
    if (nextSize === size) return
    const ratio = nextSize / size
    const newVX = viewX - (Cx - viewX) * (ratio - 1)
    const newVY = viewY - (Cy - viewY) * (ratio - 1)
    const { vx: cvx2, vy: cvy2 } = clampViewToBounds(newVX, newVY, rect.width, rect.height, W * nextSize, H * nextSize)
    setPixelSize(nextSize)
    setView(Math.round(cvx2), Math.round(cvy2))
  }

  // Touch handlers
  const TOUCH_HOLD_MS = 150
  const TOUCH_MOVE_PX = 8
  const MULTI_TAP_MS = 250 // max duration for multi-finger tap
  const MULTI_TAP_MOVE_PX = 10 // movement tolerance (in CSS px)
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

      // Selection tools (touch): start drag or creation immediately
      if (isSelectionTool()) {
        const { x, y } = pickPoint(t.clientX, t.clientY)
        if (inBounds(x, y)) {
          if (selectionMask && pointInSelection(x, y)) {
            beginStroke()
            beginSelectionDrag()
            touches.current.selDragging = true
            touches.current.selStartX = x
            touches.current.selStartY = y
          } else if (tool === 'select-rect') {
            touches.current.selRect = true
            touches.current.selStartX = x
            touches.current.selStartY = y
            setSelectionRect(x, y, x, y)
          } else if (tool === 'lasso') {
            touches.current.lasso = true
            lassoPath.current = [{ x, y }]
            const { mask, bounds } = polygonToMask(W, H, lassoPath.current)
            setSelectionMask(mask, bounds)
          }
          e.preventDefault()
          return
        }
      }

      // Touch: begin shape drawing immediately for line/rect
      if (isShapeTool()) {
        const { x, y } = pickPoint(t.clientX, t.clientY)
        if (inBounds(x, y)) {
          startShapeAt(x, y)
        }
        e.preventDefault()
        return
      }
      touches.current.timer = window.setTimeout(() => {
        if (touches.current.isDrawing) return
        if (touches.current.multi) return
        const { x, y } = pickPoint(touches.current.startX!, touches.current.startY!)
        if (inBounds(x, y)) {
          beginStroke()
          if (isBucketTool()) {
            fillBucket(x, y, parseCSSColor(color), true)
            endStroke()
          } else {
            touches.current.isDrawing = true
            setAt(x, y, rgbaFor(tool === 'eraser'))
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
      // mark as potential 2-finger tap
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      touches.current.multiCount = 2
      touches.current.multiTapStart = performance.now()
      touches.current.multiTapMoved = false
      touches.current.multiStartCenterX = cx
      touches.current.multiStartCenterY = cy
      touches.current = { ...touches.current, id1: e.touches[0].identifier, id2: e.touches[1].identifier }
      touches.current.lastDist = dist(e.touches[0].clientX, e.touches[0].clientY, e.touches[1].clientX, e.touches[1].clientY)
      touches.current.lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      touches.current.lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      e.preventDefault()
    } else if (e.touches.length === 3) {
      // Potential 3-finger tap for redo. We don't support 3-finger gestures otherwise.
      if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      if (touches.current.isDrawing) endStroke()
      touches.current.isDrawing = false
      touches.current.multi = true
      touches.current.multiCount = 3
      touches.current.multiTapStart = performance.now()
      touches.current.multiTapMoved = false
      // store center to check movement
      const t0 = e.touches[0], t1 = e.touches[1], t2 = e.touches[2]
      const cx = (t0.clientX + t1.clientX + t2.clientX) / 3
      const cy = (t0.clientY + t1.clientY + t2.clientY) / 3
      touches.current.multiStartCenterX = cx
      touches.current.multiStartCenterY = cy
      e.preventDefault()
    }
  }

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Selection interactions on touch
    if (isSelectionTool() && e.touches.length === 1) {
      const t = e.touches[0]
      const { x, y } = pickPoint(t.clientX, t.clientY)
      if (touches.current.selDragging && touches.current.selStartX !== undefined && touches.current.selStartY !== undefined) {
        setSelectionOffset(x - touches.current.selStartX, y - touches.current.selStartY)
        e.preventDefault()
        return
      }
      if (touches.current.selRect && touches.current.selStartX !== undefined && touches.current.selStartY !== undefined) {
        setSelectionRect(touches.current.selStartX, touches.current.selStartY, x, y)
        e.preventDefault()
        return
      }
      if (touches.current.lasso && lassoPath.current) {
        const last = lassoPath.current[lassoPath.current.length - 1]
        if (!last || last.x !== x || last.y !== y) {
          lassoPath.current.push({ x, y })
          const { mask, bounds } = polygonToMask(W, H, lassoPath.current)
          setSelectionMask(mask, bounds)
        }
        e.preventDefault()
        return
      }
    }
    // If shaping (line/rect), update preview and skip brush logic
    if (shapePreview.kind && e.touches.length === 1) {
      const t = e.touches[0]
      const { x, y } = pickPoint(t.clientX, t.clientY)
      updateShapeTo(x, y)
      e.preventDefault()
      return
    }
    if (e.touches.length === 1 && touches.current.id1 === undefined) {
      // For bucket tool, do not start brush strokes on move; also cancel any hold timer
      if (isBucketTool()) {
        if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
        return
      }
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
        if (inBounds(x, y)) {
          const rgba = rgbaFor(tool === 'eraser')
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
    // 3-finger movement: if moved too much, cancel multi-tap candidate
    if (e.touches.length === 3 && touches.current.multiCount === 3 && touches.current.multiStartCenterX !== undefined && touches.current.multiStartCenterY !== undefined) {
      const t0 = e.touches[0], t1m = e.touches[1], t2m = e.touches[2]
      const cx = (t0.clientX + t1m.clientX + t2m.clientX) / 3
      const cy = (t0.clientY + t1m.clientY + t2m.clientY) / 3
      const move = Math.hypot(cx - touches.current.multiStartCenterX, cy - touches.current.multiStartCenterY)
      if (move > MULTI_TAP_MOVE_PX) touches.current.multiTapMoved = true
      // Do not apply any action on move for 3 fingers; just prevent default to avoid browser gestures
      e.preventDefault()
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
      // If this was a potential 2-finger tap, cancel it on movement/scale over tolerance
      if (touches.current.multiCount === 2 && touches.current.multiTapStart !== undefined) {
        const movedCenter = Math.hypot(
          (cx - (touches.current.multiStartCenterX ?? cx)),
          (cy - (touches.current.multiStartCenterY ?? cy))
        )
        if (movedCenter > MULTI_TAP_MOVE_PX || Math.abs(k - 1) > 0.05) {
          touches.current.multiTapMoved = true
        }
      }
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
    // Selection end handling
    if (isSelectionTool()) {
      let handledSelection = false
      if (touches.current.selDragging) {
        commitSelectionMove()
        endStroke()
        handledSelection = true
      }
      if (touches.current.lasso && lassoPath.current) {
        const { mask, bounds } = polygonToMask(W, H, lassoPath.current)
        setSelectionMask(mask, bounds)
        handledSelection = true
      }
      if (handledSelection) {
        touches.current.selDragging = false
        touches.current.selRect = false
        touches.current.lasso = false
        lassoPath.current = null
        touches.current = {}
        return
      }
      // If no active selection gesture, fall through to allow multi-tap (undo/redo)
    }
    // If a shape is active, commit it first and exit to avoid brush single-tap
    if (shapePreview.kind) {
      commitShape(false)
      touches.current = {}
      return
    }
    if (e.touches.length === 0) {
      // Multi-finger tap gestures (undo/redo) when nothing else consumed the gesture
      if (touches.current.multi && (touches.current.multiCount === 2 || touches.current.multiCount === 3)) {
        const dur = touches.current.multiTapStart ? (performance.now() - touches.current.multiTapStart) : Infinity
        const valid = dur <= MULTI_TAP_MS && !touches.current.multiTapMoved
        if (valid) {
          if (touches.current.multiCount === 2) {
            undo()
            touches.current = {}
            return
          } else if (touches.current.multiCount === 3) {
            redo()
            touches.current = {}
            return
          }
        }
      }
      if (touches.current.timer) { clearTimeout(touches.current.timer); touches.current.timer = undefined }
      if (!touches.current.multi && !touches.current.isDrawing) {
        const t = e.changedTouches[0]
        const { x, y } = pickPoint(t.clientX, t.clientY)
        if (inBounds(x, y)) {
          beginStroke()
          if (isBucketTool()) {
            fillBucket(x, y, parseCSSColor(color), true)
          } else {
            setAt(x, y, rgbaFor(tool === 'eraser'))
          }
          endStroke()
        }
      }
      if (touches.current.isDrawing) endStroke()
      touches.current = {}
    }
  }

  // We must set the passive to false.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    }
  }, [onWheel])

  return {
    hoverCell,
    shapePreview,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
