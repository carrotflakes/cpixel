import { useEffect, useRef, useState } from 'react'
import { usePixelStore } from './store'
import { createPortal } from 'react-dom'
import { FaEraser } from 'react-icons/fa'
import { LuDownload, LuPaintbrush, LuPaintBucket, LuChevronRight, LuCheck, LuSquare, LuSlash } from 'react-icons/lu'
import { FaEllipsisV } from 'react-icons/fa'

export function TopBar() {
  const color = usePixelStore(s => s.color)
  const recent = usePixelStore(s => s.recentColors)
  const setColor = usePixelStore(s => s.setColor)
  const setColorLive = usePixelStore(s => s.setColorLive)
  const mode = usePixelStore(s => s.mode)
  const setMode = usePixelStore(s => s.setMode)
  const clear = usePixelStore(s => s.clear)
  const exportPNG = usePixelStore(s => s.exportPNG)
  const tool = usePixelStore(s => s.tool)
  const setTool = usePixelStore(s => s.setTool)
  const moreBtnRef = useRef<HTMLButtonElement | null>(null)
  const menuRootRef = useRef<HTMLDivElement | null>(null)
  const modeSubRef = useRef<HTMLDivElement | null>(null)
  const exportSubRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{x:number,y:number}>({x:0,y:0})
  const [openSub, setOpenSub] = useState<null | 'mode' | 'export'>(null)
  const [modePos, setModePos] = useState<{x:number,y:number} | null>(null)
  const [exportPos, setExportPos] = useState<{x:number,y:number} | null>(null)
  // Recent colors popover
  const recentBtnRef = useRef<HTMLButtonElement | null>(null)
  const recentRootRef = useRef<HTMLDivElement | null>(null)
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentPos, setRecentPos] = useState<{x:number,y:number}>({x:0,y:0})

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
        <label className="text-sm">Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColorLive(e.target.value)}
          onBlur={(e) => setColor(e.target.value)}
          className="h-7 w-10"
        />
      </div>
      <div className="hidden sm:flex items-center gap-1">
        {(recent ?? []).slice(0, 4).map((c) => (
          <button
            key={c}
            title={c}
            aria-label={`Use ${c}`}
            className="w-6 h-6 rounded border border-black/20"
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
        {Math.max(0, (recent?.length || 0) - 4) > 0 && (
          <button
            ref={recentBtnRef}
            className="w-6 h-6 rounded border border-gray-300 bg-white text-[10px] leading-6 text-gray-700 hover:bg-gray-50"
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
          <button
            className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-gray-300 ${tool === 'line' ? 'bg-gray-200' : 'bg-white'} hover:bg-gray-100`}
            onClick={() => setTool('line')}
            aria-pressed={tool === 'line'}
            title="Line"
          >
            <LuSlash aria-hidden />
            <span className="hidden sm:inline">Line</span>
          </button>
          <button
            className={`px-2 py-1 text-sm inline-flex items-center gap-1 border-l border-gray-300 ${tool === 'rect' ? 'bg-gray-200' : 'bg-white'} hover:bg-gray-100`}
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
        className="px-2 py-1 rounded border border-gray-300 bg-white text-sm inline-flex items-center gap-1"
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
          className="fixed z-[1000] min-w-52 rounded-md border border-gray-300 bg-white shadow-lg text-sm py-1"
          ref={menuRootRef}
          style={{ left: menuPos.x, top: menuPos.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-gray-100 inline-flex items-center justify-between gap-2"
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
            className="w-full text-left px-3 py-2 hover:bg-gray-100 inline-flex items-center justify-between gap-2"
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
          <div className="my-1 h-px bg-gray-200" />
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 inline-flex items-center gap-2"
            onClick={() => { clear(); setMenuOpen(false); setOpenSub(null) }}
          >
            <FaEraser aria-hidden />
            <span>Clear</span>
          </button>

      {openSub === 'mode' && modePos && createPortal(
            <div
              role="menu"
              className="fixed z-[1001] min-w-40 rounded-md border border-gray-300 bg-white shadow-lg text-sm py-1"
        style={{ left: modePos.x, top: modePos.y }}
              ref={modeSubRef}
            >
              <button className="w-full text-left px-3 py-2 hover:bg-gray-100 inline-flex items-center gap-2" onClick={() => { setMode('truecolor'); setMenuOpen(false); setOpenSub(null) }}>
                {mode === 'truecolor' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
                <span>Truecolor</span>
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-100 inline-flex items-center gap-2" onClick={() => { setMode('indexed'); setMenuOpen(false); setOpenSub(null) }}>
                {mode === 'indexed' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
                <span>Indexed</span>
              </button>
            </div>,
            document.body
          )}
      {openSub === 'export' && exportPos && createPortal(
            <div
              role="menu"
              className="fixed z-[1001] min-w-40 rounded-md border border-gray-300 bg-white shadow-lg text-sm py-1"
        style={{ left: exportPos.x, top: exportPos.y }}
              ref={exportSubRef}
            >
              <button className="w-full text-left px-3 py-2 hover:bg-gray-100 inline-flex items-center gap-2" onClick={() => { exportPNG(); setMenuOpen(false); setOpenSub(null) }}>
                <LuDownload aria-hidden />
                <span>PNG</span>
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
          className="fixed z-[1000] min-w-44 max-w-72 rounded-md border border-gray-300 bg-white shadow-lg p-2"
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
                className="w-6 h-6 rounded border border-black/20"
                style={{ background: c }}
                onClick={() => { setColor(c); setRecentOpen(false) }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
