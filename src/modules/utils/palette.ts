import { compositePixel, LayerLike } from './composite'

// Generate a palette from the current composited image.
// - Collects unique non-transparent colors and sorts by frequency (desc)
// - Places transparent slot at specified index (default 0)
// - Caps palette to maxColors (<=256)
export function generatePaletteFromComposite(
  layers: LayerLike[],
  width: number,
  height: number,
  mode: 'truecolor' | 'indexed',
  palette: Uint32Array,
  transparentIndex: number,
  maxColors: number = 256,
  preferredTransparentIndex: number = 0,
): Uint32Array {
  const MAX = Math.max(1, Math.min(maxColors | 0, 256))
  const ti = Math.max(0, Math.min(preferredTransparentIndex | 0, MAX - 1))
  
  // freq map of RGBA (excluding fully transparent)
  const freq = new Map<number, number>()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgba = compositePixel(layers, x, y, mode, palette, transparentIndex, width, height) >>> 0
      if ((rgba & 0xff) === 0) continue // skip fully transparent
      freq.set(rgba, (freq.get(rgba) || 0) + 1)
    }
  }

  // Sort colors by frequency desc
  const colors = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c >>> 0)

  // Build final palette with transparent at preferred index
  const count = Math.min(colors.length, Math.max(0, MAX - 1))
  const out = new Uint32Array(count + 1)
  
  // Fill with colors, leaving space for transparent slot
  let colorIndex = 0
  for (let i = 0; i < out.length; i++) {
    if (i === ti) {
      out[i] = 0x00000000 // transparent slot
    } else if (colorIndex < count) {
      out[i] = colors[colorIndex++] >>> 0
    } else {
      out[i] = 0x000000FF // fill remaining with black
    }
  }
  
  return out
}
