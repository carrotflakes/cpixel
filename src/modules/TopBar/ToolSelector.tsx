import { FaEraser } from 'react-icons/fa'
import { LuPaintbrush, LuPaintBucket, LuSlash, LuSquare, LuPipette } from 'react-icons/lu'
import { PiLasso, PiRectangleDashed, PiMagicWand } from 'react-icons/pi'
import { usePixelStore } from '../store'
import { useRef, useState, useEffect } from 'react'
import { Menu, MenuItem } from '../ui/ContextMenu'

export function ToolSelector() {
  const tool = usePixelStore(s => s.tool)
  const setTool = usePixelStore(s => s.setTool)
  const selectTool = usePixelStore(s => s.selectTool)
  const selBtnRef = useRef<HTMLButtonElement | null>(null)
  const selMenuRef = useRef<HTMLDivElement | null>(null)
  const [selOpen, setSelOpen] = useState(false)
  const [selPos, setSelPos] = useState({ x: 0, y: 0 })

  const selToolObj = SELECT_TOOLS.find(s => s.id === selectTool) ?? SELECT_TOOLS[0]
  const SelIcon = selToolObj.icon

  // Outside click & Escape close (moved from TopBar)
  useEffect(() => {
    if (!selOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelOpen(false) }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      const insideBtn = selBtnRef.current && t && selBtnRef.current.contains(t)
      const insideMenu = selMenuRef.current && t && selMenuRef.current.contains(t)
      if (insideBtn || insideMenu) return
      setSelOpen(false)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true } as any)
      window.removeEventListener('pointerdown', onDown, { capture: true } as any)
    }
  }, [selOpen])

  return (
    <div className="flex items-center gap-2 ml-auto">
      <label className="hidden sm:inline text-sm text-muted">Tool</label>
      <div className="inline-flex rounded border border-border overflow-hidden">
        <button
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 ${tool === 'brush' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('brush')}
          aria-pressed={tool === 'brush'}
          title="Brush"
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
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${tool === 'rect' ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => setTool('rect')}
          aria-pressed={tool === 'rect'}
          title="Rect"
        >
          <LuSquare aria-hidden />
          <span className="hidden sm:inline">Rect</span>
        </button>
        <button
          ref={selBtnRef}
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${(tool === 'select-rect' || tool === 'select-lasso' || tool === 'select-wand') ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
          onClick={() => {
            if (!selBtnRef.current) return
            const r = selBtnRef.current.getBoundingClientRect()
            const margin = 6
            const minW = 160
            const x = Math.min(window.innerWidth - minW - margin, Math.max(margin, r.left))
            const y = Math.min(window.innerHeight - 10 - margin, r.bottom + margin)
            setSelPos({ x, y })
            setSelOpen(v => !v)
            setTool(selectTool)
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
      {/* Selection dropdown menu */}
      <Menu open={selOpen} x={selPos.x} y={selPos.y} menuRef={selMenuRef} minWidth={160}>
        {SELECT_TOOLS.map(t => {
          const Icon = t.icon
          return (
            <MenuItem key={t.id} onSelect={() => { setTool(t.id); setSelOpen(false) }}>
              {selectTool === t.id ? <span className="w-4 inline-block">✓</span> : <span className="w-4 inline-block" />}
              <Icon />
              <span>{t.name}</span>
            </MenuItem>
          )
        })}
      </Menu>
    </div>
  )
}

const SELECT_TOOLS = [
  { id: 'select-rect', name: 'Rect Select', shortName: 'Select', icon: PiRectangleDashed },
  { id: 'select-lasso', name: 'Lasso', shortName: 'Lasso', icon: PiLasso },
  { id: 'select-wand', name: 'Magic Wand', shortName: 'Wand', icon: PiMagicWand },
] as const
