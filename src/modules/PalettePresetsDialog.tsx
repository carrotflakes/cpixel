import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PALETTE_PRESETS, PalettePreset } from './presets/palettes'
import { rgbaToCSSHex } from './utils/color'

type Props = {
  open: boolean
  onCancel: () => void
  onSelect: (preset: PalettePreset) => void
}

export function PalettePresetsDialog({ open, onCancel, onSelect }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Close on Escape, outside click
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      if (rootRef.current && t && rootRef.current.contains(t)) return
      onCancel()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true })
      window.removeEventListener('pointerdown', onDown, { capture: true })
    }
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(720px,92vw)] max-h-[80vh] overflow-auto rounded-md border border-border bg-elevated shadow-lg p-4">
        <h2 className="text-base font-medium mb-3">Palette presets</h2>
        <div ref={rootRef} className="grid gap-2 sm:grid-cols-2">
          {PALETTE_PRESETS.map((p) => (
            <button
              key={p.id}
              className="text-left p-2 rounded border border-border hover:bg-surface-muted"
              onClick={() => onSelect(p)}
              title={`Apply ${p.name}`}
            >
              <div className="text-xs font-medium mb-2 text-content">{p.name}</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(p.colors.slice(0, 32)).map((c, i) => {
                  const isTransparent = (p.transparentIndex ?? -1) === i || ((c >>> 0) & 0xff) === 0
                  const style = isTransparent
                    ? { backgroundImage: 'repeating-conic-gradient(#cccccc 0% 25%, transparent 0% 50%)', backgroundSize: '8px 8px', backgroundColor: '#ffffff' }
                    : { background: rgbaToCSSHex(c) }
                  return (
                    <span key={i} className="w-4 h-4 inline-block rounded border border-border" style={style} />
                  )
                })}
                {p.colors.length > 32 && (
                  <span className="text-[10px] text-muted ml-1">+{p.colors.length - 32}</span>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-3 text-right">
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={onCancel}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
