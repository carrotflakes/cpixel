import { FaEraser } from 'react-icons/fa'
import { LuPaintbrush, LuPaintBucket, LuSlash, LuSquare } from 'react-icons/lu'
import { PiLasso, PiRectangleDashed } from 'react-icons/pi'
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
          className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-border ${(tool === 'select-rect' || tool === 'select-lasso') ? 'bg-surface-muted' : 'bg-surface'} hover:bg-surface-muted`}
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
          aria-pressed={tool === 'select-rect' || tool === 'select-lasso'}
          aria-haspopup="menu"
          aria-expanded={selOpen}
          title={selectTool === 'select-lasso' ? 'Lasso' : 'Rect Select'}
        >
          {selectTool === 'select-lasso' ? (
            <PiLasso />
          ) : (
            <PiRectangleDashed />
          )}
          <span className="hidden sm:inline">{selectTool === 'select-lasso' ? 'Lasso' : 'Select'}</span>
        </button>
      </div>
      {/* Selection dropdown menu */}
      <Menu open={selOpen} x={selPos.x} y={selPos.y} menuRef={selMenuRef} minWidth={160}>
        <MenuItem onSelect={() => { setTool('select-rect'); setSelOpen(false) }}>
          {selectTool === 'select-rect' ? <span className="w-4 inline-block">✓</span> : <span className="w-4 inline-block" />}
          <PiRectangleDashed />
          <span>Rect Select</span>
        </MenuItem>
        <MenuItem onSelect={() => { setTool('select-lasso'); setSelOpen(false) }}>
          {selectTool === 'select-lasso' ? <span className="w-4 inline-block">✓</span> : <span className="w-4 inline-block" />}
          <PiLasso />
          <span>Lasso</span>
        </MenuItem>
      </Menu>
    </div>
  )
}
