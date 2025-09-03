import { create } from 'zustand'
import { clamp } from './utils/view'
import { nearestIndexInPalette } from './utils/color'
import { floodFillIndexed, floodFillTruecolor } from './utils/fill'

function equalU32(a: Uint32Array, b: Uint32Array) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
function equalU8(a: Uint8Array, b: Uint8Array) {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export const WIDTH = 64
export const HEIGHT = 64
export const MIN_SIZE = 4
export const MAX_SIZE = 40

type Layer = {
  id: string
  visible: boolean
  locked: boolean
  data?: Uint32Array
  indices?: Uint8Array
}

export type PixelState = {
  // legacy single-buffer fields are replaced by layers
  layers: Layer[]
  activeLayerId: string
  pixelSize: number
  viewX: number
  viewY: number
  color: string
  recentColors: string[]
  mode: 'truecolor' | 'indexed'
  palette: Uint32Array
  transparentIndex: number
  tool?: 'brush' | 'bucket' | 'line' | 'rect'
  setColor: (c: string) => void
  setColorLive: (c: string) => void
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
  setTool: (t: 'brush' | 'bucket' | 'line' | 'rect') => void
  setPixelSize: (n: number) => void
  setPixelSizeRaw: (n: number) => void
  setView: (x: number, y: number) => void
  panBy: (dx: number, dy: number) => void
  setAt: (x: number, y: number, rgba: number) => void
  drawLine: (x0: number, y0: number, x1: number, y1: number, rgba: number) => void
  drawRect: (x0: number, y0: number, x1: number, y1: number, rgba: number) => void
  fillBucket: (x: number, y: number, rgba: number, contiguous: boolean) => void
  setMode: (m: 'truecolor' | 'indexed') => void
  // history
  beginStroke: () => void
  endStroke: () => void
  undo: () => void
  redo: () => void
  canUndo?: boolean
  canRedo?: boolean
  // private/internal fields (optional to satisfy TS when mutating with set)
  _undo?: any[]
  _redo?: any[]
  _stroking?: boolean
  // hover info for status bar
  hoverX?: number
  hoverY?: number
  hoverRGBA?: number
  setHoverInfo: (x: number, y: number, rgba: number) => void
  clearHoverInfo: () => void
  clear: () => void
  exportPNG: () => void
}

// clamp imported from utils

export const usePixelStore = create<PixelState>((set, get) => ({
  layers: [{ id: 'L1', visible: true, locked: false, data: new Uint32Array(WIDTH * HEIGHT) }],
  activeLayerId: 'L1',
  pixelSize: 10,
  viewX: 0,
  viewY: 0,
  color: '#000000',
  recentColors: ['#000000', '#ffffff'],
  mode: 'truecolor',
  tool: 'brush',
  // simple default palette (16 base colors + transparent at 0)
  palette: new Uint32Array([
    0x00000000, 0xffffffff, 0xff0000ff, 0x00ff00ff, 0x0000ffff, 0xffff00ff, 0xff00ffff, 0x00ffffff,
    0x7f7f7fff, 0x3f3f3fff, 0xff7f7fff, 0x7fff7fff, 0x7f7fffff, 0xffff7fff, 0xff7fffff, 0x7fffffff,
  ]),
  transparentIndex: 0,
  canUndo: false,
  canRedo: false,
  // internal history state
  _undo: [] as any[],
  _redo: [] as any[],
  _stroking: false,
  addLayer: () => set((s) => {
    const id = 'L' + (s.layers.length + 1)
    const layer: Layer = s.mode === 'truecolor'
      ? { id, visible: true, locked: false, data: new Uint32Array(WIDTH * HEIGHT) }
      : { id, visible: true, locked: false, indices: new Uint8Array(WIDTH * HEIGHT) }
    return { layers: [layer, ...s.layers], activeLayerId: id }
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
    const nid = 'L' + (s.layers.length + 1)
    const dup: Layer = s.mode === 'truecolor'
      ? { id: nid, visible: true, locked: false, data: new Uint32Array(src.data ?? new Uint32Array(WIDTH * HEIGHT)) }
      : { id: nid, visible: true, locked: false, indices: new Uint8Array(src.indices ?? new Uint8Array(WIDTH * HEIGHT)) }
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
  setTool: (t) => set({ tool: t }),
  setColor: (c) => set((s) => {
    // update recent colors (dedupe, cap to 10)
    const existing = s.recentColors || []
    const norm = (x: string) => x.toLowerCase()
    const next = [c, ...existing.filter(v => norm(v) !== norm(c))].slice(0, 10)
    return { color: c, recentColors: next }
  }),
  // setColorLive updates only the current color for live previews (e.g., <input type="color"> drag)
  // It intentionally does not modify recentColors or history.
  setColorLive: (c) => set({ color: c }),
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
    return { palette: pal, transparentIndex: ti, layers }
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
    return { palette: pal, layers, transparentIndex: ti }
  }),
  addPaletteColor: (rgba) => {
    const s = get()
    // if exists, return its index
    const existingIdx = s.palette.findIndex((p) => p === (rgba >>> 0))
    if (existingIdx >= 0) return existingIdx
    if (s.palette.length >= 256) return s.palette.length - 1
    const next = new Uint32Array(s.palette.length + 1)
    next.set(s.palette)
    next[s.palette.length] = rgba >>> 0
    set({ palette: next })
    return next.length - 1
  },
  setTransparentIndex: (idx) => set((s) => {
    const clamped = Math.max(0, Math.min(idx | 0, Math.max(0, s.palette.length - 1)))
    // Ensure transparent slot is transparent color for clarity
    const pal = new Uint32Array(s.palette)
    pal[clamped] = 0x00000000
    return { transparentIndex: clamped, palette: pal }
  }),
  setPixelSize: (n) => set({ pixelSize: clamp(Math.round(n), MIN_SIZE, MAX_SIZE) }),
  // Allows fractional pixel sizes (used for pinch-zoom). Still clamped to bounds.
  setPixelSizeRaw: (n) => set({ pixelSize: clamp(n, MIN_SIZE, MAX_SIZE) }),
  setView: (x, y) => set({ viewX: x, viewY: y }),
  panBy: (dx, dy) => set((s) => ({ viewX: s.viewX + dx, viewY: s.viewY + dy })),
  setAt: (x, y, rgba) => set((s) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return {}
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const layers = s.layers.slice()
    if (s.mode === 'truecolor') {
      const src = layer.data ?? new Uint32Array(WIDTH * HEIGHT)
      const next = new Uint32Array(src)
      next[y * WIDTH + x] = rgba >>> 0
      layers[li] = { ...layer, data: next }
      return { layers }
    } else {
      const src = layer.indices ?? new Uint8Array(WIDTH * HEIGHT)
      const i = y * WIDTH + x
      const writeIndex = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      const next = new Uint8Array(src)
      next[i] = writeIndex & 0xff
      layers[li] = { ...layer, indices: next }
      return { layers }
    }
  }),
  drawLine: (x0, y0, x1, y1, rgba) => set((s) => {
    // Clamp endpoints
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
    const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    if (!inBounds(x0, y0) && !inBounds(x1, y1)) return {}
    const layers = s.layers.slice()
    if (s.mode === 'truecolor') {
      const out = new Uint32Array(layer.data ?? new Uint32Array(WIDTH * HEIGHT))
      // Bresenham
      let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
      let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
      let err = dx + dy
      let x = x0, y = y0
      while (true) {
        if (inBounds(x, y)) out[y * WIDTH + x] = rgba >>> 0
        if (x === x1 && y === y1) break
        const e2 = 2 * err
        if (e2 >= dy) { err += dy; x += sx }
        if (e2 <= dx) { err += dx; y += sy }
      }
      if (layer.data && equalU32(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return { layers }
    } else {
      const idxArr = layer.indices ?? new Uint8Array(WIDTH * HEIGHT)
      const writeIndex = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      const out = new Uint8Array(idxArr)
      let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
      let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
      let err = dx + dy
      let x = x0, y = y0
      while (true) {
        if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) out[y * WIDTH + x] = writeIndex & 0xff
        if (x === x1 && y === y1) break
        const e2 = 2 * err
        if (e2 >= dy) { err += dy; x += sx }
        if (e2 <= dx) { err += dx; y += sy }
      }
      if (equalU8(out, idxArr)) return {}
      layers[li] = { ...layer, indices: out }
      return { layers }
    }
  }),
  drawRect: (x0, y0, x1, y1, rgba) => set((s) => {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
    let left = Math.max(0, Math.min(x0, x1))
    let right = Math.min(WIDTH - 1, Math.max(x0, x1))
    let top = Math.max(0, Math.min(y0, y1))
    let bottom = Math.min(HEIGHT - 1, Math.max(y0, y1))
    if (left > right || top > bottom) return {}
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const layers = s.layers.slice()
    if (s.mode === 'truecolor') {
      const out = new Uint32Array(layer.data ?? new Uint32Array(WIDTH * HEIGHT))
      const pix = rgba >>> 0
      // top/bottom
      for (let x = left; x <= right; x++) {
        out[top * WIDTH + x] = pix
        out[bottom * WIDTH + x] = pix
      }
      // sides
      for (let y = top; y <= bottom; y++) {
        out[y * WIDTH + left] = pix
        out[y * WIDTH + right] = pix
      }
      if (layer.data && equalU32(out, layer.data)) return {}
      layers[li] = { ...layer, data: out }
      return { layers }
    } else {
      const idxArr = layer.indices ?? new Uint8Array(WIDTH * HEIGHT)
      const writeIndex = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      const out = new Uint8Array(idxArr)
      for (let x = left; x <= right; x++) {
        out[top * WIDTH + x] = writeIndex & 0xff
        out[bottom * WIDTH + x] = writeIndex & 0xff
      }
      for (let y = top; y <= bottom; y++) {
        out[y * WIDTH + left] = writeIndex & 0xff
        out[y * WIDTH + right] = writeIndex & 0xff
      }
      if (equalU8(out, idxArr)) return {}
      layers[li] = { ...layer, indices: out }
      return { layers }
    }
  }),
  fillBucket: (x, y, rgba, contiguous) => set((s) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return {}
    const li = s.layers.findIndex(l => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layer = s.layers[li]
    if (layer.locked) return {}
    const layers = s.layers.slice()
    if (s.mode === 'truecolor') {
      const src = layer.data ?? new Uint32Array(WIDTH * HEIGHT)
      const out = floodFillTruecolor(src, WIDTH, HEIGHT, x, y, rgba, contiguous)
      if (out === src || (layer.data && equalU32(out, layer.data))) return {}
      layers[li] = { ...layer, data: out }
      return { layers }
    } else {
      // indexed mode
      const idxArr = layer.indices ?? new Uint8Array(WIDTH * HEIGHT)
      const replacementIdx = (rgba >>> 0) === 0x00000000
        ? s.transparentIndex
        : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      const out = floodFillIndexed(idxArr, WIDTH, HEIGHT, x, y, replacementIdx, contiguous, s.transparentIndex)
      if (out === idxArr || equalU8(out, idxArr)) return {}
      layers[li] = { ...layer, indices: out }
      return { layers }
    }
  }),
  setMode: (m) => set((s) => {
    if (s.mode === m) return {}
    if (m === 'indexed') {
      // convert all layers: truecolor -> indices
      const layers = s.layers.map(l => {
        const src = l.data ?? new Uint32Array(WIDTH * HEIGHT)
        const idx = new Uint8Array(WIDTH * HEIGHT)
        for (let i = 0; i < idx.length; i++) {
          const rgba = src[i]
          idx[i] = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
        }
        return { id: l.id, visible: l.visible, locked: l.locked, indices: idx } as Layer
      })
      return { mode: 'indexed', layers }
    } else {
      // convert all layers: indices -> truecolor
      const layers = s.layers.map(l => {
        const src = l.indices ?? new Uint8Array(WIDTH * HEIGHT)
        const data = new Uint32Array(WIDTH * HEIGHT)
        for (let i = 0; i < data.length; i++) {
          const pi = src[i] ?? s.transparentIndex
          data[i] = s.palette[pi] ?? 0x00000000
        }
        return { id: l.id, visible: l.visible, locked: l.locked, data } as Layer
      })
      return { mode: 'truecolor', layers }
    }
  }),
  setHoverInfo: (x, y, rgba) => set({ hoverX: x, hoverY: y, hoverRGBA: rgba }),
  clearHoverInfo: () => set({ hoverX: undefined, hoverY: undefined, hoverRGBA: undefined }),
  beginStroke: () => set((s: any) => {
    if (s._stroking) return {}
    // snapshot full state as JSON-serializable object of typed array buffers
    const snap = {
      mode: s.mode,
      layers: s.layers.map((l: Layer) => ({
        id: l.id,
        visible: l.visible,
        locked: l.locked,
        data: l.data ? l.data.slice(0) : undefined,
        indices: l.indices ? l.indices.slice(0) : undefined,
      })),
      activeLayerId: s.activeLayerId,
      palette: s.palette.slice(0),
      transparentIndex: s.transparentIndex,
    }
    const undo = s._undo ? [...s._undo, snap] : [snap]
    return { _undo: undo, _redo: [], _stroking: true, canUndo: true, canRedo: false }
  }),
  endStroke: () => set((s: any) => (s._stroking ? { _stroking: false } : {})),
  undo: () => set((s: any) => {
    if (!s._undo || s._undo.length === 0) return {}
    const prev = s._undo[s._undo.length - 1]
    const undo = s._undo.slice(0, -1)
    const curSnap = {
      mode: s.mode,
      layers: s.layers.map((l: Layer) => ({
        id: l.id,
        visible: l.visible,
        locked: l.locked,
        data: l.data ? l.data.slice(0) : undefined,
        indices: l.indices ? l.indices.slice(0) : undefined,
      })),
      activeLayerId: s.activeLayerId,
      palette: s.palette.slice(0),
      transparentIndex: s.transparentIndex,
    }
    const redo = (s._redo || []).concat([curSnap])
    return {
      mode: prev.mode,
      layers: prev.layers.map((l: any) => ({
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
    }
  }),
  redo: () => set((s: any) => {
    if (!s._redo || s._redo.length === 0) return {}
    const next = s._redo[s._redo.length - 1]
    const redo = s._redo.slice(0, -1)
    const curSnap = {
      mode: s.mode,
      layers: s.layers.map((l: Layer) => ({
        id: l.id,
        visible: l.visible,
        locked: l.locked,
        data: l.data ? l.data.slice(0) : undefined,
        indices: l.indices ? l.indices.slice(0) : undefined,
      })),
      activeLayerId: s.activeLayerId,
      palette: s.palette.slice(0),
      transparentIndex: s.transparentIndex,
    }
    const undo = (s._undo || []).concat([curSnap])
    return {
      mode: next.mode,
      layers: next.layers.map((l: any) => ({
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
    }
  }),
  clear: () => set((s: any) => {
    const curSnap = {
      mode: s.mode,
      layers: s.layers.map((l: Layer) => ({
        id: l.id,
        visible: l.visible,
        locked: l.locked,
        data: l.data ? l.data.slice(0) : undefined,
        indices: l.indices ? l.indices.slice(0) : undefined,
      })),
      activeLayerId: s.activeLayerId,
      palette: s.palette.slice(0),
      transparentIndex: s.transparentIndex,
    }
    const undo = (s._undo || []).concat([curSnap])
    const li = s.layers.findIndex((l: Layer) => l.id === s.activeLayerId)
    if (li < 0) return {}
    const layers = s.layers.slice()
    const layer = layers[li]
    if (s.mode === 'truecolor') layers[li] = { ...layer, data: new Uint32Array(WIDTH * HEIGHT) }
    else layers[li] = { ...layer, indices: new Uint8Array(WIDTH * HEIGHT) }
    return { layers, _undo: undo, _redo: [], canUndo: true, canRedo: false }
  }),
  exportPNG: () => {
    const { mode, layers, palette, transparentIndex } = get()
    const cvs = document.createElement('canvas')
    cvs.width = WIDTH
    cvs.height = HEIGHT
    const ctx = cvs.getContext('2d')!
    const img = ctx.createImageData(WIDTH, HEIGHT)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const i = (y * WIDTH + x) * 4
        // composite visible layers bottom->top (Normal)
        let out = 0x00000000
        for (let li = 0; li < layers.length; li++) {
          const L = layers[li]
          if (!L.visible) continue
          let rgba = 0x00000000
          if (mode === 'truecolor') {
            rgba = (L.data ?? new Uint32Array(WIDTH * HEIGHT))[y * WIDTH + x] >>> 0
          } else {
            const pi = (L.indices ?? new Uint8Array(WIDTH * HEIGHT))[y * WIDTH + x] ?? transparentIndex
            rgba = palette[pi] ?? 0x00000000
          }
          // alpha over
          const aS = rgba & 0xff
          if (aS === 0) continue
          if ((out & 0xff) === 255) continue
          const rS = (rgba >>> 24) & 0xff
          const gS = (rgba >>> 16) & 0xff
          const bS = (rgba >>> 8) & 0xff
          const rD = (out >>> 24) & 0xff
          const gD = (out >>> 16) & 0xff
          const bD = (out >>> 8) & 0xff
          const aD = out & 0xff
          const aO = aS + ((aD * (255 - aS) + 127) / 255 | 0)
          const rO = ((rS * aS + rD * aD * (255 - aS) / 255 + 127) / 255) | 0
          const gO = ((gS * aS + gD * aD * (255 - aS) / 255 + 127) / 255) | 0
          const bO = ((bS * aS + bD * aD * (255 - aS) / 255 + 127) / 255) | 0
          out = (rO << 24) | (gO << 16) | (bO << 8) | (aO & 0xff)
          if ((out & 0xff) === 255) break
        }
        img.data[i + 0] = (out >>> 24) & 0xff
        img.data[i + 1] = (out >>> 16) & 0xff
        img.data[i + 2] = (out >>> 8) & 0xff
        img.data[i + 3] = (out >>> 0) & 0xff
      }
    }
    ctx.putImageData(img, 0, 0)
    const a = document.createElement('a')
    a.href = cvs.toDataURL('image/png')
    a.download = 'cpixel.png'
    a.click()
  },
}))
