// Bresenham line rasterization utility
export function rasterizeLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cb: (x: number, y: number) => void
) {
  // Ensure integer coordinates
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0, y = y0
  while (true) {
    cb(x, y)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
}
