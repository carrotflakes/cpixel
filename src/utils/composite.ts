export type LayerLike = {
  visible: boolean
  data: Uint32Array | Uint8Array
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
  colorMode: 'rgba' | 'indexed',
  palette: Uint32Array,
  transparentIndex: number,
  width = 64,
  height = 64,
): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0x00000000
  const i = y * width + x
  let out = 0x00000000
  for (const layer of layers) {
    if (!layer.visible) continue
    const src = colorMode === 'rgba'
      ? layer.data[i] ?? 0x00000000
      : layer.data[i] === transparentIndex ? 0x00000000 : palette[layer.data[i] ?? 0] ?? 0x00000000
    out = over(src, out)
  }
  return out >>> 0
}

// Find the top-most visible palette index at a pixel (returns undefined if none)
export function findTopPaletteIndex(
  layers: LayerLike[],
  x: number,
  y: number,
  width: number,
  height: number,
  transparentIndex: number,
): number | undefined {
  if (x < 0 || y < 0 || x >= width || y >= height) return undefined
  for (let li = layers.length - 1; li >= 0; li--) {
    const L = layers[li]
    if (!L.visible) continue
    const pi = L.data[y * width + x]
    if (pi === undefined || pi === transparentIndex) continue
    return pi
  }
  return undefined
}

// Composite all pixels into an ImageData
export function compositeImageData(
  layers: LayerLike[],
  colorMode: 'rgba' | 'indexed',
  palette: Uint32Array,
  transparentIndex: number,
  img: ImageData,
) {
  const width = img.width
  const height = img.height
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const out = compositePixel(layers, x, y, colorMode, palette, transparentIndex, width, height)
      const i = (y * width + x) * 4
      img.data[i + 0] = (out >>> 24) & 0xff
      img.data[i + 1] = (out >>> 16) & 0xff
      img.data[i + 2] = (out >>> 8) & 0xff
      img.data[i + 3] = (out >>> 0) & 0xff
    }
  }
}
