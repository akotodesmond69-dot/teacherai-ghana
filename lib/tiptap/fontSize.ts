// Purpose: Tiptap (the free, open-source rich-text engine behind the Word
// Processor — see components/document-editor/DocumentEditor.tsx) ships a
// font-FAMILY extension but no font-SIZE extension out of the box. This
// adds one, following the same pattern Tiptap's own FontFamily extension
// uses: extend the shared `textStyle` mark with a new inline CSS property
// via a chained command, rather than inventing a whole new mark.
// Folder: lib/tiptap/fontSize.ts
// Depends on: @tiptap/extension-text-style (must be loaded before this in
// the editor's extensions array — see DocumentEditor.tsx)

import { Extension } from '@tiptap/core'

export interface FontSizeOptions {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: size }).run()
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
        },
    }
  },
})

// Testing steps:
// 1. In the Word Processor, select some text, choose "14pt" from the font
//    size dropdown. Expected: the selected text visibly grows, and a new
//    document loads with the default 12pt applied everywhere it wasn't
//    explicitly overridden.
// 2. Save, reload the exam's Word Processor page. Expected: the 14pt text
//    is still 14pt — confirms the attribute round-trips through
//    document_json correctly.
