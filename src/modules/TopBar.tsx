import { useEffect, useRef, useState } from 'react'
import { usePixelStore } from './store'
import { createPortal } from 'react-dom'
import { FaEraser } from 'react-icons/fa'
import { LuDownload, LuPaintbrush, LuPaintBucket, LuChevronRight, LuCheck, LuSquare, LuSlash } from 'react-icons/lu'
import { FaEllipsisV } from 'react-icons/fa'
import { CanvasSizeDialog } from './CanvasSizeDialog'

export function TopBar() {
  const color = usePixelStore(s => s.color)
  const recent = usePixelStore(s => s.recentColors)
  const setColor = usePixelStore(s => s.setColor)
  const setColorLive = usePixelStore(s => s.setColorLive)
  const mode = usePixelStore(s => s.mode)
  const setMode = usePixelStore(s => s.setMode)
  const clear = usePixelStore(s => s.clear)
  const exportPNG = usePixelStore(s => s.exportPNG)
  const exportJSON = usePixelStore(s => s.exportJSON)
  const importJSON = usePixelStore(s => s.importJSON)
  const resizeCanvas = usePixelStore(s => s.resizeCanvas)
  const curW = usePixelStore(s => s.width)
  const curH = usePixelStore(s => s.height)
  const tool = usePixelStore(s => s.tool)
  const setTool = usePixelStore(s => s.setTool)
  const moreBtnRef = useRef<HTMLButtonElement | null>(null)
  const menuRootRef = useRef<HTMLDivElement | null>(null)
  const modeSubRef = useRef<HTMLDivElement | null>(null)
  const exportSubRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const [openSub, setOpenSub] = useState<null | 'mode' | 'export'>(null)
  const [modePos, setModePos] = useState<{ x: number, y: number } | null>(null)
  const [exportPos, setExportPos] = useState<{ x: number, y: number } | null>(null)
  // Recent colors popover
  const recentBtnRef = useRef<HTMLButtonElement | null>(null)
  const recentRootRef = useRef<HTMLDivElement | null>(null)
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentPos, setRecentPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const [sizeOpen, setSizeOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); setOpenSub(null) } }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      const insideMore = moreBtnRef.current && t && moreBtnRef.current.contains(t)
      const insideRoot = menuRootRef.current && t && menuRootRef.current.contains(t)
      const insideMode = modeSubRef.current && t && modeSubRef.current.contains(t)
      const insideExport = exportSubRef.current && t && exportSubRef.current.contains(t)
      if (insideMore || insideRoot || insideMode || insideExport) return
      setMenuOpen(false); setOpenSub(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true } as any)
      window.removeEventListener('pointerdown', onDown, { capture: true } as any)
    }
  }, [menuOpen])

  // Dismiss recent popover on outside click / Escape
  useEffect(() => {
    if (!recentOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setRecentOpen(false) }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      const insideBtn = recentBtnRef.current && t && recentBtnRef.current.contains(t)
      const insideRoot = recentRootRef.current && t && recentRootRef.current.contains(t)
      if (insideBtn || insideRoot) return
      setRecentOpen(false)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true } as any)
      window.removeEventListener('pointerdown', onDown, { capture: true } as any)
    }
  }, [recentOpen])

  const openMore = () => {
    if (!moreBtnRef.current) return
    const r = moreBtnRef.current.getBoundingClientRect()
    const margin = 6
    const x = Math.min(window.innerWidth - 220 - margin, Math.max(margin, r.right - 200))
    const y = Math.min(window.innerHeight - 10 - margin, r.bottom + margin)
    setMenuPos({ x, y })
    setMenuOpen(v => !v)
    setOpenSub(null)
    setModePos(null)
    setExportPos(null)
  }

  return (
    <div className="p-2 flex gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted">Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColorLive(e.target.value)}
          onBlur={(e) => setColor(e.target.value)}
          className="h-7 w-10 rounded border border-border bg-surface"
        />
      </div>
      <div className="hidden sm:flex items-center gap-1">
        {(recent ?? []).slice(0, 4).map((c) => (
          <button
            key={c}
            title={c}
            aria-label={`Use ${c}`}
            className="w-6 h-6 rounded border border-border"
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
        {Math.max(0, (recent?.length || 0) - 4) > 0 && (
          <button
            ref={recentBtnRef}
            className="w-6 h-6 rounded border border-border bg-surface text-[10px] leading-6 text-muted hover:bg-surface-muted"
            title="Show all recent colors"
            aria-haspopup="dialog"
            aria-expanded={recentOpen}
            onClick={() => {
              if (!recentBtnRef.current) return
              const r = recentBtnRef.current.getBoundingClientRect()
              const margin = 6
              const x = Math.min(window.innerWidth - 220 - margin, Math.max(margin, r.left))
              const y = Math.min(window.innerHeight - 10 - margin, r.bottom + margin)
              setRecentPos({ x, y })
              setRecentOpen(v => !v)
            }}
          >
            +{Math.max(0, (recent?.length || 0) - 4)}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <label className="text-sm text-muted">Tool</label>
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
        </div>
      </div>
      <button
        ref={moreBtnRef}
        className="px-2 py-1 rounded border border-border bg-surface text-sm inline-flex items-center gap-1 hover:bg-surface-muted"
        onClick={openMore}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="More"
      >
        <FaEllipsisV aria-hidden />
        <span className="hidden sm:inline">More</span>
      </button>
      {menuOpen && createPortal(
        <div
          role="menu"
          className="fixed z-[1000] min-w-52 rounded-md border border-border bg-elevated shadow-lg text-sm py-1"
          ref={menuRootRef}
          style={{ left: menuPos.x, top: menuPos.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-surface-muted inline-flex items-center justify-between gap-2"
            onClick={() => {
              if (openSub === 'mode') { setOpenSub(null); return }
              const MAIN_W = 208, SUB_W = 180, margin = 8
              const rightX = menuPos.x + MAIN_W
              const leftIfOverflow = Math.max(margin, menuPos.x - SUB_W)
              const x = rightX + SUB_W + margin > window.innerWidth ? leftIfOverflow : rightX
              const y = Math.min(window.innerHeight - 100 - margin, menuPos.y + 4)
              setModePos({ x, y })
              setOpenSub('mode')
            }}
          >
            <span>Mode</span>
            <LuChevronRight aria-hidden />
          </button>
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-surface-muted inline-flex items-center justify-between gap-2"
            onClick={() => {
              if (openSub === 'export') { setOpenSub(null); return }
              const MAIN_W = 208, SUB_W = 180, margin = 8
              const rightX = menuPos.x + MAIN_W
              const leftIfOverflow = Math.max(margin, menuPos.x - SUB_W)
              const x = rightX + SUB_W + margin > window.innerWidth ? leftIfOverflow : rightX
              const y = Math.min(window.innerHeight - 100 - margin, menuPos.y + 36)
              setExportPos({ x, y })
              setOpenSub('export')
            }}
          >
            <span>Export</span>
            <LuChevronRight aria-hidden />
          </button>
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-surface-muted inline-flex items-center gap-2"
            onClick={() => { setSizeOpen(true); setMenuOpen(false); setOpenSub(null) }}
          >
            <span>Canvas size…</span>
          </button>
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-surface-muted inline-flex items-center gap-2"
            onClick={() => {
              // open a hidden file input for JSON import
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'application/json,.json'
              input.onchange = async () => {
                const f = input.files?.[0]
                if (!f) return
                try {
                  const text = await f.text()
                  const obj = JSON.parse(text)
                  importJSON(obj)
                } catch (e) {
                  console.error('Import failed', e)
                }
              }
              input.click()
              setMenuOpen(false)
              setOpenSub(null)
            }}
          >
            <span>Import JSON…</span>
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-red-50/70 text-red-700 inline-flex items-center gap-2"
            onClick={() => { clear(); setMenuOpen(false); setOpenSub(null) }}
          >
            <FaEraser aria-hidden />
            <span>Clear</span>
          </button>

          {openSub === 'mode' && modePos && createPortal(
            <div
              role="menu"
              className="fixed z-[1001] min-w-40 rounded-md border border-border bg-elevated shadow-lg text-sm py-1"
              style={{ left: modePos.x, top: modePos.y }}
              ref={modeSubRef}
            >
              <button className="w-full text-left px-3 py-2 hover:bg-surface-muted inline-flex items-center gap-2" onClick={() => { setMode('truecolor'); setMenuOpen(false); setOpenSub(null) }}>
                {mode === 'truecolor' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
                <span>Truecolor</span>
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-surface-muted inline-flex items-center gap-2" onClick={() => { setMode('indexed'); setMenuOpen(false); setOpenSub(null) }}>
                {mode === 'indexed' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
                <span>Indexed</span>
              </button>
            </div>,
            document.body
          )}
          {openSub === 'export' && exportPos && createPortal(
            <div
              role="menu"
              className="fixed z-[1001] min-w-40 rounded-md border border-border bg-elevated shadow-lg text-sm py-1"
              style={{ left: exportPos.x, top: exportPos.y }}
              ref={exportSubRef}
            >
              <button className="w-full text-left px-3 py-2 hover:bg-surface-muted inline-flex items-center gap-2" onClick={() => { exportPNG(); setMenuOpen(false); setOpenSub(null) }}>
                <LuDownload aria-hidden />
                <span>PNG</span>
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-surface-muted inline-flex items-center gap-2" onClick={() => { exportJSON(); setMenuOpen(false); setOpenSub(null) }}>
                <LuDownload aria-hidden />
                <span>Project JSON</span>
              </button>
            </div>,
            document.body
          )}
        </div>,
        document.body
      )}
      {recentOpen && createPortal(
        <div
          ref={recentRootRef}
          className="fixed z-[1000] min-w-44 max-w-72 rounded-md border border-border bg-elevated shadow-lg p-2"
          style={{ left: recentPos.x, top: recentPos.y }}
          role="dialog"
          aria-label="Recent colors"
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="grid grid-cols-8 gap-1">
            {(recent ?? []).map((c) => (
              <button
                key={c}
                title={c}
                aria-label={`Use ${c}`}
                className="w-6 h-6 rounded border border-border"
                style={{ background: c }}
                onClick={() => { setColor(c); setRecentOpen(false) }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
      <CanvasSizeDialog
        open={sizeOpen}
        initialWidth={curW}
        initialHeight={curH}
        onCancel={() => setSizeOpen(false)}
        onSubmit={(w, h) => { resizeCanvas(w, h); setSizeOpen(false) }}
      />
    </div>
  )
}
