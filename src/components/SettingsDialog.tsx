import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettingsStore } from '@/stores/settingsStore'

export function SettingsDialog(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props
  const checkerSize = useSettingsStore(s => s.checkerSize)
  const tiltEnabled = useSettingsStore(s => s.tiltParallaxEnabled)
  const tiltTrigger = useSettingsStore(s => s.tiltParallaxTrigger)
  const tiltAmount = useSettingsStore(s => s.tiltParallaxAmount)
  const tiltAlpha = useSettingsStore(s => s.tiltParallaxAlpha)
  const rightClickTool = useSettingsStore(s => s.rightClickTool)
  const usePen = useSettingsStore(s => s.usePen)
  const googleDrive = useSettingsStore(s => s.googleDrive)
  const brushStabilize = useSettingsStore(s => s.brushStabilize)
  const [checkerStr, setCheckerStr] = useState(String(checkerSize))
  const [tiltTriggerStr, setTiltTriggerStr] = useState(String(tiltTrigger))
  const [tiltAmountStr, setTiltAmountStr] = useState(String(tiltAmount))
  const [tiltAlphaStr, setTiltAlphaStr] = useState(String(tiltAlpha))
  const [rightClickToolLocal, setRightClickToolLocal] = useState(rightClickTool)
  const [tiltEnabledLocal, setTiltEnabledLocal] = useState<boolean>(tiltEnabled)
  const [usePenLocal, setUsePenLocal] = useState<boolean>(usePen)
  const [googleDriveLocal, setGoogleDriveLocal] = useState<boolean>(googleDrive)
  const [brushStabilizeStr, setBrushStabilizeStr] = useState(String(brushStabilize))
  const firstRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setCheckerStr(String(checkerSize))
    setTiltTriggerStr(String(tiltTrigger))
    setTiltEnabledLocal(tiltEnabled)
    setTiltAmountStr(String(tiltAmount))
    setTiltAlphaStr(String(tiltAlpha))
    setRightClickToolLocal(rightClickTool)
    setUsePenLocal(usePen)
    setBrushStabilizeStr(String(brushStabilize))
    const t = setTimeout(() => firstRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open, checkerSize, tiltTrigger, tiltEnabled, tiltAmount, tiltAlpha, rightClickTool, usePen, brushStabilize])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Enter') { e.preventDefault(); apply() }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [open, checkerStr])

  const apply = () => {
    const api = useSettingsStore.getState();
    const v = Number(checkerStr)
    if (Number.isFinite(v)) {
      const norm = Math.max(1, Math.min(64, Math.floor(v)))
      api.setCheckerSize(norm)
    }
    const t = Number(tiltTriggerStr)
    if (Number.isFinite(t)) {
      const normT = Math.max(20, Math.min(720, Math.round(t)))
      api.setTiltParallaxTrigger(normT)
    }
    const a = Number(tiltAmountStr)
    if (Number.isFinite(a)) {
      const normA = Math.max(0.05, Math.min(5, a))
      api.setTiltParallaxAmount(normA)
    }
    const al = Number(tiltAlphaStr)
    if (Number.isFinite(al)) {
      const normAl = Math.max(0.05, Math.min(1, al))
      api.setTiltParallaxAlpha(normAl)
    }
    api.setTiltParallaxEnabled(tiltEnabledLocal)
    api.setRightClickTool(rightClickToolLocal)
    api.setUsePen(usePenLocal)
    api.setGoogleDrive(googleDriveLocal)
    const stabilizer = Number(brushStabilizeStr)
    if (Number.isFinite(stabilizer)) {
      const norm = Math.max(0, Math.min(32, Math.floor(stabilizer)))
      api.setBrushStabilize(norm)
    }
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,30rem)] rounded-md border border-border bg-elevated shadow-lg p-4">
        <h2 className="text-base font-medium mb-4">Settings</h2>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 max-w-52">
              <span className="text-sm text-muted">Checker size (px)</span>
              <input
                ref={firstRef}
                type="number"
                min={1}
                max={64}
                inputMode="numeric"
                className="w-full rounded border border-border bg-surface p-1"
                value={checkerStr}
                onChange={(e) => setCheckerStr(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 max-w-52">
              <span className="text-sm text-muted">Right click tool</span>
              <select
                className="rounded border border-border bg-surface p-1"
                value={rightClickToolLocal}
                onChange={(e) => setRightClickToolLocal(e.target.value as typeof rightClickToolLocal)}
              >
                <option value="brush">brush</option>
                <option value="eraser">eraser</option>
                <option value="eyedropper">eyedropper</option>
                <option value="bucket">bucket</option>
                <option value="pan">pan</option>
              </select>
            </label>
            <label className="flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={usePenLocal}
                onChange={(e) => setUsePenLocal(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">Pen mode</span>
            </label>
            <label className="flex flex-col gap-1 max-w-40">
              <span className="text-sm text-muted">Brush stabilize</span>
              <input
                type="number"
                min={0}
                max={32}
                inputMode="numeric"
                className="w-full rounded border border-border bg-surface p-1"
                value={brushStabilizeStr}
                onChange={(e) => setBrushStabilizeStr(e.target.value)}
              />
              <span className="text-[11px] text-muted leading-snug">Average last N points (0 disables).</span>
            </label>
          </div>
          <fieldset className="flex flex-col gap-3 border border-border rounded p-3 max-w-[26rem]">
            <legend className="px-1 text-sm font-medium">Tilt Parallax</legend>
            <label className="flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={tiltEnabledLocal}
                onChange={(e) => setTiltEnabledLocal(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">Enable tilt parallax</span>
            </label>
            <label className="flex flex-col gap-1 max-w-40">
              <span className="text-sm text-muted">Trigger threshold (deg/s)</span>
              <input
                type="number"
                min={20}
                max={720}
                inputMode="numeric"
                className="w-full rounded border border-border bg-surface p-1"
                value={tiltTriggerStr}
                onChange={(e) => setTiltTriggerStr(e.target.value)}
                disabled={!tiltEnabledLocal}
              />
            </label>
            <label className="flex flex-col gap-1 max-w-40">
              <span className="text-sm text-muted">Parallax amount</span>
              <input
                type="number"
                step={0.05}
                min={0.05}
                max={5}
                inputMode="decimal"
                className="w-full rounded border border-border bg-surface p-1"
                value={tiltAmountStr}
                onChange={(e) => setTiltAmountStr(e.target.value)}
                disabled={!tiltEnabledLocal}
              />
            </label>
            <label className="flex flex-col gap-1 max-w-40">
              <span className="text-sm text-muted">Layer alpha</span>
              <input
                type="number"
                step={0.05}
                min={0.05}
                max={1}
                inputMode="decimal"
                className="w-full rounded border border-border bg-surface p-1"
                value={tiltAlphaStr}
                onChange={(e) => setTiltAlphaStr(e.target.value)}
                disabled={!tiltEnabledLocal}
              />
            </label>
            <p className="text-[11px] text-muted leading-snug">Layers fan out briefly when |α|+|β| exceeds this angular velocity threshold.</p>
          </fieldset>
          <label className="flex items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={googleDriveLocal}
              onChange={(e) => setGoogleDriveLocal(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">Use Google Drive</span>
          </label>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded border border-border bg-surface hover:bg-surface-muted" onClick={apply}>Apply</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
