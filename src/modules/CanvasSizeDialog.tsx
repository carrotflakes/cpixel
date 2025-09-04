import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  initialWidth: number
  initialHeight: number
  onCancel: () => void
  onSubmit: (w: number, h: number) => void
}

export function CanvasSizeDialog({ open, initialWidth, initialHeight, onCancel, onSubmit }: Props) {
  const [wStr, setWStr] = useState(String(initialWidth))
  const [hStr, setHStr] = useState(String(initialHeight))
  const [error, setError] = useState<string | null>(null)
  const widthRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setWStr(String(initialWidth))
    setHStr(String(initialHeight))
    setError(null)
  }, [open, initialWidth, initialHeight])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => widthRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      if (e.key === 'Enter') { e.preventDefault(); submit() }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any)
  }, [open, wStr, hStr])

  const submit = () => {
    const w = Number(wStr)
    const h = Number(hStr)
    if (!Number.isFinite(w) || !Number.isFinite(h)) { setError('Width and height must be numbers.'); return }
    const wi = Math.max(1, Math.floor(w))
    const hi = Math.max(1, Math.floor(h))
    if (wi !== w || hi !== h) {
      // normalize silently; not an error
    }
    onSubmit(wi, hi)
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,32rem)] sm:w-[min(90vw,32rem)] rounded-md border border-border bg-elevated shadow-lg p-4">
        <h2 className="text-base font-medium mb-3">Canvas size</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 flex-1 min-w-[8rem]">
            <span className="text-sm text-muted">Width (px)</span>
            <input
              ref={widthRef}
              type="number"
              min={1}
              inputMode="numeric"
              className="w-full sm:w-28 rounded border border-border bg-surface p-1"
              value={wStr}
              onChange={(e) => setWStr(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[8rem]">
            <span className="text-sm text-muted">Height (px)</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              className="w-full sm:w-28 rounded border border-border bg-surface p-1"
              value={hStr}
              onChange={(e) => setHStr(e.target.value)}
            />
          </label>
          <div className="ml-0 sm:ml-auto flex gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
            <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={onCancel}>Cancel</button>
            <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={submit}>Apply</button>
          </div>
        </div>
        {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
        <p className="mt-3 text-xs text-muted">Existing pixels outside the new size will be clipped. Content is anchored at the top-left.</p>
      </div>
    </div>,
    document.body
  )
}
