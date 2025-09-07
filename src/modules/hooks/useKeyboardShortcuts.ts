import { useEffect } from 'react'
import { usePixelStore } from '../store'

export function useKeyboardShortcuts(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  clearSelection: () => void,
) {
  const undo = usePixelStore(s => s.undo)
  const redo = usePixelStore(s => s.redo)
  const selectionBounds = usePixelStore(s => s.selection.bounds)

  // beginStroke/endStroke and selectionBounds are referenced via getState when needed
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [canvasRef, clearSelection])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'z') {
        if (e.shiftKey) { redo(); e.preventDefault() }
        else { undo(); e.preventDefault(); }
        return
      }
      // Copy / Cut / Paste for selections
      if (k === 'c') {
        if (selectionBounds) {
          usePixelStore.getState().copySelection();
          e.preventDefault()
        }
        return
      }
      if (k === 'x') {
        if (selectionBounds) {
          usePixelStore.getState().beginStroke()
          usePixelStore.getState().cutSelection();
          usePixelStore.getState().endStroke()
          e.preventDefault()
        }
        return
      }
      if (k === 'v') {
        usePixelStore.getState().pasteClipboard();
        e.preventDefault()
        return
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [undo, redo, selectionBounds])
}
