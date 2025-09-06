import { useCallback, useEffect, useRef, useState } from 'react'

export type MotionPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown'

// Internal helper to throttle state updates (avoids excessive React renders on sensor spam)
function useThrottledRerender(intervalMs: number) {
  const [, setTick] = useState(0)
  const lastRef = useRef(0)
  return useCallback(() => {
    const now = performance.now()
    if (now - lastRef.current >= intervalMs) {
      lastRef.current = now
      setTick(t => (t + 1) & 0xffff)
    }
  }, [intervalMs])
}

export function useTilt({ enabled = true }: { enabled?: boolean }) {
  const rotationRateRef = useRef<{ alpha: number; beta: number; gamma: number }>({ alpha: 0, beta: 0, gamma: 0 })
  const countsRef = useRef({ motion: 0 })

  const [motionPermission, setMotionPermission] = useState<MotionPermissionState>('unknown')
  const forceRender = useThrottledRerender(60) // ~16fps max for debug panel changes

  // Capability / permission detection
  useEffect(() => {
    const canMotion = typeof window !== 'undefined' && 'DeviceMotionEvent' in window
    if (!canMotion) { setMotionPermission('unsupported'); return }
    const anyDME = DeviceMotionEvent as any
    if (anyDME && typeof anyDME.requestPermission === 'function') setMotionPermission('prompt')
    else setMotionPermission('unknown')
  }, [])

  const requestMotionPermission = useCallback(() => {
    try {
      const anyDME = DeviceMotionEvent as any
      if (anyDME && typeof anyDME.requestPermission === 'function') {
        anyDME.requestPermission().then((res: any) => {
          if (res === 'granted') setMotionPermission('granted')
          else if (res === 'denied') setMotionPermission('denied')
          else setMotionPermission('prompt')
        }).catch(() => setMotionPermission('denied'))
      }
    } catch { setMotionPermission('denied') }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const handler = (e: DeviceMotionEvent) => {
      if (!e.rotationRate) return
      countsRef.current.motion++
      const ra = e.rotationRate.alpha ?? 0
      const rb = e.rotationRate.beta ?? 0
      const rg = e.rotationRate.gamma ?? 0
      rotationRateRef.current = { alpha: ra, beta: rb, gamma: rg }
      if (motionPermission === 'unknown' || motionPermission === 'prompt') setMotionPermission('granted')
      forceRender()
    }
    window.addEventListener('devicemotion', handler, { passive: true })
    return () => window.removeEventListener('devicemotion', handler)
  }, [enabled, forceRender, motionPermission])

  return {
    rotationRate: rotationRateRef.current,
    rotationRateRef,
    motionPermission,
    requestMotionPermission,
  }
}
