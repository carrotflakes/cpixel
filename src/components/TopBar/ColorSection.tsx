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
  const colorMode = useAppStore(s => s.colorMode)
  const recentIndexed = useAppStore(s => s.recentColorsIndexed)
  const recentTrue = useAppStore(s => s.recentColorsRgba)
  const palette = useAppStore(s => s.palette)
  const recentColors = colorMode === 'indexed'
    ? recentIndexed.map(i => palette.transparentIndex === i ? 0x00000000 : palette.colors[i] ?? 0x00000000)
    : recentTrue

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="hidden sm:inline text-sm text-muted">Color</label>
        <ColorButton
          color={color}
          onChange={(rgba) => {
            if (colorMode === 'indexed' && currentPaletteIndex !== undefined) {
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
              key={colorMode === 'indexed' ? `${recentIndexed[idx]}` : c}
              className="h-5 w-5 rounded border border-border focus:outline-none"
              style={COLOR_BOX_STYLE}
              title={colorMode === 'indexed' ? `${rgbaToCSSHex(c)} (${recentIndexed[idx]})` : rgbaToCSSHex(c)}
              onClick={() => {
                if (colorMode === 'indexed' && currentPaletteIndex !== undefined) {
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
