import { usePixelStore } from './store'

export function TopBar() {
  const color = usePixelStore(s => s.color)
  const recent = usePixelStore(s => s.recentColors)
  const setColor = usePixelStore(s => s.setColor)
  const clear = usePixelStore(s => s.clear)
  const exportPNG = usePixelStore(s => s.exportPNG)

  return (
    <div className="p-2 flex gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm">Color</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10" />
      </div>
      <div className="hidden sm:flex items-center gap-1">
        {recent?.map((c) => (
          <button
            key={c}
            title={c}
            aria-label={`Use ${c}`}
            className="w-6 h-6 rounded border border-black/20"
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <button className="px-3 py-1 rounded bg-gray-800 text-white text-sm" onClick={clear}>Clear</button>
      <button className="px-3 py-1 rounded bg-blue-600 text-white text-sm" onClick={exportPNG}>Export PNG</button>
    </div>
  )
}
