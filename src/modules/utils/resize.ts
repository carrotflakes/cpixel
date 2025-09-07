export type LayerLike = {
  id: string
  visible: boolean
  locked: boolean
  data?: Uint32Array
  indices?: Uint8Array
}

export function resizeLayers(
  layers: LayerLike[],
  mode: 'truecolor' | 'indexed',
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
) {
  const copyW = Math.min(oldW, newW)
  const copyH = Math.min(oldH, newH)
  return layers.map((l) => {
    if (mode === 'truecolor') {
      const src = l.data ?? new Uint32Array(oldW * oldH)
      const dst = new Uint32Array(newW * newH)
      for (let y = 0; y < copyH; y++) {
        dst.set(src.subarray(y * oldW, y * oldW + copyW), y * newW)
      }
      return { ...l, data: dst, indices: undefined }
    } else {
      const src = l.indices ?? new Uint8Array(oldW * oldH)
      const dst = new Uint8Array(newW * newH)
      for (let y = 0; y < copyH; y++) {
        dst.set(src.subarray(y * oldW, y * oldW + copyW), y * newW)
      }
      return { ...l, indices: dst, data: undefined }
    }
  })
}
