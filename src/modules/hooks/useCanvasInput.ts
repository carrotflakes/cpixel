import { useRef, useState } from 'react'
import { usePixelStore, MIN_SIZE, MAX_SIZE } from '../store'
import { clamp, clampViewToBounds } from '../utils/view'
import { parseCSSColor, rgbaToCSSHex } from '../utils/color'
import { compositePixel, findTopPaletteIndex, LayerLike } from '../utils/composite'
import { isPointInMask, polygonToMask, magicWandMask } from '../utils/selection'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useCanvasPanZoom } from './useCanvasPanZoom'

export type ShapePreview = {
  kind: 'line' | 'rect' | null
  startX: number
  startY: number
  curX: number
  curY: number
}

export function useCanvasInput(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const view = usePixelStore(s => s.view)
  const color = usePixelStore(s => s.color)
  const setColor = usePixelStore(s => s.setColor)
  const setColorIndex = usePixelStore(s => s.setColorIndex)
  const setAt = usePixelStore(s => s.setAt)
  const fillBucket = usePixelStore(s => s.fillBucket)
  const beginStroke = usePixelStore(s => s.beginStroke)
  const endStroke = usePixelStore(s => s.endStroke)
  const layers = usePixelStore(s => s.layers)
  const mode = usePixelStore(s => s.mode)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const currentPaletteIndex = usePixelStore(s => s.currentPaletteIndex)
  const tool = usePixelStore(s => s.tool)
  const setView = usePixelStore(s => s.setView)
  const setHoverInfo = usePixelStore(s => s.setHoverInfo)
  const selectionMask = usePixelStore(s => s.selection?.mask)
  const setSelectionRect = usePixelStore(s => s.setSelectionRect)
  const setSelectionMask = usePixelStore(s => s.setSelectionMask)
  const clearSelection = usePixelStore(s => s.clearSelection)
  const beginSelectionDrag = usePixelStore(s => s.beginSelectionDrag)
  const setSelectionOffset = usePixelStore(s => s.setSelectionOffset)
  const commitSelectionMove = usePixelStore(s => s.commitSelectionMove)
  const W = usePixelStore(s => s.width)
  const H = usePixelStore(s => s.height)

  const TOUCH_MOVE_DIST_THRESHOLD = 5 * window.devicePixelRatio

  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [shapePreview, setShapePreview] = useState<ShapePreview>({ kind: null, startX: 0, startY: 0, curX: 0, curY: 0 })

  const dragState = useRef<{ lastX: number; lastY: number; panning: boolean }>({ lastX: 0, lastY: 0, panning: false })
  const touchState = useRef<{
    pointers: { id: number; startX: number; startY: number }[]
    lastDist?: number
    lastCenter?: { x: number; y: number }
    // when true we are in a multi-touch gesture and should suppress drawing
    multiGesture: boolean
    _pts: { [id: number]: { x: number; y: number } }
    // multi-finger tap detection
    gestureStartTime: number
    gestureMoved: boolean
    maxPointers: number
  }>({ pointers: [], multiGesture: false, _pts: {}, maxPointers: 0, gestureStartTime: 0, gestureMoved: false })
  const mouseStroke = useRef<{ lastX?: number; lastY?: number; active: boolean; erase: boolean }>({ active: false, erase: false })
  const selectionDrag = useRef<{ active: boolean; startX: number; startY: number }>({ active: false, startX: 0, startY: 0 })
  const rectSelecting = useRef<{ active: boolean; startX: number; startY: number }>({ active: false, startX: 0, startY: 0 })
  const lassoPath = useRef<{ x: number; y: number }[] | null>(null)
  const state = useRef<null | "firstTouch" | "pinch" | "tool">(null)
  const firstTouch = useRef<{ x: number; y: number; clientX: number; clientY: number; button: number; shiftKey: boolean; ctrlKey: boolean } | null>(null)
  const toolPointerId = useRef<number | null>(null)

  useKeyboardShortcuts(canvasRef, clearSelection)
  useCanvasPanZoom(canvasRef, view, setView, W, H)

  // Helpers
  const pickPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.floor((clientX - rect.left - view.x) / view.scale)
    const y = Math.floor((clientY - rect.top - view.y) / view.scale)
    return { x, y }
  }
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  const paintFor = (erase: boolean) => (
    mode === 'indexed'
      ? (erase ? transparentIndex : currentPaletteIndex) ?? 0
      : erase ? 0x00000000 : parseCSSColor(color)
  )
  const isShapeTool = () => tool === 'line' || tool === 'rect'
  const isSelectionTool = () => tool === 'select-rect' || tool === 'select-lasso' || tool === 'select-wand'
  const isBrushishTool = () => tool === 'brush' || tool === 'eraser'
  const isBucketTool = () => tool === 'bucket'
  const isEyedropperTool = () => tool === 'eyedropper'
  const updateHover = (x: number, y: number) => {
    if (touchState.current.multiGesture) return
    if (!inBounds(x, y)) { setHoverCell(null); setHoverInfo(undefined); return }
    setHoverCell({ x, y })
    const hov = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
    const idx = mode === 'indexed' ? findTopPaletteIndex(layers, x, y, W, H, transparentIndex) ?? transparentIndex : undefined
    setHoverInfo({ x, y, rgba: hov, index: idx })
  }
  const pickColorAt = (x: number, y: number, updateHoverInfo: boolean) => {
    if (!inBounds(x, y)) return
    const rgba = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
    if (mode === 'indexed') {
      const idx = findTopPaletteIndex(layers, x, y, W, H, transparentIndex) ?? transparentIndex
      if (updateHoverInfo) setHoverInfo({ x, y, rgba, index: idx })
      setColorIndex(idx)
    } else {
      if (updateHoverInfo) setHoverInfo({ x, y, rgba })
      setColor(rgbaToCSSHex(rgba))
    }
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
    const rgba = paintFor(erase)
    if (s.kind === 'line') usePixelStore.getState().drawLine(s.startX, s.startY, s.curX, s.curY, rgba)
    else if (s.kind === 'rect') usePixelStore.getState().drawRect(s.startX, s.startY, s.curX, s.curY, rgba)
    setShapePreview({ kind: null, startX: 0, startY: 0, curX: 0, curY: 0 })
    endStroke()
  }
  const startBrushAt = (x: number, y: number, erase: boolean) => {
    mouseStroke.current = { active: true, erase, lastX: x, lastY: y }
    setAt(x, y, paintFor(erase))
  }
  const endBrush = () => {
    mouseStroke.current = { active: false, erase: false }
  }
  const addPointer = (e: { pointerId: number, clientX: number, clientY: number }) => {
    if (!touchState.current.pointers.some(p => p.id === e.pointerId))
      touchState.current.pointers.push({ id: e.pointerId, startX: e.clientX, startY: e.clientY })
  }

  const startTool = (x: number, y: number, e: { button: number, shiftKey: boolean }) => {
    if (!inBounds(x, y)) return false
    if (isSelectionTool()) {
      // drag move if inside selection, else start creating
      if (selectionMask && pointInSelection(x, y)) {
        beginStroke()
        beginSelectionDrag()
        selectionDrag.current = { active: true, startX: x, startY: y }
        return true
      }
      if (tool === 'select-rect') {
        rectSelecting.current = { active: true, startX: x, startY: y }
        setSelectionRect(x, y, x, y)
        return true
      } else if (tool === 'select-lasso') {
        lassoPath.current = [{ x, y }]
        const { mask, bounds } = polygonToMask(W, H, lassoPath.current)
        setSelectionMask(mask, bounds)
        return true
      } else if (tool === 'select-wand') {
        const contiguous = !e.shiftKey
        const colorGetter = (px: number, py: number) => {
          if (mode === 'truecolor') {
            return compositePixel(layers, px, py, mode, palette, transparentIndex, W, H) >>> 0
          } else {
            const idx = findTopPaletteIndex(layers as LayerLike[], px, py, W, H, transparentIndex) ?? transparentIndex
            return idx & 0xff
          }
        }
        const { mask, bounds } = magicWandMask(W, H, x, y, colorGetter, contiguous)
        setSelectionMask(mask, bounds)
        return true
      }
    }
    if (isShapeTool()) {
      startShapeAt(x, y)
      return true
    }

    if (e.button === -1 || e.button === 0 || e.button === 2) {
      beginStroke()
      const erase = e.button === -1 || e.button === 0 ? tool === 'eraser' : true
      const contiguous = !e.shiftKey
      if (isBucketTool()) {
        fillBucket(x, y, paintFor(erase), contiguous)
      } else if (isBrushishTool()) {
        startBrushAt(x, y, erase)
      }
    }
  }

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (touchState.current.multiGesture) return

    const { x, y } = pickPoint(e.clientX, e.clientY)

    // Selection tools: only hover/update, do not paint via move
    if (isSelectionTool()) return
    if (isEyedropperTool()) { if (e.buttons & 1) pickColorAt(x, y, true); return }
    if (e.altKey) {
      pickColorAt(x, y, true)
      e.preventDefault();
      return
    }
    if (isBucketTool()) return

    if (mouseStroke.current.active) {
      const erase = mouseStroke.current.erase
      if (mouseStroke.current.erase !== erase) {
        startBrushAt(x, y, erase)
      } else if (mouseStroke.current.lastX !== undefined && mouseStroke.current.lastY !== undefined) {
        const rgba = paintFor(erase)
        usePixelStore.getState().drawLine(mouseStroke.current.lastX, mouseStroke.current.lastY, x, y, rgba)
        mouseStroke.current.lastX = x
        mouseStroke.current.lastY = y
      }
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.target instanceof HTMLElement) e.target.setPointerCapture(e.pointerId)

    const { x, y } = pickPoint(e.clientX, e.clientY)

    if (touchState.current.pointers.length === 0)
      updateHover(x, y)

    switch (state.current) {
      case null:
        if (e.pointerType === 'touch') {
          state.current = 'firstTouch'

          addPointer(e)

          firstTouch.current = { x, y, clientX: e.clientX, clientY: e.clientY, button: e.button, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey }
        } else {
          state.current = 'tool'
          toolPointerId.current = e.pointerId

          const wantPan = e.button === 1 || (e.button === 0 && e.ctrlKey)
          if (wantPan) {
            dragState.current = { lastX: e.clientX, lastY: e.clientY, panning: true }
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
            e.preventDefault()
            return
          }

          if (isEyedropperTool()) { pickColorAt(x, y, true); e.preventDefault(); return }
          if (startTool(x, y, e)) {
            e.preventDefault()
            return
          }
          onPointer(e)
        }
        return
      case "firstTouch":
        if (e.pointerType === 'touch') {
          addPointer(e)
          if (touchState.current.pointers.length === 2) {
            state.current = "pinch"

            // initialize pinch
            touchState.current.multiGesture = true
            touchState.current.lastDist = undefined
            touchState.current.lastCenter = undefined
            // initialize potential multi-finger tap
            touchState.current.gestureStartTime = performance.now()
            touchState.current.gestureMoved = false
            touchState.current.maxPointers = 2
          }
        }
        return
      case "pinch":
        if (e.pointerType === 'touch') {
          addPointer(e)
          touchState.current.maxPointers = Math.max(touchState.current.maxPointers, touchState.current.pointers.length)
        }
        return
      case "tool":
        // Noop
        return
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pickPoint(e.clientX, e.clientY)

    if (touchState.current.pointers.length <= 1)
      updateHover(x, y)

    switch (state.current) {
      case null:
        return
      case "firstTouch":
        const f = firstTouch.current
        if (f) {
          const dist = Math.hypot(e.clientX - f.clientX, e.clientY - f.clientY)
          if (dist < TOUCH_MOVE_DIST_THRESHOLD)
            return

          firstTouch.current = null
          state.current = 'tool'
          toolPointerId.current = e.pointerId

          const wantPan = f.button === 1 || (f.button === 0 && f.ctrlKey)
          if (wantPan) {
            dragState.current = { lastX: f.clientX, lastY: f.clientY, panning: true }
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
            e.preventDefault()
            return
          }

          if (isEyedropperTool()) { pickColorAt(f.x, f.y, true); e.preventDefault(); return }
          if (startTool(f.x, f.y, e)) {
            e.preventDefault()
            return
          }
          onPointer(e)
        }
        return
      case "pinch":
        // Handle pinch zoom (two touch pointers) or single finger pan when in multiGesture
        if (e.pointerType === 'touch' && touchState.current.multiGesture) {
          const canvas = canvasRef.current
          if (!canvas) return
          touchState.current._pts[e.pointerId] = { x: e.clientX, y: e.clientY }

          const pointers = touchState.current.pointers
          if (pointers.length >= 2) {
            const p1 = touchState.current._pts[pointers[0].id]
            const p2 = touchState.current._pts[pointers[1].id]
            if (p1 && p2) {
              const cx = (p1.x + p2.x) / 2
              const cy = (p1.y + p2.y) / 2
              const dx = p1.x - p2.x
              const dy = p1.y - p2.y
              const dist = Math.hypot(dx, dy)
              const rect = canvas.getBoundingClientRect()
              if (touchState.current.lastDist === undefined) {
                touchState.current.lastDist = dist
                touchState.current.lastCenter = { x: cx, y: cy }
              } else {
                const k = dist / (touchState.current.lastDist ?? dist)
                const nextSize = clamp(view.scale * k, MIN_SIZE, MAX_SIZE)
                const ratio = nextSize / view.scale
                const lastC = touchState.current.lastCenter ?? { x: cx, y: cy }
                const moveCx = cx - lastC.x
                const moveCy = cy - lastC.y
                const Cx = cx - rect.left
                const Cy = cy - rect.top
                const nvx = view.x + moveCx
                const nvy = view.y + moveCy
                const newVX = nvx - (Cx - nvx) * (ratio - 1)
                const newVY = nvy - (Cy - nvy) * (ratio - 1)
                const { vx: cvx, vy: cvy } = clampViewToBounds(newVX, newVY, rect.width, rect.height, W * nextSize, H * nextSize)
                setView(Math.round(cvx), Math.round(cvy), nextSize)
                touchState.current.lastDist = dist
                touchState.current.lastCenter = { x: cx, y: cy }
              }
            }
          }
          e.preventDefault()
        }
        return
      case "tool":
        if (e.pointerId !== toolPointerId.current) return

        // Selection drag/create
        if (selectionDrag.current.active) {
          setSelectionOffset(x - selectionDrag.current.startX, y - selectionDrag.current.startY)
          e.preventDefault()
          return
        }
        if (rectSelecting.current.active) {
          setSelectionRect(rectSelecting.current.startX, rectSelecting.current.startY, x, y)
          e.preventDefault()
          return
        }
        if (lassoPath.current) {
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
          const cw = W * view.scale
          const ch = H * view.scale
          const nvx = view.x + dx
          const nvy = view.y + dy
          const clamped = clampViewToBounds(nvx, nvy, vw, vh, cw, ch)
          setView(Math.round(clamped.vx), Math.round(clamped.vy), view.scale)
          e.preventDefault()
          return
        }
        if (shapePreview.kind) {
          updateShapeTo(x, y)
          return
        }
        onPointer(e)
        return
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') {
      const pointer = touchState.current.pointers.find(p => p.id === e.pointerId)
      if (pointer) {
        if (Math.hypot(pointer.startX - e.clientX, pointer.startY - e.clientY) > TOUCH_MOVE_DIST_THRESHOLD)
          touchState.current.gestureMoved = true
      }
      touchState.current.pointers = touchState.current.pointers.filter(p => p.id !== e.pointerId)
      if (touchState.current.pointers.length < 2) {
        touchState.current.multiGesture = false
        touchState.current.lastDist = undefined
        touchState.current.lastCenter = undefined
      }
    }

    const endTool = () => {
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
        commitShape()
        return
      }
      endStroke()
      endBrush()
    }

    switch (state.current) {
      case null:
        console.warn("PointerUp in null state")
        return
      case "firstTouch":
        state.current = null

        const f = firstTouch.current
        if (f) {
          firstTouch.current = null

          const wantPan = f.button === 1 || (f.button === 0 && f.ctrlKey)
          if (wantPan) {
            dragState.current = { lastX: f.clientX, lastY: f.clientY, panning: true }
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
            e.preventDefault()
            return
          }

          if (isEyedropperTool()) { pickColorAt(f.x, f.y, true); e.preventDefault(); return }
          if (startTool(f.x, f.y, e)) {
            e.preventDefault()
            return
          }
          onPointer(e)

          endTool()
        }
        return
      case "pinch":
        if (touchState.current.pointers.length === 0) {
          // evaluate multi-finger tap (undo/redo) if gesture ended quickly & without movement
          const duration = (performance.now() - (touchState.current.gestureStartTime))
          if (!touchState.current.gestureMoved && duration < 200) {
            const fingers = touchState.current.maxPointers
            if (fingers === 2) {
              usePixelStore.getState().undo()
            } else if (fingers === 3) {
              usePixelStore.getState().redo()
            }
          }
          state.current = null
        }
        return
      case "tool":
        if (e.pointerId !== toolPointerId.current) return

        state.current = null

        endTool()
        return
    }
  }

  const onPointerLeave = () => { setHoverCell(null); setHoverInfo(undefined) }

  const interactionActive = state.current !== null;

  return {
    hoverCell,
    shapePreview,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    interactionActive,
  }
}
