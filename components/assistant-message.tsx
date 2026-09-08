// Purpose: Renders the AI assistant's reply as properly formatted text —
// headings, bold, bullet/numbered lists, and separate paragraphs — instead
// of dumping the raw Markdown-flavoured string from Gemini straight into a
// <div>, which is what made replies hard to read before (asterisks for
// bold/bullets showing up literally, no line breaks between ideas).
// Only the assistant's own messages use this — the teacher's own typed
// messages are shown as plain text, since there's nothing to format there.
// Folder: components/assistant-message.tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
          h1: ({ children }) => <h3 className="mb-1 mt-3 text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="mb-1 mt-3 text-base font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="mb-1 mt-2 text-sm font-semibold">{children}</h4>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-neutral-300 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs">{children}</code>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-info-blue">
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-neutral-200" />,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-neutral-300 bg-neutral-100 p-1 text-left">{children}</th>,
          td: ({ children }) => <td className="border border-neutral-300 p-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// Testing steps:
// 1. Ask the assistant something that naturally produces a numbered list
//    (e.g. "give me 3 steps to teach fractions with no manipulatives").
//    Expected: a real numbered list renders, not literal "1." text run
//    into one paragraph.
// 2. Ask something that produces bold terms or a short heading. Expected:
//    bold renders as bold, not literal asterisks; headings are visually
//    distinct but sized to fit inside a chat bubble, not huge.
// 3. Confirm the teacher's own messages (rendered separately in
//    app/assistant/page.tsx) are unaffected — still plain text.
