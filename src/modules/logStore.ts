import { create } from 'zustand'

export type LogEntry = { message: string; time: number }

export type LogState = {
  logs: LogEntry[]
  pushLog: (log: { message: string }) => void
  clearLogs: () => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  pushLog: ({ message }) => set((s) => {
    const time = performance.now()
    const entry: LogEntry = { message, time }
    return { logs: [...s.logs, entry].slice(-20) }
  }),
  clearLogs: () => set({ logs: [] }),
}))
