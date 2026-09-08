// Purpose: Hosts the Word Processor (DocumentEditor) for one exam —
// initializes it from a previously-saved document if one exists, or
// auto-builds a starting letterhead + question layout from the structured
// exam content otherwise; autosaves on a debounce; and offers Print/Save-
// as-PDF (the browser's own print dialog — genuinely free, and the only
// approach that renders complex mixed content like tables and images with
// perfect fidelity, unlike a from-scratch PDF layout engine) and Download
// as Word (via the custom Tiptap → docx converter).
// Folder: app/exam/[id]/document/document-editor-view.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { DocumentEditor } from '@/components/document-editor/DocumentEditor'
import { buildExamDocumentJson, type ExamDocumentBranding, type ExamDocumentMeta } from '@/lib/tiptap/examToDocumentJson'
import { generateDocxFromTiptap } from '@/lib/word/generateDocxFromTiptap'
import { saveExamDocumentAction } from './actions'
import type { ExamContent } from '@/lib/ai/examSchema'
import { Button } from '@/components/ui/button'

const AUTOSAVE_DELAY_MS = 2500

export function DocumentEditorView({
  examId,
  meta,
  branding,
  examContent,
  savedDocumentJson,
}: {
  examId: string
  meta: ExamDocumentMeta
  branding: ExamDocumentBranding
  examContent: ExamContent
  savedDocumentJson: JSONContent | null
}) {
  // Whether the one-time starting document (built only if no saved
  // version exists yet) includes an answer-key section. Not surfaced as a
  // toggle here — a teacher who wants one can use the structured Exam
  // Editor's answer-key export instead, or just type one into the Word
  // Processor directly since it's fully free-form.
  const includeAnswerKey = false

  // Only build a fresh starting document (letterhead + questions) if the
  // teacher has never opened the Word Processor for this exam before —
  // once they've started formatting, their saved version is the source of
  // truth, never silently regenerated out from under them.
  const startingDoc = useMemo<JSONContent>(
    () => savedDocumentJson ?? buildExamDocumentJson(examContent, meta, branding, includeAnswerKey),
    // Deliberately NOT reactive to includeAnswerKey/examContent after the
    // first render — those only affect the ONE-TIME starting document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const letterheadNodes = useMemo<JSONContent[]>(() => {
    const nodes: JSONContent[] = []
    if (branding.schoolLogoUrl) {
      nodes.push({
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [{ type: 'image', attrs: { src: branding.schoolLogoUrl, alt: 'School logo', width: '110px' } }],
      })
    }
    if (branding.schoolName) {
      nodes.push({
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [
          {
            type: 'text',
            text: branding.schoolName.toUpperCase(),
            marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: '16pt' } }],
          },
        ],
      })
    }
    return nodes
  }, [branding.schoolLogoUrl, branding.schoolName])

  const currentDocRef = useRef<JSONContent>(startingDoc)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    savedDocumentJson ? 'saved' : 'idle'
  )
  const [exporting, setExporting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(json: JSONContent) {
    currentDocRef.current = json
    setSaveState('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(save, AUTOSAVE_DELAY_MS)
  }

  async function save() {
    setSaveState('saving')
    const result = await saveExamDocumentAction(examId, currentDocRef.current)
    setSaveState(result.error ? 'error' : 'saved')
  }

  // Save immediately on unmount if there's a pending debounced save, so
  // navigating away right after a last edit doesn't lose it.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        saveExamDocumentAction(examId, currentDocRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDownloadWord() {
    setExporting(true)
    try {
      await generateDocxFromTiptap(currentDocRef.current, examContent.title)
    } catch (err) {
      console.error('Word export failed:', err)
    }
    setExporting(false)
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="print:hidden mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Word Processor</h1>
          <p className="text-xs text-muted-foreground">
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'All changes saved ✓'}
            {saveState === 'error' && <span className="text-red-600">Could not save — check your connection.</span>}
            {saveState === 'idle' && 'Unsaved changes'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>Print / Save as PDF</Button>
          <Button variant="outline" onClick={handleDownloadWord} disabled={exporting}>
            {exporting ? 'Preparing…' : 'Download as Word'}
          </Button>
        </div>
      </div>

      <DocumentEditor initialContent={startingDoc} onChange={handleChange} letterheadNodes={letterheadNodes} />

      <p className="print:hidden mt-3 text-xs text-muted-foreground">
        Tip: "Print / Save as PDF" opens your browser's print dialog —
        choose <strong>Save as PDF</strong> as the destination/printer for a
        print-ready PDF that matches exactly what you see here, including
        images and tables.
      </p>
    </div>
  )
}

// Testing steps:
// 1. Open the Word Processor for the first time on a generated exam.
//    Expected: it auto-builds a starting document with your school logo/
//    name (if saved in Profile) and every question laid out.
// 2. Make an edit, wait ~3 seconds without typing. Expected: "Saving…"
//    then "All changes saved ✓" appears with no button click needed.
// 3. Navigate away immediately after typing (before the debounce fires).
//    Expected: the edit is still saved (the unmount effect flushes it).
// 4. Reopen the same exam's Word Processor. Expected: your saved version
//    loads — NOT a freshly regenerated one — even if you'd deleted a
//    whole section.
// 5. Click "Print / Save as PDF," choose "Save as PDF" in the browser
//    dialog. Expected: a clean PDF with no toolbar, correct fonts/images/
//    tables, and any page breaks you inserted actually splitting pages.
// 6. Click "Download as Word." Expected: a fully editable .docx opens
//    correctly in Word/Google Docs.
