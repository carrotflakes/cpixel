import { useEffect, useRef, useState } from 'react'
import { FaEllipsisV, FaEraser } from 'react-icons/fa'
import { LuCheck, LuChevronRight, LuDownload, LuMaximize, LuSettings, LuFlipHorizontal, LuFlipVertical } from 'react-icons/lu'
import { CanvasSizeDialog } from '../CanvasSizeDialog'
import { SettingsDialog } from '../SettingsDialog'
import { usePixelStore } from '../store'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { GoogleDrive } from '../utils/googleDrive'

export function MoreMenu() {
  // store selectors
  const mode = usePixelStore(s => s.mode)
  const setMode = usePixelStore(s => s.setMode)
  const curW = usePixelStore(s => s.width)
  const curH = usePixelStore(s => s.height)
  const fileMeta = usePixelStore(s => s.fileMeta)

  const [open, setOpen] = useState(false)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Drive state & fullscreen
  const [driveOpen, setDriveOpen] = useState<null | 'open' | 'save'>(null)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; modifiedTime?: string }[]>([])
  const [driveBusy, setDriveBusy] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || (window as any).VITE_GOOGLE_CLIENT_ID

  useEffect(() => { GoogleDrive.init(clientId).catch(() => { }) }, [clientId])

  useEffect(() => {
    const onChange = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement
      setIsFullscreen(!!fsEl)
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    document.addEventListener('mozfullscreenchange', onChange)
    document.addEventListener('MSFullscreenChange', onChange)
    // initialize
    onChange()
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
      document.removeEventListener('mozfullscreenchange', onChange)
      document.removeEventListener('MSFullscreenChange', onChange)
    }
  }, [])

  // edit actions / state
  const undo = usePixelStore(s => s.undo)
  const redo = usePixelStore(s => s.redo)
  const cutSelection = usePixelStore(s => s.cutSelection)
  const copySelection = usePixelStore(s => s.copySelection)
  const pasteClipboard = usePixelStore(s => s.pasteClipboard)
  const canUndo = usePixelStore(s => s.canUndo)
  const canRedo = usePixelStore(s => s.canRedo)
  const hasSelection = usePixelStore(s => !!s.selection?.bounds)
  const hasClipboard = usePixelStore(s => !!s.clipboard)

  const itemCls = 'px-3 py-2 rounded-sm text-sm flex items-center gap-2 cursor-pointer select-none outline-none focus:bg-surface-muted data-[disabled]:opacity-50 data-[disabled]:cursor-default'
  const contentCls = 'z-1000 p-1 border border-border bg-elevated rounded-md shadow-lg'
  const subContentCls = 'p-1 border border-border bg-elevated rounded-md shadow-lg'
  const separatorCls = 'my-1 h-px bg-border'

  return (
    <>
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            ref={triggerRef}
            className="px-2 py-1 rounded border border-border bg-surface text-sm inline-flex items-center gap-1 hover:bg-surface-muted"
            aria-haspopup="menu"
            aria-expanded={open}
            title="More"
          >
            <FaEllipsisV aria-hidden />
            <span className="hidden sm:inline">More</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className={contentCls} align="end" sideOffset={6}>
            {/* Edit submenu */}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={itemCls}>
                <span>Edit</span>
                <LuChevronRight className="ml-auto" aria-hidden />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className={subContentCls} sideOffset={4} alignOffset={-4}>
                <DropdownMenu.Item disabled={!canUndo} className={itemCls} onSelect={() => { if (!canUndo) return; undo(); setOpen(false) }}>Undo{navigator.maxTouchPoints > 2 ? ' (2 finger tap)' : ''}</DropdownMenu.Item>
                <DropdownMenu.Item disabled={!canRedo} className={itemCls} onSelect={() => { if (!canRedo) return; redo(); setOpen(false) }}>Redo{navigator.maxTouchPoints > 3 ? ' (3 finger tap)' : ''}</DropdownMenu.Item>
                <DropdownMenu.Separator className={separatorCls} />
                <DropdownMenu.Item disabled={!hasSelection} className={itemCls} onSelect={() => { if (!hasSelection) return; copySelection(); setOpen(false) }}>Copy</DropdownMenu.Item>
                <DropdownMenu.Item disabled={!hasSelection} className={itemCls} onSelect={() => { if (!hasSelection) return; usePixelStore.getState().beginStroke(); cutSelection(); usePixelStore.getState().endStroke(); setOpen(false) }}>Cut</DropdownMenu.Item>
                <DropdownMenu.Item disabled={!hasClipboard} className={itemCls} onSelect={() => { if (!hasClipboard) return; pasteClipboard(); setOpen(false) }}>Paste</DropdownMenu.Item>
                <DropdownMenu.Separator className={separatorCls} />
                <DropdownMenu.Item className={itemCls} onSelect={() => { setSizeOpen(true); setOpen(false) }}>Canvas size…</DropdownMenu.Item>
                {/* Mode submenu */}
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className={itemCls}>
                    <span>Mode</span>
                    <LuChevronRight className="ml-auto" aria-hidden />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.SubContent className={subContentCls} sideOffset={4} alignOffset={-4}>
                    <DropdownMenu.Item className={itemCls} onSelect={() => { setMode('truecolor'); setOpen(false) }}>
                      {mode === 'truecolor' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
                      <span>Truecolor</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={itemCls} onSelect={() => { setMode('indexed'); setOpen(false) }}>
                      {mode === 'indexed' ? <LuCheck aria-hidden /> : <span className="w-4 inline-block" />}
                      <span>Indexed</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
                <DropdownMenu.Item className={itemCls} onSelect={() => { usePixelStore.getState().clearLayer(); setOpen(false) }}>
                  <FaEraser aria-hidden />
                  <span>Clear layer</span>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={separatorCls} />
                <DropdownMenu.Item className={itemCls} onSelect={() => { usePixelStore.getState().beginStroke(); usePixelStore.getState().flipHorizontal(); usePixelStore.getState().endStroke(); setOpen(false) }}>
                  <LuFlipHorizontal aria-hidden />
                  <span>Flip horizontal</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} onSelect={() => { usePixelStore.getState().beginStroke(); usePixelStore.getState().flipVertical(); usePixelStore.getState().endStroke(); setOpen(false) }}>
                  <LuFlipVertical aria-hidden />
                  <span>Flip vertical</span>
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            {/* Import submenu */}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={itemCls}>
                <span>Import</span>
                <LuChevronRight className="ml-auto" aria-hidden />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className={subContentCls} sideOffset={4} alignOffset={-4}>
                <DropdownMenu.Item className={itemCls} onSelect={() => { pickAndImportPNG(); setOpen(false) }}>PNG…</DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} onSelect={() => { importProjectJSON(); setOpen(false) }}>Project JSON…</DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} onSelect={() => { pickAndImportAse(); setOpen(false) }}>Aseprite (.ase/.aseprite)…</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            {/* Export submenu */}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={itemCls}>
                <span>Export</span>
                <LuChevronRight className="ml-auto" aria-hidden />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className={subContentCls} sideOffset={4} alignOffset={-4}>
                <DropdownMenu.Item className={itemCls} onSelect={() => { usePixelStore.getState().exportPNG(); setOpen(false) }}>
                  <LuDownload aria-hidden />
                  <span>PNG</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} onSelect={() => { usePixelStore.getState().exportJSON(); setOpen(false) }}>
                  <LuDownload aria-hidden />
                  <span>Project JSON</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} onSelect={() => { usePixelStore.getState().exportAse(); setOpen(false) }}>
                  <LuDownload aria-hidden />
                  <span>Aseprite (.aseprite)</span>
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            {/* Drive submenu */}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={itemCls}>
                <span>Google Drive</span>
                <LuChevronRight className="ml-auto" aria-hidden />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className={subContentCls} sideOffset={4} alignOffset={-4}>
                <DropdownMenu.Item className={itemCls} onSelect={async () => { await handleDriveSignIn(setDriveError, setDriveOpen); setOpen(false) }}>
                  {GoogleDrive.isSignedIn() ? 'Signed in' : 'Sign in'}
                </DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} onSelect={() => { openDriveOpen(setDriveOpen, setDriveBusy, setDriveError, setDriveFiles); setOpen(false) }}>
                  Open from Drive…
                </DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} disabled={fileMeta?.source.type !== 'google-drive'} onSelect={() => {
                  if (fileMeta?.source.type === 'google-drive')
                    saveProjectToGoogleDrive(fileMeta.name, fileMeta.source.fileId)
                  setOpen(false)
                }}>
                  Save
                </DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} onSelect={() => { setDriveOpen('save'); setOpen(false) }}>
                  Save As…
                </DropdownMenu.Item>
                {driveError && <div className="px-3 py-2 text-xs text-red-600 max-w-56">{driveError}</div>}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.Item className={itemCls} onSelect={() => { setSettingsOpen(true); setOpen(false) }}>
              <LuSettings aria-hidden />
              <span>Settings…</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className={separatorCls} />
            <DropdownMenu.Item className={itemCls} onSelect={async () => {
              try {
                if (!isFullscreen) {
                  await document.documentElement.requestFullscreen()
                } else {
                  await document.exitFullscreen()
                }
              } catch (e) {
                console.error('Fullscreen toggle failed', e)
              } finally { setOpen(false) }
            }}>
              <LuMaximize aria-hidden />
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className={separatorCls} />
            {/* Debug submenu */}
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={itemCls}>
                <span>Debug</span>
                <LuChevronRight className="ml-auto" aria-hidden />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className={subContentCls} sideOffset={4} alignOffset={-4}>
                {fileMeta ? (
                  <div className="p-1">
                    <div className="px-3 py-2 text-sm">Name: {fileMeta.name ?? 'Untitled'}</div>
                    <div className="px-3 py-2 text-sm">Source: {fileMeta.source?.type ?? 'local'}</div>
                    {fileMeta.source && (fileMeta as any).source.type === 'google-drive' && (
                      <div className="px-3 py-2 text-xs text-muted">File ID: {(fileMeta as any).source.fileId}</div>
                    )}
                  </div>
                ) : (
                  <div className="px-3 py-2 text-sm text-muted">No file metadata</div>
                )}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <CanvasSizeDialog
        open={sizeOpen}
        initialWidth={curW}
        initialHeight={curH}
        onCancel={() => setSizeOpen(false)}
        onSubmit={(w, h) => { usePixelStore.getState().resizeCanvas(w, h); setSizeOpen(false) }}
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
          onOpen={async (name, id) => {
            setDriveBusy(true)
            setDriveError(null)
            try {
              const obj = await GoogleDrive.openFile(id)
              usePixelStore.getState().importJSON(obj, { name, source: { type: 'google-drive', fileId: id } })
              setDriveOpen(null); setOpen(false)
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
          error={driveError}
          onClose={() => setDriveOpen(null)}
          onSave={async (filename) => {
            setDriveBusy(true); setDriveError(null)
            try {
              const res = await saveProjectToGoogleDrive(filename, undefined)
              if (res) {
                usePixelStore.getState().setFileMeta({ name: res.name, source: { type: 'google-drive', fileId: res.id } })
              }
              setDriveOpen(null); setOpen(false)
            } catch (e: any) { setDriveError(e?.message || 'Failed to save') }
            finally { setDriveBusy(false) }
          }}
        />
      )}
    </>
  )
}

// ---------- Small helper components & fns ----------
function importProjectJSON() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = async () => {
    const f = input.files?.[0]
    if (!f) return
    try {
      const text = await f.text();
      usePixelStore.getState().importJSON(JSON.parse(text), { name: f.name, source: { type: 'local' } })
    } catch (e) {
      console.error('Import JSON failed', e)
    }
  }
  input.click()
}

function pickAndImportPNG() {
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
          usePixelStore.getState().importPNGFromImageData(imageData, { name: f.name, source: { type: 'local' } })
        } finally { URL.revokeObjectURL(url) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); console.error('Failed to load image') }
      img.src = url
    } catch (e) { console.error('Import PNG failed', e) }
  }
  input.click()
}

function pickAndImportAse() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.ase,.aseprite,application/octet-stream'
  input.onchange = async () => {
    const f = input.files?.[0]
    if (!f) return
    try {
      const buf = await f.arrayBuffer()
      await usePixelStore.getState().importAse(buf, { name: f.name, source: { type: 'local' } })
    } catch (e) { console.error('Import Aseprite failed', e) }
  }
  input.click()
}

async function saveProjectToGoogleDrive(filename: string, fileId?: string): Promise<{ id: string; name: string } | void> {
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
  return await GoogleDrive.saveJSON(name, payload, fileId)
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
function DriveOpenDialog(props: { busy: boolean; files: { id: string; name: string; modifiedTime?: string }[]; error: string | null; onClose: () => void; onReload: () => void; onOpen: (name: string, id: string) => void }) {
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
                  <button className="w-full text-left px-2 py-2 hover:bg-surface-muted" onClick={() => props.onOpen(f.name, f.id)}>
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

function DriveSaveDialog(props: { busy: boolean; error: string | null; onClose: () => void; onSave: (filename: string) => void }) {
  const [filename, setFilename] = useState('cpixel.json')
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
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="cpixel.json"
          />
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-1 border border-border rounded" onClick={props.onClose}>Cancel</button>
            <button className="px-3 py-1 border border-border rounded bg-surface-muted" onClick={() => props.onSave(filename)}>
              {props.busy ? 'Saving…' : 'Save'}
            </button>
          </div>
          {props.error && <div className="text-xs text-red-600">{props.error}</div>}
        </div>
      </div>
    </div>
  )
}
