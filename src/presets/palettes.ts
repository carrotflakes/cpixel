// Built-in palette presets for indexed mode
// Colors are encoded as 0xRRGGBBAA (alpha last), matching store representation.

import { WPLACE_COLORS } from "./wplace"

export type PalettePreset = {
  id: string
  name: string
  colors: Uint32Array
  transparentIndex?: number
}

function packRGB(rgb: number): number {
  // rgb as 0xRRGGBB -> 0xRRGGBBAA with AA=0xff
  const r = (rgb >>> 16) & 0xff
  const g = (rgb >>> 8) & 0xff
  const b = (rgb >>> 0) & 0xff
  return (r << 24) | (g << 16) | (b << 8) | 0xff
}

// Basic 16 (with slot 0 transparent)
const BASIC16 = new Uint32Array([
  0x00000000,
  0xffffffff, // white
  0x000000ff, // black
  0xff0000ff, // red
  0x00ff00ff, // green
  0x0000ffff, // blue
  0x00ffffff, // cyan
  0xff00ffff, // magenta
  0xffff00ff, // yellow
  0x7f7f7fff, // gray
  0x3f3f3fff, // dark gray
  0xff7f7fff, // light red
  0x7fff7fff, // light green
  0x7f7fffff, // light blue
  0xffff7fff, // light yellow
  0xff7fffff, // light magenta
])

// PICO-8 palette (16 colors)
const PICO8_COLORS_RGB = [
  0x000000, 0x1D2B53, 0x7E2553, 0x008751, 0xAB5236, 0x5F574F, 0xC2C3C7, 0xFFF1E8,
  0xFF004D, 0xFFA300, 0xFFEC27, 0x00E436, 0x29ADFF, 0x83769C, 0xFF77A8, 0xFFCCAA,
]
const PICO8 = new Uint32Array(PICO8_COLORS_RGB.map(packRGB))

// Game Boy (DMG) 4-color palette
const GB_DMG = new Uint32Array([
  0x00000000,
  packRGB(0x214231), // darkest
  packRGB(0x426b29),
  packRGB(0x6c9421),
  packRGB(0x8cad28), // lightest
])

export const PALETTE_PRESETS: PalettePreset[] = [
  { id: 'basic16', name: 'Basic 16 + Transparent', colors: BASIC16, transparentIndex: 0 },
  { id: 'pico8', name: 'PICO-8 (16)', colors: PICO8, transparentIndex: 0 },
  { id: 'gb-dmg', name: 'Game Boy (DMG, 4)', colors: GB_DMG, transparentIndex: 0 },
  {
    id: 'wplace-free', name: 'wplace (Free)', colors: new Uint32Array([
      0x00000000,
      ...WPLACE_COLORS.filter(c => !c.locked).map(c => packRGB(c.code))
    ]), transparentIndex: 0
  },
  {
    id: 'wplace', name: 'wplace', colors: new Uint32Array([
      0x00000000,
      ...WPLACE_COLORS.map(c => packRGB(c.code))
    ]), transparentIndex: 0
  },
]
