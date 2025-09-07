import { useEffect, useRef, useState } from 'react'
import { FaEllipsisV, FaEraser } from 'react-icons/fa'
import { LuCheck, LuChevronRight, LuDownload, LuMaximize, LuSettings } from 'react-icons/lu'
import { CanvasSizeDialog } from '../CanvasSizeDialog'
import { SettingsDialog } from '../SettingsDialog'
import { usePixelStore } from '../store'
import { Menu, MenuDivider, MenuItem } from '../ui/ContextMenu'
import { GoogleDrive } from '../utils/googleDrive'

export function MoreMenu() {
  // store selectors
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

  // root menu state
  const moreBtnRef = useRef<HTMLButtonElement | null>(null)
  const menuRootRef = useRef<HTMLDivElement | null>(null)
  const modeSubRef = useRef<HTMLDivElement | null>(null)
  const exportSubRef = useRef<HTMLDivElement | null>(null)
  const importSubRef = useRef<HTMLDivElement | null>(null)
  const driveSubRef = useRef<HTMLDivElement | null>(null)
  const editSubRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
  const [openSub, setOpenSub] = useState<null | 'mode' | 'export' | 'import' | 'drive' | 'edit'>(null)
  const [subPos, setSubPos] = useState<{ x: number, y: number } | null>(null)
  const modeItemRef = useRef<HTMLButtonElement | null>(null)
  const importItemRef = useRef<HTMLButtonElement | null>(null)
  const exportItemRef = useRef<HTMLButtonElement | null>(null)
  const driveItemRef = useRef<HTMLButtonElement | null>(null)
  const editItemRef = useRef<HTMLButtonElement | null>(null)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Drive state
  const [driveOpen, setDriveOpen] = useState<null | 'open' | 'save'>(null)
  // fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; modifiedTime?: string }[]>([])
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [driveFilename, setDriveFilename] = useState<string>('cpixel.json')
  const [driveFileId, setDriveFileId] = useState<string | undefined>(undefined)
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || (window as any).VITE_GOOGLE_CLIENT_ID

  useEffect(() => { GoogleDrive.init(clientId).catch(() => { }) }, [clientId])

  useEffect(() => {
    const onChange = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement
      setIsFullscreen(!!fsEl)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange as any)
    document.addEventListener('mozfullscreenchange', onChange as any)
    document.addEventListener('MSFullscreenChange', onChange as any)
    // initialize
    onChange()
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange as any)
      document.removeEventListener('mozfullscreenchange', onChange as any)
      document.removeEventListener('MSFullscreenChange', onChange as any)
    }
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
      const insideEdit = editSubRef.current && t && editSubRef.current.contains(t)
      if (insideMore || insideRoot || insideMode || insideExport || insideImport || insideDrive || insideEdit) return
      setMenuOpen(false); setOpenSub(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true } as any)
      window.removeEventListener('pointerdown', onDown, { capture: true } as any)
    }
  }, [menuOpen])

  const openMore = () => {
    if (!moreBtnRef.current) return
    const r = moreBtnRef.current.getBoundingClientRect()
    const margin = 6
    const x = Math.min(window.innerWidth - 220 - margin, Math.max(margin, r.right - 200))
    const y = Math.min(window.innerHeight - 10 - margin, r.bottom + margin)
    setMenuPos({ x, y })
    setMenuOpen(v => !v)
    setOpenSub(null)
    setSubPos(null)
  }

  const MAIN_MENU_WIDTH = 208
  const SUB_MENU_META: Record<'mode' | 'export' | 'import' | 'drive' | 'edit', { width: number; approxHeight: number; ref: React.RefObject<HTMLButtonElement | null> }> = {
    mode: { width: 160, approxHeight: 100, ref: modeItemRef },
    export: { width: 160, approxHeight: 100, ref: exportItemRef },
    import: { width: 180, approxHeight: 100, ref: importItemRef },
    drive: { width: 224, approxHeight: 140, ref: driveItemRef },
    edit: { width: 200, approxHeight: 160, ref: editItemRef },
  }
  function computeSubmenuPos(kind: keyof typeof SUB_MENU_META) {
    const meta = SUB_MENU_META[kind]
    const margin = 8
    const rightX = menuPos.x + MAIN_MENU_WIDTH
    const fitsRight = rightX + meta.width + margin <= window.innerWidth
    const x = fitsRight ? rightX : Math.max(margin, menuPos.x - meta.width)
    let y = menuPos.y
    const el = meta.ref.current
    const rootMenuEl = menuRootRef.current
    if (el && rootMenuEl) {
      const itemRect = el.getBoundingClientRect()
      y = itemRect.top
      const maxY = window.innerHeight - meta.approxHeight - margin
      if (y > maxY) y = maxY
      if (y < margin) y = margin
    }
    return { x, y }
  }

  // edit actions / state
  const undo = usePixelStore(s => s.undo)
  const redo = usePixelStore(s => s.redo)
  const cutSelection = usePixelStore(s => s.cutSelection)
  const copySelection = usePixelStore(s => s.copySelection)
  const pasteClipboard = usePixelStore(s => s.pasteClipboard)
  const canUndo = usePixelStore(s => s.canUndo)
  const canRedo = usePixelStore(s => s.canRedo)
  const hasSelection = usePixelStore(s => !!s.selectionBounds)
  const hasClipboard = usePixelStore(s => !!s.clipboard)

  return (
    <>
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
          ref={editItemRef}
          onSelect={() => {
            if (openSub === 'edit') { setOpenSub(null); setSubPos(null); return }
            setSubPos(computeSubmenuPos('edit'))
            setOpenSub('edit')
          }}
        >
          <span>Edit</span>
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem
          ref={modeItemRef}
          onSelect={() => {
            if (openSub === 'mode') { setOpenSub(null); setSubPos(null); return }
            setSubPos(computeSubmenuPos('mode'))
            setOpenSub('mode')
          }}
        >
          <span>Mode</span>
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem
          ref={importItemRef}
          onSelect={() => {
            if (openSub === 'import') { setOpenSub(null); setSubPos(null); return }
            setSubPos(computeSubmenuPos('import'))
            setOpenSub('import')
          }}
        >
          <span>Import</span>
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem
          ref={exportItemRef}
          onSelect={() => {
            if (openSub === 'export') { setOpenSub(null); setSubPos(null); return }
            setSubPos(computeSubmenuPos('export'))
            setOpenSub('export')
          }}
        >
          <span>Export</span>
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem
          ref={driveItemRef}
          onSelect={() => {
            if (openSub === 'drive') { setOpenSub(null); setSubPos(null); return }
            setSubPos(computeSubmenuPos('drive'))
            setOpenSub('drive')
          }}
        >
          <span>Google Drive</span>
          <LuChevronRight className="ml-auto" aria-hidden />
        </MenuItem>
        <MenuItem onSelect={() => { setSettingsOpen(true); setMenuOpen(false); setOpenSub(null) }}>
          <LuSettings aria-hidden />
          <span>Settings…</span>
        </MenuItem>
        <MenuDivider />
        <MenuItem onSelect={async () => {
          try {
            if (!isFullscreen) {
              const el = document.documentElement
              if (el.requestFullscreen) await el.requestFullscreen()
              else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen()
              else if ((el as any).msRequestFullscreen) await (el as any).msRequestFullscreen()
            } else {
              if (document.exitFullscreen) await document.exitFullscreen()
              else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen()
              else if ((document as any).msExitFullscreen) await (document as any).msExitFullscreen()
            }
          } catch (e) {
            console.error('Fullscreen toggle failed', e)
          } finally {
            setMenuOpen(false); setOpenSub(null)
          }
        }}>
          <LuMaximize aria-hidden />
          <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        </MenuItem>

        {/* Edit submenu */}
        <Menu open={openSub === 'edit'} x={subPos?.x ?? 0} y={subPos?.y ?? 0} menuRef={editSubRef} minWidth={SUB_MENU_META.edit.width}>
          <MenuItem
            disabled={!canUndo}
            onSelect={() => { if (!canUndo) return; undo(); setMenuOpen(false); setOpenSub(null) }}
          >
            <span>Undo</span>
          </MenuItem>
          <MenuItem
            disabled={!canRedo}
            onSelect={() => { if (!canRedo) return; redo(); setMenuOpen(false); setOpenSub(null) }}
          >
            <span>Redo</span>
          </MenuItem>
          <MenuDivider />
          <MenuItem
            disabled={!hasSelection}
            onSelect={() => { if (!hasSelection) return; copySelection(); setMenuOpen(false); setOpenSub(null) }}
          >
            <span>Copy</span>
          </MenuItem>
          <MenuItem
            disabled={!hasSelection}
            onSelect={() => { if (!hasSelection) return; usePixelStore.getState().beginStroke(); cutSelection(); usePixelStore.getState().endStroke(); setMenuOpen(false); setOpenSub(null) }}
          >
            <span>Cut</span>
          </MenuItem>
          <MenuItem
            disabled={!hasClipboard}
            onSelect={() => { if (!hasClipboard) return; pasteClipboard(); setMenuOpen(false); setOpenSub(null) }}
          >
            <span>Paste</span>
          </MenuItem>
          <MenuDivider />
          <MenuItem onSelect={() => { setSizeOpen(true); setMenuOpen(false); setOpenSub(null) }}>
            <span>Canvas size…</span>
          </MenuItem>
          <MenuItem danger onSelect={() => { clear(); setMenuOpen(false); setOpenSub(null); setSubPos(null) }}>
            <FaEraser aria-hidden />
            <span>Clear</span>
          </MenuItem>
        </Menu>
        {/* Submenus */}
        <Menu open={openSub === 'mode'} x={subPos?.x ?? 0} y={subPos?.y ?? 0} menuRef={modeSubRef} minWidth={SUB_MENU_META.mode.width}>
          <MenuItem onSelect={() => { setMode('truecolor'); setMenuOpen(false); setOpenSub(null) }}>
            {mode === 'truecolor' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
            <span>Truecolor</span>
          </MenuItem>
          <MenuItem onSelect={() => { setMode('indexed'); setMenuOpen(false); setOpenSub(null) }}>
            {mode === 'indexed' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
            <span>Indexed</span>
          </MenuItem>
        </Menu>
        <Menu open={openSub === 'export'} x={subPos?.x ?? 0} y={subPos?.y ?? 0} menuRef={exportSubRef} minWidth={SUB_MENU_META.export.width}>
          <MenuItem onSelect={() => { exportPNG(); setMenuOpen(false); setOpenSub(null) }}>
            <LuDownload aria-hidden />
            <span>PNG</span>
          </MenuItem>
          <MenuItem onSelect={() => { exportJSON(); setMenuOpen(false); setOpenSub(null) }}>
            <LuDownload aria-hidden />
            <span>Project JSON</span>
          </MenuItem>
        </Menu>
        <Menu open={openSub === 'import'} x={subPos?.x ?? 0} y={subPos?.y ?? 0} menuRef={importSubRef} minWidth={SUB_MENU_META.import.width}>
          <MenuItem onSelect={() => { pickAndImportPNG(importPNGFromImageData); setMenuOpen(false); setOpenSub(null) }}>
            <span>PNG…</span>
          </MenuItem>
          <MenuItem onSelect={() => { importProjectJSON(importJSON); setMenuOpen(false); setOpenSub(null) }}>
            <span>Project JSON…</span>
          </MenuItem>
        </Menu>
        <Menu open={openSub === 'drive'} x={subPos?.x ?? 0} y={subPos?.y ?? 0} menuRef={driveSubRef} minWidth={SUB_MENU_META.drive.width}>
          <MenuItem onSelect={async () => { await handleDriveSignIn(setDriveError, setDriveOpen) }}>
            {GoogleDrive.isSignedIn() ? 'Signed in' : 'Sign in'}
          </MenuItem>
          <MenuItem onSelect={() => { openDriveOpen(setDriveOpen, setDriveBusy, setDriveError, setDriveFiles) }}>Open from Drive…</MenuItem>
          <MenuItem onSelect={() => { setDriveOpen('save'); setDriveFilename('cpixel.json'); setDriveFileId(undefined) }}>Save to Drive…</MenuItem>
          {driveError && <div className="px-3 py-2 text-xs text-red-600">{driveError}</div>}
        </Menu>
      </Menu>

      <CanvasSizeDialog
        open={sizeOpen}
        initialWidth={curW}
        initialHeight={curH}
        onCancel={() => setSizeOpen(false)}
        onSubmit={(w, h) => { resizeCanvas(w, h); setSizeOpen(false) }}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Drive open dialog */}
      {driveOpen === 'open' && (
        <DriveOpenDialog
          busy={driveBusy}
          files={driveFiles}
          error={driveError}
          onClose={() => setDriveOpen(null)}
          onReload={async () => { await openDriveOpen(setDriveOpen, setDriveBusy, setDriveError, setDriveFiles) }}
          onOpen={async (id) => {
            setDriveBusy(true)
            setDriveError(null)
            try {
              const obj = await GoogleDrive.openFile(id)
              importJSON(obj)
              setDriveOpen(null); setMenuOpen(false); setOpenSub(null)
            } catch (e: any) {
              setDriveError(e?.message || 'Failed to open file')
            } finally { setDriveBusy(false) }
          }}
        />
      )}

      {/* Drive save dialog */}
      {driveOpen === 'save' && (
        <DriveSaveDialog
          busy={driveBusy}
          filename={driveFilename}
          setFilename={setDriveFilename}
          error={driveError}
          onClose={() => setDriveOpen(null)}
          onSave={async () => {
            setDriveBusy(true); setDriveError(null)
            try {
              await saveProjectToGoogleDrive(driveFilename, driveFileId)
              setDriveOpen(null); setMenuOpen(false); setOpenSub(null)
            } catch (e: any) { setDriveError(e?.message || 'Failed to save') }
            finally { setDriveBusy(false) }
          }}
        />
      )}
    </>
  )
}

// ---------- Small helper components & fns ----------
function importProjectJSON(importJSON: (data: unknown) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = async () => {
    const f = input.files?.[0]
    if (!f) return
    try { const text = await f.text(); importJSON(JSON.parse(text)) } catch (e) { console.error('Import JSON failed', e) }
  }
  input.click()
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
        } finally { URL.revokeObjectURL(url) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); console.error('Failed to load image') }
      img.src = url
    } catch (e) { console.error('Import PNG failed', e) }
  }
  input.click()
}

async function saveProjectToGoogleDrive(filename: string, fileId?: string) {
  const { mode, layers, activeLayerId, palette, transparentIndex, color, recentColorsTruecolor, recentColorsIndexed, width, height } = usePixelStore.getState()
  const payload = {
    app: 'cpixel' as const,
    version: 1 as const,
    width,
    height,
    mode,
    layers: layers.map(l => ({ id: l.id, visible: l.visible, locked: l.locked, data: l.data ? Array.from(l.data) : undefined, indices: l.indices ? Array.from(l.indices) : undefined })),
    activeLayerId,
    palette: Array.from(palette ?? new Uint32Array(0)),
    transparentIndex,
    color,
    recentColorsTruecolor: recentColorsTruecolor ?? [],
    recentColorsIndexed: recentColorsIndexed ?? [],
  }
  const name = filename && /\.json$/i.test(filename) ? filename : `${filename || 'cpixel'}.json`
  await GoogleDrive.saveJSON(name, payload, fileId)
}

async function handleDriveSignIn(setDriveError: (s: string | null) => void, setDriveOpen: (s: any) => void) {
  setDriveError(null)
  try { await GoogleDrive.signIn('consent'); setDriveOpen(null) } catch (e: any) { setDriveError(e?.message || 'Sign-in failed') }
}

async function openDriveOpen(
  setDriveOpen: (v: any) => void,
  setDriveBusy: (v: boolean) => void,
  setDriveError: (v: string | null) => void,
  setDriveFiles: (v: any) => void,
) {
  setDriveOpen('open')
  setDriveBusy(true)
  setDriveError(null)
  try { const files = await GoogleDrive.listFiles(); setDriveFiles(files) } catch (e: any) { setDriveError(e?.message || 'Failed to list files') } finally { setDriveBusy(false) }
}

// Dialog components
function DriveOpenDialog(props: { busy: boolean; files: { id: string; name: string; modifiedTime?: string }[]; error: string | null; onClose: () => void; onReload: () => void; onOpen: (id: string) => void }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40" role="dialog" aria-label="Open from Google Drive">
      <div className="min-w-80 max-w-[90vw] max-h-[80vh] overflow-auto rounded-md border border-border bg-elevated shadow-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-medium">Open from Google Drive</div>
          <div className="flex gap-2 items-center">
            <button className="text-sm" onClick={props.onReload}>Reload</button>
            <button className="text-sm" onClick={props.onClose}>Close</button>
          </div>
        </div>
        <div className="p-3">
          {props.busy ? (
            <div className="text-sm text-muted">Loading…</div>
          ) : (
            <ul className="divide-y divide-border">
              {props.files.map(f => (
                <li key={f.id}>
                  <button className="w-full text-left px-2 py-2 hover:bg-surface-muted" onClick={() => props.onOpen(f.id)}>
                    <div className="text-sm">{f.name}</div>
                    {f.modifiedTime && <div className="text-xs text-muted">{new Date(f.modifiedTime).toLocaleString()}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {props.error && <div className="mt-2 text-xs text-red-600">{props.error}</div>}
        </div>
      </div>
    </div>
  )
}

function DriveSaveDialog(props: { busy: boolean; filename: string; setFilename: (v: string) => void; error: string | null; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40" role="dialog" aria-label="Save to Google Drive">
      <div className="min-w-80 max-w-[90vw] rounded-md border border-border bg-elevated shadow-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-medium">Save to Google Drive</div>
          <button className="text-sm" onClick={props.onClose}>Close</button>
        </div>
        <div className="p-3 space-y-3">
          <div className="text-sm">Filename</div>
          <input
            className="w-full px-2 py-1 border border-border rounded bg-surface"
            value={props.filename}
            onChange={(e) => props.setFilename(e.target.value)}
            placeholder="cpixel.json"
          />
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-1 border border-border rounded" onClick={props.onClose}>Cancel</button>
            <button className="px-3 py-1 border border-border rounded bg-surface-muted" onClick={props.onSave}>
              {props.busy ? 'Saving…' : 'Save'}
            </button>
          </div>
          {props.error && <div className="text-xs text-red-600">{props.error}</div>}
        </div>
      </div>
    </div>
  )
}
