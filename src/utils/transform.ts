export type Transform2D = {
  cx: number
  cy: number
  angle: number
  scaleX: number
  scaleY: number
}

export type CornerHandleId = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'

export type TransformCornerHandle = {
  id: CornerHandleId
  x: number
  y: number
  localX: number
  localY: number
}

export type TransformHandles = {
  corners: TransformCornerHandle[]
  rotation: {
    x: number
    y: number
    localX: number
    localY: number
  }
  topCenter: { x: number; y: number }
}

export function transformVector(transform: Transform2D, vx: number, vy: number) {
  const sx = vx * transform.scaleX
  const sy = vy * transform.scaleY
  const sin = Math.sin(transform.angle)
  const cos = Math.cos(transform.angle)
  return {
    x: sx * cos - sy * sin,
    y: sx * sin + sy * cos,
  }
}

export function transformPoint(transform: Transform2D, px: number, py: number) {
  const vec = transformVector(transform, px - transform.cx, py - transform.cy)
  return { x: transform.cx + vec.x, y: transform.cy + vec.y }
}

export function inverseTransformPoint(transform: Transform2D, px: number, py: number) {
  const dx = px - transform.cx
  const dy = py - transform.cy
  const sin = Math.sin(transform.angle)
  const cos = Math.cos(transform.angle)
  const rx = cos * dx + sin * dy
  const ry = -sin * dx + cos * dy
  const sx = rx / (transform.scaleX || 1e-6)
  const sy = ry / (transform.scaleY || 1e-6)
  return { x: transform.cx + sx, y: transform.cy + sy }
}

export function getTransformedCorners(transform: Transform2D, width: number, height: number) {
  const hw = width / 2
  const hh = height / 2
  const corners: TransformCornerHandle[] = [
    { id: 'top-left', localX: -hw, localY: -hh, x: 0, y: 0 },
    { id: 'top-right', localX: hw, localY: -hh, x: 0, y: 0 },
    { id: 'bottom-right', localX: hw, localY: hh, x: 0, y: 0 },
    { id: 'bottom-left', localX: -hw, localY: hh, x: 0, y: 0 },
  ]
  for (const corner of corners) {
    const vec = transformVector(transform, corner.localX, corner.localY)
    corner.x = transform.cx + vec.x
    corner.y = transform.cy + vec.y
  }
  return corners
}

export function computeTransformHandles(
  transform: Transform2D,
  width: number,
  height: number,
  rotationOffset = 0,
): TransformHandles {
  const corners = getTransformedCorners(transform, width, height)
  const topCenterLocalY = -height / 2
  const topCenterVec = transformVector(transform, 0, topCenterLocalY)
  const topCenter = { x: transform.cx + topCenterVec.x, y: transform.cy + topCenterVec.y }
  const rotationLocalY = topCenterLocalY - rotationOffset
  const rotationVec = transformVector(transform, 0, rotationLocalY)
  const rotation = {
    x: transform.cx + rotationVec.x,
    y: transform.cy + rotationVec.y,
    localX: 0,
    localY: rotationLocalY,
  }
  return { corners, rotation, topCenter }
}

export function pointInTransformedRect(
  transform: Transform2D,
  width: number,
  height: number,
  px: number,
  py: number,
) {
  const local = inverseTransformPoint(transform, px, py)
  const left = transform.cx - width / 2
  const top = transform.cy - height / 2
  return local.x >= left && local.x <= left + width && local.y >= top && local.y <= top + height
}

export function transformedPatchBounds(transform: Transform2D, width: number, height: number) {
  const corners = getTransformedCorners(transform, width, height)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const corner of corners) {
    if (corner.x < minX) minX = corner.x
    if (corner.x > maxX) maxX = corner.x
    if (corner.y < minY) minY = corner.y
    if (corner.y > maxY) maxY = corner.y
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }
  const left = Math.floor(minX)
  const top = Math.floor(minY)
  const right = Math.ceil(maxX)
  const bottom = Math.ceil(maxY)
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

export function sampleTransformedPatch(
  transform: Transform2D,
  width: number,
  height: number,
  rgba: Uint32Array,
  indices: Uint8Array | undefined,
  transparentIndex: number,
) {
  const bounds = transformedPatchBounds(transform, width, height)
  const { left, top } = bounds
  const outW = bounds.width
  const outH = bounds.height
  const pixelCount = outW * outH
  const outRGBA = new Uint32Array(pixelCount)
  let outIdx: Uint8Array | undefined
  if (indices) {
    outIdx = new Uint8Array(pixelCount)
    outIdx.fill(transparentIndex & 0xff)
  }
  if (pixelCount > 0) {
    const srcLeft = transform.cx - width / 2
    const srcTop = transform.cy - height / 2
    for (let y = 0; y < outH; y++) {
      const py = top + y + 0.5
      for (let x = 0; x < outW; x++) {
        const px = left + x + 0.5
        const srcPoint = inverseTransformPoint(transform, px, py)
        const localX = srcPoint.x - srcLeft
        const localY = srcPoint.y - srcTop
        if (localX < 0 || localY < 0 || localX >= width || localY >= height) continue
        const sx = Math.floor(localX)
        const sy = Math.floor(localY)
        const srcIndex = sy * width + sx
        const value = rgba[srcIndex] >>> 0
        if ((value & 0xff) === 0) continue
        const di = y * outW + x
        outRGBA[di] = value
        if (outIdx && indices) {
          outIdx[di] = indices[srcIndex] & 0xff
        }
      }
    }
  }
  return { left, top, width: outW, height: outH, rgba: outRGBA, indices: outIdx }
}
