import { rgbaToCSSHex } from '@/utils/color'
import { useAppStore } from '@/stores/store'
import { useLogStore } from '@/stores/logStore'
import { ColorBox } from '@/components/ColorBox'
import { useEffect, useRef, useState } from 'react'

const MESSAGE_DISPLAY_DURATION = 3000

export function StatusBar() {
  const mode = useAppStore(s => s.mode)
  const width = useAppStore(s => s.width)
  const height = useAppStore(s => s.height)
  const hover = useAppStore(s => s.hover)
  const colorMode = useAppStore(s => s.colorMode)
  const palette = useAppStore(s => s.palette)
  const logs = useLogStore(s => s.logs)

  const [activeMessage, setActiveMessage] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  // When logs update, show the newest message for 1s.
  useEffect(() => {
    const latest = logs.at(-1)
    if (!latest) return
    setActiveMessage(latest.message)
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      setActiveMessage(null)
      timeoutRef.current = null
    }, MESSAGE_DISPLAY_DURATION)
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [logs])

  if (activeMessage) {
    return (
      <div className="text-xs flex items-center gap-2 px-3 py-1 border-t border-border bg-surface/70 backdrop-blur overflow-x-auto">
        <span className="px-1 bg-accent text-surface rounded whitespace-nowrap">{activeMessage}</span>
      </div>
    )
  }

  return (
    <div className="text-xs flex items-center gap-2 px-3 py-1 border-t border-border bg-surface/70 backdrop-blur overflow-x-auto [&>span]:whitespace-nowrap">
      <span className="text-muted">{width}, {height} {colorMode}{colorMode === 'indexed' ? ` (${palette.colors.length})` : ''}</span>
      {mode && (
        <span className="text-muted">{mode.type.toUpperCase()}</span>
      )}
      {hover ? (
        <>
          <span>Pos: {hover.x}, {hover.y}</span>
          {hover.rgba !== undefined ? (
            <span className="flex items-center gap-2">
              Color: <ColorBox className="inline-block align-middle w-4 h-4 rounded border border-border" color={rgbaToCSSHex(hover.rgba)} /> {rgbaToCSSHex(hover.rgba)}{colorMode === 'indexed' && hover.index !== undefined ? <span className="text-muted"> ({hover.index})</span> : null}
            </span>
          ) : (
            <span>Color: -</span>
          )}
        </>
      ) : (
        <>
          <span>Pos: -, -</span>
          <span>Color: -</span>
        </>
      )}
    </div>
  )
}
