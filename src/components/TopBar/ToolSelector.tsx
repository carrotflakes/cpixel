import { FaEraser } from 'react-icons/fa'
import { LuPaintbrush, LuPaintBucket, LuSlash, LuSquare, LuPipette, LuCheck, LuCircle } from 'react-icons/lu'
import { RiDragMove2Fill } from 'react-icons/ri'
import { PiLasso, PiRectangleDashed, PiMagicWand } from 'react-icons/pi'
import { useAppStore } from '@/stores/store'
import { useState, useRef, useEffect } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

const itemCls = 'px-3 py-2 rounded-sm text-sm flex items-center gap-2 cursor-pointer select-none outline-none focus:bg-surface-muted data-[disabled]:opacity-50'
const contentCls = 'z-1000 p-1 border border-border bg-elevated rounded-md shadow-lg'
const separatorCls = 'my-1 h-px bg-border'

export function ToolSelector() {
  const tool = useAppStore(s => s.tool)
  const setTool = useAppStore(s => s.setTool)
  const shapeTool = useAppStore(s => s.shapeTool)
  const selectTool = useAppStore(s => s.selectTool)
  const [openMenu, setOpenMenu] = useState<Record<string, boolean>>({})

  const eyedropperSampleMode = useAppStore(s => s.eyedropperSampleMode)
  const setEyedropperSampleMode = useAppStore(s => s.setEyedropperSampleMode)

  const shapeToolObj = SHAPE_TOOLS.find(s => s.id === shapeTool) ?? SHAPE_TOOLS[0]
  const ShapeIcon = shapeToolObj.icon
  const selToolObj = SELECT_TOOLS.find(s => s.id === selectTool) ?? SELECT_TOOLS[0]
  const SelIcon = selToolObj.icon

  // Brush size menu
  const brushSize = useAppStore(s => s.brush.size)
  const eraserSize = useAppStore(s => s.eraserSize)
  const setEraserSize = useAppStore(s => s.setEraserSize)
  const W = useAppStore(s => s.width)
  const H = useAppStore(s => s.height)
  const maxDim = Math.max(8, W, H) / 2 | 0
  const shapeFill = useAppStore(s => s.shapeFill)
  const toggleShapeFill = useAppStore(s => s.toggleShapeFill)

  const shapeToolSelected = !!SHAPE_TOOLS.find(s => s.id === tool)
  const selectToolSelected = !!SELECT_TOOLS.find(s => s.id === tool)

  return (
    <div className="flex items-center gap-2 ml-auto">
      <label className="hidden sm:inline text-sm text-muted">Tool</label>
      <div className="inline-flex rounded border border-border overflow-hidden">
        <DropdownMenu.Root
          modal={false}
          open={openMenu.brush ?? false}
          onOpenChange={(open) => { open && setTool('brush'); setOpenMenu(s => ({ ...s, brush: open })) }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-2 py-1 inline-flex items-center gap-1 ${tool === 'brush' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={tool === 'brush'}
              aria-haspopup="menu"
              aria-expanded={openMenu.brush ?? false}
              title={`Brush (size ${brushSize})`}
            >
              <LuPaintbrush aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={contentCls} sideOffset={6} align="start">
              <BrushMenu maxDim={maxDim} />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <DropdownMenu.Root
          modal={false}
          open={openMenu.eyedropper ?? false}
          onOpenChange={(open) => { open && setTool('eyedropper'); setOpenMenu(s => ({ ...s, eyedropper: open })) }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'eyedropper' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={tool === 'eyedropper'}
              aria-haspopup="menu"
              aria-expanded={openMenu.eyedropper ?? false}
              title={`Eyedropper (${eyedropperSampleMode === 'front' ? 'front-most' : 'composited'})`}
            >
              <LuPipette aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={contentCls} sideOffset={6} align="start">
              <DropdownMenu.Item
                className={itemCls}
                onSelect={() => setEyedropperSampleMode('composite')}
              >
                {eyedropperSampleMode === 'composite' ? <span className="w-4 inline-block"><LuCheck /></span> : <span className="w-4 inline-block" />}
                <span>Composited color</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={itemCls}
                onSelect={() => setEyedropperSampleMode('front')}
              >
                {eyedropperSampleMode === 'front' ? <span className="w-4 inline-block"><LuCheck /></span> : <span className="w-4 inline-block" />}
                <span>Front-most pixel</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <DropdownMenu.Root
          modal={false}
          open={openMenu.eraser ?? false}
          onOpenChange={(open) => { open && setTool('eraser'); setOpenMenu(s => ({ ...s, eraser: open })) }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'eraser' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={tool === 'eraser'}
              aria-haspopup="menu"
              title={`Eraser (size ${eraserSize})`}
            >
              <FaEraser aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={contentCls} sideOffset={6} align="start">
              <div className="px-3 py-2 flex flex-col gap-2">
                <div className="flex gap-2 text-sm">Eraser Size: {eraserSize}</div>
                <input
                  type="range"
                  min={1}
                  max={maxDim}
                  value={eraserSize}
                  onChange={e => setEraserSize(Number(e.target.value))}
                  aria-label="Eraser size"
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_SIZES.map(sz => (
                    <button
                      key={sz}
                      onClick={() => { setEraserSize(sz) }}
                      className={`px-2 py-1 rounded border text-xs ${eraserSize === sz ? 'bg-accent text-elevated border-accent' : 'bg-surface hover:bg-surface-muted border-border'}`}
                    >{sz}</button>
                  ))}
                </div>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button
          className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'bucket' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('bucket')}
          aria-pressed={tool === 'bucket'}
          title="Bucket"
        >
          <LuPaintBucket aria-hidden />
        </button>
        <DropdownMenu.Root
          modal={false}
          open={openMenu.shape ?? false}
          onOpenChange={(open) => { open && setTool(shapeTool); setOpenMenu(s => ({ ...s, shape: open })) }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${shapeToolSelected ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={shapeToolSelected}
              aria-haspopup="menu"
              aria-expanded={openMenu.shape ?? false}
              title={tool === 'line' ? shapeToolObj.name : `${shapeToolObj.name} (${shapeFill ? 'Filled' : 'Outline'})`}
            >
              <ShapeIcon aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={contentCls} sideOffset={6} align="start">
              {SHAPE_TOOLS.map(t => {
                const Icon = t.icon
                return (
                  <DropdownMenu.Item
                    key={t.id}
                    className={itemCls}
                    onSelect={() => setTool(t.id)}
                  >
                    {shapeTool === t.id ? <span className="w-4 inline-block"><LuCheck /></span> : <span className="w-4 inline-block" />}
                    <Icon />
                    <span>{t.name}</span>
                  </DropdownMenu.Item>
                )
              })}
              <DropdownMenu.Separator className={separatorCls} />
              <div className="px-3 py-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span>Fill</span>
                  <button
                    onClick={() => { toggleShapeFill() }}
                    className={`px-2 py-1 rounded border text-xs ${shapeFill ? 'bg-accent text-elevated border-accent' : 'bg-surface hover:bg-surface-muted border-border'}`}
                  >{shapeFill ? 'On' : 'Off'}</button>
                </div>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <DropdownMenu.Root
          modal={false}
          open={openMenu.select ?? false}
          onOpenChange={(open) => { open && setTool(selectTool); setOpenMenu(s => ({ ...s, select: open })) }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${selectToolSelected ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={selectToolSelected}
              aria-haspopup="menu"
              aria-expanded={openMenu.select ?? false}
              title={selToolObj.name}
            >
              <SelIcon />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={contentCls} sideOffset={6} align="start">
              {SELECT_TOOLS.map(t => {
                const Icon = t.icon
                return (
                  <DropdownMenu.Item
                    key={t.id}
                    className={itemCls}
                    onSelect={() => setTool(t.id)}
                  >
                    {selectTool === t.id ? <span className="w-4 inline-block"><LuCheck /></span> : <span className="w-4 inline-block" />}
                    <Icon />
                    <span>{t.name}</span>
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button
          className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'move' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('move')}
          aria-pressed={tool === 'move'}
          title="Move"
        >
          <RiDragMove2Fill aria-hidden />
        </button>
      </div>
    </div>
  )
}

const SHAPE_TOOLS = [
  { id: 'line', name: 'Line', icon: LuSlash },
  { id: 'rect', name: 'Rectangle', icon: LuSquare },
  { id: 'ellipse', name: 'Ellipse', icon: LuCircle },
] as const

const SELECT_TOOLS = [
  { id: 'select-rect', name: 'Rect Select', icon: PiRectangleDashed },
  { id: 'select-lasso', name: 'Lasso', icon: PiLasso },
  { id: 'select-wand', name: 'Magic Wand', icon: PiMagicWand },
] as const

const PRESET_SIZES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]

function BrushMenu({ maxDim }: { maxDim: number }) {
  const brush = useAppStore(s => s.brush)
  const setBrushSize = useAppStore(s => s.setBrushSize)
  const setBrushSubMode = useAppStore(s => s.setBrushSubMode)
  const setBrushPattern = useAppStore(s => s.setBrushPattern)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { size, mask } = brush.pattern
    const cellSize = 10
    canvas.width = size * cellSize + 1
    canvas.height = size * cellSize + 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x
        const on = mask[idx] === 1
        ctx.fillStyle = on ? 'black' : 'white'
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        ctx.strokeStyle = '#ccc'
        ctx.strokeRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize + 0.5, cellSize + 0.5)
      }
    }
  }, [brush])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const { size } = brush.pattern
    const x = Math.floor((e.clientX - rect.left) * size / rect.width)
    const y = Math.floor((e.clientY - rect.top) * size / rect.height)
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const idx = y * size + x
    const newMask = new Uint8Array(brush.pattern.mask)
    newMask[idx] = newMask[idx] === 1 ? 0 : 1
    setBrushPattern(size, newMask)
  }

  return (<div className="px-3 py-2 flex flex-col gap-2">
    <div className="flex gap-2 text-sm">Brush Size: {brush.size}</div>
    <input
      type="range"
      min={1}
      max={maxDim}
      value={brush.size}
      onChange={e => setBrushSize(Number(e.target.value))}
      aria-label="Brush size"
    />
    <div className="flex flex-wrap gap-1">
      {PRESET_SIZES.map(sz => (
        <button
          key={sz}
          onClick={() => { setBrushSize(sz) }}
          className={`px-2 py-1 rounded border text-xs ${brush.size === sz ? 'bg-accent text-elevated border-accent' : 'bg-surface hover:bg-surface-muted border-border'}`}
        >{sz}</button>
      ))}
    </div>
    <div className="mt-2 border-t border-border pt-2">
      <div className="flex items-center justify-between text-sm mb-2">
        <span>Brush Mode</span>
        <div className="inline-flex rounded overflow-hidden border border-border">
          <button
            className={`px-2 py-1 text-xs ${brush.subMode === 'normal' ? 'bg-accent text-elevated border-accent' : 'bg-surface hover:bg-surface-muted'}`}
            onClick={() => setBrushSubMode('normal')}
          >Normal</button>
          <button
            className={`px-2 py-1 text-xs border-l border-border ${brush.subMode === 'pattern' ? 'bg-accent text-elevated border-accent' : 'bg-surface hover:bg-surface-muted'}`}
            onClick={() => setBrushSubMode('pattern')}
          >Pattern</button>
        </div>
      </div>
      {brush.subMode === 'pattern' && (
        <div className="flex gap-2 justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <button className="px-2 py-1 rounded border text-xs bg-surface hover:bg-surface-muted border-border">
                    Preset
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className={contentCls} sideOffset={6} align="start">
                    {PRESET_PATTERNS.map(p => (
                      <DropdownMenu.Item
                        key={p.name}
                        className={itemCls}
                        onSelect={() => {
                          setBrushSubMode('pattern')
                          setBrushPattern(p.n, p.mask)
                        }}
                      >
                        {p.name}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>Size</span>
              <input
                type="number"
                min={1}
                max={16}
                value={brush.pattern.size}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(16, Number(e.target.value) | 0))
                  const mask = new Uint8Array(n * n)
                  for (let y = 0; y < n; y++)
                    for (let x = 0; x < n; x++)
                      mask[y * n + x] = (x < brush.pattern.size && y < brush.pattern.size) ? brush.pattern.mask[y * brush.pattern.size + x] : 0
                  setBrushPattern(n, mask)
                }}
                className="w-16 px-2 py-1 bg-surface rounded border border-border text-right"
                aria-label="Pattern size"
              />
            </div>
            <button className='px-2 py-1 rounded border border-border bg-surface hover:bg-surface-muted text-sm' onClick={() => {
              const mask = new Uint8Array(brush.pattern.mask)
              for (let i = 0; i < mask.length; i++)
                mask[i] = 1 - mask[i]
              setBrushPattern(brush.pattern.size, mask)
            }}>Invert</button>
          </div>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-32 border border-border cursor-pointer"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      )}
    </div>
  </div>)
}

const PRESET_PATTERNS = [
  { name: 'Checker 2x2', n: 2, mask: new Uint8Array([1, 0, 0, 1]) },
  { name: 'Dot 2x2', n: 2, mask: new Uint8Array([1, 0, 0, 0]) },
  { name: 'Dot 3x3', n: 3, mask: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0]) },
  { name: 'Dot 4x4', n: 4, mask: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) },
] as const
