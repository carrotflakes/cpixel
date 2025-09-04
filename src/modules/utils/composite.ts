import { WIDTH, HEIGHT } from "../store"

export type LayerLike = {
  visible: boolean
  data?: Uint32Array
  indices?: Uint8Array
}

// Alpha-over compositing of a single source pixel over a destination pixel (both RGBA packed as 0xRRGGBBAA)
function over(src: number, dst: number): number {
  const aS = src & 0xff
  if (aS === 0) return dst
  const rS = (src >>> 24) & 0xff
  const gS = (src >>> 16) & 0xff
  const bS = (src >>> 8) & 0xff
  const rD = (dst >>> 24) & 0xff
  const gD = (dst >>> 16) & 0xff
  const bD = (dst >>> 8) & 0xff
  const aD = dst & 0xff
  const aO = aS + ((aD * (255 - aS) + 127) / 255 | 0)
  const rO = ((rS * aS + rD * aD * (255 - aS) / 255 + 127) / 255) | 0
  const gO = ((gS * aS + gD * aD * (255 - aS) / 255 + 127) / 255) | 0
  const bO = ((bS * aS + bD * aD * (255 - aS) / 255 + 127) / 255) | 0
  return (rO << 24) | (gO << 16) | (bO << 8) | (aO & 0xff)
}

// Compute composited RGBA at a single pixel from visible layers
export function compositePixel(
  layers: LayerLike[],
  x: number,
  y: number,
  mode: 'truecolor' | 'indexed',
  palette: Uint32Array,
  transparentIndex: number,
  width = WIDTH,
  height = HEIGHT,
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0x00000000
  let out = 0x00000000
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li]
    if (!L.visible) continue
    let rgba = 0x00000000
    if (mode === 'truecolor') {
      rgba = (L.data ?? new Uint32Array(width * height))[y * width + x] >>> 0
    } else {
      const pi = (L.indices ?? new Uint8Array(width * height))[y * width + x] ?? transparentIndex
      if (pi === transparentIndex) continue
      rgba = palette[pi] ?? 0x00000000
    }
    out = over(rgba, out)
    if ((out & 0xff) === 255) break
  }
  return out >>> 0
}

// Composite all pixels into an ImageData
export function compositeImageData(
  layers: LayerLike[],
  mode: 'truecolor' | 'indexed',
  palette: Uint32Array,
  transparentIndex: number,
  ctx: CanvasRenderingContext2D,
  width = WIDTH,
  height = HEIGHT,
): ImageData {
  const img = ctx.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const out = compositePixel(layers, x, y, mode, palette, transparentIndex, width, height)
      const i = (y * width + x) * 4
      img.data[i + 0] = (out >>> 24) & 0xff
      img.data[i + 1] = (out >>> 16) & 0xff
      img.data[i + 2] = (out >>> 8) & 0xff
      img.data[i + 3] = (out >>> 0) & 0xff
    }
  }
  return img
}
