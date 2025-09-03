import { create } from 'zustand'
import { clamp } from './utils/view'

export const WIDTH = 64
export const HEIGHT = 64
export const MIN_SIZE = 4
export const MAX_SIZE = 40

export type PixelState = {
  data: Uint32Array
  pixelSize: number
  viewX: number
  viewY: number
  color: string
  recentColors: string[]
  setColor: (c: string) => void
  setPixelSize: (n: number) => void
  setPixelSizeRaw: (n: number) => void
  setView: (x: number, y: number) => void
  panBy: (dx: number, dy: number) => void
  setAt: (x: number, y: number, rgba: number) => void
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
  pixelSize: 10,
  viewX: 0,
  viewY: 0,
  color: '#000000',
  recentColors: ['#000000', '#ffffff'],
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
  setPixelSize: (n) => set({ pixelSize: clamp(Math.round(n), MIN_SIZE, MAX_SIZE) }),
  // Allows fractional pixel sizes (used for pinch-zoom). Still clamped to bounds.
  setPixelSizeRaw: (n) => set({ pixelSize: clamp(n, MIN_SIZE, MAX_SIZE) }),
  setView: (x, y) => set({ viewX: x, viewY: y }),
  panBy: (dx, dy) => set((s) => ({ viewX: s.viewX + dx, viewY: s.viewY + dy })),
  setAt: (x, y, rgba) => set((s) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return {}
    const next = new Uint32Array(s.data)
    next[y * WIDTH + x] = rgba >>> 0
    return { data: next }
  }),
  setHoverInfo: (x, y, rgba) => set({ hoverX: x, hoverY: y, hoverRGBA: rgba }),
  clearHoverInfo: () => set({ hoverX: undefined, hoverY: undefined, hoverRGBA: undefined }),
  beginStroke: () => set((s: any) => {
    if (s._stroking) return {}
    const snap = new Uint32Array(s.data)
    const undo = s._undo ? [...s._undo, snap] : [snap]
    return { _undo: undo, _redo: [], _stroking: true, canUndo: true, canRedo: false }
  }),
  endStroke: () => set((s: any) => (s._stroking ? { _stroking: false } : {})),
  undo: () => set((s: any) => {
    if (!s._undo || s._undo.length === 0) return {}
    const prev = s._undo[s._undo.length - 1]
    const undo = s._undo.slice(0, -1)
    const redo = (s._redo || []).concat([new Uint32Array(s.data)])
    return { data: new Uint32Array(prev), _undo: undo, _redo: redo, canUndo: undo.length > 0, canRedo: true }
  }),
  redo: () => set((s: any) => {
    if (!s._redo || s._redo.length === 0) return {}
    const next = s._redo[s._redo.length - 1]
    const redo = s._redo.slice(0, -1)
    const undo = (s._undo || []).concat([new Uint32Array(s.data)])
    return { data: new Uint32Array(next), _undo: undo, _redo: redo, canUndo: true, canRedo: redo.length > 0 }
  }),
  clear: () => set((s: any) => {
    const snap = new Uint32Array(s.data)
    const undo = (s._undo || []).concat([snap])
    return { data: new Uint32Array(WIDTH * HEIGHT), _undo: undo, _redo: [], canUndo: true, canRedo: false }
  }),
  exportPNG: () => {
    const { data } = get()
    const cvs = document.createElement('canvas')
    cvs.width = WIDTH
    cvs.height = HEIGHT
    const ctx = cvs.getContext('2d')!
    const img = ctx.createImageData(WIDTH, HEIGHT)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const i = (y * WIDTH + x) * 4
        const rgba = data[y * WIDTH + x]
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
