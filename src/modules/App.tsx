import { PixelCanvas } from './PixelCanvas'
import { TopBar } from './TopBar'
import { FloatingControls } from './FloatingControls.tsx'
import { StatusBar } from './StatusBar'

export function App() {
  return (
    <div className="w-dvw h-dvh flex flex-col items-stretch overflow-hidden text-gray-800 dark:text-gray-100">
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-300">
        <TopBar />
      </div>
      <div className="grow min-h-0 bg-gray-200 dark:bg-gray-800">
        <PixelCanvas />
  <FloatingControls />
      </div>
      <div className="bg-gray-50 dark:bg-gray-800">
        <StatusBar />
      </div>
    </div>
  )
}
