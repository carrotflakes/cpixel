type LayerLike = {
  id: string
  visible: boolean
  locked: boolean
  data: Uint32Array | Uint8Array
}

/**
 * Flip layers horizontally (left/right)
 */
export function flipLayersHorizontal(
  layers: LayerLike[],
  colorMode: 'rgba' | 'indexed',
  width: number,
  height: number,
) {
  return layers.map((layer) => {
    const dst = colorMode === 'rgba' ? new Uint32Array(width * height) : new Uint8Array(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x
        const dstIndex = y * width + (width - 1 - x)
        dst[dstIndex] = layer.data[srcIndex]
      }
    }
    return { ...layer, data: dst }
  })
}

/**
 * Flip layers vertically (up/down)
 */
export function flipLayersVertical(
  layers: LayerLike[],
  colorMode: 'rgba' | 'indexed',
  width: number,
  height: number,
) {
  return layers.map((layer) => {
    const dst = colorMode === 'rgba' ? new Uint32Array(width * height) : new Uint8Array(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x
        const dstIndex = (height - 1 - y) * width + x
        dst[dstIndex] = layer.data[srcIndex]
      }
    }
    return { ...layer, data: dst }
  })
}
