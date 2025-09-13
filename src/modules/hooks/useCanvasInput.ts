import { useRef, useState } from 'react'
import { usePixelStore, MIN_SCALE, MAX_SCALE, ToolType } from '../store'
import { clamp, clampViewToBounds } from '../utils/view'
import { parseCSSColor, rgbaToCSSHex } from '../utils/color'
import { compositePixel, findTopPaletteIndex, LayerLike } from '../utils/composite'
import { isPointInMask, polygonToMask, magicWandMask } from '../utils/selection'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useCanvasPanZoom } from './useCanvasPanZoom'
import { useSettingsStore } from '../settingsStore'

export type ShapePreview = {
  kind: 'line' | 'rect' | 'ellipse'
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
  const beginStroke = usePixelStore(s => s.beginStroke)
  const endStroke = usePixelStore(s => s.endStroke)
  const layers = usePixelStore(s => s.layers)
  const mode = usePixelStore(s => s.mode)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const currentPaletteIndex = usePixelStore(s => s.currentPaletteIndex)
  const setView = usePixelStore(s => s.setView)
  const setHoverInfo = usePixelStore(s => s.setHoverInfo)
  const selectionMask = usePixelStore(s => s.selection?.mask)
  const setSelectionRect = usePixelStore(s => s.setSelectionRect)
  const setSelectionMask = usePixelStore(s => s.setSelectionMask)
  const beginSelectionDrag = usePixelStore(s => s.beginSelectionDrag)
  const setSelectionOffset = usePixelStore(s => s.setSelectionOffset)
  const commitSelectionMove = usePixelStore(s => s.commitSelectionMove)
  const W = usePixelStore(s => s.width)
  const H = usePixelStore(s => s.height)

  const TOUCH_MOVE_DIST_THRESHOLD = 5 * window.devicePixelRatio

  const [shapePreview, setShapePreview] = useState<ShapePreview | null>(null)

  const panState = useRef<{ lastX: number; lastY: number; panning: boolean }>({ lastX: 0, lastY: 0, panning: false })
  const touchState = useRef<{
    pointers: { id: number; startX: number; startY: number, x: number, y: number }[]
    lastDist?: number
    lastCenter?: { x: number; y: number }
    // when true we are in a multi-touch gesture and should suppress drawing
    multiGesture: boolean
    // multi-finger tap detection
    gestureStartTime: number
    gestureMoved: boolean
    maxPointers: number
  }>({ pointers: [], multiGesture: false, maxPointers: 0, gestureStartTime: 0, gestureMoved: false })
  const mouseStroke = useRef<{ lastX?: number; lastY?: number; active: boolean; erase: boolean }>({ active: false, erase: false })
  const selectionDrag = useRef<{ active: boolean; startX: number; startY: number }>({ active: false, startX: 0, startY: 0 })
  const rectSelecting = useRef<{ active: boolean; startX: number; startY: number }>({ active: false, startX: 0, startY: 0 })
  const lassoPath = useRef<{ x: number; y: number }[] | null>(null)
  const state = useRef<null | "firstTouch" | "pinch" | "tool">(null)
  const firstTouch = useRef<{ pointerId: number, x: number; y: number; clientX: number; clientY: number; button: number; shiftKey: boolean; ctrlKey: boolean } | null>(null)
  const toolPointerId = useRef<number | null>(null)
  const curTool = useRef<ToolType>('brush')

  useKeyboardShortcuts(canvasRef)
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
  const isShapeTool = () => curTool.current === 'line' || curTool.current === 'rect' || curTool.current === 'ellipse'
  const isSelectionTool = () => curTool.current === 'select-rect' || curTool.current === 'select-lasso' || curTool.current === 'select-wand'
  const isBrushishTool = () => curTool.current === 'brush' || curTool.current === 'eraser'
  const isBucketTool = () => curTool.current === 'bucket'
  const isEyedropperTool = () => curTool.current === 'eyedropper'
  const updateHover = (x: number, y: number) => {
    if (touchState.current.multiGesture) return
    if (!inBounds(x, y)) { setHoverInfo(undefined); return }
    const hov = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
    const idx = mode === 'indexed' ? findTopPaletteIndex(layers, x, y, W, H, transparentIndex) ?? transparentIndex : undefined
    setHoverInfo({ x, y, rgba: hov, index: idx })
  }
  const pickColorAt = (x: number, y: number) => {
    if (!inBounds(x, y)) return
    const rgba = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
    if (mode === 'indexed') {
      const idx = findTopPaletteIndex(layers, x, y, W, H, transparentIndex) ?? transparentIndex
      setColorIndex(idx)
    } else {
      setColor(rgbaToCSSHex(rgba))
    }
  }
  const pointInSelection = (x: number, y: number) => isPointInMask(selectionMask, W, H, x, y)
  const startShapeAt = (x: number, y: number) => {
    setShapePreview({ kind: curTool.current as 'line' | 'rect' | 'ellipse', startX: x, startY: y, curX: x, curY: y })
    beginStroke()
  }
  const updateShapeTo = (x: number, y: number) => {
    setShapePreview((s) => s && ({ ...s, curX: clamp(x, 0, W - 1), curY: clamp(y, 0, H - 1) }))
  }
  const endBrush = () => {
    mouseStroke.current = { active: false, erase: false }
  }
  const addPointer = (e: { pointerId: number, clientX: number, clientY: number }) => {
    if (!touchState.current.pointers.some(p => p.id === e.pointerId))
      touchState.current.pointers.push({ id: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY })
  }

  const startTool = (x: number, y: number, e: { button: number, shiftKey: boolean }) => {
    if (isEyedropperTool()) { pickColorAt(x, y); return true }

    if (!inBounds(x, y)) return false

    // If a selection mask exists and pointer is outside, block starting paint / shape tools (selection tools still allowed)
    if (!isSelectionTool() && selectionMask && !pointInSelection(x, y)) return false

    if (isSelectionTool()) {
      // drag move if inside selection, else start creating
      if (selectionMask && pointInSelection(x, y)) {
        beginStroke()
        beginSelectionDrag()
        selectionDrag.current = { active: true, startX: x, startY: y }
        return true
      }
      if (curTool.current === 'select-rect') {
        rectSelecting.current = { active: true, startX: x, startY: y }
        setSelectionRect(x, y, x, y)
        return true
      } else if (curTool.current === 'select-lasso') {
        lassoPath.current = [{ x, y }]
        const { mask, bounds } = polygonToMask(W, H, lassoPath.current)
        setSelectionMask(mask, bounds)
        return true
      } else if (curTool.current === 'select-wand') {
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
      const contiguous = !e.shiftKey
      if (isBucketTool()) {
        usePixelStore.getState().fillBucket(x, y, paintFor(false), contiguous)
      } else if (isBrushishTool()) {
        const erase = curTool.current === 'eraser'
        mouseStroke.current = { active: true, erase, lastX: x, lastY: y }
        usePixelStore.getState().setAt(x, y, paintFor(erase))
      }
    }
  }

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (touchState.current.multiGesture) return

    const { x, y } = pickPoint(e.clientX, e.clientY)

    if (isSelectionTool()) return
    if (isEyedropperTool()) { pickColorAt(x, y); return }
    if (isBucketTool()) return

    if (mouseStroke.current.active && mouseStroke.current.lastX !== undefined && mouseStroke.current.lastY !== undefined) {
      const rgba = paintFor(mouseStroke.current.erase)
      usePixelStore.getState().drawLine(mouseStroke.current.lastX, mouseStroke.current.lastY, x, y, rgba)
      mouseStroke.current.lastX = x
      mouseStroke.current.lastY = y
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)

    const { x, y } = pickPoint(e.clientX, e.clientY)

    if (touchState.current.pointers.length === 0)
      updateHover(x, y)

    switch (state.current) {
      case null:
        curTool.current = e.button === 2 ? useSettingsStore.getState().rightClickTool : usePixelStore.getState().tool
        if (e.altKey) curTool.current = 'eyedropper'
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) curTool.current = 'pan'

        if (e.pointerType === 'touch') {
          state.current = 'firstTouch'

          addPointer(e)

          firstTouch.current = { pointerId: e.pointerId, x, y, clientX: e.clientX, clientY: e.clientY, button: e.button, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey }
        } else {
          state.current = 'tool'
          toolPointerId.current = e.pointerId

          if (curTool.current === 'pan') {
            panState.current = { lastX: e.clientX, lastY: e.clientY, panning: true }
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
            return
          }

          if (startTool(x, y, e)) {
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
    e.preventDefault()
    const { x, y } = pickPoint(e.clientX, e.clientY)

    if (touchState.current.pointers.length <= 1)
      updateHover(x, y)

    switch (state.current) {
      case null:
        return
      case "firstTouch":
        const f = firstTouch.current
        if (f?.pointerId === e.pointerId) {
          const dist = Math.hypot(e.clientX - f.clientX, e.clientY - f.clientY)
          if (dist < TOUCH_MOVE_DIST_THRESHOLD)
            return

          firstTouch.current = null
          state.current = 'tool'
          toolPointerId.current = e.pointerId

          if (curTool.current === 'pan') {
            panState.current = { lastX: f.clientX, lastY: f.clientY, panning: true }
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
            return
          }

          if (startTool(f.x, f.y, e)) {
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
          const pointer = touchState.current.pointers.find(p => p.id === e.pointerId)
          if (pointer) {
            pointer.x = e.clientX
            pointer.y = e.clientY
          }

          const pointers = touchState.current.pointers
          if (pointers.length >= 2) {
            const p1 = pointers[0]
            const p2 = pointers[1]
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
                const nextScale = clamp(view.scale * k, MIN_SCALE, MAX_SCALE)
                const ratio = nextScale / view.scale
                const lastC = touchState.current.lastCenter ?? { x: cx, y: cy }
                const moveCx = cx - lastC.x
                const moveCy = cy - lastC.y
                const Cx = cx - rect.left
                const Cy = cy - rect.top
                const nvx = view.x + moveCx
                const nvy = view.y + moveCy
                const newVX = nvx - (Cx - nvx) * (ratio - 1)
                const newVY = nvy - (Cy - nvy) * (ratio - 1)
                const { vx: cvx, vy: cvy } = clampViewToBounds(newVX, newVY, rect.width, rect.height, W * nextScale, H * nextScale)
                setView(Math.round(cvx), Math.round(cvy), nextScale)
                touchState.current.lastDist = dist
                touchState.current.lastCenter = { x: cx, y: cy }
              }
            }
          }
        }
        return
      case "tool":
        if (e.pointerId !== toolPointerId.current) return

        // Selection drag/create
        if (selectionDrag.current.active) {
          setSelectionOffset(x - selectionDrag.current.startX, y - selectionDrag.current.startY)
          return
        }
        if (rectSelecting.current.active) {
          setSelectionRect(rectSelecting.current.startX, rectSelecting.current.startY, x, y)
          return
        }
        if (lassoPath.current) {
          const last = lassoPath.current[lassoPath.current.length - 1]
          if (!last || last.x !== x || last.y !== y) {
            lassoPath.current.push({ x, y })
            const { mask, bounds } = polygonToMask(W, H, lassoPath.current)
            setSelectionMask(mask, bounds)
          }
          return
        }
        if (panState.current.panning) {
          const dx = e.clientX - panState.current.lastX
          const dy = e.clientY - panState.current.lastY
          panState.current.lastX = e.clientX
          panState.current.lastY = e.clientY
          const rect = canvasRef.current!.getBoundingClientRect()
          const vw = rect.width
          const vh = rect.height
          const cw = W * view.scale
          const ch = H * view.scale
          const nvx = view.x + dx
          const nvy = view.y + dy
          const clamped = clampViewToBounds(nvx, nvy, vw, vh, cw, ch)
          setView(Math.round(clamped.vx), Math.round(clamped.vy), view.scale)
          return
        }
        if (shapePreview) {
          updateShapeTo(x, y)
          return
        }
        onPointer(e)
        return
    }
  }

  const endTool = () => {
    panState.current.panning = false
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
    if (shapePreview) {
      const s = shapePreview
      if (s) {
        const rgba = paintFor(false)
        if (s.kind === 'line') usePixelStore.getState().drawLine(s.startX, s.startY, s.curX, s.curY, rgba)
        else if (s.kind === 'rect') usePixelStore.getState().drawRect(s.startX, s.startY, s.curX, s.curY, rgba)
        else if (s.kind === 'ellipse') usePixelStore.getState().drawEllipse(s.startX, s.startY, s.curX, s.curY, rgba)
        setShapePreview(null)
        endStroke()
      }
      return
    }
    endStroke()
    endBrush()
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
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

    switch (state.current) {
      case null:
        console.warn("PointerUp in null state")
        return
      case "firstTouch":
        state.current = null

        const f = firstTouch.current
        if (f?.pointerId === e.pointerId) {
          firstTouch.current = null

          if (curTool.current === 'pan')
            return
          if (!startTool(f.x, f.y, e))
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

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') {
      touchState.current.pointers = touchState.current.pointers.filter(p => p.id !== e.pointerId)
      if (touchState.current.pointers.length < 2) {
        touchState.current.multiGesture = false
        touchState.current.lastDist = undefined
        touchState.current.lastCenter = undefined
      }
    }

    switch (state.current) {
      case null:
        return
      case "firstTouch":
        state.current = null
        firstTouch.current = null
        return
      case "pinch":
        if (touchState.current.pointers.length === 0) {
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

  const onPointerLeave = () => { setHoverInfo(undefined) }

  const interactionActive = state.current !== null;

  return {
    shapePreview,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    interactionActive,
  }
}
