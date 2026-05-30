import { PixelCanvas } from "@/components/PixelCanvas/PixelCanvas";
import { TopBar } from "@/components/TopBar/index";
import { StatusBar } from "@/components/StatusBar";
import { PalettePanel } from "@/components/PalettePanel";
import { LayersPanel } from "@/components/LayersPanel";
import { useLogStore } from "@/stores/logStore";
import { useAppStore } from "@/stores/store";
import { firstImportableImageFile, importImageFile } from "@/utils/importFile";
import type { DragEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export function App() {
  const imageDrop = useImageDropImport();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useAppStore.getState().dirty) e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <div
      className="relative w-dvw h-dvh flex flex-col items-stretch overflow-hidden text-content bg-base"
      onDragEnter={imageDrop.handleDragEnter}
      onDragOver={imageDrop.handleDragOver}
      onDragLeave={imageDrop.handleDragLeave}
      onDrop={imageDrop.handleDrop}
    >
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
      {imageDrop.draggingImage && (
        <div className="pointer-events-none fixed inset-0 z-[1200] flex items-center justify-center bg-accent/10">
          <div className="rounded-md border border-accent bg-surface/90 px-4 py-3 text-sm font-medium text-content shadow">
            Drop image to import
          </div>
        </div>
      )}
    </div>
  );
}

function useImageDropImport() {
  const [draggingImage, setDraggingImage] = useState(false);
  const dragDepthRef = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDraggingImage(true);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDraggingImage(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setDraggingImage(false);

    const file = firstImportableImageFile(e.dataTransfer.files);
    if (!file) {
      useLogStore
        .getState()
        .pushLog({ message: "Drop an image file to import" });
      return;
    }

    try {
      await importImageFile(file);
    } catch (error) {
      console.error("Import dropped image failed", error);
      useLogStore.getState().pushLog({ message: "Failed to import image" });
    }
  }, []);

  return {
    draggingImage,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

function isFileDrag(e: DragEvent) {
  return Array.from(e.dataTransfer.types).includes("Files");
}
