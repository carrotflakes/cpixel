import { rgbaToCSSHex } from './utils/color'
import { useAppStore } from './store'
import { ColorBox } from './ColorBox'

export function StatusBar() {
  const size = useAppStore(s => s.view.scale)
  const hover = useAppStore(s => s.hover)
  const mode = useAppStore(s => s.mode)
  const palette = useAppStore(s => s.palette)

  return (
    <div className="text-xs flex items-center gap-4 px-3 py-1 border-t border-border bg-surface/70 backdrop-blur overflow-x-auto [&>span]:whitespace-nowrap">
      <span>Zoom: {Math.round(size * 100) / 100}x</span>
      <span className="text-muted">Mode: {mode}{mode === 'indexed' ? ` (${palette.length})` : ''}</span>
      {hover ? (
        <>
          <span>Pos: ({hover.x}, {hover.y})</span>
          {hover.rgba !== undefined ? (
            <span className="flex items-center gap-2">
              Color: <ColorBox className="inline-block align-middle w-4 h-4 rounded border border-border" color={rgbaToCSSHex(hover.rgba)} /> {rgbaToCSSHex(hover.rgba)}{mode === 'indexed' && hover.index !== undefined ? <span className="text-muted"> ({hover.index})</span> : null}
            </span>
          ) : (
            <span>Color: -</span>
          )}
        </>
      ) : (
        <>
          <span>Pos: (-,-)</span>
          <span>Color: -</span>
        </>
      )}
    </div>
  )
}
