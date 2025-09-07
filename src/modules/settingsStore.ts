import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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
}

const KEY = 'cpixel.settings.v1'

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      checkerSize: 4,
      setCheckerSize: (n: number) => {
        const v = Math.max(1, Math.min(64, Math.floor(n)))
        set({ checkerSize: v })
      },
      tiltParallaxEnabled: true,
      setTiltParallaxEnabled: (v: boolean) => set({ tiltParallaxEnabled: !!v }),
      tiltParallaxTrigger: 180,
      setTiltParallaxTrigger: (n: number) => {
        const v = Math.max(20, Math.min(720, Math.round(n)))
        set({ tiltParallaxTrigger: v })
      },
      tiltParallaxAmount: 0.5,
      setTiltParallaxAmount: (n: number) => {
        const v = Math.max(0.05, Math.min(5, Number(n)))
        set({ tiltParallaxAmount: v })
      },
      tiltParallaxAlpha: 0.9,
      setTiltParallaxAlpha: (n: number) => {
        const v = Math.max(0.05, Math.min(1, Number(n)))
        set({ tiltParallaxAlpha: v })
      },
    }),
    {
      name: KEY,
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        checkerSize: s.checkerSize,
        tiltParallaxEnabled: s.tiltParallaxEnabled,
        tiltParallaxTrigger: s.tiltParallaxTrigger,
        tiltParallaxAmount: s.tiltParallaxAmount,
        tiltParallaxAlpha: s.tiltParallaxAlpha,
      }),
      migrate: (persisted: any, _fromVersion) => {
        const state = { checkerSize: 4, tiltParallaxEnabled: true, tiltParallaxTrigger: 180, tiltParallaxAmount: 0.5, tiltParallaxAlpha: 0.9 }
        if (!persisted || typeof persisted !== 'object') return state
        if (typeof persisted.checkerSize === 'number') state.checkerSize = persisted.checkerSize
        if (typeof persisted.tiltParallaxEnabled === 'boolean') state.tiltParallaxEnabled = persisted.tiltParallaxEnabled
        if (typeof persisted.tiltParallaxTrigger === 'number') state.tiltParallaxTrigger = persisted.tiltParallaxTrigger
        if (typeof persisted.tiltParallaxAmount === 'number') state.tiltParallaxAmount = persisted.tiltParallaxAmount
        if (typeof persisted.tiltParallaxAlpha === 'number') state.tiltParallaxAlpha = persisted.tiltParallaxAlpha
        return state
      },
    }
  )
)
