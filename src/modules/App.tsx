import { PixelCanvas } from "./PixelCanvas";
import { TopBar } from "./TopBar/index";
import { StatusBar } from "./StatusBar";
import { PalettePanel } from "./PalettePanel";
import { LayersPanel } from "./LayersPanel";
import { useAppStore } from "./store";
import { useEffect } from "react";

export function App() {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useAppStore.getState().dirty)
        e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="w-dvw h-dvh flex flex-col items-stretch overflow-hidden text-content bg-base">
      <div className="bg-surface border-b border-border">
        <TopBar />
      </div>
      <div className="grow relative min-h-0 bg-surface-muted">
        <PixelCanvas />
        <LayersPanel />
      </div>
      <div className="absolute bottom-0 left-0 right-0">
        <PalettePanel />
        <StatusBar />
      </div>
    </div>
  );
}
