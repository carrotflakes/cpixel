import { nearestIndexInPalette } from './color'

export type NormalizedLayer = {
  id: string
  visible: boolean
  locked: boolean
  data?: Uint32Array
  indices?: Uint8Array
}

export type NormalizedImport = {
  mode: 'truecolor' | 'indexed'
  layers: NormalizedLayer[]
  activeLayerId: string
  palette: Uint32Array
  transparentIndex: number
  color: string
  recentColors: string[]
}

// Normalize a cpixel JSON payload into state-like fields. Returns null if invalid.
export function normalizeImportedJSON(
  data: unknown,
  defaults: { palette: Uint32Array; color: string; recentColors: string[] },
  targetWidth: number,
  targetHeight: number,
): NormalizedImport | null {
  const isObj = (v: any) => v && typeof v === 'object'
  if (!isObj(data)) return null
  const obj: any = data
  if (obj.app !== 'cpixel') return null
  const impMode: 'truecolor' | 'indexed' = obj.mode === 'indexed' ? 'indexed' : 'truecolor'
  const width = Math.max(1, obj.width | 0 || targetWidth)
  const height = Math.max(1, obj.height | 0 || targetHeight)
  const targetSize = targetWidth * targetHeight
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

  const nextLayers = layersIn.map((l: any, idx: number) => {
    const id = typeof l?.id === 'string' ? l.id : `L${idx + 1}`
    const visible = l?.visible !== false
    const locked = !!l?.locked
    if (impMode === 'truecolor') {
      if (Array.isArray(l?.data)) {
        const dataArr: number[] = width === targetWidth && height === targetHeight ? l.data : clampSize(l.data, 0)
        const data = new Uint32Array(dataArr.map(v => v >>> 0))
        return { id, visible, locked, data }
      } else if (Array.isArray(l?.indices)) {
        const idxArr: number[] = width === targetWidth && height === targetHeight ? l.indices : clampSize(l.indices, ti)
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
      if (Array.isArray(l?.indices)) {
        const idxArr: number[] = width === targetWidth && height === targetHeight ? l.indices : clampSize(l.indices, ti)
        const indices = new Uint8Array(idxArr.map(v => (v | 0) & 0xff))
        return { id, visible, locked, indices }
      } else if (Array.isArray(l?.data)) {
        const srcArr: number[] = width === targetWidth && height === targetHeight ? l.data : clampSize(l.data, 0)
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
  const nextRecent = Array.isArray(obj.recentColors)
    ? obj.recentColors.filter((x: any) => typeof x === 'string').slice(0, 10)
    : defaults.recentColors

  return {
    mode: impMode,
    layers: nextLayers,
    activeLayerId,
    palette: nextPalette,
    transparentIndex: Math.max(0, Math.min(ti, Math.max(0, nextPalette.length - 1))),
    color: nextColor,
    recentColors: nextRecent,
  }
}
