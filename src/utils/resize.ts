import type { ColorMode } from '@/types'

export type LayerLike = {
  id: string
  visible: boolean
  locked: boolean
  data: Uint32Array | Uint8Array
}

export function resizeLayers(
  layers: LayerLike[],
  colorMode: ColorMode,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
) {
  const copyW = Math.min(oldW, newW)
  const copyH = Math.min(oldH, newH)
  return layers.map((l) => {
    const src = l.data
    const dst = colorMode === 'rgba' ? new Uint32Array(newW * newH) : new Uint8Array(newW * newH)
    for (let y = 0; y < copyH; y++) {
      dst.set(src.subarray(y * oldW, y * oldW + copyW), y * newW)
    }
    return { ...l, data: dst }
  })
}
