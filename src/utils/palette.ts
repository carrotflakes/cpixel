import { compositePixel, LayerLike } from './composite'

// Generate a palette from the current composited image.
// - Collects unique non-transparent colors and sorts by frequency (desc)
// - Ensures a transparent slot at index 0 (0x00000000)
// - Caps palette to maxColors (<=256)
export function generatePaletteFromComposite(
  layers: LayerLike[],
  width: number,
  height: number,
  colorMode: 'truecolor' | 'indexed',
  palette: Uint32Array,
  transparentIndex: number,
  maxColors: number = 256,
): Uint32Array {
  const MAX = Math.max(1, Math.min(maxColors | 0, 256))
  // freq map of RGBA (excluding fully transparent)
  const freq = new Map<number, number>()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgba = compositePixel(layers, x, y, colorMode, palette, transparentIndex, width, height) >>> 0
      if ((rgba & 0xff) === 0) continue // skip fully transparent
      freq.set(rgba, (freq.get(rgba) || 0) + 1)
    }
  }

  // Sort colors by frequency desc
  const colors = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c >>> 0)

  // Build final palette with transparent at index 0
  const count = Math.min(colors.length, Math.max(0, MAX - 1))
  const out = new Uint32Array(count + 1)
  out[0] = 0x00000000 // transparent slot
  for (let i = 0; i < count; i++) out[i + 1] = colors[i] >>> 0
  return out
}
