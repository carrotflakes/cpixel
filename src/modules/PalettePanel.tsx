import { useEffect, useRef, useState } from 'react'
import { rgbaToCSSHex, parseCSSColor } from './utils/color'
import { usePixelStore } from './store'
import { LuPin, LuArrowUp, LuArrowDown, LuTrash2 } from 'react-icons/lu'
import { ColorPicker } from './ColorPicker'
import { Menu, MenuItem, useContextMenu } from './ui/ContextMenu'
import { PalettePresetsDialog } from './PalettePresetsDialog'

export function PalettePanel() {
  const mode = usePixelStore(s => s.mode)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const addPaletteColor = usePixelStore(s => s.addPaletteColor)
  const setTransparentIndex = usePixelStore(s => s.setTransparentIndex)
  const removePaletteIndex = usePixelStore(s => s.removePaletteIndex)
  const movePaletteIndex = usePixelStore(s => s.movePaletteIndex)
  const applyPalettePreset = usePixelStore(s => s.applyPalettePreset)
  const setPaletteColor = usePixelStore(s => s.setPaletteColor)
  const setColorIndex = usePixelStore(s => s.setColorIndex)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const { menu, openAt: openMenuAt, close: closeMenu, menuRef } = useContextMenu<{ index: number }>()
  const [presetsOpen, setPresetsOpen] = useState(false)
  const longPressRef = useRef<{ timer?: number; index?: number } | null>({})
  const suppressClickRef = useRef(false)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  const [edit, setEdit] = useState<{ open: boolean; index: number; x: number; y: number } | null>(null)

  useEffect(() => {
    if (mode !== 'indexed') return
    const close = (e: MouseEvent | PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') { closeMenu(); setEdit(null); }
        return
      }
      const target = e.target as Node | null
      if (menuRef.current && target && menuRef.current.contains(target)) return
      closeMenu()
      suppressClickRef.current = false
    }
    window.addEventListener('pointerdown', close, { capture: true })
    window.addEventListener('keydown', close, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', close, { capture: true } as any)
      window.removeEventListener('keydown', close, { capture: true } as any)
    }
  }, [mode])

  // position clamping handled by Menu

  if (mode !== 'indexed') return null

  const onAddBlackColor = () => {
    const rgba = parseCSSColor('#000000')
    const idx = addPaletteColor(rgba)
    setColorIndex(idx)
  }

  const openContextMenu = (clientX: number, clientY: number, index: number) => {
    suppressClickRef.current = true
    const offset = 6
    openMenuAt(clientX + offset, clientY + offset, { index })
  }

  return (
    <div ref={panelRef} className="px-3 py-2 border-t border-border bg-surface/70 backdrop-blur relative">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-muted">Palette ({palette.length}/256)</span>
        <button
          className="px-2 py-1 text-xs rounded border border-border bg-surface hover:bg-surface-muted"
          onClick={() => setPresetsOpen(true)}
          aria-expanded={presetsOpen}
        >Presets</button>
        <label className="text-sm ml-3 text-muted">Transparent</label>
        <select
          value={transparentIndex}
          onChange={(e) => setTransparentIndex(parseInt(e.target.value, 10))}
          className="px-2 py-1 rounded border border-border bg-surface text-sm"
        >
          {Array.from({ length: palette.length }).map((_, i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>

      <PalettePresetsDialog
        open={presetsOpen}
        onCancel={() => setPresetsOpen(false)}
        onSelect={(p) => { applyPalettePreset(p.colors, p.transparentIndex); setPresetsOpen(false) }}
      />

      <div className="flex flex-wrap gap-3">
        {Array.from(palette).map((rgba, i) => {
          const isTransparent = i === transparentIndex
          const style = isTransparent
            ? { backgroundImage: 'repeating-conic-gradient(#cccccc 0% 25%, transparent 0% 50%)', backgroundSize: '8px 8px', backgroundColor: '#ffffff' }
            : { background: rgbaToCSSHex(rgba) }
          return (
            <button
              key={i}
              title={`#${i}`}
              className={`w-7 h-7 rounded border border-border relative flex items-center justify-center`}
              style={style}
              onClick={(e) => {
                if (suppressClickRef.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  suppressClickRef.current = false
                  return
                }
                setColorIndex(i)
              }}
              onDoubleClick={(e) => {
                e.preventDefault()
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setColorIndex(i)
                setEdit({ open: true, index: i, x: r.left, y: r.bottom + 6 })
              }}
              onContextMenu={(e) => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, i) }}
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') {
                  if (longPressRef.current?.timer) window.clearTimeout(longPressRef.current.timer)
                  const timer = window.setTimeout(() => {
                    openContextMenu(e.clientX, e.clientY, i)
                  }, 500)
                  longPressRef.current = { timer, index: i }
                  touchStartPos.current = { x: e.clientX, y: e.clientY }
                }
              }}
              onPointerMove={(e) => {
                if (e.pointerType === 'touch' && touchStartPos.current) {
                  const dx = e.clientX - touchStartPos.current.x
                  const dy = e.clientY - touchStartPos.current.y
                  if (dx * dx + dy * dy > 16) {
                    if (longPressRef.current?.timer) { window.clearTimeout(longPressRef.current.timer); longPressRef.current = {} }
                    touchStartPos.current = null
                  }
                }
              }}
              onPointerUp={() => {
                if (longPressRef.current?.timer) { window.clearTimeout(longPressRef.current.timer); longPressRef.current = {} }
                touchStartPos.current = null
              }}
              onPointerCancel={() => {
                if (longPressRef.current?.timer) { window.clearTimeout(longPressRef.current.timer); longPressRef.current = {} }
                touchStartPos.current = null
              }}
            >
              {isTransparent && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-base font-bold">t</span>
              )}
            </button>
          )
        })}
        {/* Add new color button at the end */}
        <button
          className="w-7 h-7 rounded border border-accent flex items-center justify-center text-accent bg-surface hover:bg-accent/10"
          title="Add new color"
          onClick={onAddBlackColor}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <Menu open={!!menu && menu.open === true} x={(menu && menu.open ? menu.x : 0) as number} y={(menu && menu.open ? menu.y : 0) as number} menuRef={menuRef}>
        {menu?.open && (
          <>
            <MenuItem onSelect={() => { setTransparentIndex(menu.data!.index); closeMenu() }} disabled={menu.data!.index === transparentIndex}>
              <LuPin aria-hidden />
              <span>Set transparent</span>
            </MenuItem>
            <MenuItem onSelect={() => {
              setColorIndex(menu.data!.index)
              setEdit({ open: true, index: menu.data!.index, x: menu.x, y: menu.y })
              closeMenu()
            }}>
              <span>Edit color</span>
            </MenuItem>
            <MenuItem onSelect={() => { movePaletteIndex(menu.data!.index, Math.max(0, menu.data!.index - 1)); closeMenu() }} disabled={menu.data!.index === 0}>
              <LuArrowUp aria-hidden />
              <span>Move up</span>
            </MenuItem>
            <MenuItem onSelect={() => { movePaletteIndex(menu.data!.index, Math.min(palette.length - 1, menu.data!.index + 1)); closeMenu() }} disabled={menu.data!.index === palette.length - 1}>
              <LuArrowDown aria-hidden />
              <span>Move down</span>
            </MenuItem>
            <MenuItem onSelect={() => { removePaletteIndex(menu.data!.index); closeMenu() }} disabled={palette.length <= 1} danger>
              <LuTrash2 aria-hidden />
              <span>Remove</span>
            </MenuItem>
          </>
        )}
      </Menu>

      {edit?.open && (
        <ColorPicker
          color={rgbaToCSSHex(palette[edit.index] ?? 0)}
          open={true}
          anchor={{ x: edit.x, y: edit.y }}
          showAlpha={true}
          onClose={() => setEdit(null)}
          onChangeLive={(hex) => {
            const rgba = parseCSSColor(hex)
            setPaletteColor(edit.index, rgba)
          }}
          onChangeDone={(hex) => {
            const rgba = parseCSSColor(hex)
            setPaletteColor(edit.index, rgba)
            setEdit(null)
          }}
        />
      )}
    </div>
  )
}
