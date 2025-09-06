import { useEffect } from 'react'
import { usePixelStore } from '../store'

export function useKeyboardShortcuts(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  panModRef: React.RefObject<boolean>,
  clearSelection: () => void,
) {
  const undo = usePixelStore(s => s.undo)
  const redo = usePixelStore(s => s.redo)
  const copySelection = usePixelStore(s => s.copySelection)
  const cutSelection = usePixelStore(s => s.cutSelection)
  const pasteClipboard = usePixelStore(s => s.pasteClipboard)

  // beginStroke/endStroke and selectionBounds are referenced via getState when needed
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (!panModRef.current) {
          panModRef.current = true
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
        }
        e.preventDefault()
      } else if (e.key === 'Escape') {
        clearSelection()
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        panModRef.current = false
        if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair'
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('keyup', onKeyUp, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown as any, { capture: true } as any)
      window.removeEventListener('keyup', onKeyUp as any, { capture: true } as any)
    }
  }, [canvasRef, panModRef, clearSelection])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'z') {
        if (e.shiftKey) { redo(); e.preventDefault() }
        else { undo(); e.preventDefault() }
        return
      }
      // Copy / Cut / Paste for selections
      if (k === 'c') {
        if ((usePixelStore.getState() as any).selectionBounds) {
          copySelection();
          e.preventDefault()
        }
        return
      }
      if (k === 'x') {
        if ((usePixelStore.getState() as any).selectionBounds) {
          (usePixelStore.getState() as any).beginStroke()
          cutSelection();
          (usePixelStore.getState() as any).endStroke()
          e.preventDefault()
        }
        return
      }
      if (k === 'v') {
        pasteClipboard();
        e.preventDefault()
        return
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey as any, { capture: true } as any)
  }, [undo, redo, copySelection, cutSelection, pasteClipboard])
}
