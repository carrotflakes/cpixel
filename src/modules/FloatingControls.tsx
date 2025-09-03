import { usePixelStore } from './store'

export function FloatingControls() {
  const undo = usePixelStore(s => s.undo)
  const redo = usePixelStore(s => s.redo)
  const canUndo = usePixelStore(s => s.canUndo)
  const canRedo = usePixelStore(s => s.canRedo)

  // hide on large screens, show on mobile; keep simple responsive CSS
  // buttons are accessible and big enough for touch
  return (
    <div className="pointer-events-none pb-2 md:hidden flex justify-center">
      <div className="pointer-events-auto flex gap-3 bg-black/60 text-white rounded-full px-4 py-2 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={undo}
          className={`min-w-16 px-3 py-2 rounded-full text-sm font-medium ${canUndo ? 'bg-white/10 hover:bg-white/20' : 'bg-white/5 opacity-50 cursor-not-allowed'}`}
        >Undo</button>
        <button
          type="button"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={redo}
          className={`min-w-16 px-3 py-2 rounded-full text-sm font-medium ${canRedo ? 'bg-white/10 hover:bg-white/20' : 'bg-white/5 opacity-50 cursor-not-allowed'}`}
        >Redo</button>
      </div>
    </div>
  )
}
