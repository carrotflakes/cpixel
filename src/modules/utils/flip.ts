export type LayerLike = {
  id: string
  visible: boolean
  locked: boolean
  data?: Uint32Array
  indices?: Uint8Array
}

/**
 * Flip layers horizontally (left/right)
 */
export function flipLayersHorizontal(
  layers: LayerLike[],
  mode: 'truecolor' | 'indexed',
  width: number,
  height: number,
) {
  return layers.map((layer) => {
    if (mode === 'truecolor') {
      const src = layer.data ?? new Uint32Array(width * height)
      const dst = new Uint32Array(width * height)
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIndex = y * width + x
          const dstIndex = y * width + (width - 1 - x)
          dst[dstIndex] = src[srcIndex]
        }
      }
      
      return { ...layer, data: dst, indices: undefined }
    } else {
      const src = layer.indices ?? new Uint8Array(width * height)
      const dst = new Uint8Array(width * height)
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIndex = y * width + x
          const dstIndex = y * width + (width - 1 - x)
          dst[dstIndex] = src[srcIndex]
        }
      }
      
      return { ...layer, indices: dst, data: undefined }
    }
  })
}

/**
 * Flip layers vertically (up/down)
 */
export function flipLayersVertical(
  layers: LayerLike[],
  mode: 'truecolor' | 'indexed',
  width: number,
  height: number,
) {
  return layers.map((layer) => {
    if (mode === 'truecolor') {
      const src = layer.data ?? new Uint32Array(width * height)
      const dst = new Uint32Array(width * height)
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIndex = y * width + x
          const dstIndex = (height - 1 - y) * width + x
          dst[dstIndex] = src[srcIndex]
        }
      }
      
      return { ...layer, data: dst, indices: undefined }
    } else {
      const src = layer.indices ?? new Uint8Array(width * height)
      const dst = new Uint8Array(width * height)
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIndex = y * width + x
          const dstIndex = (height - 1 - y) * width + x
          dst[dstIndex] = src[srcIndex]
        }
      }
      
      return { ...layer, indices: dst, data: undefined }
    }
  })
}