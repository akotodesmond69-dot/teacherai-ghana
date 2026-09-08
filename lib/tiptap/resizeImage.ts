// Purpose: Before an inserted picture is embedded into the exam document
// (as a base64 data URL — see DocumentEditor.tsx's "Insert image" button),
// shrink it down via an in-browser <canvas>. This keeps the feature truly
// free and serverless (no image-hosting service, no upload API, no cost)
// while stopping a single unedited phone photo (often 3-8MB) from bloating
// exams.document_json — a jsonb column, not built to store multi-megabyte
// blobs efficiently.
// Folder: lib/tiptap/resizeImage.ts
'use client'

const MAX_DIMENSION = 900 // px — plenty sharp for a printed exam diagram,
                           // far smaller than a raw phone photo
const JPEG_QUALITY = 0.82

export interface ResizedImage {
  dataUrl: string
  width: number
  height: number
}

export function resizeImageFile(file: File): Promise<ResizedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode the image file.'))
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas is not supported in this browser.'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)

        // PNGs with transparency (e.g. a school crest) are kept lossless;
        // photos are re-encoded as JPEG for real size savings.
        const isPng = file.type === 'image/png'
        const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', JPEG_QUALITY)
        resolve({ dataUrl, width, height })
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

// Testing steps:
// 1. Insert a large phone photo (several MB) via the Word Processor's
//    "Insert image" button. Expected: it appears in the document almost
//    instantly, at a reasonable on-screen size, and the browser's
//    dev-tools show the resulting data URL is well under 1MB.
// 2. Insert a school logo PNG with a transparent background. Expected:
//    transparency is preserved (not replaced with a white/black box).
