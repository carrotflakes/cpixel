export type Layer = {
  id: string
  visible: boolean
  locked: boolean
  data: Uint32Array | Uint8Array
}

export type ToolType = 'brush' | 'bucket' | 'line' | 'rect' | 'ellipse' | 'eraser' | 'eyedropper' | 'select-rect' | 'select-lasso' | 'select-wand' | 'move' | 'pan'
export type EyedropperSampleMode = 'composite' | 'front'

export type Palette = {
  colors: Uint32Array
  transparentIndex: number
}
