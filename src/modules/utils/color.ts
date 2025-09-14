// Color utilities: pack/unpack and CSS conversions
// Packed order: 0xRRGGBBAA stored in a number

export type RGBA = { r: number; g: number; b: number; a: number }

export const packRGBA = ({ r, g, b, a }: RGBA): number =>
  ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)

export const unpackRGBA = (rgba: number): RGBA => ({
  r: (rgba >>> 24) & 0xff,
  g: (rgba >>> 16) & 0xff,
  b: (rgba >>> 8) & 0xff,
  a: (rgba >>> 0) & 0xff,
})

// Accepts #rrggbb or #rrggbbaa
export function parseCSSColor(css: string): number {
  if (css.startsWith('#')) {
    const hex = css.slice(1)
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return packRGBA({ r, g, b, a: 0xff })
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const a = parseInt(hex.slice(6, 8), 16)
      return packRGBA({ r, g, b, a })
    }
  }
  return packRGBA({ r: 0, g: 0, b: 0, a: 0xff })
}

export function rgbaToCSSHex(rgba: number): string {
  const { r, g, b, a } = unpackRGBA(rgba)
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  if (a === 0xff) return `#${hex(r)}${hex(g)}${hex(b)}`
  return `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`
}

// Simple squared distance in RGB space (ignore alpha for nearest-color search)
const dist2 = (a: RGBA, b: RGBA) => {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return dr*dr + dg*dg + db*db
}

export function nearestIndexInPalette(palette: Uint32Array, transparentIndex: number, rgba: number): number {
  const c = unpackRGBA(rgba)
  if (c.r === 0) return transparentIndex
  let best = transparentIndex
  let bestD = Number.POSITIVE_INFINITY
  for (let i = 0; i < palette.length; i++) {
    if (i === transparentIndex) continue
    const pi = palette[i] >>> 0
    const a = pi & 0xff
    if (a === 0) continue // skip fully transparent entries (e.g., transparentIndex)
    const d = dist2(c, unpackRGBA(pi))
    if (d < bestD) { bestD = d; best = i }
  }
  return best
}
