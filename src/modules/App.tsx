import { PixelCanvas } from "./PixelCanvas";
import { TopBar } from "./TopBar";
import { FloatingControls } from "./FloatingControls.tsx";
import { StatusBar } from "./StatusBar";
import { PalettePanel } from "./PalettePanel";
import { LayersPanel } from "./LayersPanel";

export function App() {
  return (
    <div className="w-dvw h-dvh flex flex-col items-stretch overflow-hidden text-content bg-base">
      <div className="bg-surface border-b border-border">
        <TopBar />
      </div>
      <div className="grow min-h-0 bg-surface-muted">
        <PixelCanvas />
        <LayersPanel />
      </div>
      <div className="absolute bottom-0 left-0 right-0">
        <FloatingControls />
        <PalettePanel />
        <StatusBar />
      </div>
    </div>
  );
}
