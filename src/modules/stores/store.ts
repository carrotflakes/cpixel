import { create } from 'zustand'
import { equalU32, equalU8 } from '../utils/arrays.ts'
import { nearestIndexInPalette } from '../utils/color.ts'
import { compositeImageData } from '../utils/composite.ts'
import { floodFillIndexed, floodFillTruecolor } from '../utils/fill.ts'
import { flipLayersHorizontal, flipLayersVertical } from '../utils/flip.ts'
import { normalizeImportedJSON } from '../utils/io.ts'
import { drawEllipseFilledIndexed, drawEllipseFilledTruecolor, drawEllipseOutlineIndexed, drawEllipseOutlineTruecolor, drawLineBrushIndexed, drawLineBrushTruecolor, drawRectFilledIndexed, drawRectFilledTruecolor, drawRectOutlineIndexed, drawRectOutlineTruecolor, stampIndexed, stampTruecolor } from '../utils/paint.ts'
import { generatePaletteFromComposite } from '../utils/palette.ts'
import { resizeLayers } from '../utils/resize.ts'
import { applyFloatingToIndexedLayer, applyFloatingToTruecolorLayer, buildFloatingFromClipboard, clearSelectedIndexed, clearSelectedTruecolor, extractFloatingIndexed, extractFloatingTruecolor, fillSelectedIndexed, fillSelectedTruecolor, rectToMask } from '../utils/selection.ts'
import { translateIndexed, translateTruecolor } from '../utils/translate.ts'
import { clamp } from '../utils/view.ts'
import { useLogStore } from './logStore'

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

export type AppState = {
  width: number
  height: number
  layers: Layer[]
  activeLayerId: string
  view: { x: number; y: number; scale: number }
  color: number
  brushSize: number
  eraserSize: number
  shapeFill: boolean
  currentPaletteIndex?: number
  recentColorsTruecolor: number[]
  recentColorsIndexed: number[] // palette indices
  mode: 'truecolor' | 'indexed'
  palette: Uint32Array
  transparentIndex: number
  tool: ToolType
  shapeTool: 'rect' | 'ellipse'
  selectTool: 'select-rect' | 'select-lasso' | 'select-wand'
  setColor: (c: number) => void
  setColorIndex: (i: number) => void
  pushRecentColor: () => void
  setPaletteColor: (index: number, rgba: number) => void
  // layer ops
  addLayer: () => void
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  moveLayer: (id: string, toIndex: number) => void
  setActiveLayer: (id: string) => void
  toggleVisible: (id: string) => void
  toggleLocked: (id: string) => void
  addPaletteColor: (rgba: number) => number
  setTransparentIndex: (idx: number) => void
  removePaletteIndex: (idx: number) => void
  movePaletteIndex: (from: number, to: number) => void
  applyPalettePreset: (colors: Uint32Array, transparentIndex?: number) => void
  setTool: (t: ToolType) => void
  setBrushSize: (n: number) => void
  setEraserSize: (n: number) => void
  toggleShapeFill: () => void
  setView: (x: number, y: number, scale: number) => void
  setAt: (x: number, y: number, rgbaOrIndex: number) => void
  drawLine: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  drawRect: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  drawEllipse: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  fillBucket: (x: number, y: number, rgbaOrIndex: number, contiguous: boolean) => void
  setMode: (m: 'truecolor' | 'indexed') => void
  translateAllLayers: (base: { id: string; visible: boolean; locked: boolean; data: Uint32Array | Uint8Array }[], dx: number, dy: number) => void
  selection: {
    mask?: Uint8Array
    bounds?: { left: number; top: number; right: number; bottom: number }
    offsetX: number
    offsetY: number
    floating?: Uint32Array
    floatingIndices?: Uint8Array
  }
  clipboard?:
  | { kind: 'rgba'; width: number; height: number; pixels: Uint32Array }
  | { kind: 'indexed'; width: number; height: number; indices: Uint8Array; palette: Uint32Array; transparentIndex: number }
  setSelectionRect: (x0: number, y0: number, x1: number, y1: number) => void
  setSelectionMask: (mask: Uint8Array, bounds: { left: number; top: number; right: number; bottom: number }) => void
  clearSelection: () => void
  beginSelectionDrag: () => void
  setSelectionOffset: (dx: number, dy: number) => void
  commitSelectionMove: () => void
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
  _stroking?: { layers: Record<string, Uint32Array | Uint8Array> }
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
  mode?: { before: 'truecolor' | 'indexed'; after: 'truecolor' | 'indexed' }
  activeLayerId?: { before: string; after: string }
  transparentIndex?: { before: number; after: number }
  palette?: { before: Uint32Array; after: Uint32Array }
  layers?:
  | { replaced: { before: Layer[]; after: Layer[] } }
  | { dataChanges: Array<{ id: string; before: Uint32Array | Uint8Array; after: Uint32Array | Uint8Array }> }
}

export const useAppStore = create<AppState>((set, get) => ({
  width: WIDTH,
  height: HEIGHT,
  layers: [{ id: 'L1', visible: true, locked: false, data: new Uint32Array(WIDTH * HEIGHT) }],
  activeLayerId: 'L1',
  view: { x: 0, y: 0, scale: 5 },
  color: 0x000000,
  brushSize: 1,
  eraserSize: 1,
  shapeFill: false,
  currentPaletteIndex: 1,
  recentColorsTruecolor: [0x000000, 0xffffff],
  recentColorsIndexed: [],
  mode: 'truecolor',
  tool: 'brush',
  shapeTool: 'rect',
  selectTool: 'select-rect',
  dirty: false,
  // simple default palette (16 base colors + transparent at 0)
  palette: new Uint32Array([
    0x00000000, 0xffffffff, 0xff0000ff, 0x00ff00ff, 0x0000ffff, 0xffff00ff, 0xff00ffff, 0x00ffffff,
    0x7f7f7fff, 0x3f3f3fff, 0xff7f7fff, 0x7fff7fff, 0x7f7fffff, 0xffff7fff, 0xff7fffff, 0x7fffffff,
  ]),
  transparentIndex: 0,
  canUndo: false,
  canRedo: false,
  // internal history state
  _undo: [],
  _redo: [],
  _stroking: undefined,
  selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
  clipboard: undefined,
  // file metadata
  fileMeta: undefined,
  setFileMeta: (fileMeta) => set(() => ({ fileMeta })),
  addLayer: () => set((s) => {
    const id = newLayerId(s.layers)
    const layer: Layer = s.mode === 'truecolor'
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
    const dup: Layer = s.mode === 'truecolor'
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
  setTool: (t) => set(() => {
    const patch: Partial<AppState> = { tool: t }
    if (t === 'rect' || t === 'ellipse') patch.shapeTool = t
    if (t === 'select-rect' || t === 'select-lasso' || t === 'select-wand') patch.selectTool = t
    return patch
  }),
  setBrushSize: (n) => set((s) => {
    const maxDim = Math.max(s.width, s.height)
    const size = Math.max(1, Math.min(Math.floor(n), maxDim))
    return { brushSize: size }
  }),
  setEraserSize: (n) => set((s) => {
    const maxDim = Math.max(s.width, s.height)
    const size = Math.max(1, Math.min(Math.floor(n), maxDim))
    return { eraserSize: size }
  }),
  toggleShapeFill: () => set((s) => ({ shapeFill: !s.shapeFill })),
  setColor: (rgba) => set((s) => {
    if (s.mode === 'indexed') {
      // In indexed, pick nearest palette index and sync color/index
      const idx = rgba === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, s.transparentIndex, rgba)
      const color = s.palette[idx] ?? 0
      return { color, currentPaletteIndex: idx }
    }
    return { color: rgba }
  }),
  setColorIndex: (i) => set((s) => {
    const idx = Math.max(0, Math.min(i | 0, Math.max(0, s.palette.length - 1)))
    const color = s.palette[idx] ?? 0
    return { currentPaletteIndex: idx, color }
  }),
  pushRecentColor: () => set((s) => {
    const MAX_RECENT = 32
    if (s.mode === 'indexed') {
      // store palette index; if no currentPaletteIndex, derive nearest
      let idx = s.currentPaletteIndex
      if (idx === undefined) {
        const rgba = s.color
        idx = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, s.transparentIndex, rgba)
      }
      if (idx === undefined) return {}
      const next = [idx, ...s.recentColorsIndexed.filter(v => v !== idx)].slice(0, MAX_RECENT)
      return { recentColorsIndexed: next }
    } else {
      const c = s.color
      const next = [c, ...s.recentColorsTruecolor.filter(v => v !== c)].slice(0, MAX_RECENT)
      return { recentColorsTruecolor: next }
    }
  }),
  setPaletteColor: (index, rgba) => set((s) => {
    const i = index | 0
    if (i < 0 || i >= s.palette.length) return {}
    const pal = new Uint32Array(s.palette)
    // Keep the transparent slot actually transparent for clarity
    pal[i] = (i === s.transparentIndex) ? 0x00000000 : (rgba >>> 0)
    if (equalU32(pal, s.palette)) return {}
    // If editing currently selected index, also sync visible color string
    const patch: Partial<AppState> = { palette: pal }
    if (s.currentPaletteIndex === i) patch.color = pal[i]
    return nextPartialState(s, patch)
  }),
  removePaletteIndex: (idx) => set((s) => {
    const n = s.palette.length
    if (idx < 0 || idx >= n || n <= 1) return {}
    // build new palette without idx
    const pal = new Uint32Array(n - 1)
    for (let i = 0, j = 0; i < n; i++) if (i !== idx) pal[j++] = s.palette[i]
    // compute new transparent index
    let ti = s.transparentIndex
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
    return nextPartialState(s, { palette: pal, transparentIndex: ti, layers, currentPaletteIndex: ci, color })
  }),
  movePaletteIndex: (from, to) => set((s) => {
    const n = s.palette.length
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return {}
    // move in palette
    const pal = new Uint32Array(n)
    pal.set(s.palette)
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
    const ti = map[s.transparentIndex]
    // remap current palette index
    const ci = s.currentPaletteIndex !== undefined ? map[s.currentPaletteIndex] : undefined
    const patch: Partial<AppState> = { palette: pal, layers, transparentIndex: ti }
    if (ci !== undefined) { patch.currentPaletteIndex = ci; patch.color = pal[ci] ?? 0 }
    return nextPartialState(s, patch)
  }),
  applyPalettePreset: (colors, ti = 0) => set((s) => {
    if (s.mode === 'truecolor')
      throw new Error('applyPalettePreset should not be called in truecolor mode')

    // Limit to 256 colors
    const limited = colors.slice(0, 256)
    if (limited.length === 0) limited[0] = 0x00000000
    const palette = new Uint32Array(limited)
    if (ti < 0 || ti >= palette.length) ti = 0

    // Remap indices by nearest color in the new palette
    const remap = s.palette.map((c, i) => i === s.transparentIndex ? ti : nearestIndexInPalette(palette, ti, c))
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
    const prevRGBA = s.palette[s.currentPaletteIndex ?? s.transparentIndex] ?? 0x00000000
    const curIdx = s.currentPaletteIndex === s.transparentIndex ? ti : nearestIndexInPalette(palette, ti, prevRGBA)
    const color = palette[curIdx] ?? 0

    const recentColorsIndexed = s.recentColorsIndexed
      .map(i => (i === s.transparentIndex ? ti : nearestIndexInPalette(palette, ti, s.palette[i] ?? 0x00000000)))
      .filter((v, i, a) => a.indexOf(v) === i) // dedupe

    return nextPartialState(s, { palette, transparentIndex: ti, layers, currentPaletteIndex: curIdx, color, recentColorsIndexed })
  }),
  addPaletteColor: (rgba) => {
    const s = get()
    if (s.palette.length >= 256) return s.palette.length - 1
    const next = new Uint32Array(s.palette.length + 1)
    next.set(s.palette)
    next[s.palette.length] = rgba >>> 0
    set((s) => {
      // If in indexed mode, select the newly added color
      if (s.mode === 'indexed') {
        const idx = next.length - 1
        return nextPartialState(s, { palette: next, currentPaletteIndex: idx, color: next[idx] ?? 0 })
      }
      return nextPartialState(s, { palette: next })
    })
    return next.length - 1
  },
  setTransparentIndex: (idx) => set((s) => {
    const clamped = Math.max(0, Math.min(idx | 0, Math.max(0, s.palette.length - 1)))
    if (clamped === s.transparentIndex) return {}
    return nextPartialState(s, { transparentIndex: clamped })
  }),
  setView: (x, y, scale) => set(() => ({ view: { x, y, scale: clamp(scale, MIN_SCALE, MAX_SCALE) } })),
  translateAllLayers: (base, dx, dy) => set((s) => {
    dx |= 0; dy |= 0
    if (dx === 0 && dy === 0) return {}
    const W = s.width, H = s.height
    const ti = s.transparentIndex
    const layers = base.map(l => {
      if (l.data instanceof Uint32Array) {
        return { ...l, data: translateTruecolor(l.data, W, H, dx, dy) }
      } else {
        return { ...l, data: translateIndexed(l.data, W, H, dx, dy, ti) }
      }
    })
    return { layers }
  }),
  setAt: (x, y, rgbaOrIndex) => {
    set((s) => {
      const W = s.width, H = s.height
      if (x < 0 || y < 0 || x >= W || y >= H) return {}

      // Block painting while a floating selection exists to force commit first
      if (s.selection?.floating) return {}
      // Selection mask constraint
      if (s.selection?.mask) {
        const i = y * W + x
        if (!s.selection.mask[i]) return {}
      }

      const li = s.layers.findIndex(l => l.id === s.activeLayerId)
      if (li < 0) return {}
      const layer = s.layers[li]
      if (layer.locked) return {}
      const layers = s.layers.slice()
      const size = Math.max(1, (s.tool === 'eraser' ? s.eraserSize : s.brushSize) | 0)
      if (s.mode === 'truecolor') {
        if (!(layer.data instanceof Uint32Array)) return {}
        const out = stampTruecolor(layer.data, W, H, x, y, size, rgbaOrIndex >>> 0, s.selection?.mask)
        if (equalU32(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        if (!(layer.data instanceof Uint8Array)) return {}
        const out = stampIndexed(layer.data, W, H, x, y, size, rgbaOrIndex & 0xff, s.selection?.mask)
        if (equalU8(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      }
    })
    get().pushRecentColor()
  },
  drawLine: (x0, y0, x1, y1, rgbaOrIndex) => {
    set((s) => {
      const W = s.width, H = s.height
      // Clamp endpoints
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
      const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
      const li = s.layers.findIndex(l => l.id === s.activeLayerId)
      if (li < 0) return {}
      const layer = s.layers[li]
      if (layer.locked) return {}
      if (s.selection?.floating) return {}
      if (!inBounds(x0, y0) && !inBounds(x1, y1)) return {}
      const layers = s.layers.slice()
      const size = Math.max(1, (s.tool === 'eraser' ? s.eraserSize : s.brushSize) | 0)
      if (s.mode === 'truecolor') {
        if (!(layer.data instanceof Uint32Array)) return {}
        const out = drawLineBrushTruecolor(layer.data, W, H, x0, y0, x1, y1, size, rgbaOrIndex >>> 0, s.selection?.mask)
        if (equalU32(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        if (!(layer.data instanceof Uint8Array)) return {}
        const out = drawLineBrushIndexed(layer.data, W, H, x0, y0, x1, y1, size, rgbaOrIndex & 0xff, s.selection?.mask)
        if (equalU8(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      }
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
      if (s.selection?.floating) return {}
      const layers = s.layers.slice()
      if (s.mode === 'truecolor') {
        if (!(layer.data instanceof Uint32Array)) return {}
        const out = (s.shapeFill
          ? drawRectFilledTruecolor(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask)
          : drawRectOutlineTruecolor(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask))
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
      if (s.selection?.floating) return {}
      const layers = s.layers.slice()
      if (s.mode === 'truecolor') {
        if (!(layer.data instanceof Uint32Array)) return {}
        const out = (s.shapeFill
          ? drawEllipseFilledTruecolor(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask)
          : drawEllipseOutlineTruecolor(layer.data, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask))
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
  fillBucket: (x, y, rgbaOrIndex, contiguous) => {
    set((s) => {
      const W = s.width, H = s.height
      if (x < 0 || y < 0 || x >= W || y >= H) return {}
      if (s.selection?.floating) return {}
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
      if (s.mode === 'truecolor') {
        if (!(layer.data instanceof Uint32Array)) return {}
        const out = floodFillTruecolor(layer.data, W, H, x, y, rgbaOrIndex, contiguous, mask)
        if (equalU32(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        if (!(layer.data instanceof Uint8Array)) return {}
        const out = floodFillIndexed(layer.data, W, H, x, y, rgbaOrIndex, contiguous, s.transparentIndex, mask)
        if (out === layer.data || equalU8(out, layer.data)) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      }
    })
    get().pushRecentColor()
  },
  setMode: (m) => set((s) => {
    if (s.mode === m) return {}
    if (m === 'indexed') {
      // Auto-generate a palette from current composited image (transparent at index 0)
      const autoPalette = generatePaletteFromComposite(
        s.layers.map(l => ({ visible: l.visible, data: l.data })),
        s.width,
        s.height,
        s.mode,
        s.palette,
        s.transparentIndex,
        256,
      )
      const transparentIndex = 0
      // Convert all layers: truecolor -> indices using the generated palette
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
      const curIdx = (rgba >>> 0) === 0x00000000 ? transparentIndex : nearestIndexInPalette(autoPalette, rgba, transparentIndex)
      return { mode: 'indexed', layers, currentPaletteIndex: curIdx, color: autoPalette[curIdx] ?? 0, palette: autoPalette, transparentIndex, recentColorsIndexed: [] }
    } else {
      // convert all layers: indices -> truecolor
      const layers = s.layers.map(l => {
        const src = l.data ?? new Uint8Array(s.width * s.height)
        const data = new Uint32Array(s.width * s.height)
        for (let i = 0; i < data.length; i++) {
          const pi = src[i] ?? s.transparentIndex
          data[i] = s.palette[pi] ?? 0x00000000
        }
        return { id: l.id, visible: l.visible, locked: l.locked, data }
      })
      return { mode: 'truecolor', layers }
    }
  }),
  // Selection APIs
  setSelectionRect: (x0, y0, x1, y1) => set((s) => {
    const { mask, bounds } = rectToMask(s.width, s.height, x0, y0, x1, y1)
    return { selection: { mask, bounds, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
  }),
  setSelectionMask: (mask, bounds) => set(() => ({ selection: { mask, bounds, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } })),
  clearSelection: () => set({ selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }),
  beginSelectionDrag: () => set((s) => {
    const sel = s.selection
    if (!sel || !sel.mask || !sel.bounds) return {}
    if (sel.floating) return {}
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    // bounds width/height available via selectionBounds when needed
    if (s.mode === 'truecolor') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const float = extractFloatingTruecolor(layer.data, sel.mask, sel.bounds, W)
      const out = clearSelectedTruecolor(layer.data, sel.mask, sel.bounds, W)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      return { selection: { ...sel, floating: float, floatingIndices: undefined, offsetX: 0, offsetY: 0 }, layers }
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const pal = s.palette
      const ti = s.transparentIndex
      const floatIdx = extractFloatingIndexed(layer.data, sel.mask, sel.bounds, W, ti)
      const float = new Uint32Array(floatIdx.length)
      for (let i = 0; i < floatIdx.length; i++) {
        float[i] = pal[floatIdx[i]]
      }
      const out = clearSelectedIndexed(layer.data, sel.mask, sel.bounds, W, ti)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      return { selection: { ...sel, floating: float, floatingIndices: floatIdx, offsetX: 0, offsetY: 0 }, layers }
    }
  }),
  setSelectionOffset: (dx, dy) => set((s) => s.selection ? { selection: { ...s.selection, offsetX: dx | 0, offsetY: dy | 0 } } : {}),
  commitSelectionMove: () => set((s) => {
    const sel = s.selection
    if (!sel || !sel.mask || !sel.bounds || !sel.floating) return {}
    const dx = (sel.offsetX ?? 0) | 0
    const dy = (sel.offsetY ?? 0) | 0
    const W = s.width, H = s.height
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const bw = sel.bounds.right - sel.bounds.left + 1
    const bh = sel.bounds.bottom - sel.bounds.top + 1
    const dstLeft = sel.bounds.left + dx
    const dstTop = sel.bounds.top + dy
    if (s.mode === 'truecolor') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const out = applyFloatingToTruecolorLayer(layer.data, sel.floating, dstLeft, dstTop, bw, bh, W, H)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      return { layers, selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      let out: Uint8Array
      if (sel.floatingIndices) {
        // Direct indices path (exact copy)
        out = new Uint8Array(layer.data)
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const pi = sel.floatingIndices[y * bw + x] & 0xff
            if (pi === (s.transparentIndex & 0xff)) continue
            const X = dstLeft + x
            const Y = dstTop + y
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue
            out[Y * W + X] = pi
          }
        }
      } else {
        // Fallback: derive indices from RGBA (legacy)
        out = applyFloatingToIndexedLayer(layer.data, sel.floating, s.palette, s.transparentIndex, dstLeft, dstTop, bw, bh, W, H)
      }
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      return { layers, selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
    }
  }),
  // Clipboard operations
  copySelection: () => set((s) => {
    const sel = s.selection
    if (!sel?.bounds) return {}
    const bw = sel.bounds.right - sel.bounds.left + 1
    const bh = sel.bounds.bottom - sel.bounds.top + 1
    const patch: Partial<AppState> = {}
    if (sel.floating) {
      if (s.mode === 'truecolor') {
        patch.clipboard = { kind: 'rgba', pixels: sel.floating.slice(0), width: bw, height: bh }
      } else if (sel.floatingIndices) {
        patch.clipboard = { kind: 'indexed', indices: sel.floatingIndices.slice(0), width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: s.transparentIndex }
      } else {
        const idxOut = new Uint8Array(bw * bh)
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const rgba = sel.floating[y * bw + x] >>> 0
            if ((rgba & 0xff) === 0) { idxOut[y * bw + x] = s.transparentIndex & 0xff; continue }
            const pi = nearestIndexInPalette(s.palette, s.transparentIndex, rgba)
            idxOut[y * bw + x] = pi & 0xff
          }
        }
        patch.clipboard = { kind: 'indexed', indices: idxOut, width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: s.transparentIndex }
      }
    }
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (s.mode === 'truecolor') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const float = extractFloatingTruecolor(layer.data, sel.mask, sel.bounds, W)
      patch.clipboard = { kind: 'rgba', pixels: float, width: bw, height: bh }
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const ti = s.transparentIndex
      const outIdx = new Uint8Array(bw * bh)
      // build masked indices copy
      for (let y = sel.bounds.top; y <= sel.bounds.bottom; y++) {
        for (let x: number = sel.bounds.left; x <= sel.bounds.right; x++) {
          const i = y * W + x
          const fi = (y - sel.bounds.top) * bw + (x - sel.bounds.left)
          outIdx[fi] = (!sel.mask || sel.mask[i]) ? (layer.data[i] ?? ti) : (ti & 0xff)
        }
      }
      patch.clipboard = { kind: 'indexed', indices: outIdx, width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: ti }
    }
    useLogStore.getState().pushLog({ message: 'Copied selection' })
    return patch
  }),
  cutSelection: () => set((s) => {
    const sel = s.selection
    if (!sel || !sel.bounds) return {}
    const bw = sel.bounds.right - sel.bounds.left + 1
    const bh = sel.bounds.bottom - sel.bounds.top + 1
    const patch: Partial<AppState> = {
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined }
    }
    if (sel.floating) {
      if (s.mode === 'truecolor') {
        patch.clipboard = { kind: 'rgba', pixels: sel.floating.slice(0), width: bw, height: bh }
      } else if (sel.floatingIndices) {
        patch.clipboard = { kind: 'indexed', indices: sel.floatingIndices.slice(0), width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: s.transparentIndex }
      } else {
        const idxOut = new Uint8Array(bw * bh)
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const rgba = sel.floating[y * bw + x] >>> 0
            if ((rgba & 0xff) === 0) { idxOut[y * bw + x] = s.transparentIndex & 0xff; continue }
            const pi = nearestIndexInPalette(s.palette, s.transparentIndex, rgba)
            idxOut[y * bw + x] = pi & 0xff
          }
        }
        patch.clipboard = { kind: 'indexed', indices: idxOut, width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: s.transparentIndex }
      }
    }
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    if (s.mode === 'truecolor') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const float = extractFloatingTruecolor(layer.data, sel.mask, sel.bounds, W)
      const out = clearSelectedTruecolor(layer.data, sel.mask, sel.bounds, W)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      patch.layers = layers
      patch.clipboard = { kind: 'rgba', pixels: float, width: bw, height: bh }
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const ti = s.transparentIndex
      const out = clearSelectedIndexed(layer.data, sel.mask, sel.bounds, W, ti)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      const outIdx = extractFloatingIndexed(layer.data, sel.mask, sel.bounds, W, ti)
      patch.layers = layers
      patch.clipboard = { kind: 'indexed', indices: outIdx, width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: ti }
    }
    useLogStore.getState().pushLog({ message: 'Cut selection' })
    return nextPartialState(s, patch)
  }),
  pasteClipboard: () => set((s) => {
    const clip = s.clipboard
    if (!clip) return {}
    const W = s.width, H = s.height
    const bw = Math.min(clip.width, W)
    const bh = Math.min(clip.height, H)
    const left = Math.max(0, Math.min(W - bw, ((W - bw) / 2) | 0))
    const top = Math.max(0, Math.min(H - bh, ((H - bh) / 2) | 0))
    const right = left + bw - 1
    const bottom = top + bh - 1
    const mask = new Uint8Array(W * H)
    for (let y = top; y <= bottom; y++) {
      const row = y * W
      mask.fill(1, row + left, row + right + 1)
    }
    const float = buildFloatingFromClipboard(clip, bw, bh)
    let floatIdx: Uint8Array | undefined
    if (clip.kind === 'indexed') {
      // Crop indices similarly (bw,bh already computed)
      if (bw !== clip.width || bh !== clip.height) {
        floatIdx = new Uint8Array(bw * bh)
        for (let y = 0; y < bh; y++) {
          const srcRow = y * clip.width
          floatIdx.set(clip.indices.subarray(srcRow, srcRow + bw), y * bw)
        }
      } else {
        floatIdx = clip.indices.slice(0)
      }
    }
    return { selection: { mask, bounds: { left, top, right, bottom }, offsetX: 0, offsetY: 0, floating: float, floatingIndices: floatIdx }, tool: 'select-rect' }
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
      return { selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
    }
    return { selection: { mask, bounds: { left, top, right, bottom }, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
  }),
  fillSelection: () => set((s) => {
    const sel = s.selection
    if (!sel || !sel.bounds) return {}
    if (sel.floating) return {}
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const layers = s.layers.slice()
    if (s.mode === 'truecolor') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const rgba = s.color
      const out = fillSelectedTruecolor(layer.data, sel.mask, sel.bounds, W, rgba >>> 0)
      if (equalU32(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return nextPartialState(s, { layers })
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const pi = (s.currentPaletteIndex ?? s.transparentIndex) & 0xff
      const out = fillSelectedIndexed(layer.data, sel.mask, sel.bounds, W, pi)
      if (equalU8(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return nextPartialState(s, { layers })
    }
  }),
  eraseSelection: () => set((s) => {
    const sel = s.selection
    if (!sel || !sel.bounds) return {}
    if (sel.floating) return {}
    const W = s.width
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const layers = s.layers.slice()
    if (s.mode === 'truecolor') {
      if (!(layer.data instanceof Uint32Array)) return {}
      const out = clearSelectedTruecolor(layer.data, sel.mask, sel.bounds, W)
      if (equalU32(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return nextPartialState(s, { layers })
    } else {
      if (!(layer.data instanceof Uint8Array)) return {}
      const out = clearSelectedIndexed(layer.data, sel.mask, sel.bounds, W, s.transparentIndex)
      if (equalU8(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return nextPartialState(s, { layers })
    }
  }),
  setHoverInfo: (h) => set({ hover: h ? { x: h.x, y: h.y, rgba: h.rgba, index: h.index } : undefined }),
  beginStroke: () => set((s) => {
    if (s._stroking) return {}
    const base: Record<string, Uint32Array | Uint8Array> = {}
    for (const l of s.layers) base[l.id] = l.data.slice(0) as typeof l.data
    return { _stroking: { layers: base } }
  }),
  endStroke: () => set((s) => {
    if (!s._stroking) return {}
    const base = s._stroking.layers
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
      _stroking: undefined,
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
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
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
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
      dirty: true,
    }
  }),
  clearLayer: () => set((s) => {
    const W = s.width, H = s.height
    const li = s.layers.findIndex((l: Layer) => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layers = s.layers.slice()
    const layer = layers[li]
    if (s.mode === 'truecolor') layers[li] = { ...layer, data: new Uint32Array(W * H) }
    else layers[li] = { ...layer, data: new Uint8Array(W * H) }
    return nextPartialState(s, { layers })
  }),
  exportPNG: (scale?: number) => {
    const { mode, layers, palette, transparentIndex, width: W, height: H } = get()
    const s = Math.max(1, Math.min(64, Math.floor(scale || 1))) // clamp scale 1-64
    const base = document.createElement('canvas')
    base.width = W
    base.height = H
    const bctx = base.getContext('2d')!
    const img = new ImageData(W, H)
    compositeImageData(layers.map(l => ({ visible: l.visible, data: l.data })), mode, palette, transparentIndex, img)
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
    const { mode, layers, activeLayerId, palette, transparentIndex, color, recentColorsTruecolor, recentColorsIndexed, width, height } = get()
    const payload = {
      app: 'cpixel' as const,
      version: 1 as const,
      width,
      height,
      mode,
      layers: layers.map(l => ({
        id: l.id,
        visible: l.visible,
        locked: l.locked,
        data: Array.from(l.data),
      })),
      activeLayerId,
      palette: Array.from(palette),
      transparentIndex,
      color,
      recentColorsTruecolor,
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
    const { mode, layers, palette, transparentIndex, width, height } = get()
    try {
      const { encodeAseprite } = await import('../utils/aseprite.ts')
      const buffer = encodeAseprite({
        width,
        height,
        mode,
        layers,
        palette,
        transparentIndex,
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
      recentColorsTruecolor: current.recentColorsTruecolor,
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
    // Build a single truecolor layer from the pixels and switch to truecolor mode
    const data = new Uint32Array(W * H)
    const src = img.data
    for (let i = 0, p = 0; i < src.length; i += 4, p++) {
      const r = src[i + 0] | 0
      const g = src[i + 1] | 0
      const b = src[i + 2] | 0
      const a = src[i + 3] | 0
      data[p] = ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)
    }
    set({
      width: W,
      height: H,
      mode: 'truecolor',
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
        activeLayerId: layersBottomFirst[layersBottomFirst.length - 1]?.id || 'L1', // top-most
        _undo: [],
        _redo: [],
        canUndo: false,
        canRedo: false,
        selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
        fileMeta,
      }
      if (converted.mode === 'indexed') {
        statePatch.mode = 'indexed'
        statePatch.palette = converted.palette
        statePatch.transparentIndex = converted.transparentIndex ?? 0
        statePatch.currentPaletteIndex = converted.transparentIndex ?? 0
        statePatch.color = 0x00000000
      } else {
        statePatch.mode = 'truecolor'
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
      layers: resizeLayers(s.layers, s.mode, oldW, oldH, newW, newH),
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
    })
  }),
  flipHorizontal: () => set((s) => {
    return nextPartialState(s, {
      layers: flipLayersHorizontal(s.layers, s.mode, s.width, s.height),
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
    })
  }),
  flipVertical: () => set((s) => {
    return nextPartialState(s, {
      layers: flipLayersVertical(s.layers, s.mode, s.width, s.height),
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
    })
  }),
}))

function nextPartialState(state: AppState, patch: Partial<AppState>): Partial<AppState> {
  const entry = buildDiff(state, { ...state, ...patch })
  return {
    ...patch,
    _undo: entry ? [...state._undo, entry] : state._undo,
    _redo: entry ? [] : state._redo,
    canUndo: entry ? true : state.canUndo,
    canRedo: entry ? false : state.canRedo,
    dirty: entry ? true : state.dirty,
  }
}

// Build a diff entry between before and after states. Only include changed fields.
function buildDiff(before: AppState, after: AppState): HistoryEntry | null {
  const entry: HistoryEntry = {}
  if (before.width !== after.width) entry.width = { before: before.width, after: after.width }
  if (before.height !== after.height) entry.height = { before: before.height, after: after.height }
  if (before.mode !== after.mode) entry.mode = { before: before.mode, after: after.mode }
  if (before.activeLayerId !== after.activeLayerId) entry.activeLayerId = { before: before.activeLayerId, after: after.activeLayerId }
  if (before.transparentIndex !== after.transparentIndex) entry.transparentIndex = { before: before.transparentIndex, after: after.transparentIndex }
  if (!equalU32(before.palette, after.palette)) entry.palette = { before: before.palette.slice(0), after: after.palette.slice(0) }

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
  const mode = pick(entry.mode)
  const activeLayerId = pick(entry.activeLayerId)
  const transparentIndex = pick(entry.transparentIndex)
  const palette = pick(entry.palette)
  if (width !== undefined) patch.width = width
  if (height !== undefined) patch.height = height
  if (mode !== undefined) patch.mode = mode
  if (activeLayerId !== undefined) patch.activeLayerId = activeLayerId
  if (transparentIndex !== undefined) patch.transparentIndex = transparentIndex
  if (palette !== undefined) patch.palette = palette.slice(0)

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
