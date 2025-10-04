export function generatePalette(
  layers: {data: Uint32Array | Uint8Array}[],
  palette: { colors: Uint32Array, transparentIndex: number },
  maxColors: number = 256,
) {
  const freq = new Map<number, number>()
  for (const layer of layers) {
    const data = layer.data
    if (data instanceof Uint32Array) {
      for (let i = 0; i < data.length; i++) {
        const c = data[i] >>> 0
        if ((c & 0xff) === 0) continue // skip fully transparent
        freq.set(c, (freq.get(c) ?? 0) + 1)
      }
    } else {
      for (let i = 0; i < data.length; i++) {
        const idx = data[i] & 0xff
        if (idx === palette.transparentIndex) continue // skip transparent index
        const c = palette.colors[idx]
        freq.set(c, (freq.get(c) ?? 0) + 1)
      }
    }
  }

  // Sort colors by frequency desc
  const colors = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c >>> 0)

  // Build final palette with transparent at index 0
  const count = Math.min(colors.length, Math.max(0, maxColors - 1))
  const out = new Uint32Array(count + 1)
  out[0] = 0x00000000 // transparent slot
  for (let i = 0; i < count; i++) out[i + 1] = colors[i] >>> 0
  return {
    colors: out,
    transparentIndex: 0,
  }
}
