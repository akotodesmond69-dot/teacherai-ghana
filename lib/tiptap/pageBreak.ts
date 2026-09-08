// Purpose: Tiptap has no built-in "page break" node (that's a print/paged-
// media concept, not a rich-text one). This adds a small block node that:
// - Renders on-screen as a clearly-labelled dashed divider (so a teacher
//   editing the document can see exactly where it is), and
// - Forces an actual page break in print/PDF output (via `break-after` in
//   the print stylesheet) and in the exported Word document (converted to
//   a real page break in lib/word/generateDocxFromTiptap.ts).
// Folder: lib/tiptap/pageBreak.ts
// Depends on: @tiptap/core

import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType
    }
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true, // a single, indivisible unit — can't place a cursor "inside" it

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': 'true',
        class: 'exam-doc-page-break',
      }),
      'Page break',
    ]
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name }).run()
        },
    }
  },
})

// Testing steps:
// 1. Click "Insert page break" in the Word Processor toolbar. Expected: a
//    dashed "Page break" divider appears at the cursor, editable content
//    can be placed before and after it.
// 2. Click "Print / Save as PDF." Expected: content after the divider
//    starts on a new physical page.
// 3. Click "Download as Word." Expected: the exported .docx also starts a
//    new page at that point (a real Word page break, not just visual
//    spacing).
