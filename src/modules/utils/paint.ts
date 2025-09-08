import { rasterizeLine } from './lines'

// Stamp a square brush onto a truecolor layer. Returns original src if no change.
export function stampTruecolor(
  src: Uint32Array,
  W: number,
  H: number,
  x: number,
  y: number,
  size: number,
  rgba: number,
  selectionMask?: Uint8Array,
): Uint32Array {
  const out = new Uint32Array(src)
  const half = Math.floor(size / 2)
  const left = x - half
  const top = y - half
  let changed = false
  for (let py = 0; py < size; py++) {
    const yy = top + py
    if (yy < 0 || yy >= H) continue
    for (let px = 0; px < size; px++) {
      const xx = left + px
      if (xx < 0 || xx >= W) continue
      const i = yy * W + xx
      if (selectionMask && !selectionMask[i]) continue
      if (out[i] !== (rgba >>> 0)) {
        out[i] = rgba >>> 0
        changed = true
      }
    }
  }
  return changed ? out : src
}

export function stampIndexed(
  src: Uint8Array,
  W: number,
  H: number,
  x: number,
  y: number,
  size: number,
  index: number,
  selectionMask?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(src)
  const half = Math.floor(size / 2)
  const left = x - half
  const top = y - half
  const v = index & 0xff
  let changed = false
  for (let py = 0; py < size; py++) {
    const yy = top + py
    if (yy < 0 || yy >= H) continue
    for (let px = 0; px < size; px++) {
      const xx = left + px
      if (xx < 0 || xx >= W) continue
      const i = yy * W + xx
      if (selectionMask && !selectionMask[i]) continue
      if (out[i] !== v) { out[i] = v; changed = true }
    }
  }
  return changed ? out : src
}

export function drawLineBrushTruecolor(
  src: Uint32Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  rgba: number,
  selectionMask?: Uint8Array,
): Uint32Array {
  const out = new Uint32Array(src)
  let changed = false
  const half = Math.floor(size / 2)
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  rasterizeLine(x0, y0, x1, y1, (cx, cy) => {
    for (let py = 0; py < size; py++) {
      const yy = cy - half + py
      if (!inBounds(cx, yy)) continue
      for (let px = 0; px < size; px++) {
        const xx = cx - half + px
        if (!inBounds(xx, yy)) continue
        const i = yy * W + xx
        if (selectionMask && !selectionMask[i]) continue
        if (out[i] !== (rgba >>> 0)) { out[i] = rgba >>> 0; changed = true }
      }
    }
  })
  return changed ? out : src
}

export function drawLineBrushIndexed(
  src: Uint8Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  size: number,
  index: number,
  selectionMask?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(src)
  const half = Math.floor(size / 2)
  const v = index & 0xff
  let changed = false
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  rasterizeLine(x0, y0, x1, y1, (cx, cy) => {
    for (let py = 0; py < size; py++) {
      const yy = cy - half + py
      if (!inBounds(cx, yy)) continue
      for (let px = 0; px < size; px++) {
        const xx = cx - half + px
        if (!inBounds(xx, yy)) continue
        const i = yy * W + xx
        if (selectionMask && !selectionMask[i]) continue
        if (out[i] !== v) { out[i] = v; changed = true }
      }
    }
  })
  return changed ? out : src
}

export function drawRectOutlineTruecolor(
  src: Uint32Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: number,
  selectionMask?: Uint8Array,
): Uint32Array {
  const out = new Uint32Array(src)
  let changed = false
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
  let left = Math.max(0, Math.min(x0, x1))
  let right = Math.min(W - 1, Math.max(x0, x1))
  let top = Math.max(0, Math.min(y0, y1))
  let bottom = Math.min(H - 1, Math.max(y0, y1))
  if (left > right || top > bottom) return src
  const pix = rgba >>> 0
  for (let x = left; x <= right; x++) {
    const it = top * W + x
    const ib = bottom * W + x
    if (!selectionMask || selectionMask[it]) { if (out[it] !== pix) { out[it] = pix; changed = true } }
    if (!selectionMask || selectionMask[ib]) { if (out[ib] !== pix) { out[ib] = pix; changed = true } }
  }
  for (let y = top; y <= bottom; y++) {
    const il = y * W + left
    const ir = y * W + right
    if (!selectionMask || selectionMask[il]) { if (out[il] !== pix) { out[il] = pix; changed = true } }
    if (!selectionMask || selectionMask[ir]) { if (out[ir] !== pix) { out[ir] = pix; changed = true } }
  }
  return changed ? out : src
}

export function drawRectOutlineIndexed(
  src: Uint8Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
  selectionMask?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(src)
  let changed = false
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
  let left = Math.max(0, Math.min(x0, x1))
  let right = Math.min(W - 1, Math.max(x0, x1))
  let top = Math.max(0, Math.min(y0, y1))
  let bottom = Math.min(H - 1, Math.max(y0, y1))
  if (left > right || top > bottom) return src
  const v = index & 0xff
  for (let x = left; x <= right; x++) {
    const it = top * W + x
    const ib = bottom * W + x
    if (!selectionMask || selectionMask[it]) { if (out[it] !== v) { out[it] = v; changed = true } }
    if (!selectionMask || selectionMask[ib]) { if (out[ib] !== v) { out[ib] = v; changed = true } }
  }
  for (let y = top; y <= bottom; y++) {
    const il = y * W + left
    const ir = y * W + right
    if (!selectionMask || selectionMask[il]) { if (out[il] !== v) { out[il] = v; changed = true } }
    if (!selectionMask || selectionMask[ir]) { if (out[ir] !== v) { out[ir] = v; changed = true } }
  }
  return changed ? out : src
}

// Filled rectangle (includes outline) for truecolor mode
export function drawRectFilledTruecolor(
  src: Uint32Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: number,
  selectionMask?: Uint8Array,
): Uint32Array {
  const out = new Uint32Array(src)
  let changed = false
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
  let left = Math.max(0, Math.min(x0, x1))
  let right = Math.min(W - 1, Math.max(x0, x1))
  let top = Math.max(0, Math.min(y0, y1))
  let bottom = Math.min(H - 1, Math.max(y0, y1))
  if (left > right || top > bottom) return src
  const pix = rgba >>> 0
  for (let y = top; y <= bottom; y++) {
    const row = y * W
    for (let x = left; x <= right; x++) {
      const i = row + x
      if (selectionMask && !selectionMask[i]) continue
      if (out[i] !== pix) { out[i] = pix; changed = true }
    }
  }
  return changed ? out : src
}

// Filled rectangle (includes outline) for indexed mode
export function drawRectFilledIndexed(
  src: Uint8Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
  selectionMask?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(src)
  let changed = false
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0
  let left = Math.max(0, Math.min(x0, x1))
  let right = Math.min(W - 1, Math.max(x0, x1))
  let top = Math.max(0, Math.min(y0, y1))
  let bottom = Math.min(H - 1, Math.max(y0, y1))
  if (left > right || top > bottom) return src
  const v = index & 0xff
  for (let y = top; y <= bottom; y++) {
    const row = y * W
    for (let x = left; x <= right; x++) {
      const i = row + x
      if (selectionMask && !selectionMask[i]) continue
      if (out[i] !== v) { out[i] = v; changed = true }
    }
  }
  return changed ? out : src
}

function rasterizeEllipse(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  const a = Math.abs(x1 - x0) / 2
  const b = Math.abs(y1 - y0) / 2
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2

  if (a > b) {
    rasterizeEllipse(y0, x0, y1, x1, (y, x) => plot(x, y))
    return
  }

  let x = 0.25
  let y = b
  const a2 = a * a
  const b2 = b * b

  const plots = () => {
    plot(Math.round(cx + x), Math.round(cy + y))
    plot(Math.round(cx - x), Math.round(cy + y))
    plot(Math.round(cx + x), Math.round(cy - y))
    plot(Math.round(cx - x), Math.round(cy - y))
  }

  // Region 1
  let d1 = b2 - a2 * b + 0.25 * a2
  while (b2 * (x + 1) < a2 * (y - 0.5)) {
    plots()
    if (d1 < 0) {
      d1 += b2 * (2 * x + 3)
    } else {
      d1 += b2 * (2 * x + 3) + a2 * (-2 * y + 2)
      y -= 1
    }
    x += 1
  }

  // Region 2
  let d2 = b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2
  while (y >= 0) {
    plots()
    if (d2 > 0) {
      d2 += a2 * (-2 * y + 3)
    } else {
      d2 += b2 * (2 * x + 2) + a2 * (-2 * y + 3)
      x += 1
    }
    y -= 1
  }
}

function rasterizeEllipseFilled(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  const a = Math.abs(x1 - x0) / 2
  const b = Math.abs(y1 - y0) / 2
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2

  if (a > b) {
    rasterizeEllipseFilled(y0, x0, y1, x1, (y, x) => plot(x, y))
    return
  }

  let x = 0.25
  let y = b
  const a2 = a * a
  const b2 = b * b

  const plots = () => {
    for (let px = Math.round(cx - x); px <= Math.round(cx + x); px++) {
      plot(px, Math.round(cy + y))
      plot(px, Math.round(cy - y))
    }
  }

  // Region 1
  let d1 = b2 - a2 * b + 0.25 * a2
  while (b2 * (x + 1) < a2 * (y - 0.5)) {
    plots()
    if (d1 < 0) {
      d1 += b2 * (2 * x + 3)
    } else {
      d1 += b2 * (2 * x + 3) + a2 * (-2 * y + 2)
      y -= 1
    }
    x += 1
  }

  // Region 2
  let d2 = b2 * (x + 0.5) * (x + 0.5) + a2 * (y - 1) * (y - 1) - a2 * b2
  while (y >= 0) {
    plots()
    if (d2 > 0) {
      d2 += a2 * (-2 * y + 3)
    } else {
      d2 += b2 * (2 * x + 2) + a2 * (-2 * y + 3)
      x += 1
    }
    y -= 1
  }
}

export function drawEllipseOutlineTruecolor(
  src: Uint32Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: number,
  selectionMask?: Uint8Array,
): Uint32Array {
  const out = new Uint32Array(src)
  let changed = false
  const pix = rgba >>> 0
  rasterizeEllipse(x0, y0, x1, y1, (px, py) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const i = py * W + px
    if (selectionMask && !selectionMask[i]) return
    if (out[i] !== pix) { out[i] = pix; changed = true }
  })
  return changed ? out : src
}

export function drawEllipseOutlineIndexed(
  src: Uint8Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
  selectionMask?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(src)
  let changed = false
  const v = index & 0xff
  rasterizeEllipse(x0, y0, x1, y1, (px, py) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const i = py * W + px
    if (selectionMask && !selectionMask[i]) return
    if (out[i] !== v) { out[i] = v; changed = true }
  })
  return changed ? out : src
}

export function drawEllipseFilledTruecolor(
  src: Uint32Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: number,
  selectionMask?: Uint8Array,
): Uint32Array {
  const out = new Uint32Array(src)
  let changed = false
  const pix = rgba >>> 0
  rasterizeEllipseFilled(x0, y0, x1, y1, (px, py) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const i = py * W + px
    if (selectionMask && !selectionMask[i]) return
    if (out[i] !== pix) { out[i] = pix; changed = true }
  })
  return changed ? out : src
}

export function drawEllipseFilledIndexed(
  src: Uint8Array,
  W: number,
  H: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  index: number,
  selectionMask?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(src)
  let changed = false
  const v = index & 0xff
  rasterizeEllipseFilled(x0, y0, x1, y1, (px, py) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const i = py * W + px
    if (selectionMask && !selectionMask[i]) return
    if (out[i] !== v) { out[i] = v; changed = true }
  })
  return changed ? out : src
}
