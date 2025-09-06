import { usePixelStore } from '../store'
import { ColorPicker, useColorPopover } from '../ColorPicker'
import { parseCSSColor } from '../utils/color'

export function ColorSection() {
  const color = usePixelStore(s => s.color)
  const setColor = usePixelStore(s => s.setColor)
  const pushRecentColor = usePixelStore(s => s.pushRecentColor)
  const setPaletteColor = usePixelStore(s => s.setPaletteColor)
  const currentPaletteIndex = usePixelStore(s => s.currentPaletteIndex)
  const mode = usePixelStore(s => s.mode)
  const recentColors = usePixelStore(s => s.recentColors)

  return (
    <div className="flex items-center gap-3">
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
      {recentColors?.length > 0 && (
        <div className="flex items-center gap-1" aria-label="Recent colors">
          {recentColors.slice(0, 8).map((c) => (
            <button
              key={c}
              className="h-5 w-5 rounded border border-border/60 hover:border-border focus:outline-none"
              style={{ background: c }}
              title={c}
              onClick={() => {
                if (mode === 'indexed' && currentPaletteIndex !== undefined) {
                  // In indexed mode, picking a recent color attempts to map to nearest palette index via setColor
                  setColor(c)
                } else {
                  setColor(c)
                  pushRecentColor()
                }
              }}
            />
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
