import { useEffect } from 'react'
import { clampViewToBounds } from '../utils/view'
import { MIN_SIZE, MAX_SIZE } from '../store'

export function useCanvasPanZoom(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  view: { x: number; y: number; scale: number },
  setView: (x: number, y: number, scale: number) => void,
  W: number,
  H: number,
) {
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const Cx = e.clientX - rect.left
    const Cy = e.clientY - rect.top
    const delta = e.deltaY
    const k = delta > 0 ? 0.9 : 1.1
    const nextSize = Math.max(Math.min(view.scale * k, MAX_SIZE), MIN_SIZE)
    if (nextSize === view.scale) return
    const ratio = nextSize / view.scale
    const newVX = view.x - (Cx - view.x) * (ratio - 1)
    const newVY = view.y - (Cy - view.y) * (ratio - 1)
    const { vx: cvx2, vy: cvy2 } = clampViewToBounds(newVX, newVY, rect.width, rect.height, W * nextSize, H * nextSize)
    setView(Math.round(cvx2), Math.round(cvy2), nextSize)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [canvasRef, view, setView, W, H])
}
