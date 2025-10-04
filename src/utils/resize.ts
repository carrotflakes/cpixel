export function resizeLayers<T extends { data: Uint32Array | Uint8Array }>(
  layers: T[],
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
): T[] {
  const copyW = Math.min(oldW, newW)
  const copyH = Math.min(oldH, newH)
  return layers.map((l) => {
    const src = l.data
    const dst = src instanceof Uint32Array ? new Uint32Array(newW * newH) : new Uint8Array(newW * newH)
    for (let y = 0; y < copyH; y++) {
      dst.set(src.subarray(y * oldW, y * oldW + copyW), y * newW)
    }
    return { ...l, data: dst }
  })
}
