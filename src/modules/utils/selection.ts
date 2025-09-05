import { nearestIndexInPalette } from './color'

export type Point = { x: number; y: number }

export function rectToMask(W: number, H: number, x0: number, y0: number, x1: number, y1: number) {
  const mask = new Uint8Array(W * H)
  const left = Math.max(0, Math.min(x0, x1)) | 0
  const right = Math.min(W - 1, Math.max(x0, x1)) | 0
  const top = Math.max(0, Math.min(y0, y1)) | 0
  const bottom = Math.min(H - 1, Math.max(y0, y1)) | 0
  for (let y = top; y <= bottom; y++) {
    const row = y * W
    for (let x = left; x <= right; x++) mask[row + x] = 1
  }
  return { mask, bounds: { left, top, right, bottom } }
}

// Point-in-polygon mask (even-odd rule)
export function polygonToMask(W: number, H: number, points: Point[]) {
  const mask = new Uint8Array(W * H)
  if (points.length < 3) return { mask, bounds: { left: 0, top: 0, right: -1, bottom: -1 } }
  let left = W - 1, right = 0, top = H - 1, bottom = 0
  for (const p of points) {
    if (p.x < left) left = p.x
    if (p.x > right) right = p.x
    if (p.y < top) top = p.y
    if (p.y > bottom) bottom = p.y
  }
  left = Math.max(0, Math.min(W - 1, left | 0))
  right = Math.max(0, Math.min(W - 1, right | 0))
  top = Math.max(0, Math.min(H - 1, top | 0))
  bottom = Math.max(0, Math.min(H - 1, bottom | 0))
  // even-odd test per pixel center
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      let inside = false
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y
        const xj = points[j].x, yj = points[j].y
        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi)
        if (intersect) inside = !inside
      }
      if (inside) mask[y * W + x] = 1
    }
  }
  return { mask, bounds: { left, top, right, bottom } }
}

export function isPointInMask(mask: Uint8Array | undefined, W: number, H: number, x: number, y: number) {
  if (!mask) return false
  if (x < 0 || y < 0 || x >= W || y >= H) return false
  return mask[y * W + x] !== 0
}

export function extractFloatingTruecolor(data: Uint32Array, mask: Uint8Array | undefined, bounds: { left: number; top: number; right: number; bottom: number }, W: number) {
  const bw = bounds.right - bounds.left + 1
  const bh = bounds.bottom - bounds.top + 1
  const float = new Uint32Array(bw * bh)
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      const i = y * W + x
      const fi = (y - bounds.top) * bw + (x - bounds.left)
      if (!mask || mask[i]) float[fi] = data[i] >>> 0
      else float[fi] = 0
    }
  }
  return float
}

export function clearSelectedTruecolor(data: Uint32Array, mask: Uint8Array | undefined, bounds: { left: number; top: number; right: number; bottom: number }, W: number) {
  const out = new Uint32Array(data)
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      const i = y * W + x
      if (!mask || mask[i]) out[i] = 0
    }
  }
  return out
}

export function extractFloatingIndexed(indices: Uint8Array, palette: Uint32Array, mask: Uint8Array | undefined, bounds: { left: number; top: number; right: number; bottom: number }, W: number, transparentIndex: number) {
  const bw = bounds.right - bounds.left + 1
  const bh = bounds.bottom - bounds.top + 1
  const float = new Uint32Array(bw * bh)
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      const i = y * W + x
      const fi = (y - bounds.top) * bw + (x - bounds.left)
      if (mask && !mask[i]) { float[fi] = 0; continue }
      const pi = indices[i] ?? transparentIndex
      float[fi] = palette[pi] >>> 0
    }
  }
  return float
}

export function clearSelectedIndexed(indices: Uint8Array, mask: Uint8Array | undefined, bounds: { left: number; top: number; right: number; bottom: number }, W: number, transparentIndex: number) {
  const out = new Uint8Array(indices)
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      const i = y * W + x
      if (!mask || mask[i]) out[i] = transparentIndex & 0xff
    }
  }
  return out
}

export function applyFloatingToTruecolorLayer(dst: Uint32Array, floating: Uint32Array, dstLeft: number, dstTop: number, bw: number, bh: number, W: number, H: number) {
  const out = new Uint32Array(dst)
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const pix = floating[y * bw + x] >>> 0
      if ((pix & 0xff) === 0) continue
      const X = dstLeft + x
      const Y = dstTop + y
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue
      out[Y * W + X] = pix
    }
  }
  return out
}

export function applyFloatingToIndexedLayer(dst: Uint8Array, floating: Uint32Array, palette: Uint32Array, transparentIndex: number, dstLeft: number, dstTop: number, bw: number, bh: number, W: number, H: number) {
  const out = new Uint8Array(dst)
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const pix = floating[y * bw + x] >>> 0
      if ((pix & 0xff) === 0) continue
      const X = dstLeft + x
      const Y = dstTop + y
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue
      const pi = nearestIndexInPalette(palette, pix, transparentIndex)
      out[Y * W + X] = pi & 0xff
    }
  }
  return out
}

// apply floating indices directly (indexed mode) without color round-trip.
// Behavior: transparentIndex pixels in floating are skipped (do not overwrite),
// other indices copied verbatim (clipped to canvas bounds).
export function applyFloatingIndicesToIndexedLayer(
  dst: Uint8Array,
  floating: Uint8Array,
  transparentIndex: number,
  dstLeft: number,
  dstTop: number,
  bw: number,
  bh: number,
  W: number,
  H: number,
) {
  const out = new Uint8Array(dst)
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const pi = floating[y * bw + x] & 0xff
      if (pi === (transparentIndex & 0xff)) continue
      const X = dstLeft + x
      const Y = dstTop + y
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue
      out[Y * W + X] = pi
    }
  }
  return out
}

// extract floating indices sub-rectangle (masked) directly for indexed mode.
export function extractFloatingSelectionIndices(
  indices: Uint8Array,
  mask: Uint8Array | undefined,
  bounds: { left: number; top: number; right: number; bottom: number },
  W: number,
  transparentIndex: number,
) {
  const bw = bounds.right - bounds.left + 1
  const bh = bounds.bottom - bounds.top + 1
  const floatIdx = new Uint8Array(bw * bh)
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      const i = y * W + x
      const fi = (y - bounds.top) * bw + (x - bounds.left)
      if (mask && !mask[i]) { floatIdx[fi] = transparentIndex & 0xff; continue }
      floatIdx[fi] = indices[i] ?? (transparentIndex & 0xff)
    }
  }
  return floatIdx
}

export function buildFloatingFromClipboard(clip: any, bw: number, bh: number) {
  // Returns a cropped/cropped-or-copied Uint32Array of size bw*bh from clipboard
  if (clip.kind === 'rgba') {
    if (bw !== clip.width || bh !== clip.height) {
      const cropped = new Uint32Array(bw * bh)
      for (let y = 0; y < bh; y++) {
        const srcRow = y * clip.width
        cropped.set(clip.pixels.subarray(srcRow, srcRow + bw), y * bw)
      }
      return cropped
    } else {
      return clip.pixels.slice(0)
    }
  } else {
    const srcW = clip.width, srcH = clip.height
    const full = new Uint32Array(srcW * srcH)
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const pi = clip.indices[y * srcW + x] ?? clip.transparentIndex
        full[y * srcW + x] = clip.palette[pi] ?? 0x00000000
      }
    }
    if (bw !== srcW || bh !== srcH) {
      const cropped = new Uint32Array(bw * bh)
      for (let y = 0; y < bh; y++) {
        const srcRow = y * srcW
        cropped.set(full.subarray(srcRow, srcRow + bw), y * bw)
      }
      return cropped
    } else {
      return full
    }
  }
}
