import { create } from 'zustand'

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
  setColor: (c: string) => void
  setPixelSize: (n: number) => void
  setPixelSizeRaw: (n: number) => void
  setView: (x: number, y: number) => void
  panBy: (dx: number, dy: number) => void
  setAt: (x: number, y: number, rgba: number) => void
  clear: () => void
  exportPNG: () => void
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export const usePixelStore = create<PixelState>((set, get) => ({
  data: new Uint32Array(WIDTH * HEIGHT),
  pixelSize: 10,
  viewX: 0,
  viewY: 0,
  color: '#000000',
  setColor: (c) => set({ color: c }),
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
  clear: () => set({ data: new Uint32Array(WIDTH * HEIGHT) }),
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
