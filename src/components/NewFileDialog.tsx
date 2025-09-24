import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ColorMode } from '@/types'

type Props = {
  open: boolean
  onCancel: () => void
  onCreate: (options: { width: number; height: number; colorMode: ColorMode }) => void
  initialWidth: number
  initialHeight: number
  initialMode: ColorMode
  dirty: boolean
}

const MAX_DIMENSION = 2048

export function NewFileDialog({ open, onCancel, onCreate, initialWidth, initialHeight, initialMode, dirty }: Props) {
  const [widthStr, setWidthStr] = useState(String(initialWidth))
  const [heightStr, setHeightStr] = useState(String(initialHeight))
  const [mode, setMode] = useState<ColorMode>(initialMode)
  const [error, setError] = useState<string | null>(null)
  const widthRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setWidthStr(String(initialWidth))
    setHeightStr(String(initialHeight))
    setMode(initialMode)
    setError(null)
    const focusHandle = setTimeout(() => widthRef.current?.focus(), 0)
    return () => clearTimeout(focusHandle)
  }, [open, initialWidth, initialHeight, initialMode])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      if (e.key === 'Enter') { e.preventDefault(); submit() }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [open, widthStr, heightStr, mode])

  const submit = () => {
    const width = Number(widthStr)
    const height = Number(heightStr)
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      setError('Width and height must be numbers.')
      return
    }
    const normWidth = clampDimension(width)
    const normHeight = clampDimension(height)
    if (normWidth <= 0 || normHeight <= 0) {
      setError('Width and height must be at least 1 pixel.')
      return
    }
    onCreate({ width: normWidth, height: normHeight, colorMode: mode })
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,30rem)] rounded-md border border-border bg-elevated shadow-lg p-4">
        <h2 className="text-base font-medium mb-3">New file</h2>
        <p className="text-xs text-muted mb-4">Set the size and color mode for the new canvas.</p>
        {dirty && (
          <div className="mb-3 rounded border border-border bg-surface-muted/60 px-3 py-2 text-xs text-muted">
            Starting a new file will discard the current project.
          </div>
        )}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 flex-1 min-w-[8rem]">
              <span className="text-sm text-muted">Width (px)</span>
              <input
                ref={widthRef}
                type="number"
                min={1}
                max={MAX_DIMENSION}
                inputMode="numeric"
                className="w-full rounded border border-border bg-surface p-1"
                value={widthStr}
                onChange={(e) => setWidthStr(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[8rem]">
              <span className="text-sm text-muted">Height (px)</span>
              <input
                type="number"
                min={1}
                max={MAX_DIMENSION}
                inputMode="numeric"
                className="w-full rounded border border-border bg-surface p-1"
                value={heightStr}
                onChange={(e) => setHeightStr(e.target.value)}
              />
            </label>
          </div>
          <fieldset className="flex flex-col gap-2 border border-border rounded p-3">
            <legend className="px-1 text-sm font-medium">Color mode</legend>
            <label className="flex items-center gap-2 select-none">
              <input
                type="radio"
                name="new-file-mode"
                value="rgba"
                checked={mode === 'rgba'}
                onChange={() => setMode('rgba')}
              />
              <span className="text-sm">RGBA</span>
            </label>
            <label className="flex items-center gap-2 select-none">
              <input
                type="radio"
                name="new-file-mode"
                value="indexed"
                checked={mode === 'indexed'}
                onChange={() => setMode('indexed')}
              />
              <span className="text-sm">Indexed</span>
            </label>
          </fieldset>
        </div>
        {error && <div className="text-xs text-red-600 mt-3">{error}</div>}
        <div className="mt-4 flex gap-2 justify-end">
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={onCancel}>Cancel</button>
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={submit}>Create</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return 0
  const clamped = Math.max(1, Math.min(MAX_DIMENSION, Math.floor(value)))
  return clamped
}
