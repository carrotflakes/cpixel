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

// Cached checkerboard pattern canvas per instance
export function getCheckerPatternCanvas(tile = 12, light = '#f0f0f0', dark = '#d7d7d7') {
  const patt = document.createElement('canvas')
  patt.width = tile * 2
  patt.height = tile * 2
  const pctx = patt.getContext('2d')!
  pctx.fillStyle = light
  pctx.fillRect(0, 0, tile, tile)
  pctx.fillRect(tile, tile, tile, tile)
  pctx.fillStyle = dark
  pctx.fillRect(tile, 0, tile, tile)
  pctx.fillRect(0, tile, tile, tile)
  return patt
}

export function drawChecker(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tileCanvas: HTMLCanvasElement,
  offsetX: number = 0,
  offsetY: number = 0,
  scale: number = 1,
) {
  const pattern = ctx.createPattern(tileCanvas, 'repeat')!

  // DOMMatrix: a c e
  //            b d f
  // where a/d are scale, e/f are translate
  const m = new DOMMatrix()
  m.a = scale
  m.d = scale
  m.e = offsetX
  m.f = offsetY
  pattern.setTransform(m)

  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, w, h)
}

export function drawBorder(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
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

export function drawHoverCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(0,128,255,0.9)'
  ctx.lineWidth = 2
  ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1)
  ctx.restore()
}

export function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  kind: 'line' | 'rect',
  startX: number,
  startY: number,
  curX: number,
  curY: number,
  size: number,
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
    ctx.strokeRect(left, top, w, h)
  } else {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawSelectionMarchingAnts(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array,
  W: number,
  H: number,
  size: number,
  phase: number = 0
) {
  // Simple marching ants around mask bounds (not per-pixel outline for perf)
  // Find bounds
  let left = W, right = -1, top = H, bottom = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x]) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < left || bottom < top) return
  const s = size
  ctx.save()
  ctx.strokeStyle = '#000'
  ctx.setLineDash([4, 3])
  ctx.lineDashOffset = -phase
  ctx.strokeRect(left * s + 0.5, top * s + 0.5, (right - left + 1) * s - 1, (bottom - top + 1) * s - 1)
  ctx.restore()
}

export function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array,
  W: number,
  H: number,
  size: number
) {
  // Dim non-selected area with a translucent veil
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) ctx.fillRect(x * size, y * size, size, size)
    }
  }
  ctx.restore()
}
