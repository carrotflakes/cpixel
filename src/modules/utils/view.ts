// View math helpers
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export function clampView(
  cx: number,
  cy: number,
  cw: number,
  ch: number,
): { cx: number; cy: number } {
  const clampAxis = (c: number, cSize: number) => {
    const margin = cSize / 2
    return Math.max(-margin, Math.min(margin, c))
  }
  return { cx: clampAxis(cx, cw), cy: clampAxis(cy, ch) }
}
