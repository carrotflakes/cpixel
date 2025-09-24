import type { ColorMode } from '@/types'

export type NormalizedLayer = {
  id: string
  visible: boolean
  locked: boolean
  data: Uint32Array | Uint8Array
}

export type NormalizedImport = {
  width: number
  height: number
  colorMode: ColorMode
  layers: NormalizedLayer[]
  activeLayerId: string
  palette: { colors: Uint32Array; transparentIndex: number }
  color: number
  recentColorsRgba: number[]
  recentColorsIndexed: number[]
}

// Normalize a cpixel JSON payload into state-like fields. Returns null if invalid.
export function normalizeImportedJSON(
  data: unknown,
  defaults: { palette: { colors: Uint32Array; transparentIndex: number }; color: number; recentColorsRgba: number[]; recentColorsIndexed: number[] },
): NormalizedImport | null {
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
  if (!isObj(data)) return null
  const obj = data as Record<string, unknown>
  if (obj.app !== 'cpixel') return null
  const impMode: ColorMode = obj.colorMode === 'indexed' ? 'indexed' : 'rgba'
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
  let nextPalette = { ...defaults.palette }
  if (isObj(obj.palette) && Array.isArray(obj.palette.colors) && typeof obj.palette.transparentIndex === 'number') {
    const paletteArr: number[] = obj.palette.colors.filter((x): x is number => typeof x === 'number').slice(0, 256)
    let colors = new Uint32Array(paletteArr.map((v) => v >>> 0))
    if (colors.length === 0) colors = defaults.palette.colors.slice(0)
    const ti = Math.max(0, Math.min(obj.palette.transparentIndex | 0, Math.max(0, colors.length - 1)))
    if (colors.length > 0) colors[ti] = 0x00000000
    nextPalette = { colors, transparentIndex: ti }
  }

  const nextLayers = layersIn.map((l: unknown, idx: number) => {
    const rec = l as Record<string, unknown> | undefined
    const id = typeof rec?.id === 'string' ? rec.id : `L${idx + 1}`
    const visible = rec?.visible !== false
    const locked = !!rec?.locked
    if (impMode === 'rgba') {
      if (Array.isArray(rec?.data)) {
        const dataArr: number[] = clampSize(rec.data, 0)
        const data = new Uint32Array(dataArr.map(v => v >>> 0))
        return { id, visible, locked, data }
      } else {
        const data = new Uint32Array(targetSize)
        return { id, visible, locked, data }
      }
    } else {
      if (Array.isArray(rec?.data)) {
        const idxArr: number[] = clampSize((rec.data) as number[], nextPalette.transparentIndex)
        const data = new Uint8Array(idxArr.map(v => (v | 0) & 0xff))
        return { id, visible, locked, data }
      } else {
        const data = new Uint8Array(new Array(targetSize).fill(nextPalette.transparentIndex & 0xff))
        return { id, visible, locked, data }
      }
    }
  }) as NormalizedLayer[]

  const activeLayerId = typeof obj.activeLayerId === 'string' && nextLayers.some(l => l.id === obj.activeLayerId)
    ? obj.activeLayerId
    : (nextLayers[0]?.id || 'L1')
  const nextColor = typeof obj.color === 'number' ? obj.color : defaults.color
  const rcRgba = Array.isArray(obj.recentColorsRgba)
    ? (obj.recentColorsRgba as unknown[]).filter((x): x is number => typeof x === 'number').slice(0, 10)
    : defaults.recentColorsRgba
  const rcIndexed = Array.isArray(obj.recentColorsIndexed)
    ? (obj.recentColorsIndexed as unknown[]).filter(x => Number.isFinite(Number(x))).map(x => Number(x) | 0).slice(0, 10)
    : defaults.recentColorsIndexed

  return {
    width,
    height,
    colorMode: impMode,
    layers: nextLayers,
    activeLayerId,
    palette: nextPalette,
    color: nextColor,
    recentColorsRgba: rcRgba,
    recentColorsIndexed: rcIndexed,
  }
}
