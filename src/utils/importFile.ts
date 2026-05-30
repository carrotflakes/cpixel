import { useLogStore } from '@/stores/logStore'
import { useAppStore } from '@/stores/store'

export function isImportableImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)
}

export function firstImportableImageFile(files: FileList | File[]) {
  return Array.from(files).find(isImportableImageFile)
}

export async function importImageFile(file: File) {
  const imageData = await readImageFile(file)
  useAppStore.getState().importPNGFromImageData(imageData, { name: file.name, source: { type: 'local' } })
  useLogStore.getState().pushLog({ message: `Imported image: ${file.name}` })
}

function readImageFile(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      try {
        const w = Math.max(1, img.naturalWidth | 0)
        const h = Math.max(1, img.naturalHeight | 0)
        const cvs = document.createElement('canvas')
        cvs.width = w
        cvs.height = h
        const ctx = cvs.getContext('2d')
        if (!ctx) throw new Error('Canvas 2D context is unavailable')

        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, w, h))
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(url)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
