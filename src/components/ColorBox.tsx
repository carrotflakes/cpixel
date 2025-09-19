export const COLOR_BOX_STYLE = {
  overflow: 'hidden',
  backgroundImage: 'linear-gradient(45deg, #0003 25%, transparent 25%), linear-gradient(-45deg, #0003 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0003 75%), linear-gradient(-45deg, transparent 75%, #0003 75%)',
  backgroundSize: '8px 8px', backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
} as const

export function ColorBox({ color, ...props }: { className?: string, color: string }) {
  return (
    <div
      {...props}
      style={COLOR_BOX_STYLE}
    >
      <ColorBoxInner color={color} />
    </div>
  )
}

export function ColorBoxInner({ color }: { color: string }) {
  return (
    <div className="w-full h-full" style={{ background: color }} />
  )
}
