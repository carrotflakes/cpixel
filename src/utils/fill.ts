// Flood fill utilities for truecolor and indexed modes
// Immutable: return new arrays based on input buffers

export function floodFillTruecolor(
  src: Uint32Array,
  w: number,
  h: number,
  x: number,
  y: number,
  replacement: number,
  contiguous: boolean,
  mask?: Uint8Array,
): Uint32Array {
  const out = new Uint32Array(src)
  const i0 = y * w + x
  if (mask && !mask[i0]) return out // start outside selection: no-op
  const target = (src[i0] >>> 0)
  const repl = (replacement >>> 0)
  if (target === repl) return out
  if (!contiguous) {
    for (let i = 0; i < out.length; i++) if ((!mask || mask[i]) && (out[i] >>> 0) === target) out[i] = repl
    return out
  }
  const stack: number[] = [x, y]
  while (stack.length) {
    const cy = stack.pop() as number
    const cx = stack.pop() as number
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue
    const i = cy * w + cx
    if (mask && !mask[i]) continue
    if ((out[i] >>> 0) !== target) continue
    out[i] = repl
    stack.push(cx + 1, cy)
    stack.push(cx - 1, cy)
    stack.push(cx, cy + 1)
    stack.push(cx, cy - 1)
  }
  return out
}

export function floodFillIndexed(
  src: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
  replacementIdx: number,
  contiguous: boolean,
  transparentIndex: number,
  mask?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(src)
  const i0 = y * w + x
  if (mask && !mask[i0]) return out // start outside selection: no-op
  const targetIdx = (src[i0] ?? transparentIndex) & 0xff
  const repl = replacementIdx & 0xff
  if (targetIdx === repl) return out
  if (!contiguous) {
    for (let i = 0; i < out.length; i++) if ((!mask || mask[i]) && (out[i] ?? transparentIndex) === targetIdx) out[i] = repl
    return out
  }
  const stack: number[] = [x, y]
  while (stack.length) {
    const cy = stack.pop() as number
    const cx = stack.pop() as number
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue
    const i = cy * w + cx
    if (mask && !mask[i]) continue
    if (((out[i] ?? transparentIndex) & 0xff) !== targetIdx) continue
    out[i] = repl
    stack.push(cx + 1, cy)
    stack.push(cx - 1, cy)
    stack.push(cx, cy + 1)
    stack.push(cx, cy - 1)
  }
  return out
}
