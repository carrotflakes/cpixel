// Aseprite decoder (first frame) – robust version adapted from reference test implementation.
// Keeps indexed mode when 8-bit; exposes aseToCpixel for integration with store.

import { inflate } from 'pako'

// LE helpers
function u16(d: DataView, o: number) { return d.getUint16(o, true) }
function i16(d: DataView, o: number) { return d.getInt16(o, true) }
function u32(d: DataView, o: number) { return d.getUint32(o, true) }

// Chunk constants
const CHUNK_OLD_PALETTE = 0x0004
const CHUNK_LAYER = 0x2004
const CHUNK_CEL = 0x2005
const CHUNK_COLOR_PROFILE = 0x2007
const CHUNK_PALETTE = 0x2019

export interface AseImportLayer { id: string; name: string; visible: boolean; blendMode: number; opacity: number; pixels?: Uint32Array; indices?: Uint8Array }
export interface AseImportResult { width: number; height: number; colorDepth: number; layers: AseImportLayer[]; palette?: Uint32Array; transparentIndex?: number; frames: number }

interface LayerInfo { name: string; flags: number; type: number; child: number; blend: number; opacity: number; id: number; visible: boolean }
interface CelInfo { layerIndex: number; x: number; y: number; opacity: number; type: number; w: number; h: number; raw: Uint8Array }

function packRGBA(r: number, g: number, b: number, a: number) { return ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff) }
function inflateData(data: Uint8Array): Uint8Array | null { try { return inflate(data) } catch { return null } }

export async function decodeAseprite(buf: ArrayBuffer, opts?: { preserveIndexed?: boolean }): Promise<AseImportResult | null> {
  if (buf.byteLength < 128) return null
  const dv = new DataView(buf)
  u32(dv, 0)
  if (u16(dv, 4) !== 0xA5E0) return null
  const frames = u16(dv, 6) || 1
  const width = u16(dv, 8), height = u16(dv, 10)
  const depth = u16(dv, 12)
  u32(dv, 14); u16(dv, 20)
  const transparentIndex = dv.getUint8(26)

  let off = 128
  const layers: LayerInfo[] = []
  const paletteRaw: number[] = []
  const celMap = new Map<number, CelInfo>()

  for (let f = 0; f < frames; f++) {
    if (off + 16 > buf.byteLength) break
    const frameStart = off
    const frameBytes = u32(dv, off); off += 4
    if (u16(dv, off) !== 0xF1FA) return null; off += 2
    const chunkCountOld = u16(dv, off); off += 2
    u16(dv, off); off += 2; off += 2
    const chunkCountNew = u32(dv, off); off += 4
    const chunkCount = chunkCountNew || chunkCountOld
    const frameEnd = frameStart + frameBytes
    for (let ci = 0; ci < chunkCount && off < frameEnd; ci++) {
      if (off + 6 > buf.byteLength) break
      const chunkSize = u32(dv, off); off += 4
      const type = u16(dv, off); off += 2
      const start = off
      const dataEnd = start + chunkSize - 6
      switch (type) {
        case CHUNK_LAYER: {
          const flags = u16(dv, off); off += 2
          const lt = u16(dv, off); off += 2
          const child = u16(dv, off); off += 2
          u16(dv, off); off += 2; u16(dv, off); off += 2
          const blend = u16(dv, off); off += 2
          const opacity = dv.getUint8(off); off += 1
          off += 3
          let nameLen = u16(dv, off); off += 2
          const remain = dataEnd - off
          if (nameLen > remain) nameLen = Math.max(0, remain)
          let name = ''
          for (let i = 0; i < nameLen; i++) name += String.fromCharCode(dv.getUint8(off + i))
          off += nameLen
          layers.push({ name, flags, type: lt, child, blend, opacity, id: layers.length, visible: (flags & 1) !== 0 })
          break
        }
        case CHUNK_CEL: {
          const layerIndex = u16(dv, off); off += 2
          const x = i16(dv, off); off += 2
          const y = i16(dv, off); off += 2
          const op = dv.getUint8(off); off += 1
          const celType = u16(dv, off); off += 2
          off += 7
          if (celType === 0) {
            const w = u16(dv, off); off += 2
            const h = u16(dv, off); off += 2
            const bpp = depth === 32 ? 4 : 1
            const need = w * h * bpp
            const avail = Math.min(need, Math.max(0, dataEnd - off))
            const raw = new Uint8Array(buf, off, avail); off += avail
            if (f === 0) celMap.set(layerIndex, { layerIndex, x, y, opacity: op, type: celType, w, h, raw })
          } else if (celType === 1) {
            off += 2
          } else if (celType === 2) {
            const w = u16(dv, off); off += 2
            const h = u16(dv, off); off += 2
            const comp = new Uint8Array(buf, off, Math.max(0, dataEnd - off))
            off = dataEnd
            const raw = inflateData(comp)
            const expected = w * h * (depth === 32 ? 4 : 1)
            if (raw && raw.length === expected && f === 0) celMap.set(layerIndex, { layerIndex, x, y, opacity: op, type: celType, w, h, raw })
          } else {
            off = dataEnd
          }
          off = dataEnd
          break
        }
        case CHUNK_PALETTE: {
          off += 4; const first = u32(dv, off); off += 4; const last = u32(dv, off); off += 4; const count = last - first + 1; off += 8
          for (let i = 0; i < count; i++) {
            const hasName = u16(dv, off); off += 2
            const r = dv.getUint8(off), g = dv.getUint8(off + 1), b = dv.getUint8(off + 2), a = dv.getUint8(off + 3); off += 4
            if (hasName) { const nl = u16(dv, off); off += 2; off += nl }
            paletteRaw[first + i] = packRGBA(r, g, b, a)
          }
          break
        }
        case CHUNK_OLD_PALETTE: {
          if (off + 2 <= dataEnd) {
            const packets = u16(dv, off); off += 2
            let idx = 0
            for (let p = 0; p < packets && off < dataEnd && idx < 256; p++) {
              if (off + 2 > dataEnd) break
              const skip = dv.getUint8(off); off += 1
              const countM1 = dv.getUint8(off); off += 1
              idx += skip
              const count = countM1 + 1
              for (let c = 0; c < count && idx < 256 && off + 3 <= dataEnd; c++) {
                const r = dv.getUint8(off), g = dv.getUint8(off + 1), b = dv.getUint8(off + 2); off += 3
                paletteRaw[idx++] = packRGBA(r, g, b, 0xff)
              }
            }
          }
          off = dataEnd
          break
        }
        case CHUNK_COLOR_PROFILE: {
          off = dataEnd
          break
        }
        default: {
          off = dataEnd
        }
      }
    }
  }

  const preserve = opts?.preserveIndexed !== false
  const outLayers: AseImportLayer[] = []
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i]
    const cel = celMap.get(i)
    if (!cel) { outLayers.push({ id: 'L' + (i + 1), name: L.name, visible: L.visible, blendMode: L.blend, opacity: L.opacity, pixels: depth === 32 ? new Uint32Array(width * height) : undefined, indices: depth === 8 ? new Uint8Array(width * height) : undefined }); continue }
    if (depth === 32) {
      const pixels = new Uint32Array(width * height)
      let si = 0
      for (let y = 0; y < cel.h; y++) for (let x = 0; x < cel.w; x++) {
        const r = cel.raw[si++], g = cel.raw[si++], b = cel.raw[si++], a = cel.raw[si++]; const X = cel.x + x, Y = cel.y + y
        if (X < 0 || Y < 0 || X >= width || Y >= height) continue
        pixels[Y * width + X] = packRGBA(r, g, b, a)
      }
      outLayers.push({ id: 'L' + (i + 1), name: L.name, visible: L.visible, blendMode: L.blend, opacity: L.opacity, pixels })
    } else { // 8-bit
      if (preserve) {
        const idxs = new Uint8Array(width * height)
        for (let y = 0; y < cel.h; y++) for (let x = 0; x < cel.w; x++) {
          const idx = cel.raw[y * cel.w + x] & 0xff; const X = cel.x + x, Y = cel.y + y
          if (X < 0 || Y < 0 || X >= width || Y >= height) continue
          idxs[Y * width + X] = idx
        }
        outLayers.push({ id: 'L' + (i + 1), name: L.name, visible: L.visible, blendMode: L.blend, opacity: L.opacity, indices: idxs })
      } else {
        const tmp = new Uint32Array(width * height)
        for (let y = 0; y < cel.h; y++) for (let x = 0; x < cel.w; x++) {
          const idx = cel.raw[y * cel.w + x] & 0xff; const X = cel.x + x, Y = cel.y + y
          if (X < 0 || Y < 0 || X >= width || Y >= height) continue
          tmp[Y * width + X] = idx
        }
        outLayers.push({ id: 'L' + (i + 1), name: L.name, visible: L.visible, blendMode: L.blend, opacity: L.opacity, pixels: tmp })
      }
    }
  }

  // Palette finalize
  let palette: Uint32Array | undefined
  if (paletteRaw.length > 0) { palette = new Uint32Array(Math.min(256, paletteRaw.length)); for (let i = 0; i < palette.length; i++) palette[i] = paletteRaw[i] >>> 0 }
  if (depth === 8) {
    if (!palette) { palette = new Uint32Array(256); for (let i = 0; i < 256; i++) palette[i] = packRGBA(i, i, i, 0xff) }
    if (transparentIndex < (palette?.length ?? 0)) palette![transparentIndex] = palette![transparentIndex] & 0xffffff00
    if (!preserve) for (const L of outLayers) if (L.pixels) { const p = L.pixels; for (let i = 0; i < p.length; i++) p[i] = palette![p[i] & 0xff] ?? 0 }
  }

  return { width, height, colorDepth: depth, layers: outLayers, palette, transparentIndex: depth === 8 ? (transparentIndex & 0xff) : undefined, frames }
}

export function aseToCpixel(imported: AseImportResult) {
  if (imported.colorDepth === 8 && imported.layers.some(l => l.indices)) {
    return { width: imported.width, height: imported.height, mode: 'indexed' as const, layers: imported.layers.map(l => ({ id: l.id, visible: l.visible, locked: false, indices: l.indices ?? new Uint8Array(imported.width * imported.height) })), palette: imported.palette ?? new Uint32Array([0x00000000]), transparentIndex: imported.transparentIndex ?? 0 }
  }
  return { width: imported.width, height: imported.height, mode: 'truecolor' as const, layers: imported.layers.map(l => ({ id: l.id, visible: l.visible, locked: false, data: l.pixels ?? new Uint32Array(imported.width * imported.height) })) }
}

// ------------------------- Encoding (export) ---------------------------------

type CpixelLikeState = Readonly<{
  width: number; height: number; mode: 'indexed' | 'truecolor';
  layers: ReadonlyArray<{ id: string; visible: boolean; data?: Uint32Array; indices?: Uint8Array }>
  palette: Uint32Array; transparentIndex: number;
}>

function writeU16(buf: Uint8Array, off: number, v: number) { buf[off] = v & 0xff; buf[off + 1] = (v >>> 8) & 0xff }
function writeU32(buf: Uint8Array, off: number, v: number) { buf[off] = v & 0xff; buf[off + 1] = (v >>> 8) & 0xff; buf[off + 2] = (v >>> 16) & 0xff; buf[off + 3] = (v >>> 24) & 0xff }

export function encodeAseprite(state: CpixelLikeState): ArrayBuffer {
  const { width, height, mode, layers, palette, transparentIndex } = state
  const colorDepth = mode === 'indexed' ? 8 : 32
  const layerCount = layers.length
  const includePalette = mode === 'indexed'
  const chunkCount = layerCount /* layer chunks */ + layerCount /* cel chunks */ + (includePalette ? 1 : 0)

  // Prebuild chunks into temporary arrays
  const chunks: Uint8Array[] = []

  // Palette chunk
  if (includePalette) {
    const first = 0
    const last = palette.length - 1
    const count = last - first + 1
    // Each entry: 2 + 4 bytes (flags + rgba) = 6 bytes (no names)
    const entriesBytes = count * 6
    const payloadSize = 4 + 4 + 4 + 8 + entriesBytes // size + first + last + reserved + entries
    const size = payloadSize + 6
    const arr = new Uint8Array(size)
    let o = 0
    writeU32(arr, o, size); o += 4
    writeU16(arr, o, 0x2019); o += 2
    writeU32(arr, o, palette.length); o += 4 // palette size
    writeU32(arr, o, first); o += 4
    writeU32(arr, o, last); o += 4
    o += 8 // reserved
    for (let i = first; i <= last; i++) {
      writeU16(arr, o, 0); o += 2 // flags
      const rgba = palette[i] >>> 0
      // Stored as RGBA; importer expects same (we packed that way). Ensure transparent alpha 0.
      const r = (rgba >>> 24) & 0xff
      const g = (rgba >>> 16) & 0xff
      const b = (rgba >>> 8) & 0xff
      const a = (i === transparentIndex) ? 0 : (rgba & 0xff)
      arr[o++] = r; arr[o++] = g; arr[o++] = b; arr[o++] = a
    }
    chunks.push(arr)
  }

  // Layer + Cel chunks (pair per layer in order)
  layers.forEach((layer, li) => {
    // LAYER chunk 0x2004
    const nameBytes = new TextEncoder().encode(layer.id)
    const payloadLen = 2 + 2 + 2 + 2 + 2 + 2 + 1 + 3 + 2 + nameBytes.length
    const size = payloadLen + 6
    const arr = new Uint8Array(size)
    let o = 0
    writeU32(arr, o, size); o += 4
    writeU16(arr, o, 0x2004); o += 2
    const flags = layer.visible ? 1 : 0
    writeU16(arr, o, flags); o += 2
    writeU16(arr, o, 0); o += 2 // layer type
    writeU16(arr, o, 0); o += 2 // child level
    writeU16(arr, o, 0); o += 2 // default width
    writeU16(arr, o, 0); o += 2 // default height
    writeU16(arr, o, 0); o += 2 // blend mode normal
    arr[o++] = 255 // opacity
    o += 3 // reserved
    writeU16(arr, o, nameBytes.length); o += 2
    arr.set(nameBytes, o); o += nameBytes.length
    chunks.push(arr)

    // CEL chunk 0x2005 (raw)
    const pixelsW = width
    const pixelsH = height
    let pixelData: Uint8Array
    if (mode === 'indexed') {
      const src = layer.indices ?? new Uint8Array(width * height)
      pixelData = src // already 1 byte per pixel
    } else {
      const src = layer.data ?? new Uint32Array(width * height)
      pixelData = new Uint8Array(width * height * 4)
      // Aseprite 32bpp raw stores RGBA bytes in order (decoder earlier assumed r,g,b,a)
      for (let i = 0, p = 0; i < src.length; i++) {
        const rgba = src[i] >>> 0
        pixelData[p++] = (rgba >>> 24) & 0xff // R
        pixelData[p++] = (rgba >>> 16) & 0xff // G
        pixelData[p++] = (rgba >>> 8) & 0xff  // B
        pixelData[p++] = rgba & 0xff          // A
      }
    }
    const celPayload = 2 + 2 + 2 + 1 + 2 + 7 + 2 + 2 + pixelData.length
    const celSize = celPayload + 6
    const celArr = new Uint8Array(celSize)
    o = 0
    writeU32(celArr, o, celSize); o += 4
    writeU16(celArr, o, 0x2005); o += 2
    writeU16(celArr, o, li); o += 2 // layer index referencing previous LAYER order
    writeU16(celArr, o, 0); o += 2 // x
    writeU16(celArr, o, 0); o += 2 // y
    celArr[o++] = 255 // opacity
    writeU16(celArr, o, 0); o += 2 // raw cel
    o += 7 // future
    writeU16(celArr, o, pixelsW); o += 2
    writeU16(celArr, o, pixelsH); o += 2
    celArr.set(pixelData, o); o += pixelData.length
    chunks.push(celArr)
  })

  // Frame header (single frame)
  const frameHeaderSize = 16 // old header (no extended chunk count)
  const frameChunksBytes = chunks.reduce((a, c) => a + c.length, 0)
  const frameBytes = frameHeaderSize + frameChunksBytes

  // File size = header(128) + frameBytes
  const fileSize = 128 + frameBytes
  const out = new Uint8Array(fileSize)
  let o = 0
  // File header (128 bytes total)
  writeU32(out, o, fileSize); o += 4               // size
  writeU16(out, o, 0xA5E0); o += 2                 // magic
  writeU16(out, o, 1); o += 2                      // frames
  writeU16(out, o, width); o += 2
  writeU16(out, o, height); o += 2
  writeU16(out, o, colorDepth); o += 2
  writeU32(out, o, 0); o += 4                      // flags
  writeU16(out, o, 1); o += 2                      // speed (deprecated)
  writeU32(out, o, 0); o += 4                      // reserved
  writeU32(out, o, 0); o += 4                      // reserved
  out[o++] = (mode === 'indexed') ? (transparentIndex & 0xff) : 0 // transparent palette index
  o += 3                                           // ignore
  writeU16(out, o, (mode === 'indexed') ? palette.length : 256); o += 2 // number of colors (old field)
  out[o++] = 1; out[o++] = 1                      // pixel ratio w/h
  writeU16(out, o, 0); o += 2                     // grid x
  writeU16(out, o, 0); o += 2                     // grid y
  writeU16(out, o, 0); o += 2                     // grid w
  writeU16(out, o, 0); o += 2                     // grid h
  // reserved padding to 128 bytes
  while (o < 128) out[o++] = 0

  // Frame header (always 16 bytes as decoder expects extended field present)
  const oldCount = chunkCount < 0xFFFF ? chunkCount : 0xFFFF
  const newCount = oldCount === 0xFFFF ? chunkCount : 0
  writeU32(out, o, frameBytes); o += 4
  writeU16(out, o, 0xF1FA); o += 2
  writeU16(out, o, oldCount); o += 2
  writeU16(out, o, 1); o += 2                      // frame duration
  writeU16(out, o, 0); o += 2                      // reserved
  writeU32(out, o, newCount); o += 4               // new chunk count or 0

  // Append chunks
  for (const c of chunks) { out.set(c, o); o += c.length }

  return out.buffer
}
