import { ColorSection } from './ColorSection'
import { ToolSelector } from './ToolSelector'
import { MoreMenu } from './MoreMenu'

export function TopBar() {
  return (
    <div className="p-2 flex gap-4 items-center overflow-x-auto">
      <ColorSection />
      <ToolSelector />
      <MoreMenu />
    </div>
  )
}
