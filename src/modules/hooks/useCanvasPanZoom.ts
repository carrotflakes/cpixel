import { useEffect } from 'react'
import { clampView } from '../utils/view'
import { MIN_SCALE, MAX_SCALE } from '../stores/store'

export function useCanvasPanZoom(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  view: { x: number; y: number; scale: number },
  setView: (x: number, y: number, scale: number) => void,
  W: number,
  H: number,
) {
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY
    const k = delta > 0 ? 0.9 : 1.1
    const nextScale = Math.max(Math.min(view.scale * k, MAX_SCALE), MIN_SCALE)
    if (nextScale === view.scale) return
    const ratio = nextScale / view.scale

    const rect = canvasRef.current!.getBoundingClientRect()
    const Cx = e.clientX - rect.left, Cy = e.clientY - rect.top
    const vw = rect.width, vh = rect.height
    const curContentW = W * view.scale, curContentH = H * view.scale
    const curVX = view.x + (vw - curContentW) / 2, curVY = view.y + (vh - curContentH) / 2
    const newVX = curVX - (Cx - curVX) * (ratio - 1), newVY = curVY - (Cy - curVY) * (ratio - 1)
    const nextContentW = W * nextScale, nextContentH = H * nextScale
    const cx = newVX - (vw - nextContentW) / 2, cy = newVY - (vh - nextContentH) / 2
    const { cx: clampedCX, cy: clampedCY } = clampView(cx, cy, nextContentW, nextContentH)

    setView(clampedCX, clampedCY, nextScale)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [canvasRef, view, setView, W, H])
}
