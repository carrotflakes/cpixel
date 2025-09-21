import { FileMeta, useAppStore } from './store'
import { useLogStore } from './logStore'
import { parseCSSColor } from '../utils/color'

// Simple localStorage autosave / restore
// - Periodic save (every 10s)
// - Debounced save (1s after a change)
// - Save on page unload
// - Restore on load (runs once)

const KEY = 'cpixel.autosave.v1'
let started = false

type PersistPayload = {
  app: 'cpixel'
  version: 1
  width: number
  height: number
  colorMode: 'rgba' | 'indexed'
  layers: Array<{
    id: string; visible: boolean; locked: boolean; data: number[];
  }>
  activeLayerId: string
  palette: { colors: number[]; transparentIndex: number }
  color: number
  recentColorsRgba: number[]
  recentColorsIndexed: number[]
  fileMeta?: FileMeta
}

function buildPayload(): PersistPayload {
  const s = useAppStore.getState()
  return {
    app: 'cpixel',
    version: 1,
    width: s.width,
    height: s.height,
    colorMode: s.colorMode,
    layers: s.layers.map(l => ({
      id: l.id,
      visible: l.visible,
      locked: l.locked,
      data: Array.from(l.data),
    })),
    activeLayerId: s.activeLayerId,
    palette: {
      colors: Array.from(s.palette.colors),
      transparentIndex: s.palette.transparentIndex,
    },
    color: s.color,
    recentColorsRgba: s.recentColorsRgba,
    recentColorsIndexed: s.recentColorsIndexed,
    fileMeta: s.fileMeta,
  }
}

function saveNow() {
  try {
    const s = useAppStore.getState()
    // Avoid saving mid-stroke to prevent excessive snapshots
    if (s.mode !== null) return
    const payload = buildPayload()
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data && data.app === 'cpixel') {
      // migrate
      data.color = typeof data.color === 'string' ? parseCSSColor(data.color) : data.color
      data.recentColorsRgba = typeof data.recentColorsRgba[0] === 'string'
        ? data.recentColorsRgba.map(parseCSSColor)
        : data.recentColorsRgba

      useAppStore.getState().importJSON(data, data.fileMeta)
      useLogStore.getState().pushLog({ message: 'Autosave restored' })
    }
  } catch {
    // ignore corrupt
  }
}

export function initAutosave() {
  if (typeof window === 'undefined') return
  if (started) return
  started = true
  restore()

  // Debounced change save
  let timeout: number | undefined
  useAppStore.subscribe(() => {
    if (timeout) window.clearTimeout(timeout)
    timeout = window.setTimeout(saveNow, 1000)
  })

  // Periodic safety save
  const interval = window.setInterval(saveNow, 10000)

  // Save on unload
  const handleUnload = () => { try { saveNow() } catch { /* noop */ } }
  window.addEventListener('beforeunload', handleUnload)

    // Optional cleanup if ever needed (not used now)
    ; (window as any).__cpixelStopAutosave = () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.clearInterval(interval)
      if (timeout) window.clearTimeout(timeout)
    }
}
