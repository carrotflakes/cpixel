import { ColorMode } from "@/types";
import { Layer, Palette } from "./types";
import { compositePixel } from "@/utils/composite";

export function pickColor(appState: {
  colorMode: ColorMode
  layers: Layer[]
  width: number
  height: number
  eyedropperSampleMode: 'front' | 'composite'
  palette: Palette
}, x: number, y: number) {
  const { colorMode, layers, width, height, eyedropperSampleMode, palette } = appState
  if (x < 0 || y < 0 || x >= width || y >= height) return null
  if (eyedropperSampleMode === 'front') {
    if (colorMode === 'indexed') {
      const idx = findTopPaletteIndex(layers, x, y, width, height, palette.transparentIndex)
      if (idx === null) return 0x00000000
      return palette.colors[idx] ?? null
    }
    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li]
      if (!layer.visible) continue
      if (!(layer.data instanceof Uint32Array)) continue
      const px = layer.data[y * width + x]
      if ((px & 0xff) === 0) continue
      return px >>> 0
    }
    return 0x00000000
  } else if (eyedropperSampleMode === 'composite') {
    return compositePixel(layers, x, y, colorMode, palette, width, height)
  }
  throw new Error(`Invalid eyedropper sample mode: ${eyedropperSampleMode}`)
}

// Find the top-most visible palette index at a pixel (returns undefined if none)
export function findTopPaletteIndex(
  layers: Layer[],
  x: number,
  y: number,
  width: number,
  height: number,
  transparentIndex: number,
): number | null {
  if (x < 0 || y < 0 || x >= width || y >= height) return null
  for (let li = layers.length - 1; li >= 0; li--) {
    const layer = layers[li]
    if (!layer.visible) continue
    if (!(layer.data instanceof Uint8Array)) continue
    const pi = layer.data[y * width + x]
    if (pi === transparentIndex) continue
    return pi
  }
  return null
}
