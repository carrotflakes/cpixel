import { RCMenuContent, RCMenuItem, RCMenuRoot, RCMenuSeparator, RCMenuTrigger } from '@/components/ui/RadixContextMenu'
import { useAppStore } from '@/stores/store'
import { useUIState } from '@/stores/useUiStore'
import { ensureHiDPICanvas, getCheckerCanvas } from '@/utils/canvasDraw.ts'
import { compositeImageData } from '@/utils/composite.ts'
import { useEffect, useRef } from 'react'
import { FaLock, FaLockOpen } from 'react-icons/fa'
import { LuArrowDown, LuArrowUp, LuCopy, LuEraser, LuEye, LuEyeOff, LuPlus, LuTrash2 } from 'react-icons/lu'

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
      <div className="absolute right-2 top-2 z-[500] rounded-md border border-border bg-elevated/70 backdrop-blur shadow">
        <div className="flex items-center justify-between px-4 py-2" onClick={() => setCollapsed(!collapsed)}>
          <div className="text-xs font-medium">Layers</div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute right-2 top-2 z-[500] w-42 rounded-md border border-border bg-elevated/70 backdrop-blur shadow">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border">
        <div className="text-xs font-medium cursor-pointer" onClick={() => setCollapsed(!collapsed)}>Layers</div>
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
                  <LayerPreview layer={l} />
                  <div className="flex-1 truncate">{l.id}</div>
                  <div className="flex flex-col">
                    <button className="p-1 rounded disabled:opacity-50" title="Down" disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveLayer(l.id, Math.min(layers.length - 1, idx + 1)) }}><LuArrowUp /></button>
                    <button className="p-1 rounded disabled:opacity-50" title="Up" disabled={i === layers.length - 1} onClick={(e) => { e.stopPropagation(); moveLayer(l.id, Math.max(0, idx - 1)) }}><LuArrowDown /></button>
                  </div>
                </div>
              </RCMenuTrigger>
              <RCMenuContent>
                <RCMenuItem onSelect={() => { toggleLocked(l.id) }}>
                  {l.locked ? (<FaLockOpen aria-hidden />) : (<FaLock aria-hidden />)}
                  <span>{l.locked ? 'Unlock' : 'Lock'}</span>
                </RCMenuItem>
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

function LayerPreview({ layer }: { layer: { id: string; visible: boolean; locked: boolean; data: Uint32Array | Uint8Array }; }) {
  const width = useAppStore(s => s.width)
  const height = useAppStore(s => s.height)
  const colorMode = useAppStore(s => s.colorMode)
  const palette = useAppStore(s => s.palette)
  const transparentIndex = useAppStore(s => s.transparentIndex)
  const blockRedraw = useAppStore(s => !!s._stroking)

  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (blockRedraw) return
    const cvs = ref.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    const { rect } = ensureHiDPICanvas(cvs, ctx)
    ctx.clearRect(0, 0, rect.width, rect.height)

    ctx.save()
    // checker background
    const checker = getCheckerCanvas(4, rect.width, rect.height)
    ctx.drawImage(checker, 0, 0, rect.width, rect.height)
    // render layer to ImageData
    const img = ctx.createImageData(width, height)
    compositeImageData([{ visible: true, data: layer.data }], colorMode, palette, transparentIndex, img)
    // draw scaled into thumb
    const off = new OffscreenCanvas(img.width, img.height)
    const octx = off.getContext('2d', { willReadFrequently: true })!
    octx.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = false
    const scale = Math.min(rect.width / img.width, rect.height / img.height) || 1
    const drawW = Math.max(1, Math.floor(img.width * scale))
    const drawH = Math.max(1, Math.floor(img.height * scale))
    const dx = Math.floor((rect.width - drawW) / 2)
    const dy = Math.floor((rect.height - drawH) / 2)
    ctx.drawImage(off, dx, dy, drawW, drawH)
    // overlay if locked
    if (layer.locked) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(0, 0, rect.width, rect.height)
    }
    // clip to bounds
    ctx.globalCompositeOperation = 'destination-in'
    ctx.fillStyle = 'black'
    ctx.fillRect(dx, dy, drawW, drawH)
    ctx.restore()
  }, [layer.data, layer.locked, width, height, colorMode, palette, transparentIndex, blockRedraw])

  return (
    <div className="relative w-10 h-10 pointer-events-none">
      <canvas ref={ref} className="w-10 h-10" />
      {layer.locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FaLock className="text-sm text-black/70" aria-hidden />
        </div>
      )}
    </div>
  )
}
