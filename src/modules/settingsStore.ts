import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type SettingsState = {
  checkerSize: number
  setCheckerSize: (n: number) => void
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
    }),
    {
      name: KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // validate / migrate if needed later
      partialize: (s) => ({ checkerSize: s.checkerSize }),
      migrate: (persisted) => {
        // Basic guard + range clamp
        if (!persisted || typeof (persisted as any).checkerSize !== 'number') return { checkerSize: 4 }
        const cs = Math.max(1, Math.min(64, Math.floor((persisted as any).checkerSize)))
        return { checkerSize: cs }
      },
    }
  )
)
