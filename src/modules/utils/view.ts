// View math helpers
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

// Clamp view so content stays within or is centered if smaller than viewport
export function clampViewToBounds(
  vx: number,
  vy: number,
  vw: number,
  vh: number,
  cw: number,
  ch: number,
): { vx: number; vy: number } {
  // If content is smaller than viewport, center it
  if (cw <= vw && ch <= vh) return { vx: (vw - cw) * 0.5, vy: (vh - ch) * 0.5 }

  const clampAxis = (v: number, vSize: number, cSize: number) => {
    const min = vSize - cSize - 50
    const max = 50
    if (max < min) return (vSize - cSize) * 0.5 // center
    return Math.max(min, Math.min(max, v))
  }
  return { vx: clampAxis(vx, vw, cw), vy: clampAxis(vy, vh, ch) }
}
