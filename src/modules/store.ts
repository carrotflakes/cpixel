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

export type PixelState = {
  data: Uint32Array
  indices?: Uint8Array | null
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
  _undo?: Uint32Array[]
  _redo?: Uint32Array[]
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
  data: new Uint32Array(WIDTH * HEIGHT),
  indices: null,
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
  _undo: [] as Uint32Array[],
  _redo: [] as Uint32Array[],
  _stroking: false,
  setTool: (t) => set({ tool: t }),
  setColor: (c) => set((s) => {
    // update recent colors (dedupe, cap to 10)
    const existing = s.recentColors || []
    const norm = (x: string) => x.toLowerCase()
    const next = [c, ...existing.filter(v => norm(v) !== norm(c))].slice(0, 10)
    return { color: c, recentColors: next }
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
    // remap indices if present
    let newIdxArr: Uint8Array | null = null
    if (s.indices) {
      const src = s.indices
      const dst = new Uint8Array(src.length)
      for (let k = 0; k < src.length; k++) {
        const v = src[k]
        if (v === idx) dst[k] = ti
        else if (v > idx) dst[k] = (v - 1) & 0xff
        else dst[k] = v
      }
      newIdxArr = dst
    }
    return { palette: pal, transparentIndex: ti, indices: newIdxArr ?? s.indices }
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
    // remap indices
    let newIdxArr: Uint8Array | null = null
    if (s.indices) {
      const src = s.indices
      const dst = new Uint8Array(src.length)
      for (let k = 0; k < src.length; k++) dst[k] = map[src[k]]
      newIdxArr = dst
    }
    // remap transparent index
    const ti = map[s.transparentIndex]
    return { palette: pal, indices: newIdxArr ?? s.indices, transparentIndex: ti }
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
    if (s.mode === 'truecolor') {
      const next = new Uint32Array(s.data)
      next[y * WIDTH + x] = rgba >>> 0
      return { data: next }
    } else {
      const idx = s.indices ?? new Uint8Array(WIDTH * HEIGHT)
      const i = y * WIDTH + x
      // erase writes transparent index
      const writeIndex = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      const next = new Uint8Array(idx)
      next[i] = writeIndex & 0xff
      return { indices: next }
    }
  }),
  drawLine: (x0, y0, x1, y1, rgba) => set((s) => {
    // Clamp endpoints
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
    const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT
    if (!inBounds(x0, y0) && !inBounds(x1, y1)) return {}
    if (s.mode === 'truecolor') {
      const out = new Uint32Array(s.data)
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
      if (equalU32(out, s.data)) return {}
      return { data: out }
    } else {
      const idxArr = s.indices ?? new Uint8Array(WIDTH * HEIGHT)
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
      return { indices: out }
    }
  }),
  drawRect: (x0, y0, x1, y1, rgba) => set((s) => {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
    let left = Math.max(0, Math.min(x0, x1))
    let right = Math.min(WIDTH - 1, Math.max(x0, x1))
    let top = Math.max(0, Math.min(y0, y1))
    let bottom = Math.min(HEIGHT - 1, Math.max(y0, y1))
    if (left > right || top > bottom) return {}
    if (s.mode === 'truecolor') {
      const out = new Uint32Array(s.data)
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
      if (equalU32(out, s.data)) return {}
      return { data: out }
    } else {
      const idxArr = s.indices ?? new Uint8Array(WIDTH * HEIGHT)
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
      return { indices: out }
    }
  }),
  fillBucket: (x, y, rgba, contiguous) => set((s) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return {}
    if (s.mode === 'truecolor') {
      const out = floodFillTruecolor(s.data, WIDTH, HEIGHT, x, y, rgba, contiguous)
      // Early out if nothing changed (same color)
      if (out === s.data || equalU32(out, s.data)) return {}
      return { data: out }
    } else {
      // indexed mode
      const idxArr = s.indices ?? new Uint8Array(WIDTH * HEIGHT)
      const replacementIdx = (rgba >>> 0) === 0x00000000
        ? s.transparentIndex
        : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      const out = floodFillIndexed(idxArr, WIDTH, HEIGHT, x, y, replacementIdx, contiguous, s.transparentIndex)
      if (out === idxArr || equalU8(out, idxArr)) return {}
      return { indices: out }
    }
  }),
  setMode: (m) => set((s) => {
    if (s.mode === m) return {}
    if (m === 'indexed') {
      // convert truecolor data -> indices by nearest in palette
      const idx = new Uint8Array(WIDTH * HEIGHT)
      for (let i = 0; i < idx.length; i++) {
        const rgba = s.data[i]
        idx[i] = (rgba >>> 0) === 0x00000000 ? s.transparentIndex : nearestIndexInPalette(s.palette, rgba, s.transparentIndex)
      }
      return { mode: 'indexed', indices: idx }
    } else {
      // convert indices -> truecolor data
      const data = new Uint32Array(WIDTH * HEIGHT)
      const idx = s.indices ?? new Uint8Array(WIDTH * HEIGHT)
      for (let i = 0; i < data.length; i++) {
        const pi = idx[i] ?? s.transparentIndex
        data[i] = s.palette[pi] ?? 0x00000000
      }
      return { mode: 'truecolor', data }
    }
  }),
  setHoverInfo: (x, y, rgba) => set({ hoverX: x, hoverY: y, hoverRGBA: rgba }),
  clearHoverInfo: () => set({ hoverX: undefined, hoverY: undefined, hoverRGBA: undefined }),
  beginStroke: () => set((s: any) => {
    if (s._stroking) return {}
    // snapshot full state as JSON-serializable object of typed array buffers
    const snap = {
      mode: s.mode,
      data: s.data.slice(0),
      indices: s.indices ? s.indices.slice(0) : null,
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
      data: s.data.slice(0),
      indices: s.indices ? s.indices.slice(0) : null,
      palette: s.palette.slice(0),
      transparentIndex: s.transparentIndex,
    }
    const redo = (s._redo || []).concat([curSnap])
    return {
      mode: prev.mode,
      data: new Uint32Array(prev.data),
      indices: prev.indices ? new Uint8Array(prev.indices) : null,
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
      data: s.data.slice(0),
      indices: s.indices ? s.indices.slice(0) : null,
      palette: s.palette.slice(0),
      transparentIndex: s.transparentIndex,
    }
    const undo = (s._undo || []).concat([curSnap])
    return {
      mode: next.mode,
      data: new Uint32Array(next.data),
      indices: next.indices ? new Uint8Array(next.indices) : null,
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
      data: s.data.slice(0),
      indices: s.indices ? s.indices.slice(0) : null,
      palette: s.palette.slice(0),
      transparentIndex: s.transparentIndex,
    }
    const undo = (s._undo || []).concat([curSnap])
    if (s.mode === 'truecolor') {
      return { data: new Uint32Array(WIDTH * HEIGHT), _undo: undo, _redo: [], canUndo: true, canRedo: false }
    } else {
      return { indices: new Uint8Array(WIDTH * HEIGHT), _undo: undo, _redo: [], canUndo: true, canRedo: false }
    }
  }),
  exportPNG: () => {
    const { mode, data, indices, palette, transparentIndex } = get()
    const cvs = document.createElement('canvas')
    cvs.width = WIDTH
    cvs.height = HEIGHT
    const ctx = cvs.getContext('2d')!
    const img = ctx.createImageData(WIDTH, HEIGHT)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const i = (y * WIDTH + x) * 4
        let rgba: number
        if (mode === 'truecolor') {
          rgba = data[y * WIDTH + x]
        } else {
          const pi = indices ? indices[y * WIDTH + x] : transparentIndex
          rgba = palette[pi] ?? 0x00000000
        }
        img.data[i+0] = (rgba >>> 24) & 0xff
        img.data[i+1] = (rgba >>> 16) & 0xff
        img.data[i+2] = (rgba >>> 8) & 0xff
        img.data[i+3] = (rgba >>> 0) & 0xff
      }
    }
    ctx.putImageData(img, 0, 0)
    const a = document.createElement('a')
    a.href = cvs.toDataURL('image/png')
    a.download = 'cpixel.png'
    a.click()
  },
}))
