import { useRef, useState } from 'react'
import { LuArrowDown, LuArrowUp, LuChevronDown, LuChevronUp, LuPin, LuTrash2 } from 'react-icons/lu'
import { COLOR_BOX_STYLE, ColorBoxInner } from '@/components/ColorBox'
import { ColorPicker } from '@/components/ColorPicker'
import { PalettePresetsDialog } from '@/components/PalettePresetsDialog'
import { useAppStore } from '@/stores/store'
import { RCMenuContent, RCMenuItem, RCMenuRoot, RCMenuSeparator, RCMenuTrigger } from '@/components/ui/RadixContextMenu'
import { parseCSSColor, rgbaToCSSHex } from '@/utils/color'
import { useUIState } from '@/stores/useUiStore'
import { useTouchLongPress } from '@/hooks/useTouchLongPress'

export function PalettePanel() {
  const colorMode = useAppStore(s => s.colorMode)
  const palette = useAppStore(s => s.palette)
  const addPaletteColor = useAppStore(s => s.addPaletteColor)
  const setTransparentIndex = useAppStore(s => s.setTransparentIndex)
  const removePaletteIndex = useAppStore(s => s.removePaletteIndex)
  const movePaletteIndex = useAppStore(s => s.movePaletteIndex)
  const applyPalettePreset = useAppStore(s => s.applyPalettePreset)
  const setPaletteColor = useAppStore(s => s.setPaletteColor)
  const setColorIndex = useAppStore(s => s.setColorIndex)
  const currentPaletteIndex = useAppStore(s => s.currentPaletteIndex)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [collapsed, setCollapsed] = useUIState('palettePanelCollapsed', false)
  const suppressClickRef = useRef(false)
  const [edit, setEdit] = useState<{ open: boolean; index: number; x: number; y: number } | null>(null)

  // Track last context menu position (for opening Edit color picker near pointer)
  const lastContextPos = useRef<{ x: number; y: number } | null>(null)

  const onAddBlackColor = () => {
    const idx = addPaletteColor(parseCSSColor('#000000') ?? 0)
    setColorIndex(idx)
  }

  // Long-press handling: dispatch synthetic contextmenu event for touch so Radix opens
  const touchLongPress = useTouchLongPress<HTMLButtonElement>({
    onTrigger: ({ target, clientX, clientY }) => {
      suppressClickRef.current = true
      lastContextPos.current = { x: clientX, y: clientY }
      const evt = new MouseEvent('contextmenu', { bubbles: true, clientX, clientY })
      target.dispatchEvent(evt)
    },
  })

  const openColorEditor = (index: number, anchor: { x: number; y: number }) => {
    setEdit({ open: true, index, x: anchor.x, y: anchor.y })
  }

  const fallbackAnchorForIndex = (index: number) => {
    const btn = panelRef.current?.querySelector<HTMLButtonElement>(`[data-palette-index="${index}"]`)
    if (!btn) return null
    const rect = btn.getBoundingClientRect()
    return { x: rect.left, y: rect.bottom + 6 }
  }

  if (colorMode !== 'indexed') return null

  return (
    <div ref={panelRef} className="px-3 py-2 border-t border-border bg-surface/70 backdrop-blur relative">
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 text-xs rounded border border-border bg-surface hover:bg-surface-muted inline-flex items-center gap-1"
          onClick={() => setCollapsed(v => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand palette panel' : 'Collapse palette panel'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <LuChevronUp /> : <LuChevronDown />}
        </button>
        <span className="text-sm text-muted">Palette ({palette.colors.length})</span>
        {!collapsed && (
          <button
            className="px-2 py-1 text-xs rounded border border-border bg-surface hover:bg-surface-muted"
            onClick={() => setPresetsOpen(true)}
            aria-expanded={presetsOpen}
          >Presets</button>
        )}
      </div>

      {!collapsed && (
        <PalettePresetsDialog
          open={presetsOpen}
          onCancel={() => setPresetsOpen(false)}
          onSelect={(p) => { applyPalettePreset({ colors: p.colors, transparentIndex: p.transparentIndex ?? 0 }); setPresetsOpen(false) }}
        />
      )}

      {!collapsed && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from(palette.colors).map((rgba, i) => {
            const isTransparent = i === palette.transparentIndex
            const isSelected = currentPaletteIndex === i
            const color = isTransparent ? "#0000" : rgbaToCSSHex(rgba)
            return (
              <RCMenuRoot key={i}>
                <RCMenuTrigger asChild>
                  <button
                    data-palette-index={i}
                    title={`${color} (${i})`}
                    aria-pressed={isSelected}
                    className={`w-6 h-6 rounded border border-border relative flex items-center justify-center ${isSelected ? 'ring-2 ring-accent' : ''}`}
                    style={COLOR_BOX_STYLE}
                    onClick={(e) => {
                      if (suppressClickRef.current) {
                        e.preventDefault(); e.stopPropagation(); suppressClickRef.current = false; return
                      }
                      setColorIndex(i)
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setColorIndex(i)
                      openColorEditor(i, { x: rect.left, y: rect.bottom + 6 })
                    }}
                    onContextMenu={(e) => {
                      lastContextPos.current = { x: e.clientX, y: e.clientY }
                      suppressClickRef.current = true
                    }}
                    onPointerDown={touchLongPress.onPointerDown}
                    onPointerMove={touchLongPress.onPointerMove}
                    onPointerUp={touchLongPress.cancel}
                    onPointerCancel={touchLongPress.cancel}
                  >
                    <ColorBoxInner color={color} />
                    {isTransparent && (
                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-base font-bold">t</span>
                    )}
                  </button>
                </RCMenuTrigger>
                <RCMenuContent>
                  <RCMenuItem
                    disabled={i === palette.transparentIndex}
                    onSelect={() => setTransparentIndex(i)}
                  >
                    <LuPin aria-hidden />
                    <span>Set transparent</span>
                  </RCMenuItem>
                  <RCMenuItem
                    onSelect={() => {
                      setColorIndex(i)
                      const anchor = lastContextPos.current ?? fallbackAnchorForIndex(i)
                      if (anchor) openColorEditor(i, anchor)
                    }}
                  >
                    <span>Edit color</span>
                  </RCMenuItem>
                  <RCMenuItem
                    disabled={i === 0}
                    onSelect={() => movePaletteIndex(i, Math.max(0, i - 1))}
                  >
                    <LuArrowUp aria-hidden />
                    <span>Move up</span>
                  </RCMenuItem>
                  <RCMenuItem
                    disabled={i === palette.colors.length - 1}
                    onSelect={() => movePaletteIndex(i, Math.min(palette.colors.length - 1, i + 1))}
                  >
                    <LuArrowDown aria-hidden />
                    <span>Move down</span>
                  </RCMenuItem>
                  <RCMenuSeparator />
                  <RCMenuItem
                    disabled={palette.colors.length <= 1}
                    danger
                    onSelect={() => removePaletteIndex(i)}
                  >
                    <LuTrash2 aria-hidden />
                    <span>Remove</span>
                  </RCMenuItem>
                </RCMenuContent>
              </RCMenuRoot>
            )
          })}
          {/* Add new color button at the end */}
          <button
            className="w-6 h-6 rounded border border-accent flex items-center justify-center text-accent bg-surface hover:bg-accent/10"
            title="Add new color"
            onClick={onAddBlackColor}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {!collapsed && edit?.open && (
        <ColorPicker
          color={palette.colors[edit.index] ?? 0}
          open={true}
          anchor={{ x: edit.x, y: edit.y }}
          showAlpha={true}
          onClose={() => setEdit(null)}
          onChangeLive={(rgba) => {
            setPaletteColor(edit.index, rgba)
          }}
          onChangeDone={(rgba) => {
            setPaletteColor(edit.index, rgba)
            setEdit(null)
          }}
        />
      )}
    </div>
  )
}
