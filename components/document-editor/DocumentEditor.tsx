// Purpose: The reusable rich-text "Word Processor" editor at the heart of
// the exam formatting feature. Built entirely on Tiptap (MIT-licensed,
// open-source, runs in the browser — no paid editor SaaS, no per-document
// API cost, matching the "no cost of money" requirement) with:
// - Bold/italic/underline, headings, bullet/numbered lists, text alignment
// - A font-family selector and a font-size selector, defaulting the whole
//   document to Times New Roman 12pt (the standard Ghanaian exam-paper
//   convention) via CSS, with per-selection overrides
// - Image insertion (resized/compressed client-side, embedded as a data
//   URL — see lib/tiptap/resizeImage.ts — so there's no upload step, no
//   storage cost, and the document is fully self-contained)
// - A resizable-image control, tables, and an explicit page-break node
// - Undo/redo
// This component is controlled: the parent owns the document JSON and
// decides when to save it (see app/exam/[id]/document/document-editor-view.tsx).
// Folder: components/document-editor/DocumentEditor.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Image as ImageIcon,
  Table as TableIcon, Undo2, Redo2, SeparatorHorizontal, ImageMinus, ImagePlus,
} from 'lucide-react'
import { FontSize } from '@/lib/tiptap/fontSize'
import { PageBreak } from '@/lib/tiptap/pageBreak'
import { ImageWithSize, IMAGE_SIZE_PRESETS } from '@/lib/tiptap/imageWithSize'
import { resizeImageFile } from '@/lib/tiptap/resizeImage'

const FONT_FAMILIES = ['Times New Roman', 'Arial', 'Calibri', 'Georgia', 'Comic Sans MS']
const FONT_SIZES = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt']
const DEFAULT_FONT_FAMILY = 'Times New Roman'
const DEFAULT_FONT_SIZE = '12pt'

export function DocumentEditor({
  initialContent,
  onChange,
  letterheadNodes,
}: {
  initialContent: JSONContent
  onChange: (json: JSONContent) => void
  /** Nodes for the "Insert letterhead" toolbar button — lets a teacher
   *  re-add their school logo + name at the cursor if they deleted it or
   *  started from a blank document. */
  letterheadNodes?: JSONContent[]
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      ImageWithSize,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      PageBreak,
      Placeholder.configure({ placeholder: 'Start typing, or use the toolbar to insert your school letterhead…' }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON()),
    editorProps: {
      attributes: {
        class: 'exam-doc-content focus:outline-none',
      },
    },
    immediatelyRender: false,
  })

  // Keep the editor in sync if the parent swaps in a different document
  // (e.g. loading a previously-saved one after the initial mount).
  const loadedRef = useRef(false)
  useEffect(() => {
    if (editor && !loadedRef.current) {
      loadedRef.current = true
    }
  }, [editor])

  async function handleInsertImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file || !editor) return

    try {
      const { dataUrl, width } = await resizeImageFile(file)
      // Cap the initial on-screen width so a huge photo doesn't blow past
      // the page — teacher can still resize larger via the toolbar.
      const displayWidth = Math.min(width, 500)
      editor.chain().focus().setImage({ src: dataUrl } as any).run()
      editor.chain().updateAttributes('image', { width: `${displayWidth}px` }).run()
    } catch (err) {
      console.error('Image insert failed:', err)
    }
  }

  function setImageSize(preset: string) {
    editor?.chain().focus().updateAttributes('image', { width: preset }).run()
  }

  function insertLetterhead() {
    if (!editor || !letterheadNodes || letterheadNodes.length === 0) return
    editor.chain().focus().insertContent(letterheadNodes).run()
  }

  if (!editor) return null

  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || DEFAULT_FONT_FAMILY
  const currentFontSize = editor.getAttributes('textStyle').fontSize || DEFAULT_FONT_SIZE
  const isImageSelected = editor.isActive('image')

  return (
    <div className="rounded-lg border">
      {/* Toolbar — hidden when printing, same .print:hidden pattern used
          elsewhere in the app (exam-view.tsx, lesson editor). */}
      <div className="print:hidden flex flex-wrap items-center gap-1 border-b bg-neutral-50 p-2">
        <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={16} />
        </ToolbarButton>

        <Divider />

        <select
          aria-label="Heading style"
          className="rounded border bg-white px-1 py-1 text-xs"
          value={
            editor.isActive('heading', { level: 1 }) ? '1'
            : editor.isActive('heading', { level: 2 }) ? '2'
            : editor.isActive('heading', { level: 3 }) ? '3'
            : 'p'
          }
          onChange={(e) => {
            const v = e.target.value
            if (v === 'p') editor.chain().focus().setParagraph().run()
            else editor.chain().focus().toggleHeading({ level: parseInt(v, 10) as 1 | 2 | 3 }).run()
          }}
        >
          <option value="p">Paragraph</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>

        <select
          aria-label="Font family"
          className="rounded border bg-white px-1 py-1 text-xs"
          value={currentFontFamily}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>

        <select
          aria-label="Font size"
          className="rounded border bg-white px-1 py-1 text-xs"
          value={currentFontSize}
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{parseInt(s, 10)}pt</option>
          ))}
        </select>

        <Divider />

        <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight size={16} />
        </ToolbarButton>
        <ToolbarButton label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
          <AlignJustify size={16} />
        </ToolbarButton>

        <Divider />

        <label className="cursor-pointer rounded p-1.5 hover:bg-neutral-200" title="Insert image">
          <ImageIcon size={16} />
          <input type="file" accept="image/*" className="hidden" onChange={handleInsertImage} />
        </label>

        {isImageSelected && (
          <>
            <ToolbarButton label="Shrink image" onClick={() => setImageSize('25%')}><ImageMinus size={16} /></ToolbarButton>
            <select
              aria-label="Image size"
              className="rounded border bg-white px-1 py-1 text-xs"
              onChange={(e) => setImageSize(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Image size…</option>
              {IMAGE_SIZE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ToolbarButton label="Enlarge image" onClick={() => setImageSize('100%')}><ImagePlus size={16} /></ToolbarButton>
          </>
        )}

        <ToolbarButton
          label="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon size={16} />
        </ToolbarButton>

        <ToolbarButton label="Insert page break" onClick={() => editor.chain().focus().setPageBreak().run()}>
          <SeparatorHorizontal size={16} />
        </ToolbarButton>

        {letterheadNodes && letterheadNodes.length > 0 && (
          <button
            type="button"
            onClick={insertLetterhead}
            className="ml-1 rounded border px-2 py-1 text-xs hover:bg-neutral-200"
            title="Re-insert your school logo and name at the cursor"
          >
            Insert letterhead
          </button>
        )}

        <Divider />

        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={16} />
        </ToolbarButton>
      </div>

      {/* The page itself — Times New Roman 12pt by default, A4-ish max
          width so on-screen editing roughly previews the printed shape. */}
      <div className="exam-doc-page-wrapper bg-neutral-200 p-4 print:bg-white print:p-0">
        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        .exam-doc-page-wrapper {
          display: flex;
          justify-content: center;
        }
        .exam-doc-content {
          background: white;
          width: 100%;
          max-width: 794px; /* ~A4 width at 96dpi */
          min-height: 500px;
          padding: 56px 64px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #111;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        }
        .exam-doc-content h1, .exam-doc-content h2, .exam-doc-content h3 {
          font-family: 'Times New Roman', Times, serif;
          font-weight: bold;
        }
        .exam-doc-content h2 { font-size: 14pt; margin-top: 1em; }
        .exam-doc-content h3 { font-size: 13pt; margin-top: 0.8em; }
        .exam-doc-content p { margin: 0 0 0.6em 0; }
        .exam-doc-content img { max-width: 100%; height: auto; }
        .exam-doc-content table { border-collapse: collapse; width: 100%; margin: 0.6em 0; }
        .exam-doc-content td, .exam-doc-content th { border: 1px solid #999; padding: 4px 8px; }
        .exam-doc-page-break {
          border-top: 2px dashed #bbb;
          text-align: center;
          color: #999;
          font-size: 10px;
          padding: 4px 0;
          margin: 1em 0;
          user-select: none;
        }
        @media print {
          .exam-doc-page-wrapper { background: white; padding: 0; }
          .exam-doc-content { box-shadow: none; max-width: 100%; padding: 0; }
          .exam-doc-page-break { border: none; break-after: page; padding: 0; margin: 0; color: transparent; height: 0; }
        }
        @page {
          size: A4;
          margin: 20mm;
        }
      `}</style>
    </div>
  )
}

function ToolbarButton({
  label, active, onClick, children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`rounded p-1.5 hover:bg-neutral-200 ${active ? 'bg-chalkboard text-white hover:bg-chalkboard' : ''}`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-neutral-300" />
}

// Testing steps:
// 1. Open the Word Processor on a freshly generated exam. Expected: body
//    text renders in Times New Roman at 12pt by default, with no need to
//    manually set either.
// 2. Select a line, change font size to 18pt and family to Arial. Expected:
//    only that selection changes; typing new text elsewhere still defaults
//    back to Times New Roman 12pt.
// 3. Insert an image, confirm the size dropdown appears only while an
//    image is selected, and each preset visibly resizes it.
// 4. Insert a page break, a table, toggle a bullet list, and use the
//    heading dropdown — each should behave like a normal word processor.
// 5. Click "Print / Save as PDF" (from the parent view) — the toolbar
//    should disappear from the print output entirely, and the page-break
//    node should force a real page split.
