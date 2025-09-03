import { create } from 'zustand'
import { clamp } from './utils/view'
import { nearestIndexInPalette } from './utils/color'

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
  setColor: (c: string) => void
  addPaletteColor: (rgba: number) => number
  setTransparentIndex: (idx: number) => void
  setPixelSize: (n: number) => void
  setPixelSizeRaw: (n: number) => void
  setView: (x: number, y: number) => void
  panBy: (dx: number, dy: number) => void
  setAt: (x: number, y: number, rgba: number) => void
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
  setColor: (c) => set((s) => {
    // update recent colors (dedupe, cap to 10)
    const existing = s.recentColors || []
    const norm = (x: string) => x.toLowerCase()
    const next = [c, ...existing.filter(v => norm(v) !== norm(c))].slice(0, 10)
    return { color: c, recentColors: next }
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
