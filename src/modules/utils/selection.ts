export type Point = { x: number; y: number }

export function rectToMask(W: number, H: number, x0: number, y0: number, x1: number, y1: number) {
  const mask = new Uint8Array(W * H)
  const left = Math.max(0, Math.min(x0, x1)) | 0
  const right = Math.min(W - 1, Math.max(x0, x1)) | 0
  const top = Math.max(0, Math.min(y0, y1)) | 0
  const bottom = Math.min(H - 1, Math.max(y0, y1)) | 0
  for (let y = top; y <= bottom; y++) {
    const row = y * W
    for (let x = left; x <= right; x++) mask[row + x] = 1
  }
  return { mask, bounds: { left, top, right, bottom } }
}

// Point-in-polygon mask (even-odd rule)
export function polygonToMask(W: number, H: number, points: Point[]) {
  const mask = new Uint8Array(W * H)
  if (points.length < 3) return { mask, bounds: { left: 0, top: 0, right: -1, bottom: -1 } }
  let left = W - 1, right = 0, top = H - 1, bottom = 0
  for (const p of points) {
    if (p.x < left) left = p.x
    if (p.x > right) right = p.x
    if (p.y < top) top = p.y
    if (p.y > bottom) bottom = p.y
  }
  left = Math.max(0, Math.min(W - 1, left | 0))
  right = Math.max(0, Math.min(W - 1, right | 0))
  top = Math.max(0, Math.min(H - 1, top | 0))
  bottom = Math.max(0, Math.min(H - 1, bottom | 0))
  // even-odd test per pixel center
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      let inside = false
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y
        const xj = points[j].x, yj = points[j].y
        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi)
        if (intersect) inside = !inside
      }
      if (inside) mask[y * W + x] = 1
    }
  }
  return { mask, bounds: { left, top, right, bottom } }
}

export function isPointInMask(mask: Uint8Array | undefined, W: number, H: number, x: number, y: number) {
  if (!mask) return false
  if (x < 0 || y < 0 || x >= W || y >= H) return false
  return mask[y * W + x] !== 0
}
