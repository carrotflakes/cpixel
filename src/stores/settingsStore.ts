import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ToolType } from './store'

export type SettingsState = {
  checkerSize: number
  setCheckerSize: (n: number) => void
  tiltParallaxEnabled: boolean
  setTiltParallaxEnabled: (v: boolean) => void
  tiltParallaxTrigger: number
  setTiltParallaxTrigger: (n: number) => void
  tiltParallaxAmount: number
  setTiltParallaxAmount: (n: number) => void
  tiltParallaxAlpha: number
  setTiltParallaxAlpha: (n: number) => void
  rightClickTool: ToolType
  setRightClickTool: (t: ToolType) => void
  usePen: boolean
  setUsePen: (v: boolean) => void
  googleDrive: boolean
  setGoogleDrive: (v: boolean) => void
}

const KEY = 'cpixel.settings.v1'

const DEFAULT_STATE = {
  checkerSize: 4,
  tiltParallaxEnabled: true,
  tiltParallaxTrigger: 180,
  tiltParallaxAmount: 0.5,
  tiltParallaxAlpha: 0.9,
  rightClickTool: 'eraser',
  usePen: false,
  googleDrive: false
} as const

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_STATE,
      setCheckerSize: (n: number) => {
        const v = Math.max(1, Math.min(64, Math.floor(n)))
        set({ checkerSize: v })
      },
      setTiltParallaxEnabled: (v: boolean) => set({ tiltParallaxEnabled: !!v }),
      tiltParallaxTrigger: 180,
      setTiltParallaxTrigger: (n: number) => {
        const v = Math.max(20, Math.min(720, Math.round(n)))
        set({ tiltParallaxTrigger: v })
      },
      setTiltParallaxAmount: (n: number) => {
        const v = Math.max(0.05, Math.min(5, Number(n)))
        set({ tiltParallaxAmount: v })
      },
      setTiltParallaxAlpha: (n: number) => {
        const v = Math.max(0.05, Math.min(1, Number(n)))
        set({ tiltParallaxAlpha: v })
      },
      setRightClickTool: (t) => set({ rightClickTool: t }),
      setUsePen: (v: boolean) => set({ usePen: !!v }),
      setGoogleDrive: (v: boolean) => set({ googleDrive: !!v }),
    }),
    {
      name: KEY,
      version: 5,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        checkerSize: s.checkerSize,
        tiltParallaxEnabled: s.tiltParallaxEnabled,
        tiltParallaxTrigger: s.tiltParallaxTrigger,
        tiltParallaxAmount: s.tiltParallaxAmount,
        tiltParallaxAlpha: s.tiltParallaxAlpha,
        rightClickTool: s.rightClickTool,
        usePen: s.usePen,
        googleDrive: s.googleDrive,
      }),
      migrate: (persisted: any, _fromVersion) => {
        const state = { ...DEFAULT_STATE }
        if (!persisted || typeof persisted !== 'object') return state
        if (typeof persisted.checkerSize === 'number') state.checkerSize = persisted.checkerSize
        if (typeof persisted.tiltParallaxEnabled === 'boolean') state.tiltParallaxEnabled = persisted.tiltParallaxEnabled
        if (typeof persisted.tiltParallaxTrigger === 'number') state.tiltParallaxTrigger = persisted.tiltParallaxTrigger
        if (typeof persisted.tiltParallaxAmount === 'number') state.tiltParallaxAmount = persisted.tiltParallaxAmount
        if (typeof persisted.tiltParallaxAlpha === 'number') state.tiltParallaxAlpha = persisted.tiltParallaxAlpha
        if (typeof persisted.rightClickTool === 'string') state.rightClickTool = persisted.rightClickTool
        if (typeof persisted.usePen === 'boolean') state.usePen = persisted.usePen
        if (typeof persisted.googleDrive === 'boolean') state.googleDrive = persisted.googleDrive
        return state
      },
    }
  )
)
