import { FaEraser } from 'react-icons/fa'
import { LuPaintbrush, LuPaintBucket, LuSlash, LuSquare, LuPipette, LuCheck, LuCircle } from 'react-icons/lu'
import { RiDragMove2Fill } from 'react-icons/ri'
import { PiLasso, PiRectangleDashed, PiMagicWand } from 'react-icons/pi'
import { useAppStore } from '../stores/store'
import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export function ToolSelector() {
  const tool = useAppStore(s => s.tool)
  const setTool = useAppStore(s => s.setTool)
  const shapeTool = useAppStore(s => s.shapeTool)
  const selectTool = useAppStore(s => s.selectTool)
  const [selOpen, setSelOpen] = useState(false)

  const shapeToolObj = SHAPE_TOOLS.find(s => s.id === shapeTool) ?? SHAPE_TOOLS[0]
  const ShapeIcon = shapeToolObj.icon
  const selToolObj = SELECT_TOOLS.find(s => s.id === selectTool) ?? SELECT_TOOLS[0]
  const SelIcon = selToolObj.icon

  // Brush size menu
  const [brushOpen, setBrushOpen] = useState(false)
  const brushSize = useAppStore(s => s.brushSize)
  const setBrushSize = useAppStore(s => s.setBrushSize)
  const eraserSize = useAppStore(s => s.eraserSize)
  const setEraserSize = useAppStore(s => s.setEraserSize)
  const W = useAppStore(s => s.width)
  const H = useAppStore(s => s.height)
  const maxDim = Math.max(8, W, H) / 2 | 0
  const shapeFill = useAppStore(s => s.shapeFill)
  const toggleShapeFill = useAppStore(s => s.toggleShapeFill)

  // Shape options menu
  const [shapeOpen, setShapeOpen] = useState(false)

  // Radix handles outside click / Escape.

  const itemCls = 'px-3 py-2 rounded-sm text-sm flex items-center gap-2 cursor-pointer select-none outline-none focus:bg-surface-muted data-[disabled]:opacity-50'
  const contentCls = 'z-1000 p-1 border border-border bg-elevated rounded-md shadow-lg'
  const separatorCls = 'my-1 h-px bg-border'

  return (
    <div className="flex items-center gap-2 ml-auto">
      <label className="hidden sm:inline text-sm text-muted">Tool</label>
      <div className="inline-flex rounded border border-border overflow-hidden">
        <DropdownMenu.Root modal={false} open={brushOpen} onOpenChange={(o) => { setBrushOpen(o); if (o) setTool('brush') }}>
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-2 py-1 inline-flex items-center gap-1 ${tool === 'brush' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={tool === 'brush'}
              aria-haspopup="menu"
              aria-expanded={brushOpen}
              title={`Brush (size ${brushSize})`}
            >
              <LuPaintbrush aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={contentCls} sideOffset={6} align="start">
              <div className="px-3 py-2 flex flex-col gap-2">
                <div className="flex gap-2 text-sm">Brush Size: {brushSize}</div>
                <input
                  type="range"
                  min={1}
                  max={maxDim}
                  value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  aria-label="Brush size"
                />
                <div className="flex flex-wrap gap-1">
                  {PRESET_SIZES.map(sz => (
                    <button
                      key={sz}
                      onClick={() => { setBrushSize(sz) }}
                      className={`px-2 py-1 rounded border text-xs ${brushSize === sz ? 'bg-accent text-elevated border-accent' : 'bg-surface hover:bg-surface-muted border-border'}`}
                    >{sz}</button>
                  ))}
                </div>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button
          className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'eyedropper' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('eyedropper')}
          aria-pressed={tool === 'eyedropper'}
          title="Eyedropper"
        >
          <LuPipette aria-hidden />
        </button>
        <DropdownMenu.Root modal={false} open={tool === 'eraser' && brushOpen === false && false}>
          {/* Dummy root to satisfy structure (not using separate state) */}
        </DropdownMenu.Root>
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <button
              onClick={() => setTool('eraser')}
              className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'eraser' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={tool === 'eraser'}
              aria-haspopup="menu"
              title={`Eraser (size ${eraserSize})`}
            >
              <FaEraser aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          {tool === 'eraser' && (
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
          )}
        </DropdownMenu.Root>
        <button
          className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'bucket' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('bucket')}
          aria-pressed={tool === 'bucket'}
          title="Bucket"
        >
          <LuPaintBucket aria-hidden />
        </button>
        <button
          className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'line' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('line')}
          aria-pressed={tool === 'line'}
          title="Line"
        >
          <LuSlash aria-hidden />
        </button>
        <DropdownMenu.Root modal={false} open={shapeOpen} onOpenChange={(o) => { setShapeOpen(o); if (o) setTool(shapeTool) }}>
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${tool === 'rect' || tool === 'ellipse' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={tool === 'rect' || tool === 'ellipse'}
              aria-haspopup="menu"
              aria-expanded={shapeOpen}
              title={`${shapeToolObj.name} (${shapeFill ? 'Filled' : 'Outline'})`}
            >
              <ShapeIcon aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={contentCls} sideOffset={6} align="start">
              {SHAPE_TOOLS.map(t => {
                const Icon = t.icon
                return (
                  <DropdownMenu.Item key={t.id} className={itemCls} onSelect={() => { setTool(t.id); setShapeOpen(false) }}>
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
        <DropdownMenu.Root modal={false} open={selOpen} onOpenChange={(o) => { setSelOpen(o); if (o) setTool(selectTool) }}>
          <DropdownMenu.Trigger asChild>
            <button
              className={`px-2 py-1 inline-flex items-center gap-1 border-l border-border ${(tool === 'select-rect' || tool === 'select-lasso' || tool === 'select-wand') ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
              aria-pressed={tool === 'select-rect' || tool === 'select-lasso' || tool === 'select-wand'}
              aria-haspopup="menu"
              aria-expanded={selOpen}
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
                  <DropdownMenu.Item key={t.id} className={itemCls} onSelect={() => { setTool(t.id); setSelOpen(false) }}>
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
  { id: 'rect', name: 'Rectangle', shortName: 'Rect', icon: LuSquare },
  { id: 'ellipse', name: 'Ellipse', shortName: 'Ellipse', icon: LuCircle },
] as const

const SELECT_TOOLS = [
  { id: 'select-rect', name: 'Rect Select', shortName: 'Select', icon: PiRectangleDashed },
  { id: 'select-lasso', name: 'Lasso', shortName: 'Lasso', icon: PiLasso },
  { id: 'select-wand', name: 'Magic Wand', shortName: 'Wand', icon: PiMagicWand },
] as const

const PRESET_SIZES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
