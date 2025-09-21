// Pure translation helpers for shifting pixel data
// Keeps immutability: always returns a new typed array

export function translate(src: Uint32Array | Uint8Array, W: number, H: number, dx: number, dy: number, transparent: number) {
  dx |= 0; dy |= 0
  if (dx === 0 && dy === 0) return src
  const out = src instanceof Uint32Array ? new Uint32Array(W * H) : new Uint8Array(W * H)
  out.fill(transparent)
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
