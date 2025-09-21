// Pure translation helpers for shifting pixel data
// Keeps immutability: always returns a new typed array

export function translateRgba(src: Uint32Array, W: number, H: number, dx: number, dy: number): Uint32Array {
  dx |= 0; dy |= 0
  if (dx === 0 && dy === 0) return src
  const out = new Uint32Array(W * H)
  if (Math.abs(dx) >= W || Math.abs(dy) >= H) return out // all moved out -> transparent (0)
  for (let y = 0; y < H; y++) {
    const ny = y + dy
    if (ny < 0 || ny >= H) continue
    const row = y * W
    const nrow = ny * W
    for (let x = 0; x < W; x++) {
      const nx = x + dx
      if (nx < 0 || nx >= W) continue
      out[nrow + nx] = src[row + x]
    }
  }
  return out
}

export function translateIndexed(src: Uint8Array, W: number, H: number, dx: number, dy: number, transparentIndex: number): Uint8Array {
  dx |= 0; dy |= 0
  if (dx === 0 && dy === 0) return src
  const out = new Uint8Array(W * H)
  out.fill(transparentIndex & 0xff)
  if (Math.abs(dx) >= W || Math.abs(dy) >= H) return out // all moved out -> fully transparent
  for (let y = 0; y < H; y++) {
    const ny = y + dy
    if (ny < 0 || ny >= H) continue
    const row = y * W
    const nrow = ny * W
    for (let x = 0; x < W; x++) {
      const nx = x + dx
      if (nx < 0 || nx >= W) continue
      out[nrow + nx] = src[row + x]
    }
  }
  return out
}
