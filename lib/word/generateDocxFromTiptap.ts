// Purpose: Converts the Word Processor's document (Tiptap/ProseMirror
// JSON — see components/document-editor/DocumentEditor.tsx) into a real,
// downloadable, fully-editable .docx file, entirely in the browser via the
// `docx` npm library — no server call, no paid conversion API. This is
// intentionally a BOUNDED converter: it handles exactly the node and mark
// types our own editor toolbar can produce (paragraph, heading 1-3, bullet/
// numbered list, table, image, horizontal rule, page break, bold/italic/
// underline, font family/size, text alignment) — not an arbitrary
// universal ProseMirror-to-docx converter, since the editor can never
// actually produce anything outside that set.
// Folder: lib/word/generateDocxFromTiptap.ts
// Depends on: docx
'use client'

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ImageRun, PageBreak as DocxPageBreak,
  BorderStyle, convertInchesToTwip,
} from 'docx'
import type { JSONContent } from '@tiptap/core'

const BULLET_REF = 'exam-doc-bullets'
const ORDERED_REF = 'exam-doc-numbers'
const CONTENT_WIDTH_PX = 650 // nominal page content width used to resolve % image widths

const ALIGNMENT_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

function ptToHalfPoints(pt: string | undefined, fallback: number): number {
  if (!pt) return fallback
  const num = parseFloat(pt)
  return isNaN(num) ? fallback : Math.round(num * 2)
}

function textRunsFromInline(nodes: JSONContent[] | undefined): TextRun[] {
  if (!nodes) return []
  const runs: TextRun[] = []
  for (const node of nodes) {
    if (node.type !== 'text') continue
    const marks = node.marks ?? []
    const bold = marks.some((m) => m.type === 'bold')
    const italics = marks.some((m) => m.type === 'italic')
    const underline = marks.some((m) => m.type === 'underline')
    const textStyle = marks.find((m) => m.type === 'textStyle')?.attrs ?? {}
    runs.push(
      new TextRun({
        text: node.text ?? '',
        bold,
        italics,
        underline: underline ? {} : undefined,
        font: textStyle.fontFamily || 'Times New Roman',
        size: ptToHalfPoints(textStyle.fontSize, 24), // 24 half-points = 12pt default
      })
    )
  }
  return runs
}

async function loadImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 200, height: img.naturalHeight || 200 })
    img.onerror = () => resolve({ width: 200, height: 200 })
    img.src = src
  })
}

async function imageBytesAndType(src: string): Promise<{ data: ArrayBuffer; type: 'png' | 'jpg' | 'gif' }> {
  if (src.startsWith('data:')) {
    const [header, base64] = src.split(',')
    const mime = /data:(.*?);base64/.exec(header)?.[1] ?? 'image/png'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { data: bytes.buffer, type: mimeToType(mime) }
  }
  const response = await fetch(src)
  const blob = await response.blob()
  const buffer = await blob.arrayBuffer()
  return { data: buffer, type: mimeToType(blob.type) }
}

function mimeToType(mime: string): 'png' | 'jpg' | 'gif' {
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  return 'png'
}

function resolveWidthPx(widthAttr: string | undefined, naturalWidth: number): number {
  if (!widthAttr) return Math.min(naturalWidth, CONTENT_WIDTH_PX)
  if (widthAttr.endsWith('%')) {
    const pct = parseFloat(widthAttr) / 100
    return Math.round(CONTENT_WIDTH_PX * pct)
  }
  const px = parseFloat(widthAttr)
  return isNaN(px) ? Math.min(naturalWidth, CONTENT_WIDTH_PX) : px
}

async function imageParagraph(node: JSONContent, align: (typeof AlignmentType)[keyof typeof AlignmentType]): Promise<Paragraph> {
  const src: string = node.attrs?.src ?? ''
  const { width: naturalWidth, height: naturalHeight } = await loadImageDimensions(src)
  const targetWidth = resolveWidthPx(node.attrs?.width, naturalWidth)
  const targetHeight = Math.round((targetWidth / naturalWidth) * naturalHeight) || targetWidth

  try {
    const { data, type } = await imageBytesAndType(src)
    return new Paragraph({
      alignment: align,
      children: [
        new ImageRun({
          data,
          type,
          transformation: { width: targetWidth, height: targetHeight },
        } as any),
      ],
    })
  } catch (err) {
    console.error('generateDocxFromTiptap: image failed to embed, skipping:', err)
    return new Paragraph({ children: [new TextRun({ text: '[image could not be embedded]', italics: true })] })
  }
}

function listItemParagraphs(item: JSONContent, reference: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  for (const child of item.content ?? []) {
    if (child.type === 'paragraph') {
      paragraphs.push(
        new Paragraph({
          numbering: { reference, level: 0 },
          children: textRunsFromInline(child.content),
        })
      )
    }
  }
  return paragraphs
}

async function tableFromNode(node: JSONContent): Promise<Table> {
  const rows = node.content ?? []
  const colCount = rows[0]?.content?.length ?? 1
  const colWidthTwips = Math.floor(convertInchesToTwip(6.2) / colCount)

  const tableRows = rows.map((row) => {
    const cells = (row.content ?? []).map((cell) => {
      const isHeader = cell.type === 'tableHeader'
      const cellParagraphs = (cell.content ?? []).map(
        (p) =>
          new Paragraph({
            children: textRunsFromInline(p.content).map(
              (run) =>
                isHeader
                  ? new TextRun({ ...(run as any), bold: true })
                  : run
            ),
          })
      )
      return new TableCell({
        width: { size: colWidthTwips, type: WidthType.DXA },
        children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ text: '' })],
      })
    })
    return new TableRow({ children: cells })
  })

  return new Table({
    columnWidths: Array(colCount).fill(colWidthTwips),
    rows: tableRows,
  })
}

export async function generateDocxFromTiptap(doc: JSONContent, filename: string) {
  const children: (Paragraph | Table)[] = []

  for (const node of doc.content ?? []) {
    const align = ALIGNMENT_MAP[node.attrs?.textAlign] ?? AlignmentType.LEFT

    switch (node.type) {
      case 'paragraph':
        children.push(
          new Paragraph({
            alignment: align,
            children: node.content ? textRunsFromInline(node.content) : [],
          })
        )
        break

      case 'heading': {
        const level = node.attrs?.level ?? 2
        const headingLevel =
          level === 1 ? HeadingLevel.HEADING_1 : level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2
        children.push(
          new Paragraph({
            heading: headingLevel,
            alignment: align,
            children: textRunsFromInline(node.content),
          })
        )
        break
      }

      case 'bulletList':
        for (const item of node.content ?? []) children.push(...listItemParagraphs(item, BULLET_REF))
        break

      case 'orderedList':
        for (const item of node.content ?? []) children.push(...listItemParagraphs(item, ORDERED_REF))
        break

      case 'image':
        children.push(await imageParagraph(node, align))
        break

      case 'table':
        children.push(await tableFromNode(node))
        break

      case 'horizontalRule':
        // A visible rule under a theory question's answer space — a
        // paragraph bottom border, per the docx skill's guidance (never
        // use a table as a horizontal rule).
        children.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'auto' } },
            spacing: { after: 200 },
          })
        )
        break

      case 'pageBreak':
        children.push(new Paragraph({ children: [new DocxPageBreak()] }))
        break

      default:
        // Unsupported/unknown node type — skip rather than throw, so one
        // odd node never blocks the whole export.
        break
    }
  }

  const document = new Document({
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [{ level: 0, format: 'bullet' as any, text: '•', alignment: AlignmentType.LEFT }],
        },
        {
          reference: ORDERED_REF,
          levels: [{ level: 0, format: 'decimal' as any, text: '%1.', alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [{ children }],
  })

  const blob = await Packer.toBlob(document)
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.docx') ? filename : `${filename}.docx`
  link.click()
  URL.revokeObjectURL(url)
}

// Testing steps:
// 1. Build a document with a heading, a paragraph with mixed bold/italic
//    text, a bullet list, a numbered list, a 3x3 table, an inserted image,
//    a horizontal-rule answer line, and a page break. Download as Word.
// 2. Open the .docx in real Word (or Google Docs). Expected: every element
//    renders correctly and is fully editable — headings are real Word
//    headings, lists are real numbered/bulleted lists (not literal "•"
//    characters), the image is embedded (not a broken link), the page
//    break actually starts a new page.
// 3. Confirm default body text is Times New Roman 12pt in the exported
//    file, matching what was shown on screen.
