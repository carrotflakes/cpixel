import { create } from 'zustand'
import { clamp } from './utils/view'
import { nearestIndexInPalette, parseCSSColor, rgbaToCSSHex } from './utils/color'
import { generatePaletteFromComposite } from './utils/palette'
import { floodFillIndexed, floodFillTruecolor } from './utils/fill'
import { normalizeImportedJSON } from './utils/io'
import { equalU32, equalU8 } from './utils/arrays'
import { stampTruecolor, stampIndexed, drawLineBrushTruecolor, drawLineBrushIndexed, drawRectOutlineTruecolor, drawRectOutlineIndexed, drawRectFilledTruecolor, drawRectFilledIndexed, drawEllipseOutlineTruecolor, drawEllipseOutlineIndexed, drawEllipseFilledTruecolor, drawEllipseFilledIndexed } from './utils/paint'
import { extractFloatingTruecolor, clearSelectedTruecolor, extractFloatingIndexed, clearSelectedIndexed, applyFloatingToTruecolorLayer, applyFloatingToIndexedLayer, buildFloatingFromClipboard } from './utils/selection'
import { resizeLayers } from './utils/resize'
import { flipLayersHorizontal, flipLayersVertical } from './utils/flip'
import { compositeImageData } from './utils/composite'

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
  data?: Uint32Array
  indices?: Uint8Array
}

export type ToolType = 'brush' | 'bucket' | 'line' | 'rect' | 'ellipse' | 'eraser' | 'eyedropper' | 'select-rect' | 'select-lasso' | 'select-wand' | 'pan'

export type AppState = {
  width: number
  height: number
  layers: Layer[]
  activeLayerId: string
  view: { x: number; y: number; scale: number }
  color: string
  brushSize: number
  shapeFill: boolean
  currentPaletteIndex?: number
  recentColorsTruecolor: string[]
  recentColorsIndexed: number[] // palette indices
  mode: 'truecolor' | 'indexed'
  palette: Uint32Array
  transparentIndex: number
  tool: ToolType
  shapeTool: 'rect' | 'ellipse'
  selectTool: 'select-rect' | 'select-lasso' | 'select-wand'
  setColor: (c: string) => void
  pushRecentColor: () => void
  setColorIndex: (i: number) => void
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
  toggleShapeFill: () => void
  setView: (x: number, y: number, scale: number) => void
  setAt: (x: number, y: number, rgbaOrIndex: number) => void
  drawLine: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  drawRect: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  drawEllipse: (x0: number, y0: number, x1: number, y1: number, rgbaOrIndex: number) => void
  fillBucket: (x: number, y: number, rgbaOrIndex: number, contiguous: boolean) => void
  setMode: (m: 'truecolor' | 'indexed') => void
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
  // history
  beginStroke: () => void
  endStroke: () => void
  undo: () => void
  redo: () => void
  canUndo?: boolean
  canRedo?: boolean
  _undo?: Snapshot[]
  _redo?: Snapshot[]
  _stroking?: boolean
  dirty: boolean // TODO: need to update this
  hover?: { x: number; y: number; rgba?: number; index?: number }
  setHoverInfo: (h?: { x: number; y: number; rgba?: number; index?: number }) => void
  clearLayer: () => void
  exportPNG: () => void
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

type Snapshot = {
  width: number
  height: number
  mode: 'truecolor' | 'indexed'
  layers: Layer[]
  activeLayerId: string
  palette: Uint32Array
  transparentIndex: number
}

export const useAppStore = create<AppState>((set, get) => ({
  width: WIDTH,
  height: HEIGHT,
  layers: [{ id: 'L1', visible: true, locked: false, data: new Uint32Array(WIDTH * HEIGHT) }],
  activeLayerId: 'L1',
  view: { x: 0, y: 0, scale: 5 },
  color: '#000000',
  brushSize: 1,
  shapeFill: false,
  currentPaletteIndex: 1,
  recentColorsTruecolor: ['#000000', '#ffffff'],
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
  _stroking: false,
  selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
  clipboard: undefined,
  // file metadata
  fileMeta: undefined,
  setFileMeta: (fileMeta) => set(() => ({ fileMeta })),
  addLayer: () => set((s) => {
    const id = newLayerId(s.layers)
    const layer: Layer = s.mode === 'truecolor'
      ? { id, visible: true, locked: false, data: new Uint32Array(s.width * s.height) }
      : { id, visible: true, locked: false, indices: new Uint8Array(s.width * s.height) }
    return { layers: [...s.layers, layer], activeLayerId: id }
  }),
  removeLayer: (id) => set((s) => {
    if (s.layers.length <= 1) return {}
    const idx = s.layers.findIndex(l => l.id === id)
    if (idx < 0) return {}
    const next = s.layers.slice(0, idx).concat(s.layers.slice(idx + 1))
    const active = s.activeLayerId === id ? next[Math.max(0, idx - 1)].id : s.activeLayerId
    return { layers: next, activeLayerId: active }
  }),
  duplicateLayer: (id) => set((s) => {
    const i = s.layers.findIndex(l => l.id === id)
    if (i < 0) return {}
    const src = s.layers[i]
    const nid = newLayerId(s.layers)
    const dup: Layer = s.mode === 'truecolor'
      ? { id: nid, visible: true, locked: false, data: new Uint32Array(src.data ?? new Uint32Array(s.width * s.height)) }
      : { id: nid, visible: true, locked: false, indices: new Uint8Array(src.indices ?? new Uint8Array(s.width * s.height)) }
    const next = s.layers.slice()
    next.splice(i + 1, 0, dup)
    return { layers: next, activeLayerId: nid }
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
    return { layers: arr }
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
  toggleShapeFill: () => set((s) => ({ shapeFill: !s.shapeFill })),
  setColor: (c) => set((s) => {
    if (s.mode === 'indexed') {
      // In indexed, pick nearest palette index and sync color/index
      const rgba = parseCSSColor(c)
      const idx = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      const hex = rgbaToCSSHex(s.palette[idx] ?? 0)
      return { color: hex, currentPaletteIndex: idx }
    }
    return { color: c }
  }),
  pushRecentColor: () => set((s) => {
    if (s.mode === 'indexed') {
      // store palette index; if no currentPaletteIndex, derive nearest
      let idx = s.currentPaletteIndex
      if (idx === undefined) {
        const rgba = parseCSSColor(s.color)
        idx = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      }
      if (idx === undefined) return {}
      const existing = s.recentColorsIndexed ?? []
      const next = [idx, ...existing.filter(v => v !== idx)].slice(0, 10)
      return { recentColorsIndexed: next }
    } else {
      const c = s.color
      const norm = (x: string) => x.toLowerCase()
      const existing = s.recentColorsTruecolor ?? []
      const next = [c, ...existing.filter(v => norm(v) !== norm(c))].slice(0, 10)
      return { recentColorsTruecolor: next }
    }
  }),
  setColorIndex: (i) => set((s) => {
    const idx = Math.max(0, Math.min(i | 0, Math.max(0, s.palette.length - 1)))
    const hex = rgbaToCSSHex(s.palette[idx] ?? 0)
    return { currentPaletteIndex: idx, color: hex }
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
    if (s.currentPaletteIndex === i) patch.color = rgbaToCSSHex(pal[i] >>> 0)
    return patch
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
      if (!l.indices) return l
      const src = l.indices
      const dst = new Uint8Array(src.length)
      for (let k = 0; k < src.length; k++) {
        const v = src[k]
        if (v === idx) dst[k] = ti
        else if (v > idx) dst[k] = (v - 1) & 0xff
        else dst[k] = v
      }
      return { ...l, indices: dst }
    })
    const colorHex = rgbaToCSSHex(pal[ci] ?? 0)
    return { palette: pal, transparentIndex: ti, layers, currentPaletteIndex: ci, color: colorHex }
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
      if (!l.indices) return l
      const src = l.indices
      const dst = new Uint8Array(src.length)
      for (let k = 0; k < src.length; k++) dst[k] = map[src[k]]
      return { ...l, indices: dst }
    })
    // remap transparent index
    const ti = map[s.transparentIndex]
    // remap current palette index
    const ci = s.currentPaletteIndex !== undefined ? map[s.currentPaletteIndex] : undefined
    const patch: Partial<AppState> = { palette: pal, layers, transparentIndex: ti }
    if (ci !== undefined) { patch.currentPaletteIndex = ci; patch.color = rgbaToCSSHex(pal[ci] ?? 0) }
    return patch
  }),
  applyPalettePreset: (colors, ti = 0) => set((s) => {
    if (s.mode === 'truecolor')
      throw new Error('applyPalettePreset should not be called in truecolor mode')

    // Limit to 256 colors
    const limited = colors.slice(0, 256)
    if (limited.length === 0) limited[0] = 0x00000000
    const palette = new Uint32Array(limited)
    const transparentIndex = Math.max(0, Math.min(ti | 0, palette.length - 1))


    // Remap indices by nearest color in the new palette
    const remap = s.palette.map((c, i) => i === s.transparentIndex ? ti : nearestIndexInPalette(palette, c, transparentIndex))
    const layers = s.layers.map(l => {
      if (!l.indices) return l
      const src = l.indices
      const dst = new Uint8Array(src.length)
      for (const i in src) {
        dst[i] = remap[src[i]]
      }
      return { ...l, indices: dst }
    })

    // choose current index nearest to previous selected color
    const prevRGBA = s.palette[s.currentPaletteIndex ?? s.transparentIndex] ?? 0x00000000
    const curIdx = s.currentPaletteIndex === s.transparentIndex ? ti : nearestIndexInPalette(palette, prevRGBA, transparentIndex)
    const colorHex = rgbaToCSSHex(palette[curIdx] ?? 0)

    const recentColorsIndexed = s.recentColorsIndexed
      .map(i => (i === s.transparentIndex ? ti : nearestIndexInPalette(palette, s.palette[i] ?? 0x00000000, transparentIndex)))
      .filter((v, i, a) => a.indexOf(v) === i) // dedupe

    return { palette, transparentIndex, layers, currentPaletteIndex: curIdx, color: colorHex, recentColorsIndexed }
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
        return { palette: next, currentPaletteIndex: idx, color: rgbaToCSSHex(next[idx] ?? 0) }
      }
      return { palette: next }
    })
    return next.length - 1
  },
  setTransparentIndex: (idx) => set((s) => {
    const clamped = Math.max(0, Math.min(idx | 0, Math.max(0, s.palette.length - 1)))
    return { transparentIndex: clamped }
  }),
  setView: (x, y, scale) => set(() => ({ view: { x, y, scale: clamp(scale, MIN_SCALE, MAX_SCALE) } })),
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
      const size = Math.max(1, s.brushSize | 0)
      if (s.mode === 'truecolor') {
        const src = layer.data ?? new Uint32Array(W * H)
        const out = stampTruecolor(src, W, H, x, y, size, rgbaOrIndex >>> 0, s.selection?.mask)
        if (out === src || (layer.data && equalU32(out, layer.data))) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        const src = layer.indices ?? new Uint8Array(W * H)
        const out = stampIndexed(src, W, H, x, y, size, rgbaOrIndex & 0xff, s.selection?.mask)
        if (out === src || (layer.indices && equalU8(out, layer.indices))) return {}
        layers[li] = { ...layer, indices: out }
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
      const size = Math.max(1, s.brushSize | 0)
      if (s.mode === 'truecolor') {
        const src = layer.data ?? new Uint32Array(W * H)
        const out = drawLineBrushTruecolor(src, W, H, x0, y0, x1, y1, size, rgbaOrIndex >>> 0, s.selection?.mask)
        if (out === src || (layer.data && equalU32(out, layer.data))) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        const src = layer.indices ?? new Uint8Array(W * H)
        const out = drawLineBrushIndexed(src, W, H, x0, y0, x1, y1, size, rgbaOrIndex & 0xff, s.selection?.mask)
        if (out === src || (layer.indices && equalU8(out, layer.indices))) return {}
        layers[li] = { ...layer, indices: out }
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
        const src = layer.data ?? new Uint32Array(W * H)
        const out = (s.shapeFill
          ? drawRectFilledTruecolor(src, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask)
          : drawRectOutlineTruecolor(src, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask))
        if (out === src || (layer.data && equalU32(out, layer.data))) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        const src = layer.indices ?? new Uint8Array(W * H)
        const out = (s.shapeFill
          ? drawRectFilledIndexed(src, W, H, x0, y0, x1, y1, rgbaOrIndex & 0xff, s.selection?.mask)
          : drawRectOutlineIndexed(src, W, H, x0, y0, x1, y1, rgbaOrIndex & 0xff, s.selection?.mask))
        if (out === src || (layer.indices && equalU8(out, layer.indices))) return {}
        layers[li] = { ...layer, indices: out }
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
        const src = layer.data ?? new Uint32Array(W * H)
        const out = (s.shapeFill
          ? drawEllipseFilledTruecolor(src, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask)
          : drawEllipseOutlineTruecolor(src, W, H, x0, y0, x1, y1, rgbaOrIndex >>> 0, s.selection?.mask))
        if (out === src || (layer.data && equalU32(out, layer.data))) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        const src = layer.indices ?? new Uint8Array(W * H)
        const out = (s.shapeFill
          ? drawEllipseFilledIndexed(src, W, H, x0, y0, x1, y1, rgbaOrIndex & 0xff, s.selection?.mask)
          : drawEllipseOutlineIndexed(src, W, H, x0, y0, x1, y1, rgbaOrIndex & 0xff, s.selection?.mask))
        if (out === src || (layer.indices && equalU8(out, layer.indices))) return {}
        layers[li] = { ...layer, indices: out }
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
        const src = layer.data ?? new Uint32Array(W * H)
        const out = floodFillTruecolor(src, W, H, x, y, rgbaOrIndex, contiguous, mask)
        if (out === src || (layer.data && equalU32(out, layer.data))) return {}
        layers[li] = { ...layer, data: out }
        return { layers }
      } else {
        // indexed mode
        const idxArr = layer.indices ?? new Uint8Array(W * H)
        const replacementIdx = rgbaOrIndex
        const out = floodFillIndexed(idxArr, W, H, x, y, replacementIdx, contiguous, s.transparentIndex, mask)
        if (out === idxArr || equalU8(out, idxArr)) return {}
        layers[li] = { ...layer, indices: out }
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
        s.layers.map(l => ({ visible: l.visible, data: l.data, indices: l.indices })),
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
        return { id: l.id, visible: l.visible, locked: l.locked, indices: idx }
      })
      // Sync current palette index nearest to current color
      const rgba = parseCSSColor(s.color)
      const curIdx = (rgba >>> 0) === 0x00000000 ? transparentIndex : nearestIndexInPalette(autoPalette, rgba, transparentIndex)
      return { mode: 'indexed', layers, currentPaletteIndex: curIdx, color: rgbaToCSSHex(autoPalette[curIdx] ?? 0), palette: autoPalette, transparentIndex, recentColorsIndexed: [] }
    } else {
      // convert all layers: indices -> truecolor
      const layers = s.layers.map(l => {
        const src = l.indices ?? new Uint8Array(s.width * s.height)
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
    const W = s.width, H = s.height
    // reuse selection util to build mask and bounds
    const { mask, bounds } = (() => {
      const left = Math.max(0, Math.min(x0 | 0, x1 | 0))
      const right = Math.min(W - 1, Math.max(x0 | 0, x1 | 0))
      const top = Math.max(0, Math.min(y0 | 0, y1 | 0))
      const bottom = Math.min(H - 1, Math.max(y0 | 0, y1 | 0))
      const m = new Uint8Array(W * H)
      for (let y = top; y <= bottom; y++) {
        const row = y * W
        m.fill(1, row + left, row + right + 1)
      }
      return { mask: m, bounds: { left, top, right, bottom } }
    })()
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
      const data = layer.data ?? new Uint32Array(W * (s.height))
      const float = extractFloatingTruecolor(data, sel.mask, sel.bounds, W)
      const out = clearSelectedTruecolor(data, sel.mask, sel.bounds, W)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      return { selection: { ...sel, floating: float, floatingIndices: undefined, offsetX: 0, offsetY: 0 }, layers }
    } else {
      const idx = layer.indices ?? new Uint8Array(W * (s.height))
      const pal = s.palette
      const ti = s.transparentIndex
      const floatIdx = extractFloatingIndexed(idx, sel.mask, sel.bounds, W, ti)
      const float = new Uint32Array(floatIdx.length)
      for (let i = 0; i < floatIdx.length; i++) {
        float[i] = pal[floatIdx[i]]
      }
      const out = clearSelectedIndexed(idx, sel.mask, sel.bounds, W, ti)
      const layers = s.layers.slice()
      layers[li] = { ...layer, indices: out }
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
      const src = layer.data ?? new Uint32Array(W * H)
      const out = applyFloatingToTruecolorLayer(src, sel.floating, dstLeft, dstTop, bw, bh, W, H)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      return { layers, selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
    } else {
      const idx = layer.indices ?? new Uint8Array(W * H)
      let out: Uint8Array
      if (sel.floatingIndices) {
        // Direct indices path (exact copy)
        out = new Uint8Array(idx)
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
        out = applyFloatingToIndexedLayer(idx, sel.floating, s.palette, s.transparentIndex, dstLeft, dstTop, bw, bh, W, H)
      }
      const layers = s.layers.slice()
      layers[li] = { ...layer, indices: out }
      return { layers, selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
    }
  }),
  // Clipboard operations
  copySelection: () => set((s) => {
    const sel = s.selection
    if (!sel?.bounds) return {}
    const bw = sel.bounds.right - sel.bounds.left + 1
    const bh = sel.bounds.bottom - sel.bounds.top + 1
    if (sel.floating) {
      if (s.mode === 'truecolor') {
        return { clipboard: { kind: 'rgba', pixels: sel.floating.slice(0), width: bw, height: bh } }
      } else {
        if (sel.floatingIndices) {
          return { clipboard: { kind: 'indexed', indices: sel.floatingIndices.slice(0), width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: s.transparentIndex } }
        }
        const idxOut = new Uint8Array(bw * bh)
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const rgba = sel.floating[y * bw + x] >>> 0
            if ((rgba & 0xff) === 0) { idxOut[y * bw + x] = s.transparentIndex & 0xff; continue }
            const pi = nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
            idxOut[y * bw + x] = pi & 0xff
          }
        }
        return { clipboard: { kind: 'indexed', indices: idxOut, width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: s.transparentIndex } }
      }
    }
    const W = s.width, H = s.height
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (s.mode === 'truecolor') {
      const data = layer.data ?? new Uint32Array(W * H)
      const float = extractFloatingTruecolor(data, sel.mask, sel.bounds, W)
      return { clipboard: { kind: 'rgba', pixels: float, width: bw, height: bh } }
    } else {
      const idx = layer.indices ?? new Uint8Array(W * H)
      const ti = s.transparentIndex
      const outIdx = new Uint8Array(bw * bh)
      // build masked indices copy
      for (let y = sel.bounds.top; y <= sel.bounds.bottom; y++) {
        for (let x: number = sel.bounds.left; x <= sel.bounds.right; x++) {
          const i = y * W + x
          const fi = (y - sel.bounds.top) * bw + (x - sel.bounds.left)
          outIdx[fi] = (!sel.mask || sel.mask[i]) ? (idx[i] ?? ti) : (ti & 0xff)
        }
      }
      return { clipboard: { kind: 'indexed', indices: outIdx, width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: ti } }
    }
  }),
  cutSelection: () => set((s) => {
    const sel = s.selection
    if (!sel || !sel.bounds) return {}
    const bw = sel.bounds.right - sel.bounds.left + 1
    const bh = sel.bounds.bottom - sel.bounds.top + 1
    if (sel.floating) {
      if (s.mode === 'truecolor') {
        return { clipboard: { kind: 'rgba', pixels: sel.floating.slice(0), width: bw, height: bh }, selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
      } else {
        if (sel.floatingIndices) {
          return { clipboard: { kind: 'indexed', indices: sel.floatingIndices.slice(0), width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: s.transparentIndex }, selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
        }
        const idxOut = new Uint8Array(bw * bh)
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const rgba = sel.floating[y * bw + x] >>> 0
            if ((rgba & 0xff) === 0) { idxOut[y * bw + x] = s.transparentIndex & 0xff; continue }
            const pi = nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
            idxOut[y * bw + x] = pi & 0xff
          }
        }
        return { clipboard: { kind: 'indexed', indices: idxOut, width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: s.transparentIndex }, selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined } }
      }
    }
    const W = s.width, H = s.height
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    if (s.mode === 'truecolor') {
      const data = layer.data ?? new Uint32Array(W * H)
      const float = extractFloatingTruecolor(data, sel.mask, sel.bounds, W)
      const out = clearSelectedTruecolor(data, sel.mask, sel.bounds, W)
      const layers = s.layers.slice()
      layers[li] = { ...layer, data: out }
      return { selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined }, layers, clipboard: { kind: 'rgba', pixels: float.slice(0), width: bw, height: bh } }
    } else {
      const idx = layer.indices ?? new Uint8Array(W * H)
      const ti = s.transparentIndex
      const out = clearSelectedIndexed(idx, sel.mask, sel.bounds, W, ti)
      const layers = s.layers.slice()
      layers[li] = { ...layer, indices: out }
      const outIdx = extractFloatingIndexed(idx, sel.mask, sel.bounds, W, ti)
      return { selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined }, layers, clipboard: { kind: 'indexed', indices: outIdx, width: bw, height: bh, palette: s.palette.slice(0), transparentIndex: ti } }
    }
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
  setHoverInfo: (h) => set({ hover: h ? { x: h.x, y: h.y, rgba: h.rgba, index: h.index } : undefined }),
  beginStroke: () => set((s) => {
    if (s._stroking) return {}
    const snap = createSnapshot(s)
    const undo = s._undo ? [...s._undo, snap] : [snap]
    return { _undo: undo, _redo: [], _stroking: true, canUndo: true, canRedo: false, dirty: true }
  }),
  endStroke: () => set((s) => (s._stroking ? { _stroking: false } : {})),
  undo: () => set((s) => {
    if (!s._undo || s._undo.length === 0) return {}
    const prev = s._undo[s._undo.length - 1]
    const undo = s._undo.slice(0, -1)
    const snap = createSnapshot(s)
    const redo = (s._redo || []).concat([snap])
    return {
      width: prev.width,
      height: prev.height,
      mode: prev.mode,
      layers: prev.layers.map((l: Snapshot['layers'][number]) => ({
        id: l.id,
        visible: l.visible,
        locked: l.locked,
        data: l.data ? new Uint32Array(l.data) : undefined,
        indices: l.indices ? new Uint8Array(l.indices) : undefined,
      })),
      activeLayerId: prev.activeLayerId,
      palette: new Uint32Array(prev.palette),
      transparentIndex: prev.transparentIndex,
      _undo: undo,
      _redo: redo,
      canUndo: undo.length > 0,
      canRedo: true,
      dirty: true,
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
    }
  }),
  redo: () => set((s) => {
    if (!s._redo || s._redo.length === 0) return {}
    const next = s._redo[s._redo.length - 1]
    const redo = s._redo.slice(0, -1)
    const snap = createSnapshot(s)
    const undo = (s._undo || []).concat([snap])
    return {
      width: next.width,
      height: next.height,
      mode: next.mode,
      layers: next.layers.map((l: Snapshot['layers'][number]) => ({
        id: l.id,
        visible: l.visible,
        locked: l.locked,
        data: l.data ? new Uint32Array(l.data) : undefined,
        indices: l.indices ? new Uint8Array(l.indices) : undefined,
      })),
      activeLayerId: next.activeLayerId,
      palette: new Uint32Array(next.palette),
      transparentIndex: next.transparentIndex,
      _undo: undo,
      _redo: redo,
      canUndo: true,
      canRedo: redo.length > 0,
      dirty: true,
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
    }
  }),
  clearLayer: () => set((s) => {
    const W = s.width, H = s.height
    const snap = createSnapshot(s)
    const undo = (s._undo || []).concat([snap])
    const li = s.layers.findIndex((l: Layer) => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layers = s.layers.slice()
    const layer = layers[li]
    if (s.mode === 'truecolor') layers[li] = { ...layer, data: new Uint32Array(W * H) }
    else layers[li] = { ...layer, indices: new Uint8Array(W * H) }
    return { layers, _undo: undo, _redo: [], canUndo: true, canRedo: false }
  }),
  exportPNG: () => {
    const { mode, layers, palette, transparentIndex, width: W, height: H } = get()
    const cvs = document.createElement('canvas')
    cvs.width = W
    cvs.height = H
    const ctx = cvs.getContext('2d')!
    const img = new ImageData(W, H)
    compositeImageData(layers.map(l => ({ visible: l.visible, data: l.data, indices: l.indices })), mode, palette, transparentIndex, img)
    ctx.putImageData(img, 0, 0)

    const a = document.createElement('a')
    a.href = cvs.toDataURL('image/png')
    a.download = 'cpixel.png'
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
        data: l.data ? Array.from(l.data) : undefined,
        indices: l.indices ? Array.from(l.indices) : undefined,
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
      const { encodeAseprite } = await import('./utils/aseprite.ts')
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
      const { decodeAseprite, aseToCpixel } = await import('./utils/aseprite.ts')
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
        statePatch.color = '#000000'
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

    const snap = createSnapshot(s)
    const layers = resizeLayers(s.layers, s.mode, oldW, oldH, newW, newH)
    const undo = (s._undo || []).concat([snap])
    return {
      width: newW,
      height: newH,
      layers,
      _undo: undo,
      _redo: [],
      canUndo: true,
      canRedo: false,
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
    }
  }),
  flipHorizontal: () => set((s) => {
    const snap = createSnapshot(s)
    const layers = flipLayersHorizontal(s.layers, s.mode, s.width, s.height)
    const undo = (s._undo || []).concat([snap])
    return {
      layers,
      _undo: undo,
      _redo: [],
      canUndo: true,
      canRedo: false,
      dirty: true,
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
    }
  }),
  flipVertical: () => set((s) => {
    const snap = createSnapshot(s)
    const layers = flipLayersVertical(s.layers, s.mode, s.width, s.height)
    const undo = (s._undo || []).concat([snap])
    return {
      layers,
      _undo: undo,
      _redo: [],
      canUndo: true,
      canRedo: false,
      dirty: true,
      selection: { mask: undefined, bounds: undefined, offsetX: 0, offsetY: 0, floating: undefined, floatingIndices: undefined },
    }
  }),
}))

function createSnapshot(state: AppState): Snapshot {
  return {
    width: state.width,
    height: state.height,
    mode: state.mode,
    layers: state.layers.map((l: Layer) => ({
      id: l.id,
      visible: l.visible,
      locked: l.locked,
      data: l.data ? l.data.slice(0) : undefined,
      indices: l.indices ? l.indices.slice(0) : undefined,
    })),
    activeLayerId: state.activeLayerId,
    palette: state.palette.slice(0),
    transparentIndex: state.transparentIndex,
  }
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
