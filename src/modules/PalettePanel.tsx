import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { rgbaToCSSHex, parseCSSColor } from './utils/color'
import { usePixelStore } from './store'
import { LuPin, LuArrowUp, LuArrowDown, LuTrash2 } from 'react-icons/lu'
import { PALETTE_PRESETS } from './presets/palettes'

export function PalettePanel() {
  const mode = usePixelStore(s => s.mode)
  const palette = usePixelStore(s => s.palette)
  const transparentIndex = usePixelStore(s => s.transparentIndex)
  const addPaletteColor = usePixelStore(s => s.addPaletteColor)
  const setTransparentIndex = usePixelStore(s => s.setTransparentIndex)
  const removePaletteIndex = usePixelStore(s => s.removePaletteIndex)
  const movePaletteIndex = usePixelStore(s => s.movePaletteIndex)
  const applyPalettePreset = usePixelStore(s => s.applyPalettePreset)
  const setColor = usePixelStore(s => s.setColor)
  const color = usePixelStore(s => s.color)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menu, setMenu] = useState<{ open: boolean; x: number; y: number; index: number } | null>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const presetsRef = useRef<HTMLDivElement | null>(null)
  const longPressRef = useRef<{ timer?: number; index?: number } | null>({})
  const suppressClickRef = useRef(false)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (mode !== 'indexed') return
    const close = (e: MouseEvent | PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setMenu(null)
        return
      }
      const target = e.target as Node | null
      if (menuRef.current && target && menuRef.current.contains(target)) return
      if (presetsRef.current && target && presetsRef.current.contains(target)) return
      setMenu(null)
      setPresetsOpen(false)
      suppressClickRef.current = false
    }
    window.addEventListener('pointerdown', close, { capture: true })
    window.addEventListener('keydown', close, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', close, { capture: true } as any)
      window.removeEventListener('keydown', close, { capture: true } as any)
    }
  }, [mode])

  useEffect(() => {
    if (!menu?.open) return
    const el = menuRef.current
    if (!el) return
    const w = el.offsetWidth || 160
    const h = el.offsetHeight || 120
    const margin = 8
    const maxX = window.innerWidth - w - margin
    const maxY = window.innerHeight - h - margin
    const nextX = Math.max(margin, Math.min(menu.x, maxX))
    const nextY = Math.max(margin, Math.min(menu.y, maxY))
    if (nextX !== menu.x || nextY !== menu.y) setMenu(m => (m ? { ...m, x: nextX, y: nextY } : m))
  }, [menu?.open, menu?.x, menu?.y])

  if (mode !== 'indexed') return null

  const onAddFromPicker = () => {
    const rgba = parseCSSColor(color)
    const idx = addPaletteColor(rgba)
    setColor(rgbaToCSSHex(palette[idx] ?? rgba))
  }

  const openMenuAt = (clientX: number, clientY: number, index: number) => {
    suppressClickRef.current = true
    const offset = 6
    setMenu({ open: true, x: clientX + offset, y: clientY + offset, index })
  }

  return (
    <div ref={panelRef} className="px-3 py-2 border-t border-gray-300 bg-white/70 dark:bg-gray-900/40 backdrop-blur relative">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">Palette ({palette.length}/256)</span>
        <button className="px-2 py-1 text-xs rounded bg-gray-800 text-white" onClick={onAddFromPicker}>Add current color</button>
        <button
          className="px-2 py-1 text-xs rounded border border-gray-300 bg-white"
          onClick={() => setPresetsOpen(v => !v)}
          aria-expanded={presetsOpen}
        >Presets</button>
        <label className="text-sm ml-3">Transparent</label>
        <select
          value={transparentIndex}
          onChange={(e) => setTransparentIndex(parseInt(e.target.value, 10))}
          className="px-2 py-1 rounded border border-gray-300 bg-white text-sm"
        >
          {Array.from({ length: palette.length }).map((_, i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>
      {presetsOpen && (
        <div ref={presetsRef} className="mb-3 p-2 rounded border border-gray-300 bg-white shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            {PALETTE_PRESETS.map(p => (
              <button
                key={p.id}
                className="text-left p-2 rounded border border-gray-200 hover:bg-gray-50"
                onClick={() => { applyPalettePreset(p.colors, p.transparentIndex); setPresetsOpen(false) }}
                title={`Apply ${p.name}`}
              >
                <div className="text-xs font-medium mb-2">{p.name}</div>
                <div className="flex flex-wrap gap-1">
                  {Array.from(p.colors.slice(0, 32)).map((c, i) => (
                    <span
                      key={i}
                      className="w-4 h-4 inline-block rounded border border-black/10"
                      style={{ background: rgbaToCSSHex(c) }}
                    />
                  ))}
                  {p.colors.length > 32 && <span className="text-[10px] text-gray-500 ml-1">+{p.colors.length - 32}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {Array.from(palette).map((rgba, i) => (
          <button
            key={i}
            title={`#${i}`}
            className={`w-7 h-7 rounded border ${i === transparentIndex ? 'border-blue-600 border-2' : 'border-black/20'}`}
            style={{ background: rgbaToCSSHex(rgba) }}
            onClick={(e) => {
              if (suppressClickRef.current) {
                e.preventDefault()
                e.stopPropagation()
                suppressClickRef.current = false
                return
              }
              setColor(rgbaToCSSHex(rgba))
            }}
            onContextMenu={(e) => { e.preventDefault(); openMenuAt(e.clientX, e.clientY, i) }}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') {
                if (longPressRef.current?.timer) window.clearTimeout(longPressRef.current.timer)
                const timer = window.setTimeout(() => {
                  openMenuAt(e.clientX, e.clientY, i)
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
          />
        ))}
      </div>

      {menu?.open && createPortal(
        <div
          role="menu"
          className="fixed z-[1000] min-w-32 rounded-md border border-gray-300 bg-white shadow-lg text-sm"
          ref={menuRef}
          style={{ top: menu.y, left: menu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-gray-100 inline-flex items-center gap-2"
            onClick={() => { setTransparentIndex(menu.index); setMenu(null) }}
            disabled={menu.index === transparentIndex}
          >
            <LuPin aria-hidden />
            <span>Set transparent</span>
          </button>
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-gray-100 disabled:opacity-50 inline-flex items-center gap-2"
            onClick={() => { movePaletteIndex(menu.index, Math.max(0, menu.index - 1)); setMenu(null) }}
            disabled={menu.index === 0}
          >
            <LuArrowUp aria-hidden />
            <span>Move up</span>
          </button>
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-gray-100 disabled:opacity-50 inline-flex items-center gap-2"
            onClick={() => { movePaletteIndex(menu.index, Math.min(palette.length - 1, menu.index + 1)); setMenu(null) }}
            disabled={menu.index === palette.length - 1}
          >
            <LuArrowDown aria-hidden />
            <span>Move down</span>
          </button>
          <button
            role="menuitem"
            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-700 disabled:opacity-50 inline-flex items-center gap-2"
            onClick={() => { removePaletteIndex(menu.index); setMenu(null) }}
            disabled={palette.length <= 1}
          >
            <LuTrash2 aria-hidden />
            <span>Remove</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
