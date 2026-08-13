// Purpose: Handles the file upload, extracts text (PDF/Word) or prepares
// an image, then calls the appropriate generation action.
// Folder: app/exercises/uploader.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { extractContentFromFile } from '@/lib/files/extractTextFromFile'
import { generateExerciseFromTextAction, generateExerciseFromImageAction } from './actions'
import { Button } from '@/components/ui/button'

export function ExerciseUploader() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [questionCount, setQuestionCount] = useState(10)
  const [stage, setStage] = useState<'idle' | 'extracting' | 'generating'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!file) return
    setError(null)

    // Client-side pre-check for fast feedback — the real enforcement is
    // server-side in actions.ts, this just avoids making someone wait
    // through a slow extraction only to be rejected afterward.
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setError('That file is too large. Please use a file under 10MB.')
      return
    }

    try {
      setStage('extracting')
      const extracted = await extractContentFromFile(file)

      setStage('generating')
      const result =
        extracted.type === 'text'
          ? await generateExerciseFromTextAction(extracted.text, questionCount, file.name)
          : await generateExerciseFromImageAction(extracted.dataUrl, questionCount, file.name)

      setStage('idle')
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.push(`/exercises/${result.exerciseId}`)
    } catch (err) {
      setStage('idle')
      setError(err instanceof Error ? err.message : 'Something went wrong processing that file.')
    }
  }

  const busy = stage !== 'idle'

  return (
    <div>
      <label className="mb-2 block rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
        <input
          type="file"
          accept=".pdf,.docx,image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <span className="font-medium text-ink">{file.name}</span>
        ) : (
          <>Click to choose a PDF, Word document, or photo</>
        )}
      </label>

      <label className="mb-1 mt-4 block text-sm font-medium">Number of questions</label>
      <input
        type="number"
        min={1}
        max={30}
        value={questionCount}
        onChange={(e) => setQuestionCount(Number(e.target.value))}
        className="mb-6 w-24 rounded-md border p-2 text-sm"
      />

      <Button onClick={handleGenerate} disabled={!file || busy} className="w-full">
        {stage === 'extracting' && 'Reading your file…'}
        {stage === 'generating' && 'Generating questions…'}
        {stage === 'idle' && 'Generate exercise'}
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  )
}

// Testing steps:
// 1. Upload a PDF, set 10 questions, generate. Expected: "Reading your
//    file…" then "Generating questions…" then redirect to the exercise.
// 2. Upload an unsupported file type (e.g. .txt).
//    Expected: a clear error message, not a silent failure.
