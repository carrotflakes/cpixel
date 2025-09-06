import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettingsStore } from './settingsStore'

export function SettingsDialog(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props
  const checkerSize = useSettingsStore(s => s.checkerSize)
  const setCheckerSize = useSettingsStore(s => s.setCheckerSize)
  const [checkerStr, setCheckerStr] = useState(String(checkerSize))
  const firstRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setCheckerStr(String(checkerSize))
    const t = setTimeout(() => firstRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open, checkerSize])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Enter') { e.preventDefault(); apply() }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any)
  }, [open, checkerStr])

  const apply = () => {
    const v = Number(checkerStr)
    if (!Number.isFinite(v)) return
    const norm = Math.max(1, Math.min(64, Math.floor(v)))
    setCheckerSize(norm)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,30rem)] rounded-md border border-border bg-elevated shadow-lg p-4">
        <h2 className="text-base font-medium mb-4">Settings</h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 max-w-52">
            <span className="text-sm text-muted">Checker size (px)</span>
            <input
              ref={firstRef}
              type="number"
              min={1}
              max={64}
              inputMode="numeric"
              className="w-full rounded border border-border bg-surface p-1"
              value={checkerStr}
              onChange={(e) => setCheckerStr(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={apply}>Apply</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
