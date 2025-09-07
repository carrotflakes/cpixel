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
    }),
    {
      name: KEY,
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        checkerSize: s.checkerSize,
        tiltParallaxEnabled: s.tiltParallaxEnabled,
        tiltParallaxTrigger: s.tiltParallaxTrigger,
        tiltParallaxAmount: s.tiltParallaxAmount,
      }),
      migrate: (persisted, fromVersion) => {
        if (!persisted) return { checkerSize: 4, tiltParallaxEnabled: true, tiltParallaxTrigger: 180, tiltParallaxAmount: 0.5 }
        if (fromVersion === 1) {
          const cs = Math.max(1, Math.min(64, Math.floor((persisted as any).checkerSize ?? 4)))
            ; return { checkerSize: cs, tiltParallaxEnabled: true, tiltParallaxTrigger: 180, tiltParallaxAmount: 0.5 }
        }
        const cs = Math.max(1, Math.min(64, Math.floor((persisted as any).checkerSize ?? 4)))
        const en = typeof (persisted as any).tiltParallaxEnabled === 'boolean' ? (persisted as any).tiltParallaxEnabled : true
        const trgRaw = (persisted as any).tiltParallaxTrigger
        const trg = Math.max(20, Math.min(720, Number.isFinite(trgRaw) ? Math.round(trgRaw) : 180))
        const amtRaw = (persisted as any).tiltParallaxAmount
        const amount = Math.max(0.05, Math.min(5, Number.isFinite(amtRaw) ? Number(amtRaw) : 0.5))
        return { checkerSize: cs, tiltParallaxEnabled: en, tiltParallaxTrigger: trg, tiltParallaxAmount: amount }
      },
    }
  )
)
