import { create } from 'zustand'
import { equalU32, equalU8 } from '@/utils/arrays.ts'
import { nearestIndexInPalette } from '@/utils/color.ts'
import { compositeImageData, over } from '@/utils/composite.ts'
import { floodFillIndexed, floodFillRgba } from '@/utils/fill.ts'
import { flipLayersHorizontal, flipLayersVertical } from '@/utils/flip.ts'
import { normalizeImportedJSON } from '@/utils/io.ts'
import { drawEllipseFilledIndexed, drawEllipseFilledRgba, drawEllipseOutlineIndexed, drawEllipseOutlineRgba, drawLineBrush, drawRectFilledIndexed, drawRectFilledRgba, drawRectOutlineIndexed, drawRectOutlineRgba, stamp } from '@/utils/paint.ts'
import { generatePaletteFromComposite } from '@/utils/palette.ts'
import { resizeLayers } from '@/utils/resize.ts'
import { applyFloatingIndicesToIndexedLayer, applyFloatingToIndexedLayer, applyFloatingToRgbaLayer, clearSelectedIndexed, clearSelectedRgba, extractFloatingIndexed, extractFloatingRgba, fillSelectedIndexed, fillSelectedRgba, rectToMask } from '@/utils/selection.ts'
import { translate } from '@/utils/translate.ts'
import { clamp } from '@/utils/view.ts'
import { useLogStore } from '@/stores/logStore.ts'
import { sampleTransformedPatch } from '@/utils/transform.ts'

const WIDTH = 64
const HEIGHT = 64
export const MIN_SCALE = 1
export const MAX_SCALE = 40

export type FileMeta = {
  name: string
  source: {
    type: "local"
  } | {
    type: "google-drive"
    fileId: string
  }
}

type Layer = {
  id: string
  visible: boolean
  locked: boolean
  data: Uint32Array | Uint8Array
}

export type ToolType = 'brush' | 'bucket' | 'line' | 'rect' | 'ellipse' | 'eraser' | 'eyedropper' | 'select-rect' | 'select-lasso' | 'select-wand' | 'move' | 'pan'

type Palette = {
  colors: Uint32Array
  transparentIndex: number
}

export type AppState = {
  mode:
  | null
  | { type: 'stroking', layers: Record<string, Uint32Array | Uint8Array> }
  | {
    type: 'transform',
    orgLayer: Layer,
    width: number,
    height: number,
    data: Uint32Array,
    dataIdx?: Uint8Array,
    transform: { cx: number, cy: number, angle: number, scaleX: number, scaleY: number },
    snap: boolean,
  },
  width: number
  height: number
  layers: Layer[]
  activeLayerId: string
  view: { x: number; y: number; scale: number }
  color: number
  brush: {
    size: number
    subMode: 'normal' | 'pattern'
    pattern: { size: number; mask: Uint8Array }
  }
  eraserSize: number
  shapeFill: boolean
  currentPaletteIndex?: number
  recentColorsRgba: number[]
  recentColorsIndexed: number[] // palette indices
  colorMode: 'rgba' | 'indexed'
  palette: Palette
  tool: ToolType
  shapeTool: 'line' | 'rect' | 'ellipse'
  selectTool: 'select-rect' | 'select-lasso' | 'select-wand'
  setColor: (c: number) => void
  setColorIndex: (i: number) => void
  pushRecentColor: () => void
  setPaletteColor: (index: number, rgba: number) => void
  currentColor: () => number
  // layer ops
  addLayer: () => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  moveLayer: (id: string, toIndex: number) => void
  setActiveLayer: (id: string) => void
  toggleVisible: (id: string) => void
  toggleLocked: (id: string) => void
  mergeLayerDown: (id: string) => void
  addPaletteColor: (rgba: number) => number
  setTransparentIndex: (idx: number) => void
  removePaletteIndex: (idx: number) => void
  movePaletteIndex: (from: number, to: number) => void
  applyPalettePreset: (palette: Palette) => void
  setTool: (t: ToolType) => void
  setBrushSize: (n: number) => void
  setEraserSize: (n: number) => void
  setBrushSubMode: (m: 'normal' | 'pattern') => void
  setBrushPattern: (size: number, mask: Uint8Array) => void
  toggleShapeFill: () => void
  setView: (x: number, y: number, scale: number) => void
  setAt: (x: number, y: number, rgbaOrIndex: number) => void
  drawLine: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  drawRect: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  drawEllipse: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  fillBucket: (x: number, y: number, rgbaOrIndex: number) => void
  setColorMode: (m: 'rgba' | 'indexed') => void
  translateAllLayers: (base: { id: string; visible: boolean; locked: boolean; data: Uint32Array | Uint8Array }[], dx: number, dy: number) => void
  selection?: {
    mask: Uint8Array
    bounds: { left: number; top: number; right: number; bottom: number }
  }
  clipboard?:
  | { kind: 'rgba'; width: number; height: number; data: Uint32Array }
  | { kind: 'indexed'; width: number; height: number; data: Uint8Array; palette: Palette }
  setSelectionRect: (x0: number, y0: number, x1: number, y1: number) => void
  setSelectionMask: (mask: Uint8Array, bounds: { left: number; top: number; right: number; bottom: number }) => void
  clearSelection: () => void
  beginSelectionDrag: () => void
  endTransform: () => void
  // selection clipboard ops
  copySelection: () => void
  cutSelection: () => void
  pasteClipboard: () => void
  // extra selection ops
  invertSelection: () => void
  fillSelection: () => void
  eraseSelection: () => void
  // history
  beginStroke: () => void
  endStroke: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  _undo: HistoryEntry[]
  _redo: HistoryEntry[]
  dirty: boolean // TODO: need to update this
  hover?: { x: number; y: number; rgba?: number; index?: number }
  setHoverInfo: (h?: { x: number; y: number; rgba?: number; index?: number }) => void
  clearLayer: () => void
  exportPNG: (scale?: number) => void
  exportJSON: () => void
  exportAse: () => Promise<void>
  importJSON: (data: unknown, meta?: FileMeta) => void
  importPNGFromImageData: (img: ImageData, meta?: FileMeta) => void
  importAse: (buffer: ArrayBuffer, meta?: FileMeta) => Promise<void>
  resizeCanvas: (w: number, h: number) => void
  flipHorizontal: () => void
  flipVertical: () => void
  fileMeta?: FileMeta
  setFileMeta: (fileMeta: FileMeta | undefined) => void
}

type HistoryEntry = {
  width?: { before: number; after: number }
  height?: { before: number; after: number }
  colorMode?: { before: 'rgba' | 'indexed'; after: 'rgba' | 'indexed' }
  activeLayerId?: { before: string; after: string }
  palette?: { before: Palette; after: Palette }
  layers?:
  | { replaced: { before: Layer[]; after: Layer[] } }
  | { dataChanges: Array<{ id: string; before: Uint32Array | Uint8Array; after: Uint32Array | Uint8Array }> }
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: null,
  width: WIDTH,
  height: HEIGHT,
  layers: [{ id: 'L1', visible: true, locked: false, data: new Uint32Array(WIDTH * HEIGHT) }],
  activeLayerId: 'L1',
  view: { x: 0, y: 0, scale: 5 },
  color: 0x000000,
  brush: {
    size: 1,
    subMode: 'normal',
    pattern: { size: 2, mask: new Uint8Array([1, 0, 0, 1]) },
  },
  eraserSize: 1,
  shapeFill: false,
  currentPaletteIndex: 1,
  recentColorsRgba: [0x000000, 0xffffff],
  recentColorsIndexed: [],
  colorMode: 'rgba',
  tool: 'brush',
  shapeTool: 'rect',
  selectTool: 'select-rect',
  dirty: false,
  palette: { colors: new Uint32Array([0x00000000, 0xffffffff]), transparentIndex: 0 },
  canUndo: false,
  canRedo: false,
  _undo: [],
  _redo: [],
  selection: undefined,
  clipboard: undefined,
  fileMeta: undefined,
  setFileMeta: (fileMeta) => set(() => ({ fileMeta })),
  addLayer: () => set((s) => {
    const id = newLayerId(s.layers)
    const layer: Layer = s.colorMode === 'rgba'
      ? { id, visible: true, locked: false, data: new Uint32Array(s.width * s.height) }
      : { id, visible: true, locked: false, data: new Uint8Array(s.width * s.height) }
    return nextPartialState(s, { layers: [...s.layers, layer], activeLayerId: id })
  }),
  removeLayer: (id) => set((s) => {
    if (s.layers.length <= 1) return {}
    const idx = s.layers.findIndex(l => l.id === id)
    if (idx < 0) return {}
    const next = s.layers.slice(0, idx).concat(s.layers.slice(idx + 1))
    const active = s.activeLayerId === id ? next[Math.max(0, idx - 1)].id : s.activeLayerId
    return nextPartialState(s, { layers: next, activeLayerId: active })
  }),
  duplicateLayer: (id) => set((s) => {
    const i = s.layers.findIndex(l => l.id === id)
    if (i < 0) return {}
    const src = s.layers[i]
    const nid = newLayerId(s.layers)
    const dup: Layer = s.colorMode === 'rgba'
      ? { id: nid, visible: true, locked: false, data: new Uint32Array(src.data) }
      : { id: nid, visible: true, locked: false, data: new Uint8Array(src.data) }
    const next = s.layers.slice()
    next.splice(i + 1, 0, dup)
    return nextPartialState(s, { layers: next, activeLayerId: nid })
  }),
  moveLayer: (id, toIndex) => set((s) => {
    const n = s.layers.length
    const from = s.layers.findIndex(l => l.id === id)
    if (from < 0) return {}
    const to = Math.max(0, Math.min(toIndex, n - 1))
    if (from === to) return {}
    const arr = s.layers.slice()
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    return nextPartialState(s, { layers: arr })
  }),
  setActiveLayer: (id) => set((s) => (s.layers.some(l => l.id === id) ? { activeLayerId: id } : {})),
  toggleVisible: (id) => set((s) => ({ layers: s.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l) })),
  toggleLocked: (id) => set((s) => ({ layers: s.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l) })),
  mergeLayerDown: (id) => set((s) => {
    if (s.mode !== null) return {}
    const i = s.layers.findIndex(l => l.id === id)
    if (i <= 0) return {}
    const top = s.layers[i]
    const below = s.layers[i - 1]
    if (top.locked || below.locked) return {}
    const W = s.width, H = s.height
    const nextLayers = s.layers.slice()
    if (s.colorMode === 'rgba') {
      if (!(top.data instanceof Uint32Array) || !(below.data instanceof Uint32Array)) return {}
      const src = top.data
      const dst = below.data
      const out = new Uint32Array(W * H)
      for (let p = 0; p < out.length; p++) out[p] = over(src[p] >>> 0, dst[p] >>> 0)
      nextLayers[i - 1] = { ...below, data: out }
    } else {
      if (!(top.data instanceof Uint8Array) || !(below.data instanceof Uint8Array)) return {}
      const src = top.data
      const dst = below.data
      const out = new Uint8Array(W * H)
      const ti = s.palette.transparentIndex
      for (let p = 0; p < out.length; p++) {
        const si = src[p]
        out[p] = si === ti ? dst[p] : si
      }
      nextLayers[i - 1] = { ...below, data: out }
    }
    // remove the merged (top) layer
    nextLayers.splice(i, 1)
    const activeLayerId = nextLayers[i - 1]?.id ?? s.activeLayerId
    return nextPartialState(s, { layers: nextLayers, activeLayerId })
  }),
  setTool: (t) => set(() => {
    const patch: Partial<AppState> = { tool: t }
    if (t === 'line' || t === 'rect' || t === 'ellipse') patch.shapeTool = t
    if (t === 'select-rect' || t === 'select-lasso' || t === 'select-wand') patch.selectTool = t
    return patch
  }),
  setBrushSize: (n) => set((s) => {
    const maxDim = Math.max(s.width, s.height)
    const size = Math.max(1, Math.min(Math.floor(n), maxDim))
    return { brush: { ...s.brush, size } }
  }),
  setBrushSubMode: (m) => set((s) => ({ brush: { ...s.brush, subMode: m } })),
  setBrushPattern: (size, mask) => set((s) => ({ brush: { ...s.brush, pattern: { size: Math.max(1, size | 0), mask } } })),
  setEraserSize: (n) => set((s) => {
    const maxDim = Math.max(s.width, s.height)
    const size = Math.max(1, Math.min(Math.floor(n), maxDim))
    return { eraserSize: size }
  }),
  toggleShapeFill: () => set((s) => ({ shapeFill: !s.shapeFill })),
  setColor: (rgba) => set((s) => {
    if (s.colorMode === 'indexed') {
      // In indexed, pick nearest palette index and sync color/index
      const idx = rgba === 0x00000000 ? s.palette.transparentIndex : nearestIndexInPalette(s.palette, rgba)
      const color = s.palette.colors[idx] ?? 0
      return { color, currentPaletteIndex: idx }
    }
    return { color: rgba }
  }),
  setColorIndex: (i) => set((s) => {
    const idx = Math.max(0, Math.min(i | 0, Math.max(0, s.palette.colors.length - 1)))
    const color = s.palette.colors[idx] ?? 0
    return { currentPaletteIndex: idx, color }
  }),
  pushRecentColor: () => set((s) => {
    const MAX_RECENT = 32
    if (s.colorMode === 'indexed') {
      // store palette index; if no currentPaletteIndex, derive nearest
      let idx = s.currentPaletteIndex
      if (idx === undefined) {
        const rgba = s.color
        idx = (rgba >>> 0) === 0x00000000 ? s.palette.transparentIndex : nearestIndexInPalette(s.palette, rgba)
      }
      if (idx === undefined) return {}
      const next = [idx, ...s.recentColorsIndexed.filter(v => v !== idx)].slice(0, MAX_RECENT)
      return { recentColorsIndexed: next }
    } else {
      const c = s.color
      const next = [c, ...s.recentColorsRgba.filter(v => v !== c)].slice(0, MAX_RECENT)
      return { recentColorsRgba: next }
    }
  }),
  setPaletteColor: (index, rgba) => set((s) => {
    const i = index | 0
    if (i < 0 || i >= s.palette.colors.length) return {}
    const pal = new Uint32Array(s.palette.colors)
    // Keep the transparent slot actually transparent for clarity
    pal[i] = rgba >>> 0
    if (equalU32(pal, s.palette.colors)) return {}
    // If editing currently selected index, also sync visible color string
    const patch: Partial<AppState> = { palette: { colors: pal, transparentIndex: s.palette.transparentIndex } }
    if (s.currentPaletteIndex === i) patch.color = pal[i]
    return nextPartialState(s, patch)
  }),
  currentColor: () => {
    const s = get()
    if (s.colorMode === 'rgba') return s.color
    return s.palette.colors[s.currentPaletteIndex ?? 0] ?? 0
  },
  removePaletteIndex: (idx) => set((s) => {
    const n = s.palette.colors.length
    if (idx < 0 || idx >= n || n <= 1) return {}
    // build new palette without idx
    const pal = new Uint32Array(n - 1)
    for (let i = 0, j = 0; i < n; i++) if (i !== idx) pal[j++] = s.palette.colors[i]
    // compute new transparent index
    let ti = s.palette.transparentIndex
    if (ti === idx) ti = 0
    else if (ti > idx) ti = ti - 1
    // compute new current palette index
    let ci = s.currentPaletteIndex ?? 0
    if (ci === idx) ci = ti
    else if (ci > idx) ci = ci - 1
    // remap indices for all layers
    const layers = s.layers.map(l => {
      if (!(l.data instanceof Uint8Array)) return l
      const src = l.data
      const dst = new Uint8Array(src.length)
      for (let k = 0; k < src.length; k++) {
        const v = src[k]
        if (v === idx) dst[k] = ti
        else if (v > idx) dst[k] = (v - 1) & 0xff
        else dst[k] = v
      }
      return { ...l, data: dst }
    })
    const color = pal[ci] ?? 0
    return nextPartialState(s, { palette: { colors: pal, transparentIndex: ti }, layers, currentPaletteIndex: ci, color })
  }),
  movePaletteIndex: (from, to) => set((s) => {
    const n = s.palette.colors.length
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return {}
    // move in palette
    const pal = new Uint32Array(n)
    pal.set(s.palette.colors)
    const val = pal[from]
    if (from < to) {
      for (let i = from; i < to; i++) pal[i] = pal[i + 1]
      pal[to] = val
    } else {
      for (let i = from; i > to; i--) pal[i] = pal[i - 1]
      pal[to] = val
    }
    // build mapping old->new
    const map = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      if (i === from) map[i] = to
      else if (from < to && i > from && i <= to) map[i] = i - 1
      else if (to < from && i >= to && i < from) map[i] = i + 1
      else map[i] = i
    }
    // remap indices for all layers
    const layers = s.layers.map(l => {
      if (!(l.data instanceof Uint8Array)) return l
      const src = l.data
      const dst = new Uint8Array(src.length)
      for (let k = 0; k < src.length; k++) dst[k] = map[src[k]]
      return { ...l, data: dst }
    })
    // remap transparent index
    const ti = map[s.palette.transparentIndex]
    // remap current palette index
    const ci = s.currentPaletteIndex !== undefined ? map[s.currentPaletteIndex] : undefined
    const patch: Partial<AppState> = { palette: { colors: pal, transparentIndex: ti }, layers }
    if (ci !== undefined) { patch.currentPaletteIndex = ci; patch.color = pal[ci] ?? 0 }
    return nextPartialState(s, patch)
  }),
  applyPalettePreset: (palette) => set((s) => {
    let ti = palette.transparentIndex
    if (s.colorMode === 'rgba')
      throw new Error('applyPalettePreset should not be called in rgba mode')

    // Limit to 256 colors
    const limited = palette.colors.slice(0, 256)
    if (limited.length === 0) limited[0] = 0x00000000
    const paletteColors = new Uint32Array(limited)
    if (ti < 0 || ti >= paletteColors.length) ti = 0
    palette = { colors: paletteColors, transparentIndex: ti }

    // Remap indices by nearest color in the new palette
    const remap = s.palette.colors.map((c, i) => i === s.palette.transparentIndex ? ti : nearestIndexInPalette(palette, c))
    const layers = s.layers.map(l => {
      if (!(l.data instanceof Uint8Array)) return l
      const src = l.data
      const dst = new Uint8Array(src.length)
      for (const i in src) {
        dst[i] = remap[src[i]]
      }
      return { ...l, data: dst }
    })

    // choose current index nearest to previous selected color
    const prevRGBA = s.palette.colors[s.currentPaletteIndex ?? s.palette.transparentIndex] ?? 0x00000000
    const curIdx = s.currentPaletteIndex === s.palette.transparentIndex ? ti : nearestIndexInPalette(palette, prevRGBA)
    const color = palette.colors[curIdx] ?? 0

    const recentColorsIndexed = s.recentColorsIndexed
      .map(i => (i === s.palette.transparentIndex ? ti : nearestIndexInPalette(palette, s.palette.colors[i] ?? 0x00000000)))
      .filter((v, i, a) => a.indexOf(v) === i) // dedupe

    return nextPartialState(s, { palette, layers, currentPaletteIndex: curIdx, color, recentColorsIndexed })
  }),
  addPaletteColor: (rgba) => {
    const s = get()
    if (s.palette.colors.length >= 256) return s.palette.colors.length - 1
    const next = new Uint32Array(s.palette.colors.length + 1)
    next.set(s.palette.colors)
    next[s.palette.colors.length] = rgba >>> 0
    set((s) => {
      // If in indexed mode, select the newly added color
      if (s.colorMode === 'indexed') {
        const idx = next.length - 1
        return nextPartialState(s, { palette: { ...s.palette, colors: next }, currentPaletteIndex: idx, color: next[idx] ?? 0 })
      }
      return nextPartialState(s, { palette: { ...s.palette, colors: next } })
    })
    return next.length - 1
  },
  setTransparentIndex: (idx) => set((s) => {
    const clamped = Math.max(0, Math.min(idx | 0, Math.max(0, s.palette.colors.length - 1)))
    if (clamped === s.palette.transparentIndex) return {}
    return nextPartialState(s, { palette: { colors: s.palette.colors, transparentIndex: clamped } })
  }),
  setView: (x, y, scale) => set(() => ({ view: { x, y, scale: clamp(scale, MIN_SCALE, MAX_SCALE) } })),
  translateAllLayers: (base, dx, dy) => set((s) => {
    dx |= 0; dy |= 0
    if (dx === 0 && dy === 0) return {}
    const W = s.width, H = s.height
    const ti = s.palette.transparentIndex
    const layers = base.map(l => ({ ...l, data: translate(l.data, W, H, dx, dy, l.data instanceof Uint32Array ? 0x00000000 : ti) }))
    return { layers }
  }),
  setAt: (x, y, rgbaOrIndex) => {
    set((s) => {
      const W = s.width, H = s.height
      if (x < 0 || y < 0 || x >= W || y >= H) return {}

      // Block painting while a floating selection exists to force commit first
      if (s.mode?.type !== 'stroking') return {}
      // Selection mask constraint
      if (s.selection?.mask) {
        const i = y * W + x
        if (!s.selection.mask[i]) return {}
      }

      const brush = s.brush
      const li = s.layers.findIndex(l => l.id === s.activeLayerId)
      if (li < 0) return {}
      const layer = s.layers[li]
      if (layer.locked) return {}
      const layers = s.layers.slice()
      const size = Math.max(1, (s.tool === 'eraser' ? s.eraserSize : brush.size) | 0)
      const pattern = s.tool === 'brush' && brush.subMode === 'pattern' ? brush.pattern : undefined
      const out = stamp(layer.data, W, H, x, y, size, rgbaOrIndex >>> 0, s.selection?.mask, pattern)
      if (out === layer.data) return {}
      layers[li] = { ...layer, data: out }
      return { layers }
    })
    get().pushRecentColor()
  },
  drawLine: (x0, y0, x1, y1, rgbaOrIndex) => {
    set((s) => {
      const W = s.width, H = s.height
      // Clamp endpoints
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
      const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
      const brush = s.brush
      const li = s.layers.findIndex(l => l.id === s.activeLayerId)
      if (li < 0) return {}
      const layer = s.layers[li]
      if (layer.locked) return {}
      if (s.mode?.type !== 'stroking') return {}
      if (!inBounds(x0, y0) && !inBounds(x1, y1)) return {}
      const layers = s.layers.slice()
      const size = Math.max(1, brush.size | 0)
      const pattern = brush.subMode === 'pattern' ? brush.pattern : undefined
      const out = drawLineBrush(layer.data, W, H, x0, y0, x1, y1, size, rgbaOrIndex >>> 0, s.selection?.mask, pattern)
      if (out === layer.data) return {}
      layers[li] = { ...layer, data: out }
      return { layers }
    })
    get().pushRecentColor()
  },
  drawRect: (x0, y0, x1, y1, rgbaOrIndex) => {
    set((s) => {
      const W = s.width, H = s.height
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
      let left = Math.max(0, Math.min(x0, x1))
      let right = Math.min(W - 1, Math.max(x0, x1))
      let top = Math.max(0, Math.min(y0, y1))
      let bottom = Math.min(H - 1, Math.max(y0, y1))
      if (left > right || top > bottom) return {}
      const li = s.layers.findIndex(l => l.id === s.activeLayerId)
      if (li < 0) return {}
      const layer = s.layers[li]
      if (layer.locked) return {}
      if (s.mode?.type !== 'stroking') return {}
      const layers = s.layers.slice()
      if (s.colorMode === 'rgba') {
        if (!(layer.data instanceof Uint32Array)) return {}
        const out = (s.shapeFill
          ? drawRectFilledRgba(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask)
          : drawRectOutlineRgba(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask))
        if (equalU32(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        if (!(layer.data instanceof Uint8Array)) return {}
        const out = (s.shapeFill
          ? drawRectFilledIndexed(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex & 0xff, s.selection?.mask)
          : drawRectOutlineIndexed(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex & 0xff, s.selection?.mask))
        if (equalU8(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      }
    })
    get().pushRecentColor()
  },
  drawEllipse: (x0, y0, x1, y1, rgbaOrIndex) => {
    set((s) => {
      const W = s.width, H = s.height
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
      // x0 += 0.5; y0 += 0.5; x1 += 0.5; y1 += 0.5 // offset by 0.5 to align to pixel centers
      const li = s.layers.findIndex(l => l.id === s.activeLayerId)
      if (li < 0) return {}
      const layer = s.layers[li]
      if (layer.locked) return {}
      if (s.mode?.type !== 'stroking') return {}
      const layers = s.layers.slice()
      if (s.colorMode === 'rgba') {
        if (!(layer.data instanceof Uint32Array)) return {}
        const out = (s.shapeFill
          ? drawEllipseFilledRgba(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask)
          : drawEllipseOutlineRgba(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask))
        if (equalU32(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        if (!(layer.data instanceof Uint8Array)) return {}
        const out = (s.shapeFill
          ? drawEllipseFilledIndexed(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex & 0xff, s.selection?.mask)
          : drawEllipseOutlineIndexed(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex & 0xff, s.selection?.mask))
        if (equalU8(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      }
    })
    get().pushRecentColor()
  },
  fillBucket: (x, y, rgbaOrIndex) => {
    set((s) => {
      const W = s.width, H = s.height
      if (x < 0 || y < 0 || x >= W || y >= H) return {}
      if (s.mode?.type !== 'stroking') return {}
      const mask = s.selection?.mask
      if (mask) {
        const i0 = y * W + x
        if (!mask[i0]) return {}
      }
      const li = s.layers.findIndex(l => l.id === s.activeLayerId)
      if (li < 0) return {}
      const layer = s.layers[li]
      if (layer.locked) return {}
      const layers = s.layers.slice()
      if (s.colorMode === 'rgba') {
        if (!(layer.data instanceof Uint32Array)) return {}
        const out = floodFillRgba(layer.data, W, H, x, y, rgbaOrIndex, mask)
        if (equalU32(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        if (!(layer.data instanceof Uint8Array)) return {}
        const out = floodFillIndexed(layer.data, W, H, x, y, rgbaOrIndex, mask)
        if (out === layer.data || equalU8(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      }
    })
    get().pushRecentColor()
  },
  setColorMode: (m) => set((s) => {
    if (s.colorMode === m) return {}
    if (m === 'indexed') {
      // Auto-generate a palette from current composited image (transparent at index 0)
      const autoPalette = generatePaletteFromComposite(
        s.layers.map(l => ({ visible: l.visible, data: l.data })),
        s.width,
        s.height,
        s.colorMode,
        s.palette,
        256,
      )
      const transparentIndex = 0
      // Convert all layers: rgba -> indices using the generated palette
      const layers = s.layers.map(l => {
        const src = l.data ?? new Uint32Array(s.width * s.height)
        const idx = new Uint8Array(s.width * s.height)
        for (let i = 0; i < idx.length; i++) {
          const rgba = src[i] >>> 0
          if (rgba === 0x00000000) { idx[i] = transparentIndex; continue }
          let best = transparentIndex, bestD = Infinity
          const r = (rgba >>> 24) & 0xff, g = (rgba >>> 16) & 0xff, b = (rgba >>> 8) & 0xff
          for (let k = 0; k < autoPalette.length; k++) {
            const c = autoPalette[k] >>> 0
            if (c === 0x00000000 && k === transparentIndex) continue
            const cr = (c >>> 24) & 0xff, cg = (c >>> 16) & 0xff, cb = (c >>> 8) & 0xff
            const d = (cr - r) * (cr - r) + (cg - g) * (cg - g) + (cb - b) * (cb - b)
            if (d < bestD) { bestD = d; best = k }
          }
          idx[i] = best & 0xff
        }
        return { id: l.id, visible: l.visible, locked: l.locked, data: idx }
      })
      // Sync current palette index nearest to current color
      const rgba = s.color
      const palette = { colors: autoPalette, transparentIndex }
      const curIdx = (rgba >>> 0) === 0x00000000 ? transparentIndex : nearestIndexInPalette(palette, rgba)
      return { colorMode: 'indexed', layers, currentPaletteIndex: curIdx, color: palette.colors[curIdx] ?? 0, palette, recentColorsIndexed: [] }
    } else {
      // convert all layers: indices -> rgba
      const layers = s.layers.map(l => {
        const src = l.data ?? new Uint8Array(s.width * s.height)
        const data = new Uint32Array(s.width * s.height)
        for (let i = 0; i < data.length; i++) {
          const pi = src[i] ?? s.palette.transparentIndex
          data[i] = s.palette.colors[pi] ?? 0x00000000
        }
        return { id: l.id, visible: l.visible, locked: l.locked, data }
      })
      return { colorMode: 'rgba', layers }
    }
  }),
  // Selection APIs
  setSelectionRect: (x0, y0, x1, y1) => set((s) => {
    if (s.mode !== null) return {}
    const selection = rectToMask(s.width, s.height, x0, y0, x1, y1)
    return { selection }
  }),
  setSelectionMask: (mask, bounds) => set((s) => {
    if (s.mode !== null) return {}
    return { selection: { mask, bounds } }
  }),
  clearSelection: () => set({ selection: undefined }),
  beginSelectionDrag: () => set((s) => {
    if (s.mode !== null) return {}
    const sel = s.selection
    if (!sel || !sel.mask || !sel.bounds) return {}
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    // bounds width/height available via selectionBounds when needed
    if (s.colorMode === 'rgba') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const float = extractFloatingRgba(layer.data, sel.mask, sel.bounds, W)
      const out = clearSelectedRgba(layer.data, sel.mask, sel.bounds, W)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      const cx = (sel.bounds.left + sel.bounds.right + 1) / 2
      const cy = (sel.bounds.top + sel.bounds.bottom + 1) / 2
      const width = sel.bounds.right - sel.bounds.left + 1
      const height = sel.bounds.bottom - sel.bounds.top + 1
      return { layers, mode: { type: 'transform', orgLayer: layer, width, height, data: float, transform: { cx, cy, angle: 0, scaleX: 1, scaleY: 1 }, snap: true }, selection: undefined }
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const pal = s.palette.colors
      const ti = s.palette.transparentIndex
      const floatIdx = extractFloatingIndexed(layer.data, sel.mask, sel.bounds, W, ti)
      const float = new Uint32Array(floatIdx.length)
      for (let i = 0; i < floatIdx.length; i++) {
        float[i] = pal[floatIdx[i]]
      }
      const out = clearSelectedIndexed(layer.data, sel.mask, sel.bounds, W, ti)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      const cx = (sel.bounds.left + sel.bounds.right + 1) / 2
      const cy = (sel.bounds.top + sel.bounds.bottom + 1) / 2
      const width = sel.bounds.right - sel.bounds.left + 1
      const height = sel.bounds.bottom - sel.bounds.top + 1
      return { layers, mode: { type: 'transform', orgLayer: layer, width, height, data: float, dataIdx: floatIdx, transform: { cx, cy, angle: 0, scaleX: 1, scaleY: 1 }, snap: true }, selection: undefined }
    }
  }),
  endTransform: () => set((s) => {
    const mode = s.mode
    if (mode?.type !== 'transform') return {}
    const W = s.width, H = s.height
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const patch = sampleTransformedPatch(mode.transform, mode.width, mode.height, mode.data, mode.dataIdx, s.palette.transparentIndex)

    let nextData: Uint32Array | Uint8Array
    if (s.colorMode === 'rgba') {
      if (!(layer.data instanceof Uint32Array)) return {}
      nextData = applyFloatingToRgbaLayer(layer.data, patch.rgba, patch.left, patch.top, patch.width, patch.height, W, H)
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      nextData = patch.indices
        ? applyFloatingIndicesToIndexedLayer(layer.data, patch.indices, s.palette.transparentIndex, patch.left, patch.top, patch.width, patch.height, W, H)
        : applyFloatingToIndexedLayer(layer.data, patch.rgba, s.palette, patch.left, patch.top, patch.width, patch.height, W, H)
    }

    const layers = s.layers.slice()
    layers[li] = { ...layer, data: nextData }
    return nextPartialState({ ...s, layers: s.layers.map(l => l.id === s.activeLayerId ? mode.orgLayer : l) }, { mode: null, layers, selection: undefined })
  }),
  // Clipboard operations
  copySelection: () => set((s) => {
    if (s.mode !== null) return {}
    const sel = s.selection
    if (!sel?.bounds) return {}
    const bw = sel.bounds.right - sel.bounds.left + 1
    const bh = sel.bounds.bottom - sel.bounds.top + 1
    const patch: Partial<AppState> = {}
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (s.colorMode === 'rgba') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const float = extractFloatingRgba(layer.data, sel.mask, sel.bounds, W)
      patch.clipboard = { kind: 'rgba', data: float, width: bw, height: bh }
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const ti = s.palette.transparentIndex
      const outIdx = new Uint8Array(bw * bh)
      // build masked indices copy
      for (let y = sel.bounds.top; y <= sel.bounds.bottom; y++) {
        for (let x: number = sel.bounds.left; x <= sel.bounds.right; x++) {
          const i = y * W + x
          const fi = (y - sel.bounds.top) * bw + (x - sel.bounds.left)
          outIdx[fi] = (!sel.mask || sel.mask[i]) ? (layer.data[i] ?? ti) : (ti & 0xff)
        }
      }
      patch.clipboard = { kind: 'indexed', data: outIdx, width: bw, height: bh, palette: { ...s.palette } }
    }
    useLogStore.getState().pushLog({ message: 'Copied selection' })
    return patch
  }),
  cutSelection: () => set((s) => {
    if (s.mode !== null) return {}
    const sel = s.selection
    if (!sel || !sel.bounds) return {}
    const bw = sel.bounds.right - sel.bounds.left + 1
    const bh = sel.bounds.bottom - sel.bounds.top + 1
    const patch: Partial<AppState> = {
      selection: undefined
    }
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    if (s.colorMode === 'rgba') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const float = extractFloatingRgba(layer.data, sel.mask, sel.bounds, W)
      const out = clearSelectedRgba(layer.data, sel.mask, sel.bounds, W)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      patch.layers = layers
      patch.clipboard = { kind: 'rgba', data: float, width: bw, height: bh }
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const ti = s.palette.transparentIndex
      const out = clearSelectedIndexed(layer.data, sel.mask, sel.bounds, W, ti)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      const outIdx = extractFloatingIndexed(layer.data, sel.mask, sel.bounds, W, ti)
      patch.layers = layers
      patch.clipboard = { kind: 'indexed', data: outIdx, width: bw, height: bh, palette: { ...s.palette } }
    }
    useLogStore.getState().pushLog({ message: 'Cut selection' })
    return nextPartialState(s, patch)
  }),
  pasteClipboard: () => set((s) => {
    const clip = s.clipboard
    if (!clip) return {}
    let data: Uint32Array
    let dataIdx: Uint8Array | undefined = undefined
    if (clip.kind === 'rgba') {
      data = clip.data.slice(0)
    } else {
      // convert indices to RGBA using clipboard palette
      const pal = clip.palette
      data = new Uint32Array(clip.data.length)
      for (let i = 0; i < data.length; i++) {
        const pi = clip.data[i] & 0xff
        data[i] = pi === pal.transparentIndex ? 0x00000000 : pal.colors[pi] ?? 0x00000000
      }
      dataIdx = clip.data.slice(0)
    }
    const mode = {
      type: 'transform' as const,
      orgLayer: s.layers.find(l => l.id === s.activeLayerId)!,
      width: clip.width,
      height: clip.height,
      data,
      dataIdx,
      transform: { cx: s.width / 2, cy: s.height / 2, angle: 0, scaleX: 1, scaleY: 1 },
      snap: true,
    } as const
    return { mode, tool: s.selectTool }
  }),
  invertSelection: () => set((s) => {
    const sel = s.selection
    if (!sel || !sel.bounds) return {}
    const W = s.width, H = s.height
    const size = W * H
    let mask = sel.mask ? new Uint8Array(sel.mask) : new Uint8Array(size).fill(1)
    for (let i = 0; i < size; i++) mask[i] = mask[i] ? 0 : 1
    let left = W, right = -1, top = H, bottom = -1
    for (let y = 0; y < H; y++) {
      const row = y * W
      for (let x = 0; x < W; x++) {
        if (mask[row + x]) {
          if (x < left) left = x
          if (x > right) right = x
          if (y < top) top = y
          if (y > bottom) bottom = y
        }
      }
    }
    if (right < left || bottom < top) {
      return { selection: undefined }
    }
    return { selection: { mask, bounds: { left, top, right, bottom } } }
  }),
  fillSelection: () => set((s) => {
    if (s.mode !== null) return {}
    const sel = s.selection
    if (!sel || !sel.bounds) return {}
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const layers = s.layers.slice()
    if (s.colorMode === 'rgba') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const rgba = s.color
      const out = fillSelectedRgba(layer.data, sel.mask, sel.bounds, W, rgba >>> 0)
      if (equalU32(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return nextPartialState(s, { layers })
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const pi = (s.currentPaletteIndex ?? s.palette.transparentIndex) & 0xff
      const out = fillSelectedIndexed(layer.data, sel.mask, sel.bounds, W, pi)
      if (equalU8(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return nextPartialState(s, { layers })
    }
  }),
  eraseSelection: () => set((s) => {
    if (s.mode !== null) return {}
    const sel = s.selection
    if (!sel || !sel.bounds) return {}
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const layers = s.layers.slice()
    if (s.colorMode === 'rgba') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const out = clearSelectedRgba(layer.data, sel.mask, sel.bounds, W)
      if (equalU32(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return nextPartialState(s, { layers })
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const out = clearSelectedIndexed(layer.data, sel.mask, sel.bounds, W, s.palette.transparentIndex)
      if (equalU8(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return nextPartialState(s, { layers })
    }
  }),
  setHoverInfo: (hover) => set({ hover }),
  beginStroke: () => set((s) => {
    if (s.mode !== null) return {}
    const base: Record<string, Uint32Array | Uint8Array> = {}
    for (const l of s.layers) base[l.id] = l.data.slice(0) as typeof l.data
    return { mode: { type: 'stroking', layers: base } }
  }),
  endStroke: () => set((s) => {
    if (s.mode?.type !== 'stroking') return {}
    const base = s.mode.layers
    const changes: Array<{ id: string; before: Uint32Array | Uint8Array; after: Uint32Array | Uint8Array }> = []
    if (base) {
      for (const l of s.layers) {
        const before = base[l.id]
        if (!before) continue
        const after = l.data
        if (before instanceof Uint32Array && after instanceof Uint32Array) {
          if (!equalU32(before, after)) changes.push({ id: l.id, before, after: after.slice(0) })
        } else if (before instanceof Uint8Array && after instanceof Uint8Array) {
          if (!equalU8(before, after)) changes.push({ id: l.id, before, after: after.slice(0) })
        } else {
          // Type change (shouldn't happen mid-stroke) — treat as changed
          changes.push({ id: l.id, before, after: after.slice(0) })
        }
      }
    }
    const entry = changes.length > 0 ? { layers: { dataChanges: changes } } : undefined
    return {
      mode: null,
      _undo: entry ? [...s._undo, entry] : s._undo,
      _redo: entry ? [] : s._redo,
      canUndo: entry ? true : s.canUndo,
      canRedo: entry ? false : s.canRedo,
      dirty: entry ? true : s.dirty,
    }
  }),
  undo: () => set((s) => {
    if (s._undo.length === 0) return {}
    const entry = s._undo[s._undo.length - 1]
    const undo = s._undo.slice(0, -1)
    const patch = applyHistoryEntry(s, entry, 'undo')
    useLogStore.getState().pushLog({ message: 'UNDO' })
    return {
      ...patch,
      _undo: undo,
      _redo: [...s._redo, entry],
      canUndo: undo.length > 0,
      canRedo: true,
      selection: undefined,
      dirty: true,
    }
  }),
  redo: () => set((s) => {
    if (s._redo.length === 0) return {}
    const entry = s._redo[s._redo.length - 1]
    const redo = s._redo.slice(0, -1)
    const patch = applyHistoryEntry(s, entry, 'redo')
    useLogStore.getState().pushLog({ message: 'REDO' })
    return {
      ...patch,
      _undo: [...s._undo, entry],
      _redo: redo,
      canUndo: true,
      canRedo: redo.length > 0,
      selection: undefined,
      dirty: true,
    }
  }),
  clearLayer: () => set((s) => {
    const W = s.width, H = s.height
    const li = s.layers.findIndex((l: Layer) => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layers = s.layers.slice()
    const layer = layers[li]
    if (s.colorMode === 'rgba') layers[li] = { ...layer, data: new Uint32Array(W * H) }
    else layers[li] = { ...layer, data: new Uint8Array(W * H) }
    return nextPartialState(s, { layers })
  }),
  exportPNG: (scale?: number) => {
    const { colorMode, layers, palette, width: W, height: H } = get()
    const s = Math.max(1, Math.floor(scale || 1))
    const base = document.createElement('canvas')
    base.width = W
    base.height = H
    const bctx = base.getContext('2d')!
    const img = new ImageData(W, H)
    compositeImageData(layers.map(l => ({ visible: l.visible, data: l.data })), colorMode, palette, img)
    bctx.putImageData(img, 0, 0)

    let outCanvas = base
    if (s !== 1) {
      const scaled = document.createElement('canvas')
      scaled.width = W * s
      scaled.height = H * s
      const sctx = scaled.getContext('2d')!
      sctx.imageSmoothingEnabled = false
      sctx.drawImage(base, 0, 0, W * s, H * s)
      outCanvas = scaled
    }

    const a = document.createElement('a')
    a.href = outCanvas.toDataURL('image/png')
    a.download = s === 1 ? 'cpixel.png' : `cpixel@${s}x.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  },
  exportJSON: () => {
    const { colorMode, layers, activeLayerId, palette, color, recentColorsRgba: recentColorsRgba, recentColorsIndexed, width, height } = get()
    const transparentIndex = palette.transparentIndex
    const payload = {
      app: 'cpixel' as const,
      version: 1 as const,
      width,
      height,
      colorMode,
      layers: layers.map(l => ({
        id: l.id,
        visible: l.visible,
        locked: l.locked,
        data: Array.from(l.data),
      })),
      activeLayerId,
      palette: { colors: Array.from(palette.colors), transparentIndex },
      color,
      recentColorsRgba,
      recentColorsIndexed,
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })

    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'cpixel.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  },
  exportAse: async () => {
    const { colorMode, layers, palette, width, height } = get()
    try {
      const { encodeAseprite } = await import('../utils/aseprite.ts')
      const buffer = encodeAseprite({
        width,
        height,
        colorMode,
        layers,
        palette,
      })
      const blob = new Blob([buffer], { type: 'application/octet-stream' })

      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'cpixel.aseprite'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      console.error('Ase export failed', e)
    }
  },
  importJSON: (data: unknown, fileMeta?: FileMeta) => {
    const current = get()
    const normalized = normalizeImportedJSON(data, {
      palette: current.palette,
      color: current.color,
      recentColorsRgba: current.recentColorsRgba,
      recentColorsIndexed: current.recentColorsIndexed,
    })
    if (!normalized) return
    set({
      ...normalized,
      _undo: [],
      _redo: [],
      canUndo: false,
      canRedo: false,
      fileMeta,
    })
  },
  importPNGFromImageData: (img: ImageData, fileMeta?: FileMeta) => {
    const W = img.width | 0
    const H = img.height | 0
    if (W <= 0 || H <= 0) return
    // Build a single rgba layer from the pixels and switch to rgba mode
    const data = new Uint32Array(W * H)
    const src = img.data
    for (let i = 0, p = 0; i < src.length; i += 4, p++) {
      const r = src[i + 0]
      const g = src[i + 1]
      const b = src[i + 2]
      const a = src[i + 3]
      data[p] = (r << 24) | (g << 16) | (b << 8) | a
    }
    set({
      width: W,
      height: H,
      colorMode: 'rgba',
      layers: [{ id: 'L1', visible: true, locked: false, data }],
      activeLayerId: 'L1',
      _undo: [],
      _redo: [],
      canUndo: false,
      canRedo: false,
      fileMeta,
    })
  },
  importAse: async (buffer: ArrayBuffer, fileMeta?: FileMeta) => {
    try {
      const { decodeAseprite, aseToCpixel } = await import('../utils/aseprite.ts')
      const parsed = await decodeAseprite(buffer, { preserveIndexed: true })
      if (!parsed) return
      const converted = aseToCpixel(parsed)
      const layersBottomFirst = converted.layers
      const statePatch: Partial<AppState> = {
        width: converted.width,
        height: converted.height,
        layers: layersBottomFirst.length > 0 ? layersBottomFirst : [{ id: 'L1', visible: true, locked: false, data: new Uint32Array(converted.width * converted.height) }],
        activeLayerId: layersBottomFirst[layersBottomFirst.length - 1]?.id ?? 'L1', // top-most
        _undo: [],
        _redo: [],
        canUndo: false,
        canRedo: false,
        selection: undefined,
        fileMeta,
      }
      if (converted.colorMode === 'indexed') {
        statePatch.colorMode = 'indexed'
        statePatch.palette = { colors: converted.palette.colors, transparentIndex: converted.palette.transparentIndex ?? 0 }
        statePatch.currentPaletteIndex = converted.palette.transparentIndex ?? 0
        statePatch.color = 0x00000000
      } else {
        statePatch.colorMode = 'rgba'
      }
      set(statePatch)
    } catch (e) {
      console.error('Ase import failed', e)
    }
  },
  resizeCanvas: (w, h) => set((s) => {
    let newW = Math.max(1, Math.floor(w))
    let newH = Math.max(1, Math.floor(h))
    const MAX_WH = 2048
    newW = Math.min(newW, MAX_WH)
    newH = Math.min(newH, MAX_WH)
    const oldW = s.width, oldH = s.height
    if (newW === oldW && newH === oldH) return {}

    return nextPartialState(s, {
      width: newW,
      height: newH,
      layers: resizeLayers(s.layers, s.colorMode, oldW, oldH, newW, newH),
      selection: undefined,
    })
  }),
  flipHorizontal: () => set((s) => {
    return nextPartialState(s, {
      layers: flipLayersHorizontal(s.layers, s.colorMode, s.width, s.height),
      selection: undefined,
    })
  }),
  flipVertical: () => set((s) => {
    return nextPartialState(s, {
      layers: flipLayersVertical(s.layers, s.colorMode, s.width, s.height),
      selection: undefined,
    })
  }),
}))

function nextPartialState(state: AppState, patch: Partial<AppState>): Partial<AppState> {
  const entry = buildDiff(state, { ...state, ...patch })

  // Merge palette color changes into existing entry if present
  const prevEntry = state._undo.at(-1)
  if (prevEntry && Object.keys(prevEntry) + '' === 'palette' && entry && Object.keys(entry) + '' === 'palette') {
    const prevPal = prevEntry.palette!
    const nextPal = entry.palette!
    if (prevPal.before.colors.length === prevPal.after.colors.length && prevPal.after.colors.length === nextPal.after.colors.length) {
      const diffIdxs = []
      for (let i = 0; i < prevPal.after.colors.length; i++) {
        if (prevPal.before.colors[i] !== prevPal.after.colors[i] || prevPal.after.colors[i] !== nextPal.after.colors[i]) diffIdxs.push(i)
      }
      if (diffIdxs.length === 1) {
        const mergedEntry = { palette: { before: prevPal.before, after: nextPal.after } }
        return {
          ...patch,
          _undo: [...state._undo.slice(0, -1), mergedEntry],
          _redo: [],
          canUndo: true,
          canRedo: false,
          dirty: true,
        }
      }
    }
  }

  if (entry === null) return patch // no changes

  return {
    ...patch,
    _undo: [...state._undo, entry],
    _redo: [],
    canUndo: true,
    canRedo: false,
    dirty: true,
  }
}

// Build a diff entry between before and after states. Only include changed fields.
function buildDiff(before: AppState, after: AppState): HistoryEntry | null {
  const entry: HistoryEntry = {}
  if (before.width !== after.width) entry.width = { before: before.width, after: after.width }
  if (before.height !== after.height) entry.height = { before: before.height, after: after.height }
  if (before.colorMode !== after.colorMode) entry.colorMode = { before: before.colorMode, after: after.colorMode }
  if (before.activeLayerId !== after.activeLayerId) entry.activeLayerId = { before: before.activeLayerId, after: after.activeLayerId }
  if (before.palette.transparentIndex !== after.palette.transparentIndex || !equalU32(before.palette.colors, after.palette.colors)) entry.palette = { before: before.palette, after: after.palette }

  // Layers: if structure (ids/visibility/locked/count/type) differs, store full replacement; else store only data changes.
  let structureDiffers = false
  if (before.layers.length !== after.layers.length) structureDiffers = true
  if (!structureDiffers) {
    for (let i = 0; i < before.layers.length; i++) {
      const b = before.layers[i], a = after.layers[i]
      if (!a || b.id !== a.id || b.visible !== a.visible || b.locked !== a.locked || (b.data instanceof Uint32Array) !== (a.data instanceof Uint32Array)) {
        structureDiffers = true
        break
      }
    }
  }
  if (structureDiffers) {
    entry.layers = { replaced: { before: cloneLayers(before.layers), after: cloneLayers(after.layers) } }
  } else {
    const changes: Array<{ id: string; before: Uint32Array | Uint8Array; after: Uint32Array | Uint8Array }> = []
    for (let i = 0; i < before.layers.length; i++) {
      const b = before.layers[i], a = after.layers[i]
      if (b.data instanceof Uint32Array && a.data instanceof Uint32Array) {
        if (!equalU32(b.data, a.data)) changes.push({ id: a.id, before: b.data.slice(0), after: a.data.slice(0) })
      } else if (b.data instanceof Uint8Array && a.data instanceof Uint8Array) {
        if (!equalU8(b.data, a.data)) changes.push({ id: a.id, before: b.data.slice(0), after: a.data.slice(0) })
      } else {
        // type mismatch shouldn't happen here due to structure check, but guard anyway
        changes.push({ id: a.id, before: b.data.slice(0), after: a.data.slice(0) })
      }
    }
    if (changes.length > 0) entry.layers = { dataChanges: changes }
  }

  if (Object.keys(entry).length === 0) return null
  return entry
}

function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map(l => ({ id: l.id, visible: l.visible, locked: l.locked, data: l.data.slice(0) }))
}

function applyHistoryEntry(state: AppState, entry: HistoryEntry, dir: 'undo' | 'redo'): Partial<AppState> {
  const patch: Partial<AppState> = {}
  const pick = <T>(pair?: { before: T; after: T }) => pair ? (dir === 'undo' ? pair.before : pair.after) : undefined
  const width = pick(entry.width)
  const height = pick(entry.height)
  const colorMode = pick(entry.colorMode)
  const activeLayerId = pick(entry.activeLayerId)
  const palette = pick(entry.palette)
  if (width !== undefined) patch.width = width
  if (height !== undefined) patch.height = height
  if (colorMode !== undefined) patch.colorMode = colorMode
  if (activeLayerId !== undefined) patch.activeLayerId = activeLayerId
  if (palette !== undefined) patch.palette = { colors: palette.colors.slice(), transparentIndex: palette.transparentIndex }

  if (entry.layers) {
    if ('replaced' in entry.layers) {
      const v = pick(entry.layers.replaced)
      if (v) patch.layers = cloneLayers(v)
    } else if ('dataChanges' in entry.layers) {
      // Apply per-layer data changes on current layers array
      const nextLayers = state.layers.map(l => ({ ...l }))
      for (const dc of entry.layers.dataChanges) {
        const arr = dir === 'undo' ? dc.before : dc.after
        const i = nextLayers.findIndex(x => x.id === dc.id)
        if (i >= 0) nextLayers[i] = { ...nextLayers[i], data: arr.slice(0) }
      }
      patch.layers = nextLayers
    }
  }
  return patch
}

function newLayerId(layers: Layer[]): string {
  let maxId = 0
  for (const l of layers) {
    if (l.id.startsWith('L')) {
      const n = parseInt(l.id.slice(1))
      if (!isNaN(n) && n > maxId) maxId = n
    }
  }
  return 'L' + (maxId + 1)
}
