import * as ContextMenu from '@radix-ui/react-context-menu'
import React from 'react'

// Thin styling wrapper around Radix primitives to match existing MenuItem look.
// This will be used incrementally to replace the bespoke ContextMenu implementation.

export const RCMenuTrigger = ContextMenu.Trigger

export function RCMenuRoot(props: React.ComponentProps<typeof ContextMenu.Root>) {
  const { children, ...rest } = props
  return <ContextMenu.Root modal={false} {...rest}>{children}</ContextMenu.Root>
}

export function RCMenuContent(props: React.ComponentProps<typeof ContextMenu.Content>) {
  const { className, ...rest } = props
  return (
    <ContextMenu.Portal>
      <ContextMenu.Content
        {...rest}
        className={
          'z-[1000] min-w-[160px] rounded-md border border-border bg-elevated shadow-lg p-1 text-sm ' +
          (className || '')
        }
      />
    </ContextMenu.Portal>
  )
}

export function RCMenuItem(props: React.ComponentProps<typeof ContextMenu.Item> & { danger?: boolean }) {
  const { className, danger, ...rest } = props
  return (
    <ContextMenu.Item
      {...rest}
      className={
        'px-3 py-2 select-none outline-none cursor-pointer rounded-sm flex items-center gap-2 ' +
        'focus:bg-surface-muted focus:outline-none data-[disabled]:opacity-50 data-[disabled]:cursor-default ' +
        (danger ? 'text-red-700 focus:bg-red-50/70 ' : '') +
        (className || '')
      }
    />
  )
}

export const RCMenuSeparator = (props: React.ComponentProps<typeof ContextMenu.Separator>) => (
  <ContextMenu.Separator {...props} className={'my-1 h-px bg-border ' + (props.className || '')} />
)

export const RCMenuSub = ContextMenu.Sub
export const RCMenuSubTrigger = (props: React.ComponentProps<typeof ContextMenu.SubTrigger>) => {
  const { className, ...rest } = props
  return (
    <ContextMenu.SubTrigger
      {...rest}
      className={
        'px-3 py-2 select-none outline-none cursor-pointer rounded-sm flex items-center gap-2 ' +
        'focus:bg-surface-muted data-[state=open]:bg-surface-muted ' +
        (className || '')
      }
    />
  )
}
export const RCMenuSubContent = (props: React.ComponentProps<typeof ContextMenu.SubContent>) => {
  const { className, ...rest } = props
  return (
    <ContextMenu.SubContent
      {...rest}
      className={'min-w-[160px] rounded-md border border-border bg-elevated shadow-lg p-1 text-sm ' + (className || '')}
    />
  )
}

// Convenience composite for external use mirroring old API (very limited)
export function SimpleRadixContextMenu(props: { trigger: React.ReactNode; children: React.ReactNode }) {
  const { trigger, children } = props
  return (
    <RCMenuRoot>
      <RCMenuTrigger asChild>{trigger}</RCMenuTrigger>
      <RCMenuContent>{children}</RCMenuContent>
    </RCMenuRoot>
  )
}
