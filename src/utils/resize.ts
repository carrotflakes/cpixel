export type LayerLike = {
  id: string
  visible: boolean
  locked: boolean
  data: Uint32Array | Uint8Array
}

export function resizeLayers(
  layers: LayerLike[],
  colorMode: 'rgba' | 'indexed',
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
) {
  const copyW = Math.min(oldW, newW)
  const copyH = Math.min(oldH, newH)
  return layers.map((l) => {
    if (colorMode === 'rgba') {
      const src = l.data instanceof Uint32Array ? l.data : new Uint32Array(oldW * oldH)
      const dst = new Uint32Array(newW * newH)
      for (let y = 0; y < copyH; y++) {
        dst.set(src.subarray(y * oldW, y * oldW + copyW), y * newW)
      }
      return { ...l, data: dst }
    } else {
      const src = l.data instanceof Uint8Array ? l.data : new Uint8Array(oldW * oldH)
      const dst = new Uint8Array(newW * newH)
      for (let y = 0; y < copyH; y++) {
        dst.set(src.subarray(y * oldW, y * oldW + copyW), y * newW)
      }
      return { ...l, data: dst }
    }
  })
}
