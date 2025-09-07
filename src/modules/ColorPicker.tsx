import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { parseCSSColor, rgbaToCSSHex, unpackRGBA, packRGBA } from './utils/color'

type Props = {
  color: string
  open: boolean
  anchor: { x: number; y: number }
  onClose: () => void
  onChangeLive: (hex: string) => void
  onChangeDone: (hex: string) => void
  showAlpha?: boolean
}

type HSV = { h: number; s: number; v: number; a: number }

function rgbToHsv(r: number, g: number, b: number, a = 1): HSV {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, v = max
  const d = max - min
  s = max === 0 ? 0 : d / max
  if (max === min) h = 0
  else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h, s, v, a }
}

function hsvToRgb(h: number, s: number, v: number) {
  let r = 0, g = 0, b = 0
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

export function ColorPicker({ color, open, anchor, onClose, onChangeLive, onChangeDone, showAlpha = true }: Props) {
  const rgba = useMemo(() => unpackRGBA(parseCSSColor(color)), [color])
  const [hsv, setHSV] = useState<HSV>(() => rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a / 255))
  const [hexInput, setHexInput] = useState<string>('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const svRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)
  const alphaRef = useRef<HTMLDivElement | null>(null)
  // Track dragging to avoid external color sync jitter while interacting
  const [isDragging, setIsDragging] = useState(false)

  // Keep HSV in sync when external color changes (but don’t fight while dragging)
  useEffect(() => {
    // While dragging, keep internal HSV stable (skip external sync)
    if (isDragging) return
    const next = rgbToHsv(rgba.r, rgba.g, rgba.b, rgba.a / 255)
    setHSV(next)
    setHexInput(rgbaToCSSHex(packRGBA({ r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, isDragging])


  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Commit the current value before closing
        emit(hsv, true)
        onClose()
      }
    }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      if (rootRef.current && t && rootRef.current.contains(t)) return
      // Outside click: commit and close
      emit(hsv, true)
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true })
      window.removeEventListener('pointerdown', onDown, { capture: true })
    }
  }, [open, onClose, hsv])

  const emit = (next: HSV, done = false) => {
    const rgb = hsvToRgb(next.h, next.s, next.v)
    const hex = rgbaToCSSHex(packRGBA({ r: rgb.r, g: rgb.g, b: rgb.b, a: Math.round(next.a * 255) }))
    if (done) onChangeDone(hex)
    else onChangeLive(hex)
    setHexInput(hex)
  }

  const beginDrag = (
    ref: React.RefObject<HTMLDivElement | null>,
    onMove: (rect: DOMRect, x: number, y: number) => void,
  ) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!ref.current) return
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const rect = ref.current.getBoundingClientRect()
    const handle = (ev: PointerEvent) => {
      onMove(rect, ev.clientX, ev.clientY)
    }
    const up = () => {
      window.removeEventListener('pointermove', handle)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setIsDragging(false)
    }
    window.addEventListener('pointermove', handle)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    onMove(rect, e.clientX, e.clientY);
  }

  const hueRGB = hsvToRgb(hsv.h, 1, 1)
  const hueHex = `#${[hueRGB.r, hueRGB.g, hueRGB.b].map(n => n.toString(16).padStart(2, '0')).join('')}`
  const curRGB = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const curHexNoAlpha = `#${[curRGB.r, curRGB.g, curRGB.b].map(n => n.toString(16).padStart(2, '0')).join('')}`

  const width = 220
  const margin = 8
  const x = Math.min(window.innerWidth - width - margin, Math.max(margin, anchor.x))
  const y = Math.min(window.innerHeight - 280 - margin, Math.max(margin, anchor.y))

  const content = (
    <div
      ref={rootRef}
      className="fixed z-[1000] w-[220px] rounded-md border border-border bg-elevated shadow-lg p-3 text-sm select-none"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      aria-label="Color picker"
    >
      {/* SV box */}
      <div
        ref={svRef}
        className="relative w-full h-36 rounded overflow-hidden border border-border mb-2 touch-none"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})`,
        }}
        onPointerDown={beginDrag(svRef, (rect, cx, cy) => {
          const s = clamp01((cx - rect.left) / rect.width)
          const v = clamp01(1 - (cy - rect.top) / rect.height)
          const next = { ...hsv, s, v }
          setHSV(next)
          // hsvRef will mirror on next effect tick, but emit with our local next immediately
          emit(next, false)
        })}
      >
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="relative w-full h-5 rounded mb-2 border border-border touch-none"
        style={{
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
        }}
        onPointerDown={beginDrag(hueRef, (rect, cx) => {
          const h = clamp01((cx - rect.left) / rect.width)
          const next = { ...hsv, h }
          setHSV(next)
          emit(next, false)
        })}
      >
        <div
          className="absolute -top-0.5 w-1 h-6 bg-white border border-black/30 rounded"
          style={{ left: `${hsv.h * 100}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Alpha slider */}
      {showAlpha && (
        <div
          ref={alphaRef}
          className="relative w-full h-5 rounded mb-2 border border-border touch-none"
          style={{
            backgroundImage: `linear-gradient(45deg, #0003 25%, transparent 25%), linear-gradient(-45deg, #0003 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0003 75%), linear-gradient(-45deg, transparent 75%, #0003 75%), linear-gradient(to right, rgba(0,0,0,0), ${curHexNoAlpha})`,
            backgroundSize: '8px 8px, 8px 8px, 8px 8px, 8px 8px, auto',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0, 0 0',
          }}
          onPointerDown={beginDrag(alphaRef, (rect, cx) => {
            const a = clamp01((cx - rect.left) / rect.width)
            const next = { ...hsv, a }
            setHSV(next)
            emit(next, false)
          })}
        >
          <div
            className="absolute -top-0.5 w-1 h-6 bg-white border border-black/30 rounded"
            style={{ left: `${hsv.a * 100}%`, transform: 'translateX(-50%)' }}
          />
        </div>
      )}

      {/* Hex input + preview */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded border border-border"
          style={{
            backgroundImage: 'linear-gradient(45deg, #0003 25%, transparent 25%), linear-gradient(-45deg, #0003 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0003 75%), linear-gradient(-45deg, transparent 75%, #0003 75%)',
            backgroundSize: '8px 8px', backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
          }}
        >
          <div className="w-full h-full rounded" style={{ background: rgbaToCSSHex(packRGBA({ r: curRGB.r, g: curRGB.g, b: curRGB.b, a: Math.round(hsv.a * 255) })) }} />
        </div>
        <input
          className="w-24 px-2 py-1 rounded border border-border bg-surface"
          value={hexInput}
          onChange={(e) => {
            const v = e.target.value
            setHexInput(v)
            if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
              const { r, g, b, a } = unpackRGBA(parseCSSColor(v))
              const next = rgbToHsv(r, g, b, a / 255)
              setHSV(next)
              onChangeLive(v)
            }
          }}
          onBlur={() => {
            const v = hexInput
            if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) onChangeDone(v)
          }}
        />
        <button
          className="px-2 py-1 text-sm rounded border border-border"
          onClick={() => { emit(hsv, true); onClose() }}
        >
          Close
        </button>
      </div>
    </div>
  )

  if (!open) return null
  return createPortal(content, document.body)
}

export function useColorPopover() {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const toggle = () => {
    if (!btnRef.current) { setOpen((v) => !v); return }
    const r = btnRef.current.getBoundingClientRect()
    const x = r.left
    const y = r.bottom + 6
    setAnchor({ x, y })
    setOpen((v) => !v)
  }
  const close = () => setOpen(false)
  return { open, anchor, btnRef, toggle, close }
}
