// Purpose: Extracts plain text from an uploaded PDF or Word document,
// entirely in the browser. WHY client-side, not sent to a server first:
// no file storage needed at all — we only ever need the TEXT, which we
// can get for free with pdfjs-dist (PDF) and mammoth (Word) running
// locally, then send just that extracted text to the AI. A photo of a
// book page is handled differently (see extractImageBase64) since there's
// no text to extract — the AI itself reads the image directly.
// Folder: lib/files/extractTextFromFile.ts
// Depends on: pdfjs-dist, mammoth
'use client'

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(' ')
    fullText += pageText + '\n\n'
  }
  return fullText.trim()
}

export async function extractTextFromWord(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value.trim()
}

// Converts an image file to a base64 data URL, for sending directly to
// Gemini's vision capability — the AI itself performs the "reading" of a
// photographed book page, there's no separate OCR step for us to build.
export async function fileToBase64DataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function extractContentFromFile(
  file: File
): Promise<{ type: 'text'; text: string } | { type: 'image'; dataUrl: string }> {
  if (file.type === 'application/pdf') {
    return { type: 'text', text: await extractTextFromPdf(file) }
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    return { type: 'text', text: await extractTextFromWord(file) }
  }
  if (file.type.startsWith('image/')) {
    return { type: 'image', dataUrl: await fileToBase64DataUrl(file) }
  }
  throw new Error('Unsupported file type. Please upload a PDF, Word (.docx), or image file.')
}

// Testing steps:
// 1. Upload a text-based PDF. Expected: extractTextFromPdf returns the
//    real page text, not empty/garbled.
// 2. Upload a .docx file. Expected: extractTextFromWord returns the real
//    paragraph text.
// 3. Upload a photo (.jpg/.png). Expected: returns { type: 'image', dataUrl }
//    starting with "data:image/...;base64,".
// 4. Upload an unsupported type (e.g. .txt). Expected: throws a clear error.
