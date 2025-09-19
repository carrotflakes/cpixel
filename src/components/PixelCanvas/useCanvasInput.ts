import { useRef, useState } from 'react'
import { useAppStore, MIN_SCALE, MAX_SCALE, ToolType } from '@/stores/store'
import { clamp, clampView } from '@/utils/view'
import { compositePixel, findTopPaletteIndex, LayerLike } from '@/utils/composite'
import { isPointInMask, polygonToMask, magicWandMask } from '@/utils/selection'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useCanvasPanZoom } from './useCanvasPanZoom'
import { useSettingsStore } from '@/stores/settingsStore'

type ShapePreview = {
  kind: 'line' | 'rect' | 'ellipse'
  startX: number
  startY: number
  curX: number
  curY: number
}

export function useCanvasInput(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const view = useAppStore(s => s.view)
  const color = useAppStore(s => s.color)
  const setColor = useAppStore(s => s.setColor)
  const setColorIndex = useAppStore(s => s.setColorIndex)
  const beginStroke = useAppStore(s => s.beginStroke)
  const endStroke = useAppStore(s => s.endStroke)
  const layers = useAppStore(s => s.layers)
  const mode = useAppStore(s => s.mode)
  const palette = useAppStore(s => s.palette)
  const transparentIndex = useAppStore(s => s.transparentIndex)
  const currentPaletteIndex = useAppStore(s => s.currentPaletteIndex)
  const setView = useAppStore(s => s.setView)
  const setHoverInfo = useAppStore(s => s.setHoverInfo)
  const selectionMask = useAppStore(s => s.selection?.mask)
  const setSelectionRect = useAppStore(s => s.setSelectionRect)
  const setSelectionMask = useAppStore(s => s.setSelectionMask)
  const beginSelectionDrag = useAppStore(s => s.beginSelectionDrag)
  const setSelectionOffset = useAppStore(s => s.setSelectionOffset)
  const commitSelectionMove = useAppStore(s => s.commitSelectionMove)
  const W = useAppStore(s => s.width)
  const H = useAppStore(s => s.height)
  const settings = useSettingsStore()

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
  const moveDrag = useRef<{ active: boolean; startX: number; startY: number; baseLayers: { id: string; visible: boolean; locked: boolean; data: Uint32Array | Uint8Array }[] } | null>(null)
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
    const vx = view.x + (rect.width - W * view.scale) / 2
    const vy = view.y + (rect.height - H * view.scale) / 2
    const x = Math.floor((clientX - rect.left - vx) / view.scale)
    const y = Math.floor((clientY - rect.top - vy) / view.scale)
    return { x, y }
  }
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  const paintFor = (erase: boolean) => (
    mode === 'indexed'
      ? (erase ? transparentIndex : currentPaletteIndex) ?? 0
      : erase ? 0x00000000 : color
  )
  const isShapeTool = () => curTool.current === 'line' || curTool.current === 'rect' || curTool.current === 'ellipse'
  const isSelectionTool = () => curTool.current === 'select-rect' || curTool.current === 'select-lasso' || curTool.current === 'select-wand'
  const isMoveTool = () => curTool.current === 'move'
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
    if (mode === 'indexed') {
      const idx = findTopPaletteIndex(layers, x, y, W, H, transparentIndex) ?? transparentIndex
      setColorIndex(idx)
    } else {
      const rgba = compositePixel(layers, x, y, mode, palette, transparentIndex, W, H)
      setColor(rgba)
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

  const startTool_ = (e: { x?: number, y?: number, clientX?: number, clientY?: number, button: number, shiftKey: boolean }) => {
    const { x, y } = e.x !== undefined && e.y !== undefined ? { x: e.x, y: e.y } : pickPoint(e.clientX!, e.clientY!)

    if (isEyedropperTool()) { pickColorAt(x, y); return true }

    if (!inBounds(x, y)) return false

    // If a selection mask exists and pointer is outside, block starting paint / shape tools (selection tools still allowed)
    if (!isSelectionTool() && selectionMask && !pointInSelection(x, y)) return false

    if (isMoveTool()) {
      beginStroke()
      moveDrag.current = { active: true, startX: x, startY: y, baseLayers: layers.map(l => ({ id: l.id, visible: l.visible, locked: l.locked, data: l.data instanceof Uint32Array ? new Uint32Array(l.data) : new Uint8Array(l.data) })) }
      return true
    }
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
        useAppStore.getState().fillBucket(x, y, paintFor(false), contiguous)
      } else if (isBrushishTool()) {
        const erase = curTool.current === 'eraser'
        mouseStroke.current = { active: true, erase, lastX: x, lastY: y }
        useAppStore.getState().setAt(x, y, paintFor(erase))
      }
    }
  }

  const startTool = (e: React.PointerEvent<HTMLCanvasElement>) => {
    firstTouch.current = null
    state.current = 'tool'
    toolPointerId.current = e.pointerId

    if (curTool.current === 'pan') {
      panState.current = { lastX: e.clientX, lastY: e.clientY, panning: true }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      return
    }

    if (startTool_(e)) {
      return
    }
    onPointer(e)
  }

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (touchState.current.multiGesture) return

    const { x, y } = pickPoint(e.clientX, e.clientY)

    if (isSelectionTool()) return
    if (isMoveTool()) return
    if (isEyedropperTool()) { pickColorAt(x, y); return }
    if (isBucketTool()) return

    if (mouseStroke.current.active && mouseStroke.current.lastX !== undefined && mouseStroke.current.lastY !== undefined) {
      const rgba = paintFor(mouseStroke.current.erase)
      useAppStore.getState().drawLine(mouseStroke.current.lastX, mouseStroke.current.lastY, x, y, rgba)
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
        curTool.current = e.button === 2 ? settings.rightClickTool : useAppStore.getState().tool
        if (e.altKey) curTool.current = 'eyedropper'
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) curTool.current = 'pan'

        if (e.pointerType === 'touch') {
          state.current = 'firstTouch'

          addPointer(e)

          firstTouch.current = { pointerId: e.pointerId, x, y, clientX: e.clientX, clientY: e.clientY, button: e.button, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey }
        } else {
          startTool(e)
        }
        return
      case "firstTouch":
        if (e.pointerType === 'pen') {
          startTool(e)
          return
        }
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

          if (settings.usePen)
            return

          firstTouch.current = null
          state.current = 'tool'
          toolPointerId.current = e.pointerId

          if (curTool.current === 'pan') {
            panState.current = { lastX: f.clientX, lastY: f.clientY, panning: true }
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
            return
          }

          if (startTool_(f)) {
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
                const dcx = cx - lastC.x
                const dcy = cy - lastC.y
                const vw = rect.width, vh = rect.height

                const curContentW = W * view.scale, curContentH = H * view.scale
                const curVX = view.x + (vw - curContentW) / 2, curVY = view.y + (vh - curContentH) / 2
                const Cx = cx - rect.left
                const Cy = cy - rect.top
                const newVX = (curVX + dcx) - (Cx - (curVX + dcx)) * (ratio - 1)
                const newVY = (curVY + dcy) - (Cy - (curVY + dcy)) * (ratio - 1)
                const nextContentW = W * nextScale, nextContentH = H * nextScale
                const cxRaw = newVX - (vw - nextContentW) / 2, cyRaw = newVY - (vh - nextContentH) / 2
                const { cx: ccx, cy: ccy } = clampView(cxRaw, cyRaw, nextContentW, nextContentH)
                setView(ccx, ccy, nextScale)
                touchState.current.lastDist = dist
                touchState.current.lastCenter = { x: cx, y: cy }
              }
            }
          }
        }
        return
      case "tool":
        if (e.pointerId !== toolPointerId.current) return

        if (moveDrag.current?.active) {
          const dx = x - moveDrag.current.startX
          const dy = y - moveDrag.current.startY
          useAppStore.getState().translateAllLayers(moveDrag.current.baseLayers, dx, dy)
          return
        }
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
          const cw = W * view.scale
          const ch = H * view.scale
          const { cx, cy } = clampView(view.x + dx, view.y + dy, cw, ch)
          setView(cx, cy, view.scale)
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
    if (moveDrag.current?.active) {
      moveDrag.current = null
      endStroke()
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
        if (s.kind === 'line') useAppStore.getState().drawLine(s.startX, s.startY, s.curX, s.curY, rgba)
        else if (s.kind === 'rect') useAppStore.getState().drawRect(s.startX, s.startY, s.curX, s.curY, rgba)
        else if (s.kind === 'ellipse') useAppStore.getState().drawEllipse(s.startX, s.startY, s.curX, s.curY, rgba)
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

          if (settings.usePen)
            return

          // Invoke tool that would have been started on pointerdown
          beginStroke()
          const contiguous = !e.shiftKey
          if (isBucketTool()) {
            useAppStore.getState().fillBucket(f.x, f.y, paintFor(false), contiguous)
          } else if (isBrushishTool()) {
            const erase = curTool.current === 'eraser'
            mouseStroke.current = { active: true, erase, lastX: f.x, lastY: f.y }
            useAppStore.getState().setAt(f.x, f.y, paintFor(erase))
          }

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
              useAppStore.getState().undo()
            } else if (fingers === 3) {
              useAppStore.getState().redo()
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
