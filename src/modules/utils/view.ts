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
  const clampAxis = (v: number, vSize: number, cSize: number) => {
    // If content is smaller than viewport, don't clamp (allow free pan)
    if (cSize <= vSize) return v
    const min = vSize - cSize
    const max = 0
    return Math.max(min, Math.min(max, v))
  }
  return { vx: clampAxis(vx, vw, cw), vy: clampAxis(vy, vh, ch) }
}
