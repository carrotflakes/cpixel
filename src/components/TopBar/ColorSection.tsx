import { COLOR_BOX_STYLE, ColorBoxInner } from '../ColorBox'
import { ColorPicker, useColorPopover } from '../ColorPicker'
import { useAppStore } from '@/stores/store'
import { rgbaToCSSHex } from '@/utils/color'

export function ColorSection() {
  const color = useAppStore(s => s.currentColor())
  const setColor = useAppStore(s => s.setColor)
  const setColorIndex = useAppStore(s => s.setColorIndex)
  const setPaletteColor = useAppStore(s => s.setPaletteColor)
  const currentPaletteIndex = useAppStore(s => s.currentPaletteIndex)
  const mode = useAppStore(s => s.mode)
  const recentIndexed = useAppStore(s => s.recentColorsIndexed)
  const recentTrue = useAppStore(s => s.recentColorsTruecolor)
  const palette = useAppStore(s => s.palette)
  const recentColors = mode === 'indexed'
    ? recentIndexed.map(i => palette[i] ?? 0x00000000)
    : recentTrue

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="hidden sm:inline text-sm text-muted">Color</label>
        <ColorButton
          color={color}
          onChange={(rgba) => {
            if (mode === 'indexed' && currentPaletteIndex !== undefined) {
              setPaletteColor(currentPaletteIndex, rgba)
            } else {
              setColor(rgba)
            }
          }}
        />
      </div>
      {recentColors?.length > 0 && (
        <div className="flex items-center gap-1" aria-label="Recent colors">
          {recentColors.slice(0, 4).map((c, idx) => (
            <button
              key={mode === 'indexed' ? `${recentIndexed[idx]}` : c}
              className="h-5 w-5 rounded border border-border focus:outline-none"
              style={COLOR_BOX_STYLE}
              title={mode === 'indexed' ? `Palette index ${recentIndexed[idx]}` : rgbaToCSSHex(c)}
              onClick={() => {
                if (mode === 'indexed' && currentPaletteIndex !== undefined) {
                  setColorIndex(recentIndexed[idx])
                } else {
                  setColor(c)
                }
              }}
            >
              <ColorBoxInner color={rgbaToCSSHex(c)} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ColorButton({ color, onChange }: { color: number; onChange: (c: number) => void }) {
  const { open, anchor, btnRef, toggle, close } = useColorPopover()
  const hex = rgbaToCSSHex(color)
  return (
    <>
      <button
        ref={btnRef}
        className="h-6 w-6 rounded border border-border"
        style={COLOR_BOX_STYLE}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={hex}
      >
        <ColorBoxInner color={hex} />
      </button>
      <ColorPicker
        color={color}
        open={open}
        anchor={anchor}
        onClose={close}
        onChangeLive={onChange}
        onChangeDone={(c) => { onChange(c); close() }}
        showAlpha={true}
      />
    </>
  )
}
