import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@/stores/store'

export function ExportPNGDialog(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props
  const [scaleStr, setScaleStr] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const firstRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setScaleStr('1')
    setError(null)
    const t = setTimeout(() => firstRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Enter') { e.preventDefault(); submit() }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [open, scaleStr])

  const submit = () => {
    const v = Number(scaleStr)
    if (!Number.isFinite(v)) { setError('Scale must be a number.'); return }
    const vi = Math.max(1, Math.min(64, Math.floor(v)))
    if (vi !== v) {
      // silently normalize
    }
    useAppStore.getState().exportPNG(vi)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,30rem)] rounded-md border border-border bg-elevated shadow-lg p-4">
        <h2 className="text-base font-medium mb-4">Export PNG</h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 max-w-40">
            <span className="text-sm text-muted">Scale (1-64x)</span>
            <input
              ref={firstRef}
              type="number"
              min={1}
              max={64}
              inputMode="numeric"
              className="w-full rounded border border-border bg-surface p-1"
              value={scaleStr}
              onChange={(e) => setScaleStr(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 items-center text-xs">
            {['1','2','4','8','16'].map(opt => (
              <button
                key={opt}
                onClick={() => setScaleStr(opt)}
                className={"px-2 py-1 rounded border border-border bg-surface hover:bg-surface-muted " + (scaleStr === opt ? 'ring-1 ring-primary' : '')}
              >{opt}x</button>
            ))}
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <p className="text-[11px] text-muted leading-snug">The image will be exported at (canvas size * scale). Pixels are scaled with nearest-neighbor.</p>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={submit}>Export</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
