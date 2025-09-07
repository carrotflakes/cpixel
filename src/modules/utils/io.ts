import { nearestIndexInPalette } from './color'

export type NormalizedLayer = {
  id: string
  visible: boolean
  locked: boolean
  data?: Uint32Array
  indices?: Uint8Array
}

export type NormalizedImport = {
  width: number
  height: number
  mode: 'truecolor' | 'indexed'
  layers: NormalizedLayer[]
  activeLayerId: string
  palette: Uint32Array
  transparentIndex: number
  color: string
  recentColorsTruecolor: string[]
  recentColorsIndexed: number[]
}

// Normalize a cpixel JSON payload into state-like fields. Returns null if invalid.
export function normalizeImportedJSON(
  data: unknown,
  defaults: { palette: Uint32Array; color: string; recentColorsTruecolor: string[]; recentColorsIndexed: number[] },
): NormalizedImport | null {
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
  if (!isObj(data)) return null
  const obj = data as Record<string, unknown>
  if (obj.app !== 'cpixel') return null
  const impMode: 'truecolor' | 'indexed' = obj.mode === 'indexed' ? 'indexed' : 'truecolor'
  const width = Math.max(1, (typeof obj.width === 'number' ? (obj.width | 0) : 0))
  const height = Math.max(1, (typeof obj.height === 'number' ? (obj.height | 0) : 0))
  const targetSize = width * height
  const clampSize = (arr: number[], fill = 0) => {
    const out = new Array<number>(targetSize)
    const n = Math.min(targetSize, arr.length)
    for (let i = 0; i < n; i++) out[i] = (arr[i] >>> 0)
    for (let i = n; i < targetSize; i++) out[i] = fill >>> 0
    return out
  }
  const layersIn = Array.isArray(obj.layers) ? obj.layers : []
  const paletteIn: number[] = Array.isArray(obj.palette) ? obj.palette : []
  const transparentIndexIn = typeof obj.transparentIndex === 'number' ? obj.transparentIndex | 0 : 0
  // Build palette (<= 256, ensure transparent slot is transparent)
  let nextPalette = new Uint32Array(paletteIn.map((v) => v >>> 0))
  if (nextPalette.length === 0) nextPalette = defaults.palette.slice(0)
  if (nextPalette.length > 256) nextPalette = new Uint32Array(nextPalette.slice(0, 256))
  const ti = Math.max(0, Math.min(transparentIndexIn | 0, Math.max(0, nextPalette.length - 1)))
  if (nextPalette.length > 0) nextPalette[ti] = 0x00000000

  const nextLayers = layersIn.map((l: unknown, idx: number) => {
    const rec = l as Record<string, unknown> | undefined
    const id = typeof rec?.id === 'string' ? rec.id : `L${idx + 1}`
    const visible = rec?.visible !== false
    const locked = !!rec?.locked
    if (impMode === 'truecolor') {
      if (Array.isArray(rec?.data)) {
        const dataArr: number[] = clampSize(rec.data as number[], 0)
        const data = new Uint32Array(dataArr.map(v => v >>> 0))
        return { id, visible, locked, data }
      } else if (Array.isArray(rec?.indices)) {
        const idxArr: number[] = clampSize(rec.indices as number[], ti)
        const data = new Uint32Array(targetSize)
        for (let i = 0; i < targetSize; i++) {
          const pi = (idxArr[i] | 0) & 0xff
          data[i] = nextPalette[pi] ?? 0x00000000
        }
        return { id, visible, locked, data }
      } else {
        const data = new Uint32Array(targetSize)
        return { id, visible, locked, data }
      }
    } else {
      if (Array.isArray(rec?.indices)) {
        const idxArr: number[] = clampSize(rec.indices as number[], ti)
        const indices = new Uint8Array(idxArr.map(v => (v | 0) & 0xff))
        return { id, visible, locked, indices }
      } else if (Array.isArray(rec?.data)) {
        const srcArr: number[] = clampSize(rec.data as number[], 0)
        const indices = new Uint8Array(targetSize)
        for (let i = 0; i < targetSize; i++) {
          const rgba = (srcArr[i] >>> 0)
          indices[i] = (rgba === 0x00000000) ? (ti & 0xff) : (nearestIndexInPalette(nextPalette, rgba, ti) & 0xff)
        }
        return { id, visible, locked, indices }
      } else {
        const indices = new Uint8Array(new Array(targetSize).fill(ti & 0xff))
        return { id, visible, locked, indices }
      }
    }
  }) as NormalizedLayer[]

  const activeLayerId = typeof obj.activeLayerId === 'string' && nextLayers.some(l => l.id === obj.activeLayerId)
    ? obj.activeLayerId
    : (nextLayers[0]?.id || 'L1')
  const nextColor = typeof obj.color === 'string' ? obj.color : defaults.color
  // Backward compatibility: if flat recentColors provided, apply to truecolor list
  const flatRecent = Array.isArray(obj.recentColors)
    ? (obj.recentColors as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 10)
    : undefined
  const rcTrue = Array.isArray(obj.recentColorsTruecolor)
    ? (obj.recentColorsTruecolor as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 10)
    : (flatRecent ?? defaults.recentColorsTruecolor)
  const rcIndexed = Array.isArray(obj.recentColorsIndexed)
    ? (obj.recentColorsIndexed as unknown[]).filter(x => Number.isFinite(Number(x))).map(x => Number(x) | 0).slice(0, 10)
    : defaults.recentColorsIndexed

  return {
    width,
    height,
    mode: impMode,
    layers: nextLayers,
    activeLayerId,
    palette: nextPalette,
    transparentIndex: Math.max(0, Math.min(ti, Math.max(0, nextPalette.length - 1))),
    color: nextColor,
    recentColorsTruecolor: rcTrue,
    recentColorsIndexed: rcIndexed,
  }
}
