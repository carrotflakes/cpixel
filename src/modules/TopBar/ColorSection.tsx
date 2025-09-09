import { usePixelStore } from '../store'
import { ColorPicker, useColorPopover } from '../ColorPicker'
import { parseCSSColor, rgbaToCSSHex } from '../utils/color'
import { ColorBoxInner, COLOR_BOX_STYLE } from '../ColorBox'

export function ColorSection() {
  const color = usePixelStore(s => s.color)
  const setColor = usePixelStore(s => s.setColor)
  const setColorIndex = usePixelStore(s => s.setColorIndex)
  const setPaletteColor = usePixelStore(s => s.setPaletteColor)
  const currentPaletteIndex = usePixelStore(s => s.currentPaletteIndex)
  const mode = usePixelStore(s => s.mode)
  const recentIndexed = usePixelStore(s => s.recentColorsIndexed)
  const recentTrue = usePixelStore(s => s.recentColorsTruecolor)
  const palette = usePixelStore(s => s.palette)
  const recentColors = mode === 'indexed'
    ? recentIndexed.map(i => rgbaToCSSHex((palette[i] ?? 0x00000000)))
    : recentTrue

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="hidden sm:inline text-sm text-muted">Color</label>
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
            }
          }}
        />
      </div>
      {recentColors?.length > 0 && (
        <div className="flex items-center gap-1" aria-label="Recent colors">
          {recentColors.slice(0, 8).map((c, idx) => (
            <button
              key={mode === 'indexed' ? `${recentIndexed[idx]}` : c}
              className="h-5 w-5 rounded border border-border/60 hover:border-border focus:outline-none"
              style={COLOR_BOX_STYLE}
              title={mode === 'indexed' ? `Palette index ${recentIndexed[idx]}` : c}
              onClick={() => {
                if (mode === 'indexed' && currentPaletteIndex !== undefined) {
                  setColorIndex(recentIndexed[idx])
                } else {
                  setColor(c)
                }
              }}
            >
              <ColorBoxInner color={c} />
            </button>
          ))}
        </div>
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
        className="h-7 w-10 rounded border border-border"
        style={COLOR_BOX_STYLE}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={color}
      >
        <ColorBoxInner color={color} />
      </button>
      <ColorPicker
        color={color}
        open={open}
        anchor={anchor}
        onClose={close}
        onChangeLive={onLive}
        onChangeDone={(c) => { onDone(c); close() }}
        showAlpha={true}
      />
    </>
  )
}
