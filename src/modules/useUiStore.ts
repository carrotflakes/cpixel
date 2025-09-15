import { useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const useUIStateStore = create<Record<string, any>>()(
  persist(
    () => ({}),
    { name: 'cpixel.uistate' }
  )
)

export function useUIState<T>(key: string, defaultValue: T) {
  const v = useUIStateStore(s => (s[key] ?? defaultValue) as T)
  const setter = useCallback((val: T | ((prev: T) => T)) => {
    if (typeof val === 'function') {
      useUIStateStore.setState(s => ({ [key]: (val as (prev: T) => T)(s[key] ?? defaultValue as T) }))
    } else {
      useUIStateStore.setState(({ [key]: val }))
    }
  }, [key])
  return [
    v,
    setter
  ] as const
}
