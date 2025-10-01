import { useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export function useTouchLongPress<T extends HTMLElement>({
  delay = 500,
  moveTolerance = 4,
  onTrigger,
}: {
  delay?: number
  moveTolerance?: number
  onTrigger: (payload: { target: T; clientX: number; clientY: number }) => void
}) {
  const timerRef = useRef<number | null>(null)
  const startPosRef = useRef<{ x: number; y: number } | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startPosRef.current = null
  }, [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<T>) => {
      if (event.pointerType !== 'touch') return
      clear()
      const target = event.currentTarget
      const { clientX, clientY } = event
      startPosRef.current = { x: clientX, y: clientY }
      timerRef.current = window.setTimeout(() => {
        clear()
        onTrigger({ target, clientX, clientY })
      }, delay)
    },
    [clear, delay, onTrigger],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<T>) => {
      if (event.pointerType !== 'touch') return
      const start = startPosRef.current
      if (!start) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (dx * dx + dy * dy > moveTolerance * moveTolerance) clear()
    },
    [clear, moveTolerance],
  )

  return {
    onPointerDown,
    onPointerMove,
    cancel: clear,
  }
}
