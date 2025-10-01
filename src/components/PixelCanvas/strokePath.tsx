export type StrokePath = {
  addPoint(x: number, y: number): void
  getSmoothedPoint(): { x: number; y: number } | null
  finish(): void
}

// A function that smooths the movement of the pointer from the past n points
export function smoothPath(n: number) {
  n = Math.max(1, n)
  const points: Array<Readonly<{ x: number; y: number }>> = []
  let i = 0
  let finished = false

  return {
    addPoint(x: number, y: number) {
      if (finished) return
      points.push({ x, y })
    },
    getSmoothedPoint(): { x: number; y: number } | null {
      if (points.length <= i) return null
      if (i === 0 || (finished && points.length - 1 === i)) {
        i++
        return {
          x: points[i-1].x,
          y: points[i-1].y,
        }
      }
      if (!finished && points.length - i < n) return null
      const recentPoints = points.slice(Math.max(0, i), Math.min(i + n, points.length))
      let x = 0, y = 0
      for (const p of recentPoints) {
        x += p.x
        y += p.y
      }
      i++
      return {
        x: x / recentPoints.length,
        y: y / recentPoints.length
      }
    },
    finish() {
      finished = true
    },
  }
}

export function skipPath(strokePath: StrokePath) {
  let finished = false
  let lastPoint: { x: number; y: number } | null = null

  return {
    addPoint(x: number, y: number) {
      strokePath.addPoint(x, y)
    },
    getSmoothedPoint() {
      const p = strokePath.getSmoothedPoint()
      if (!p) return null
      if (finished) return p
      if (lastPoint) {
        const d = Math.hypot(p.x - lastPoint.x, p.y - lastPoint.y)
        if (d < 1) return null
      }
      lastPoint = p
      return p
    },
    finish() {
      finished = true
      strokePath.finish()
    },
  }
}
