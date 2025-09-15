import { FaLock, FaLockOpen } from 'react-icons/fa'
import { LuArrowDown, LuArrowUp, LuCopy, LuEraser, LuEye, LuEyeOff, LuPlus, LuTrash2 } from 'react-icons/lu'
import { useAppStore } from './stores/store'
import { RCMenuContent, RCMenuItem, RCMenuRoot, RCMenuSeparator, RCMenuTrigger } from './ui/RadixContextMenu'
import { useUIState } from './stores/useUiStore'

export function LayersPanel() {
  const layers = useAppStore(s => s.layers)
  const active = useAppStore(s => s.activeLayerId)
  const addLayer = useAppStore(s => s.addLayer)
  const removeLayer = useAppStore(s => s.removeLayer)
  const duplicateLayer = useAppStore(s => s.duplicateLayer)
  const moveLayer = useAppStore(s => s.moveLayer)
  const setActive = useAppStore(s => s.setActiveLayer)
  const toggleVisible = useAppStore(s => s.toggleVisible)
  const toggleLocked = useAppStore(s => s.toggleLocked)
  const clearLayer = useAppStore(s => s.clearLayer)

  const [collapsed, setCollapsed] = useUIState('layersPanelCollapsed', false)

  if (collapsed) {
    return (
      <div className="absolute right-2 top-2 z-[500] rounded-md border border-border bg-elevated/90 backdrop-blur shadow">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border" onClick={() => setCollapsed(!collapsed)}>
          <div className="text-xs font-medium text-muted">Layers</div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute right-2 top-2 z-[500] w-42 rounded-md border border-border bg-elevated/90 backdrop-blur shadow">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border">
        <div className="text-xs font-medium text-muted cursor-pointer" onClick={() => setCollapsed(!collapsed)}>Layers</div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-surface-muted rounded" title="Add" onClick={() => addLayer()}><LuPlus /></button>
          <button className="p-1 hover:bg-surface-muted rounded" title="Duplicate" onClick={() => active && duplicateLayer(active)}><LuCopy /></button>
          <button className="p-1 hover:bg-surface-muted rounded" title="Remove" onClick={() => active && removeLayer(active)}><LuTrash2 /></button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto">
        {layers.toReversed().map((l, i) => {
          const idx = layers.length - 1 - i
          return (
            <RCMenuRoot key={l.id}>
              <RCMenuTrigger asChild>
                <div className={`flex items-center gap-2 px-2 py-1 text-sm cursor-pointer ${l.id === active ? 'bg-accent/10' : ''}`} onClick={() => setActive(l.id)}>
                  <button className="p-1 rounded" title={l.visible ? 'Hide' : 'Show'} onClick={(e) => { e.stopPropagation(); toggleVisible(l.id) }}>
                    {l.visible ? <LuEye /> : <LuEyeOff />}
                  </button>
                  <button className="p-1 rounded" title={l.locked ? 'Unlock' : 'Lock'} onClick={(e) => { e.stopPropagation(); toggleLocked(l.id) }}>
                    {l.locked ? <FaLock /> : <FaLockOpen />}
                  </button>
                  <div className="flex-1 truncate">{l.id}</div>
                  <div className="flex flex-col">
                    <button className="p-1 rounded disabled:opacity-50" title="Down" disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveLayer(l.id, Math.min(layers.length - 1, idx + 1)) }}><LuArrowUp /></button>
                    <button className="p-1 rounded disabled:opacity-50" title="Up" disabled={i === layers.length - 1} onClick={(e) => { e.stopPropagation(); moveLayer(l.id, Math.max(0, idx - 1)) }}><LuArrowDown /></button>
                  </div>
                </div>
              </RCMenuTrigger>
              <RCMenuContent>
                <RCMenuItem onSelect={() => { if (active !== l.id) setActive(l.id); clearLayer() }}>
                  <LuEraser aria-hidden />
                  <span>Clear</span>
                </RCMenuItem>
                <RCMenuSeparator />
                <RCMenuItem onSelect={() => duplicateLayer(l.id)}>
                  <LuCopy aria-hidden />
                  <span>Duplicate Layer</span>
                </RCMenuItem>
                <RCMenuItem danger disabled={layers.length <= 1} onSelect={() => { if (layers.length <= 1) return; removeLayer(l.id) }}>
                  <LuTrash2 aria-hidden />
                  <span>Delete Layer</span>
                </RCMenuItem>
              </RCMenuContent>
            </RCMenuRoot>
          )
        })}
      </div>
    </div>
  )
}
