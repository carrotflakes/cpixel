import { rgbaToCSSHex } from './utils/color'
import { usePixelStore, WIDTH } from './store'

export function StatusBar() {
  const size = usePixelStore(s => s.pixelSize)
  const hx = usePixelStore(s => s.hoverX)
  const hy = usePixelStore(s => s.hoverY)
  const rgba = usePixelStore(s => s.hoverRGBA)
  const mode = usePixelStore(s => s.mode)
  const indices = usePixelStore(s => s.indices)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)

  return (
    <div className="text-xs flex items-center gap-4 px-3 py-1 border-t border-gray-300 bg-white/60 dark:bg-gray-900/40 backdrop-blur">
      <span>Zoom: {Math.round(size * 100) / 100}x</span>
      {hx !== undefined && hy !== undefined ? (
        <span>Pos: ({hx}, {hy})</span>
      ) : (
        <span>Pos: (-,-)</span>
      )}
      {rgba !== undefined ? (
        mode === 'indexed' && hx !== undefined && hy !== undefined ? (
          (() => {
            const p = hy * WIDTH + hx
            const idx = indices ? indices[p] ?? transparentIndex : transparentIndex
            const hex = rgbaToCSSHex(palette[idx] ?? 0)
            return (
              <span className="flex items-center gap-2">
                Idx: {idx} <i className="inline-block align-middle w-4 h-4 rounded border border-black/20" style={{ background: hex }} /> {hex}
              </span>
            )
          })()
        ) : (
          <span className="flex items-center gap-2">
            Color: <i className="inline-block align-middle w-4 h-4 rounded border border-black/20" style={{ background: rgbaToCSSHex(rgba) }} /> {rgbaToCSSHex(rgba)}
          </span>
        )
      ) : (
        <span>Color: -</span>
      )}
    </div>
  )
}
