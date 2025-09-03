import { usePixelStore } from './store'
import { FaEraser } from 'react-icons/fa'
import { LuDownload, LuPaintbrush, LuPaintBucket } from 'react-icons/lu'

export function TopBar() {
  const color = usePixelStore(s => s.color)
  const recent = usePixelStore(s => s.recentColors)
  const setColor = usePixelStore(s => s.setColor)
  const mode = usePixelStore(s => s.mode)
  const setMode = usePixelStore(s => s.setMode)
  const clear = usePixelStore(s => s.clear)
  const exportPNG = usePixelStore(s => s.exportPNG)
  const tool = usePixelStore(s => s.tool)
  const setTool = usePixelStore(s => s.setTool)

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
      <div className="flex items-center gap-2 ml-auto">
        <label className="text-sm">Tool</label>
        <div className="inline-flex rounded border border-gray-300 overflow-hidden">
          <button
            className={`px-2 py-1 text-sm inline-flex items-center gap-1 ${tool === 'brush' ? 'bg-gray-200' : 'bg-white'} hover:bg-gray-100`}
            onClick={() => setTool('brush')}
            aria-pressed={tool === 'brush'}
            title="Brush"
          >
            <LuPaintbrush aria-hidden />
            <span className="hidden sm:inline">Brush</span>
          </button>
          <button
            className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-gray-300 ${tool === 'bucket' ? 'bg-gray-200' : 'bg-white'} hover:bg-gray-100`}
            onClick={() => setTool('bucket')}
            aria-pressed={tool === 'bucket'}
            title="Bucket"
          >
            <LuPaintBucket aria-hidden />
            <span className="hidden sm:inline">Bucket</span>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm">Mode</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as any)}
          className="px-2 py-1 rounded border border-gray-300 bg-white text-sm"
        >
          <option value="truecolor">Truecolor</option>
          <option value="indexed">Indexed</option>
        </select>
      </div>
      <button className="px-3 py-1 rounded bg-gray-800 text-white text-sm inline-flex items-center gap-1" onClick={clear}>
        <FaEraser aria-hidden />
        <span>Clear</span>
      </button>
      <button className="px-3 py-1 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-1" onClick={exportPNG}>
        <LuDownload aria-hidden />
        <span>Export PNG</span>
      </button>
    </div>
  )
}
