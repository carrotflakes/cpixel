import { useEffect, useRef, useState } from 'react'
import { usePixelStore } from './store'
import { createPortal } from 'react-dom'
import { FaEraser } from 'react-icons/fa'
import { LuDownload, LuPaintbrush, LuPaintBucket, LuChevronRight, LuCheck, LuSquare, LuSlash } from 'react-icons/lu'
import { FaEllipsisV } from 'react-icons/fa'
import { CanvasSizeDialog } from './CanvasSizeDialog'
import { GoogleDrive } from './utils/googleDrive'
import { ColorPicker, useColorPopover } from './ColorPicker'
import { Menu, MenuItem, MenuDivider } from './ui/ContextMenu'
import { parseCSSColor } from './utils/color'

export function TopBar() {
  const color = usePixelStore(s => s.color)
  const recent = usePixelStore(s => s.recentColors)
  const setColor = usePixelStore(s => s.setColor)
  const pushRecentColor = usePixelStore(s => s.pushRecentColor)
  const setPaletteColor = usePixelStore(s => s.setPaletteColor)
  const currentPaletteIndex = usePixelStore(s => s.currentPaletteIndex)
  const mode = usePixelStore(s => s.mode)
  const setMode = usePixelStore(s => s.setMode)
  const clear = usePixelStore(s => s.clear)
  const exportPNG = usePixelStore(s => s.exportPNG)
  const exportJSON = usePixelStore(s => s.exportJSON)
  const importJSON = usePixelStore(s => s.importJSON)
  const importPNGFromImageData = usePixelStore(s => s.importPNGFromImageData)
  const resizeCanvas = usePixelStore(s => s.resizeCanvas)
  const curW = usePixelStore(s => s.width)
  const curH = usePixelStore(s => s.height)
  const tool = usePixelStore(s => s.tool)
  const setTool = usePixelStore(s => s.setTool)
  const selectTool = usePixelStore(s => s.selectTool)
  const moreBtnRef = useRef<HTMLButtonElement | null>(null)
  const menuRootRef = useRef<HTMLDivElement | null>(null)
  const modeSubRef = useRef<HTMLDivElement | null>(null)
  const exportSubRef = useRef<HTMLDivElement | null>(null)
  const importSubRef = useRef<HTMLDivElement | null>(null)
  const driveSubRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const [openSub, setOpenSub] = useState<null | 'mode' | 'export' | 'import' | 'drive'>(null)
  const [modePos, setModePos] = useState<{ x: number, y: number } | null>(null)
  const [exportPos, setExportPos] = useState<{ x: number, y: number } | null>(null)
  const [importPos, setImportPos] = useState<{ x: number, y: number } | null>(null)
  const [drivePos, setDrivePos] = useState<{ x: number, y: number } | null>(null)
  // Selection tool dropdown state
  const selBtnRef = useRef<HTMLButtonElement | null>(null)
  const selMenuRef = useRef<HTMLDivElement | null>(null)
  const [selOpen, setSelOpen] = useState(false)
  const [selPos, setSelPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  // Recent colors popover
  const recentBtnRef = useRef<HTMLButtonElement | null>(null)
  const recentRootRef = useRef<HTMLDivElement | null>(null)
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentPos, setRecentPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const [sizeOpen, setSizeOpen] = useState(false)
  // Drive state
  const [driveOpen, setDriveOpen] = useState<null | 'menu' | 'open' | 'save'>(null)
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; modifiedTime?: string }[]>([])
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [driveFilename, setDriveFilename] = useState<string>('cpixel.json')
  const [driveFileId, setDriveFileId] = useState<string | undefined>(undefined)
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || (window as any).VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    // init GIS token client if clientId provided
    GoogleDrive.init(clientId).catch(() => { })
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); setOpenSub(null) } }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      const insideMore = moreBtnRef.current && t && moreBtnRef.current.contains(t)
      const insideRoot = menuRootRef.current && t && menuRootRef.current.contains(t)
      const insideMode = modeSubRef.current && t && modeSubRef.current.contains(t)
      const insideExport = exportSubRef.current && t && exportSubRef.current.contains(t)
      const insideImport = importSubRef.current && t && importSubRef.current.contains(t)
      const insideDrive = driveSubRef.current && t && driveSubRef.current.contains(t)
      if (insideMore || insideRoot || insideMode || insideExport || insideImport || insideDrive) return
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

  // Dismiss selection dropdown on outside click / Escape
  useEffect(() => {
    if (!selOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelOpen(false) }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      const insideBtn = selBtnRef.current && t && selBtnRef.current.contains(t)
      const insideRoot = selMenuRef.current && t && selMenuRef.current.contains(t)
      if (insideBtn || insideRoot) return
      setSelOpen(false)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true } as any)
      window.removeEventListener('pointerdown', onDown, { capture: true } as any)
    }
  }, [selOpen])

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
    setImportPos(null)
    setDrivePos(null)
    setDriveOpen(null)
  }

  return (
    <div className="p-2 flex gap-4 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted">Color</label>
        <ColorButton
          color={color}
          onLive={(hex) => {
            if (mode === 'indexed' && currentPaletteIndex !== undefined) {
              setPaletteColor(currentPaletteIndex, parseCSSColor(hex))
            } else {
              setColor(hex)
            }
          }}
          onDone={(hex) => {
            if (mode === 'indexed' && currentPaletteIndex !== undefined) {
              setPaletteColor(currentPaletteIndex, parseCSSColor(hex))
            } else {
              setColor(hex)
              pushRecentColor()
            }
          }}
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
              <span className="w-4 h-4 inline-block rounded-full border border-current" aria-hidden />
            ) : (
              <span className="w-4 h-4 inline-block border border-current" aria-hidden />
            )}
            <span className="hidden sm:inline">{selectTool === 'select-lasso' ? 'Lasso' : 'Select'}</span>
          </button>
        </div>
      </div>
      {/* Selection dropdown menu */}
      <Menu open={selOpen} x={selPos.x} y={selPos.y} menuRef={selMenuRef} minWidth={160}>
        <MenuItem onSelect={() => { setTool('select-rect'); setSelOpen(false) }}>
          {selectTool === 'select-rect' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
          <span className="w-4 h-4 inline-block border border-current" aria-hidden />
          <span>Rect Select</span>
        </MenuItem>
        <MenuItem onSelect={() => { setTool('select-lasso'); setSelOpen(false) }}>
          {selectTool === 'select-lasso' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
          <span className="w-4 h-4 inline-block rounded-full border border-current" aria-hidden />
          <span>Lasso</span>
        </MenuItem>
      </Menu>
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
      <Menu open={menuOpen} x={menuPos.x} y={menuPos.y} menuRef={menuRootRef} minWidth={208}>
        <MenuItem
          onSelect={() => {
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
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem
          onSelect={() => {
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
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem
          onSelect={() => {
            if (openSub === 'import') { setOpenSub(null); return }
            const MAIN_W = 208, SUB_W = 180, margin = 8
            const rightX = menuPos.x + MAIN_W
            const leftIfOverflow = Math.max(margin, menuPos.x - SUB_W)
            const x = rightX + SUB_W + margin > window.innerWidth ? leftIfOverflow : rightX
            const y = Math.min(window.innerHeight - 100 - margin, menuPos.y + 68)
            setImportPos({ x, y })
            setOpenSub('import')
          }}
        >
          <span>Import</span>
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem
          onSelect={() => {
            if (openSub === 'drive') { setOpenSub(null); return }
            const MAIN_W = 208, SUB_W = 220, margin = 8
            const rightX = menuPos.x + MAIN_W
            const leftIfOverflow = Math.max(margin, menuPos.x - SUB_W)
            const x = rightX + SUB_W + margin > window.innerWidth ? leftIfOverflow : rightX
            const y = Math.min(window.innerHeight - 140 - margin, menuPos.y + 100)
            setDrivePos({ x, y })
            setOpenSub('drive')
          }}
        >
          <span>Google Drive</span>
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem
          onSelect={() => { setSizeOpen(true); setMenuOpen(false); setOpenSub(null) }}
        >
          <span>Canvas size…</span>
        </MenuItem>

        <MenuDivider />
        <MenuItem danger onSelect={() => { clear(); setMenuOpen(false); setOpenSub(null) }}>
          <FaEraser aria-hidden />
          <span>Clear</span>
        </MenuItem>
        <Menu open={!!modePos && openSub === 'mode'} x={modePos?.x ?? 0} y={modePos?.y ?? 0} menuRef={modeSubRef} minWidth={160}>
          <MenuItem onSelect={() => { setMode('truecolor'); setMenuOpen(false); setOpenSub(null) }}>
            {mode === 'truecolor' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
            <span>Truecolor</span>
          </MenuItem>
          <MenuItem onSelect={() => { setMode('indexed'); setMenuOpen(false); setOpenSub(null) }}>
            {mode === 'indexed' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
            <span>Indexed</span>
          </MenuItem>
        </Menu>

        <Menu open={!!exportPos && openSub === 'export'} x={exportPos?.x ?? 0} y={exportPos?.y ?? 0} menuRef={exportSubRef} minWidth={160}>
          <MenuItem onSelect={() => { exportPNG(); setMenuOpen(false); setOpenSub(null) }}>
            <LuDownload aria-hidden />
            <span>PNG</span>
          </MenuItem>
          <MenuItem onSelect={() => { exportJSON(); setMenuOpen(false); setOpenSub(null) }}>
            <LuDownload aria-hidden />
            <span>Project JSON</span>
          </MenuItem>
        </Menu>

        <Menu open={!!importPos && openSub === 'import'} x={importPos?.x ?? 0} y={importPos?.y ?? 0} menuRef={importSubRef} minWidth={180}>
          <MenuItem
            onSelect={() => {
              pickAndImportPNG(importPNGFromImageData)
              setMenuOpen(false)
              setOpenSub(null)
            }}
          >
            <span>PNG…</span>
          </MenuItem>
          <MenuItem
            onSelect={() => {
              // Import Project JSON…
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
                  console.error('Import JSON failed', e)
                }
              }
              input.click()
              setMenuOpen(false)
              setOpenSub(null)
            }}
          >
            <span>Project JSON…</span>
          </MenuItem>
        </Menu>

        <Menu open={!!drivePos && openSub === 'drive'} x={drivePos?.x ?? 0} y={drivePos?.y ?? 0} menuRef={driveSubRef} minWidth={224}>
          <MenuItem
            onSelect={async () => {
              setDriveError(null)
              try {
                await GoogleDrive.signIn('consent')
                setDriveOpen('menu')
              } catch (e: any) {
                setDriveError(e?.message || 'Sign-in failed')
              }
            }}
          >
            {GoogleDrive.isSignedIn() ? 'Signed in' : 'Sign in'}
          </MenuItem>
          <MenuItem
            onSelect={async () => {
              setDriveOpen('open')
              setDriveBusy(true)
              setDriveError(null)
              try {
                const files = await GoogleDrive.listFiles()
                setDriveFiles(files)
              } catch (e: any) {
                setDriveError(e?.message || 'Failed to list files')
              } finally {
                setDriveBusy(false)
              }
            }}
          >
            Open from Drive…
          </MenuItem>
          <MenuItem
            onSelect={async () => {
              setDriveOpen('save')
              setDriveFilename('cpixel.json')
              setDriveFileId(undefined)
            }}
          >
            Save to Drive…
          </MenuItem>
          {driveError && (
            <div className="px-3 py-2 text-xs text-red-600">{driveError}</div>
          )}
        </Menu>
      </Menu>
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

      {driveOpen === 'open' && createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40" role="dialog" aria-label="Open from Google Drive">
          <div className="min-w-80 max-w-[90vw] max-h-[80vh] overflow-auto rounded-md border border-border bg-elevated shadow-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="font-medium">Open from Google Drive</div>
              <button className="text-sm" onClick={() => setDriveOpen(null)}>Close</button>
            </div>
            <div className="p-3">
              {driveBusy ? (
                <div className="text-sm text-muted">Loading…</div>
              ) : (
                <ul className="divide-y divide-border">
                  {driveFiles.map((f) => (
                    <li key={f.id}>
                      <button
                        className="w-full text-left px-2 py-2 hover:bg-surface-muted"
                        onClick={async () => {
                          setDriveBusy(true)
                          setDriveError(null)
                          try {
                            const obj = await GoogleDrive.openFile(f.id)
                            importJSON(obj)
                            setDriveOpen(null)
                            setMenuOpen(false)
                            setOpenSub(null)
                          } catch (e: any) {
                            setDriveError(e?.message || 'Failed to open file')
                          } finally {
                            setDriveBusy(false)
                          }
                        }}
                      >
                        <div className="text-sm">{f.name}</div>
                        {f.modifiedTime && <div className="text-xs text-muted">{new Date(f.modifiedTime).toLocaleString()}</div>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {driveError && <div className="mt-2 text-xs text-red-600">{driveError}</div>}
            </div>
          </div>
        </div>,
        document.body
      )}

      {driveOpen === 'save' && createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40" role="dialog" aria-label="Save to Google Drive">
          <div className="min-w-80 max-w-[90vw] rounded-md border border-border bg-elevated shadow-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="font-medium">Save to Google Drive</div>
              <button className="text-sm" onClick={() => setDriveOpen(null)}>Close</button>
            </div>
            <div className="p-3 space-y-3">
              <div className="text-sm">Filename</div>
              <input
                className="w-full px-2 py-1 border border-border rounded bg-surface"
                value={driveFilename}
                onChange={(e) => setDriveFilename(e.target.value)}
                placeholder="cpixel.json"
              />
              <div className="flex gap-2 justify-end">
                <button className="px-3 py-1 border border-border rounded" onClick={() => setDriveOpen(null)}>Cancel</button>
                <button
                  className="px-3 py-1 border border-border rounded bg-surface-muted"
                  onClick={async () => {
                    setDriveBusy(true)
                    setDriveError(null)
                    try {
                      await saveProjectToGoogleDrive(driveFilename, driveFileId)
                      setDriveOpen(null)
                      setMenuOpen(false)
                      setOpenSub(null)
                    } catch (e: any) {
                      setDriveError(e?.message || 'Failed to save')
                    } finally {
                      setDriveBusy(false)
                    }
                  }}
                >
                  {driveBusy ? 'Saving…' : 'Save'}
                </button>
              </div>
              {driveError && <div className="text-xs text-red-600">{driveError}</div>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function ColorButton({ color, onLive, onDone }: { color: string; onLive: (c: string) => void; onDone: (c: string) => void }) {
  const { open, anchor, btnRef, toggle, close } = useColorPopover()
  return (
    <>
      <button
        ref={btnRef}
        className="h-7 w-10 rounded border border-border bg-surface"
        style={{ background: color }}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={color}
      />
      <ColorPicker
        color={color}
        open={open}
        anchor={anchor}
        onClose={close}
        onChangeLive={onLive}
        onChangeDone={(c) => { onDone(c); close() }}
        showAlpha={false}
      />
    </>
  )
}

function pickAndImportPNG(onComplete: (img: ImageData) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/png,.png,image/*'
  input.onchange = async () => {
    const f = input.files?.[0]
    if (!f) return
    try {
      const url = URL.createObjectURL(f)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const w = Math.max(1, img.naturalWidth | 0)
          const h = Math.max(1, img.naturalHeight | 0)
          const cvs = document.createElement('canvas')
          cvs.width = w
          cvs.height = h
          const ctx = cvs.getContext('2d')!
          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, w, h)
          onComplete(imageData)
        } finally {
          URL.revokeObjectURL(url)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        console.error('Failed to load image')
      }
      img.src = url
    } catch (e) {
      console.error('Import PNG failed', e)
    }
  }
  input.click()
}

async function saveProjectToGoogleDrive(filename: string, fileId?: string) {
  const { mode, layers, activeLayerId, palette, transparentIndex, color, recentColors, width, height } = usePixelStore.getState()
  const payload = {
    app: 'cpixel' as const,
    version: 1 as const,
    width,
    height,
    mode,
    layers: layers.map(l => ({
      id: l.id,
      visible: l.visible,
      locked: l.locked,
      data: l.data ? Array.from(l.data) : undefined,
      indices: l.indices ? Array.from(l.indices) : undefined,
    })),
    activeLayerId,
    palette: Array.from(palette ?? new Uint32Array(0)),
    transparentIndex,
    color,
    recentColors: recentColors ?? [],
  }
  const name = filename && /\.json$/i.test(filename) ? filename : `${filename || 'cpixel'}.json`
  await GoogleDrive.saveJSON(name, payload, fileId)
}
