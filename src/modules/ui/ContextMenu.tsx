import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Lightweight primitives to render a floating context menu at screen coords (x,y)
// Features:
// - Portal to body
// - Clamp to viewport with margin
// - Dismiss on outside click or Escape
// - Prevent default native contextmenu inside

export type MenuState<T = unknown> = { open: true; x: number; y: number; data?: T } | { open: false } | null

export function useContextMenu<T = unknown>(options?: {
  refsInside?: Array<React.RefObject<HTMLElement | null>>
}): {
  menu: MenuState<T>
  openAt: (x: number, y: number, data?: T) => void
  close: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
} {
  const [menu, setMenu] = useState<MenuState<T>>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const refsInside = options?.refsInside || []

  const openAt = useCallback((x: number, y: number, data?: T) => {
    setMenu({ open: true, x, y, data })
  }, [])

  const close = useCallback(() => setMenu(null), [])

  // Outside click + Escape to dismiss
  useEffect(() => {
    if (!menu || !('open' in menu) || !menu.open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onDown = (e: MouseEvent | PointerEvent) => {
      const t = e.target as Node | null
      const insideMenu = menuRef.current && t && menuRef.current.contains(t)
      const insideAny = insideMenu || refsInside.some(r => r.current && t && r.current.contains(t))
      if (insideAny) return
      close()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true } as any)
      window.removeEventListener('pointerdown', onDown, { capture: true } as any)
    }
  }, [menu, refsInside, close])

  return { menu, openAt, close, menuRef }
}

export function Menu(props: {
  open: boolean
  x: number
  y: number
  onClose?: () => void
  menuRef?: React.RefObject<HTMLDivElement | null>
  minWidth?: number
  margin?: number
  className?: string
  children: React.ReactNode
}) {
  const ref = props.menuRef ?? useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: props.x, y: props.y })
  const minW = props.minWidth ?? 128
  const margin = props.margin ?? 8

  // Clamp to viewport after mount and whenever coords change
  useEffect(() => {
    if (!props.open) return
    const el = ref.current
    const w = (el?.offsetWidth || minW)
    const h = (el?.offsetHeight || 10)
    const maxX = window.innerWidth - w - margin
    const maxY = window.innerHeight - h - margin
    const nextX = Math.max(margin, Math.min(props.x, maxX))
    const nextY = Math.max(margin, Math.min(props.y, maxY))
    setPos({ x: nextX, y: nextY })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.x, props.y, minW, margin])

  const className = useMemo(() => (
    'fixed flex flex-col z-[1000] rounded-md border border-border bg-elevated shadow-lg text-sm py-1 ' + (props.className || '')
  ), [props.className])

  if (!props.open) return null
  return createPortal(
    <div
      role="menu"
      ref={ref}
      className={className}
      style={{ left: pos.x, top: pos.y, minWidth: minW }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {props.children}
    </div>,
    document.body
  )
}

export function MenuItem({
  onSelect,
  disabled,
  danger,
  children,
}: {
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  const base = 'w-full text-left px-3 py-2 inline-flex items-center gap-2 '
  const color = danger ? 'hover:bg-red-50/70 text-red-700 ' : 'hover:bg-surface-muted '
  const dis = disabled ? 'disabled:opacity-50 ' : ''
  return (
    <button
      role="menuitem"
      className={base + color + dis}
      onClick={() => { if (!disabled) onSelect() }}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-border" />
}
