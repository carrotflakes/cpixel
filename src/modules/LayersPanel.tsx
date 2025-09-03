import { usePixelStore } from './store'
import { LuEye, LuEyeOff, LuArrowUp, LuArrowDown, LuPlus, LuTrash2, LuCopy } from 'react-icons/lu'
import { FaLock, FaLockOpen } from 'react-icons/fa'

export function LayersPanel() {
  const layers = usePixelStore(s => s.layers)
  const active = usePixelStore(s => s.activeLayerId)
  const addLayer = usePixelStore(s => s.addLayer)
  const removeLayer = usePixelStore(s => s.removeLayer)
  const duplicateLayer = usePixelStore(s => s.duplicateLayer)
  const moveLayer = usePixelStore(s => s.moveLayer)
  const setActive = usePixelStore(s => s.setActiveLayer)
  const toggleVisible = usePixelStore(s => s.toggleVisible)
  const toggleLocked = usePixelStore(s => s.toggleLocked)

  return (
    <div className="absolute right-2 top-14 z-[500] w-56 rounded-md border border-border bg-elevated/90 backdrop-blur shadow">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border">
        <div className="text-xs font-medium text-muted">Layers</div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-surface-muted rounded" title="Add" onClick={() => addLayer()}><LuPlus /></button>
          <button className="p-1 hover:bg-surface-muted rounded" title="Duplicate" onClick={() => active && duplicateLayer(active)}><LuCopy /></button>
          <button className="p-1 hover:bg-surface-muted rounded" title="Remove" onClick={() => active && removeLayer(active)}><LuTrash2 /></button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto">
        {layers.map((l, i) => {
          return (
          <div key={l.id} className={`flex items-center gap-2 px-2 py-1 text-sm cursor-pointer ${l.id === active ? 'bg-accent/10' : ''}`} onClick={() => setActive(l.id)}>
            <button className="p-1 hover:bg-surface-muted rounded" title={l.visible ? 'Hide' : 'Show'} onClick={(e) => { e.stopPropagation(); toggleVisible(l.id) }}>
              {l.visible ? <LuEye /> : <LuEyeOff />}
            </button>
            <button className={`p-1 rounded ${l.locked ? 'text-muted' : ''}`} title={l.locked ? 'Unlock' : 'Lock'} onClick={(e) => { e.stopPropagation(); toggleLocked(l.id) }}>
              {l.locked ? <FaLock /> : <FaLockOpen />}
            </button>
            <div className="flex-1 truncate">{l.id}</div>
            <div className="flex flex-col">
              <button className="p-1 hover:bg-surface-muted rounded disabled:opacity-50" title="Down" disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveLayer(l.id, Math.max(0, i - 1)) }}><LuArrowUp /></button>
              <button className="p-1 hover:bg-surface-muted rounded disabled:opacity-50" title="Up" disabled={i === layers.length - 1} onClick={(e) => { e.stopPropagation(); moveLayer(l.id, Math.min(layers.length - 1, i + 1)) }}><LuArrowDown /></button>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}
