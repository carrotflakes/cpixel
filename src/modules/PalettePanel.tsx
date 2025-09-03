import { rgbaToCSSHex, parseCSSColor } from './utils/color'
import { usePixelStore } from './store'

export function PalettePanel() {
  const mode = usePixelStore(s => s.mode)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const addPaletteColor = usePixelStore(s => s.addPaletteColor)
  const setTransparentIndex = usePixelStore(s => s.setTransparentIndex)
  const setColor = usePixelStore(s => s.setColor)
  const color = usePixelStore(s => s.color)

  if (mode !== 'indexed') return null

  const onAddFromPicker = () => {
    const rgba = parseCSSColor(color)
    const idx = addPaletteColor(rgba)
    setColor(rgbaToCSSHex(palette[idx] ?? rgba))
  }

  return (
    <div className="px-3 py-2 border-t border-gray-300 bg-white/70 dark:bg-gray-900/40 backdrop-blur">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">Palette ({palette.length}/256)</span>
        <button className="px-2 py-1 text-xs rounded bg-gray-800 text-white" onClick={onAddFromPicker}>Add current color</button>
        <label className="text-sm ml-3">Transparent</label>
        <select
          value={transparentIndex}
          onChange={(e) => setTransparentIndex(parseInt(e.target.value, 10))}
          className="px-2 py-1 rounded border border-gray-300 bg-white text-sm"
        >
          {Array.from({ length: palette.length }).map((_, i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from(palette).map((rgba, i) => (
          <button
            key={i}
            title={`#${i}`}
            className={`w-7 h-7 rounded border ${i === transparentIndex ? 'border-blue-600 border-2' : 'border-black/20'}`}
            style={{ background: rgbaToCSSHex(rgba) }}
            onClick={() => setColor(rgbaToCSSHex(rgba))}
          />
        ))}
      </div>
    </div>
  )
}
