import { computeTransformHandles } from './transform'

export function ensureHiDPICanvas(cvs: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  const rect = cvs.getBoundingClientRect()
  const needW = Math.max(1, Math.round(rect.width * dpr))
  const needH = Math.max(1, Math.round(rect.height * dpr))
  if (cvs.width !== needW || cvs.height !== needH) {
    cvs.width = needW
    cvs.height = needH
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, cvs.width, cvs.height)
  ctx.scale(dpr, dpr)
  ctx.imageSmoothingEnabled = false
  return { dpr, rect }
}

export function getCheckerCanvas(size: number, width: number, height: number, light = '#f0f0f0', dark = '#d7d7d7') {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = light
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = dark
  for (let x = 0; x < width; x += size) {
    for (let y = 0; y < height; y += size) {
      if ((x / size + y / size) % 2 !== 0) {
        ctx.fillRect(x, y, size, size)
      }
    }
  }
  return canvas
}

export function drawBorder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1)
}

export function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number) {
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 1
  const scaledW = width * size
  const scaledH = height * size
  for (let x = 0; x <= width; x++) {
    ctx.beginPath()
    ctx.moveTo(x * size + 0.5, 0)
    ctx.lineTo(x * size + 0.5, scaledH)
    ctx.stroke()
  }
  for (let y = 0; y <= height; y++) {
    ctx.beginPath()
    ctx.moveTo(0, y * size + 0.5)
    ctx.lineTo(scaledW, y * size + 0.5)
    ctx.stroke()
  }
}

export function drawHoverCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, brushSize: number = 1) {
  ctx.save()
  ctx.strokeStyle = 'rgba(0,128,255,0.9)'
  ctx.lineWidth = 2
  if (brushSize <= 1) {
    ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1)
  } else {
    const half = Math.floor(brushSize / 2)
    const left = (x - half) * size + 0.5
    const top = (y - half) * size + 0.5
    const w = brushSize * size - 1
    const h = brushSize * size - 1
    ctx.strokeRect(left, top, w, h)
  }
  ctx.restore()
}

export function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  kind: 'line' | 'rect' | 'ellipse',
  startX: number,
  startY: number,
  curX: number,
  curY: number,
  size: number,
  fillRect: boolean = false,
) {
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.8)'
  ctx.setLineDash([4, 3])
  const s = size
  const x0 = startX * s + 0.5
  const y0 = startY * s + 0.5
  const x1 = curX * s + 0.5
  const y1 = curY * s + 0.5
  if (kind === 'rect') {
    const left = Math.min(x0, x1)
    const top = Math.min(y0, y1)
    const w = Math.abs(x1 - x0) + (s - 1)
    const h = Math.abs(y1 - y0) + (s - 1)
    if (fillRect) {
      ctx.save()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(left, top, w, h)
      ctx.restore()
    }
    ctx.strokeRect(left, top, w, h)
  } else if (kind === 'ellipse') {
    const left = Math.min(x0, x1)
    const top = Math.min(y0, y1)
    const w = Math.abs(x1 - x0) + (s - 1)
    const h = Math.abs(y1 - y0) + (s - 1)
    const cx = left + w / 2
    const cy = top + h / 2
    const rx = w / 2
    const ry = h / 2
    ctx.save()
    if (fillRect) {
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.moveTo((startX + 0.5) * s, (startY + 0.5) * s)
    ctx.lineTo((curX + 0.5) * s, (curY + 0.5) * s)
    ctx.stroke()
  }
  ctx.restore()
}

export function createSelectionOverlay(mask: Uint8Array, W: number, H: number) {
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) ctx.fillRect(x, y, 1, 1)
    }
  }

  return (ctx: CanvasRenderingContext2D, size: number) => {
    ctx.drawImage(canvas, 0, 0, W, H, 0, 0, W * size, H * size)
  }
}

export function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array,
  W: number,
  H: number,
  size: number,
  phase: number = 0,
  dx: number = 0,
  dy: number = 0,
) {
  if (!mask) return
  const s = size

  function f() {
    ctx.beginPath()
    for (let y = 0; y < H; y++) {
      const row = y * W
      for (let x = 0; x < W; x++) {
        if (!mask[row + x]) continue
        if (y === 0 || !mask[row - W + x]) {
          const X = (x + dx) * s + 0.5
          const Y = (y + dy) * s + 0.5
          ctx.moveTo(X, Y)
          ctx.lineTo(X + s, Y)
        }
        if (y === H - 1 || !mask[row + W + x]) {
          const X = (x + dx) * s + 0.5
          const Y = (y + 1 + dy) * s - 0.5
          ctx.moveTo(X, Y)
          ctx.lineTo(X + s, Y)
        }
        if (x === 0 || !mask[row + x - 1]) {
          const X = (x + dx) * s + 0.5
          const Y = (y + dy) * s + 0.5
          ctx.moveTo(X, Y)
          ctx.lineTo(X, Y + s)
        }
        if (x === W - 1 || !mask[row + x + 1]) {
          const X = (x + 1 + dx) * s - 0.5
          const Y = (y + dy) * s + 0.5
          ctx.moveTo(X, Y)
          ctx.lineTo(X, Y + s)
        }
      }
    }
    ctx.stroke()
  }

  ctx.save()
  ctx.lineWidth = 1

  ctx.strokeStyle = '#000'
  f()

  ctx.strokeStyle = '#fff'
  ctx.setLineDash([4, 4])
  ctx.lineDashOffset = -phase
  f()

  ctx.restore()
}

export function drawBoundsOutline(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  transform: { cx: number; cy: number; angle: number; scaleX: number; scaleY: number },
  size: number,
  phase: number = 0,
) {
  const s = size

  const rotationOffset = 16 / Math.max(s, 0.0000001)
  const handles = computeTransformHandles(transform, w, h, rotationOffset)

  ctx.save()
  ctx.lineWidth = 1
  function drawRect() {
    ctx.beginPath()
    ctx.moveTo(handles.resize[0].x * s, handles.resize[0].y * s)
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(handles.resize[i].x * s, handles.resize[i].y * s)
    }
    ctx.closePath()
    ctx.stroke()
  }
  ctx.strokeStyle = '#000'
  drawRect()
  ctx.strokeStyle = '#fff'
  ctx.setLineDash([4, 4])
  ctx.lineDashOffset = -phase
  drawRect()
  ctx.restore()

  const handleSize = Math.min(12, Math.max(6, s * 0.7))
  const half = handleSize / 2

  ctx.save()
  ctx.lineWidth = 1
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#000'


  for (const handle of handles.resize) {
    const hx = handle.x * s
    const hy = handle.y * s
    ctx.beginPath()
    ctx.rect(hx - half, hy - half, handleSize, handleSize)
    ctx.fill()
    ctx.stroke()
  }

  // Connector line to rotation handle
  ctx.beginPath()
  ctx.moveTo(handles.topCenter.x * s, handles.topCenter.y * s)
  ctx.lineTo(handles.rotation.x * s, handles.rotation.y * s)
  ctx.stroke()

  const rotRadius = handleSize * 0.6
  ctx.beginPath()
  ctx.arc(handles.rotation.x * s, handles.rotation.y * s, rotRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.restore()
}
