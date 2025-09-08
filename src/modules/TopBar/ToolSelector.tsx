import { FaEraser } from 'react-icons/fa'
import { LuPaintbrush, LuPaintBucket, LuSlash, LuSquare, LuPipette, LuCheck, LuCircle } from 'react-icons/lu'
import { PiLasso, PiRectangleDashed, PiMagicWand } from 'react-icons/pi'
import { usePixelStore } from '../store'
import { useRef, useState, useEffect } from 'react'
import { Menu, MenuDivider, MenuItem } from '../ui/ContextMenu'

export function ToolSelector() {
  const tool = usePixelStore(s => s.tool)
  const setTool = usePixelStore(s => s.setTool)
  const shapeTool = usePixelStore(s => s.shapeTool)
  const selectTool = usePixelStore(s => s.selectTool)
  const selBtnRef = useRef<HTMLButtonElement | null>(null)
  const selMenuRef = useRef<HTMLDivElement | null>(null)
  const [selOpen, setSelOpen] = useState(false)
  const [selPos, setSelPos] = useState({ x: 0, y: 0 })

  const shapeToolObj = SHAPE_TOOLS.find(s => s.id === shapeTool) ?? SHAPE_TOOLS[0]
  const ShapeIcon = shapeToolObj.icon
  const selToolObj = SELECT_TOOLS.find(s => s.id === selectTool) ?? SELECT_TOOLS[0]
  const SelIcon = selToolObj.icon

  // Brush size menu
  const brushBtnRef = useRef<HTMLButtonElement | null>(null)
  const brushMenuRef = useRef<HTMLDivElement | null>(null)
  const [brushOpen, setBrushOpen] = useState(false)
  const [brushPos, setBrushPos] = useState({ x: 0, y: 0 })
  const brushSize = usePixelStore(s => s.brushSize)
  const setBrushSize = usePixelStore(s => s.setBrushSize)
  const W = usePixelStore(s => s.width)
  const H = usePixelStore(s => s.height)
  const maxDim = Math.max(W, H)
  const shapeFill = usePixelStore(s => s.shapeFill)
  const toggleShapeFill = usePixelStore(s => s.toggleShapeFill)

  // Shape options menu
  const shapeBtnRef = useRef<HTMLButtonElement | null>(null)
  const shapeMenuRef = useRef<HTMLDivElement | null>(null)
  const [shapeOpen, setShapeOpen] = useState(false)
  const [shapePos, setShapePos] = useState({ x: 0, y: 0 })

  // Outside click & Escape close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelOpen(false); setBrushOpen(false); setShapeOpen(false) } }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      for (const [btn, menu, setOpen] of [
        [selBtnRef.current, selMenuRef.current, setSelOpen] as const,
        [brushBtnRef.current, brushMenuRef.current, setBrushOpen] as const,
        [shapeBtnRef.current, shapeMenuRef.current, setShapeOpen] as const
      ]) {
        const insideBtn = btn && btn.contains(t)
        const insideMenu = menu && menu.contains(t)
        if (insideBtn || insideMenu) continue
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true })
      window.removeEventListener('pointerdown', onDown, { capture: true })
    }
  }, [])

  return (
    <div className="flex items-center gap-2 ml-auto">
      <label className="hidden sm:inline text-sm text-muted">Tool</label>
      <div className="inline-flex rounded border border-border overflow-hidden">
        <button
          ref={brushBtnRef}
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 ${tool === 'brush' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => {
            setTool('brush')
            if (!brushBtnRef.current) return
            const r = brushBtnRef.current.getBoundingClientRect()
            const margin = 6
            const minW = 180
            const x = Math.min(window.innerWidth - minW - margin, Math.max(margin, r.left))
            const y = Math.min(window.innerHeight - 10 - margin, r.bottom + margin)
            setBrushPos({ x, y })
            setBrushOpen(o => !o)
          }}
          aria-pressed={tool === 'brush'}
          aria-haspopup="menu"
          aria-expanded={brushOpen}
          title={`Brush (size ${brushSize})`}
        >
          <LuPaintbrush aria-hidden />
          <span className="hidden sm:inline">Brush</span>
        </button>
        <button
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${tool === 'eyedropper' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('eyedropper')}
          aria-pressed={tool === 'eyedropper'}
          title="Eyedropper"
        >
          <LuPipette aria-hidden />
          <span className="hidden sm:inline">Eye</span>
        </button>
        <button
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${tool === 'eraser' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('eraser')}
          aria-pressed={tool === 'eraser'}
          title="Eraser"
        >
          <FaEraser aria-hidden />
          <span className="hidden sm:inline">Eraser</span>
        </button>
        <button
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${tool === 'bucket' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('bucket')}
          aria-pressed={tool === 'bucket'}
          title="Bucket"
        >
          <LuPaintBucket aria-hidden />
          <span className="hidden sm:inline">Bucket</span>
        </button>
        <button
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${tool === 'line' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('line')}
          aria-pressed={tool === 'line'}
          title="Line"
        >
          <LuSlash aria-hidden />
          <span className="hidden sm:inline">Line</span>
        </button>
        <button
          ref={shapeBtnRef}
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${tool === 'rect' || tool === 'ellipse' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => {
            setTool(shapeTool)
            if (!shapeBtnRef.current) return
            const r = shapeBtnRef.current.getBoundingClientRect()
            const margin = 6
            const minW = 160
            const x = Math.min(window.innerWidth - minW - margin, Math.max(margin, r.left))
            const y = Math.min(window.innerHeight - 10 - margin, r.bottom + margin)
            setShapePos({ x, y })
            setShapeOpen(o => !o)
          }}
          aria-pressed={tool === 'rect'}
          aria-haspopup="menu"
          aria-expanded={shapeOpen}
          title={`${shapeToolObj.name} (${shapeFill ? 'Filled' : 'Outline'})`}
        >
          <ShapeIcon aria-hidden />
          <span className="hidden sm:inline">{shapeToolObj.shortName}</span>
        </button>
        <button
          ref={selBtnRef}
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${(tool === 'select-rect' || tool === 'select-lasso' || tool === 'select-wand') ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => {
            setTool(selectTool)
            if (!selBtnRef.current) return
            const r = selBtnRef.current.getBoundingClientRect()
            const margin = 6
            const minW = 160
            const x = Math.min(window.innerWidth - minW - margin, Math.max(margin, r.left))
            const y = Math.min(window.innerHeight - 10 - margin, r.bottom + margin)
            setSelPos({ x, y })
            setSelOpen(v => !v)
          }}
          aria-pressed={tool === 'select-rect' || tool === 'select-lasso' || tool === 'select-wand'}
          aria-haspopup="menu"
          aria-expanded={selOpen}
          title={selToolObj.name}
        >
          <SelIcon />
          <span className="hidden sm:inline">{selToolObj.shortName}</span>
        </button>
      </div>
      {/* Brush size menu */}
      <Menu open={brushOpen} x={brushPos.x} y={brushPos.y} menuRef={brushMenuRef} minWidth={200}>
        <div className="px-3 py-2 flex flex-col gap-2">
          <div className="flex gap-2 text-sm">
            Brush Size: {brushSize}
          </div>
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
                onClick={() => { setBrushSize(sz); setBrushOpen(false) }}
                className={`px-2 py-1 rounded border text-xs ${brushSize === sz ? 'bg-accent text-elevated border-accent' : 'bg-surface hover:bg-surface-muted border-border'}`}
              >{sz}</button>
            ))}
          </div>
        </div>
      </Menu>
      {/* Shape options menu */}
      <Menu open={shapeOpen} x={shapePos.x} y={shapePos.y} menuRef={shapeMenuRef} minWidth={160}>
        {SHAPE_TOOLS.map(t => {
          const Icon = t.icon
          return (
            <MenuItem key={t.id} onSelect={() => { setTool(t.id); setShapeOpen(false) }}>
              {shapeTool === t.id ? <span className="w-4 inline-block"><LuCheck /></span> : <span className="w-4 inline-block" />}
              <Icon />
              <span>{t.name}</span>
            </MenuItem>
          )
        })}
        <MenuDivider />
        <div className="px-3 py-2 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>Fill</span>
            <button
              onClick={() => { toggleShapeFill() }}
              className={`px-2 py-1 rounded border text-xs ${shapeFill ? 'bg-accent text-elevated border-accent' : 'bg-surface hover:bg-surface-muted border-border'}`}
            >{shapeFill ? 'On' : 'Off'}</button>
          </div>
        </div>
      </Menu>
      {/* Selection dropdown menu */}
      <Menu open={selOpen} x={selPos.x} y={selPos.y} menuRef={selMenuRef} minWidth={160}>
        {SELECT_TOOLS.map(t => {
          const Icon = t.icon
          return (
            <MenuItem key={t.id} onSelect={() => { setTool(t.id); setSelOpen(false) }}>
              {selectTool === t.id ? <span className="w-4 inline-block"><LuCheck /></span> : <span className="w-4 inline-block" />}
              <Icon />
              <span>{t.name}</span>
            </MenuItem>
          )
        })}
      </Menu>
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
