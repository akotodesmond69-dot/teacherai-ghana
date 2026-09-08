// Purpose: The base @tiptap/extension-image node has no size attributes —
// every inserted image renders at its natural pixel size, which is wrong
// for a print-ready exam (a phone-camera diagram can be enormous). This
// extends it with a `width` attribute a teacher can change via the
// toolbar's image-size buttons, without needing a paid/hosted image editor.
// Folder: lib/tiptap/imageWithSize.ts
// Depends on: @tiptap/extension-image

import TiptapImage from '@tiptap/extension-image'

export const ImageWithSize = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.style.width || element.getAttribute('width'),
        renderHTML: (attributes) => {
          if (!attributes.width) return {}
          return { style: `width: ${attributes.width}; height: auto;` }
        },
      },
    }
  },
})

// Preset widths offered by the toolbar's image-size control — percentages
// so an image scales sensibly whether the page is viewed on a phone,
// laptop, or the print stylesheet's fixed A4 width.
export const IMAGE_SIZE_PRESETS: { label: string; value: string }[] = [
  { label: 'Small', value: '25%' },
  { label: 'Medium', value: '50%' },
  { label: 'Large', value: '75%' },
  { label: 'Full width', value: '100%' },
]

// Testing steps:
// 1. Insert an image, then select it and choose "Small" from the image
//    size control. Expected: it shrinks to 25% of the content width
//    in-place, aspect ratio preserved (height: auto).
// 2. Save, reload the Word Processor. Expected: the size persists.
// 3. Download as Word — expected: the exported image is sized
//    proportionally to the chosen preset, not full original resolution.
