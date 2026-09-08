// Purpose: The Teacher AI Assistant chat interface. Assistant replies are
// now rendered as formatted text (headings, bold, real bullet/numbered
// lists) via AssistantMessage, instead of one dense unformatted block —
// that was the specific readability problem here: Gemini's replies come
// back in Markdown, but a plain <div> just shows the raw asterisks/hyphens
// as literal characters with no real line breaks between ideas.
// Folder: app/assistant/page.tsx
'use client'

import { useState } from 'react'
import { sendAssistantMessageAction } from './actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AppNav } from '@/components/app-nav'
import { AssistantMessage } from '@/components/assistant-message'

interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function AssistantPage() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!input.trim()) return
    const userText = input
    setInput('')
    setError(null)

    // Show the teacher's own message immediately — don't make them wait
    // for the round trip just to see what they typed.
    setMessages((prev) => [...prev, { role: 'user', content: userText }])
    setSending(true)

    const result = await sendAssistantMessageAction(conversationId, userText)

    setSending(false)
    if (!conversationId && result.conversationId) setConversationId(result.conversationId)

    if (result.error) {
      setError(result.error)
      return
    }
    setMessages((prev) => [...prev, { role: 'assistant', content: result.reply! }])
  }

  return (
    <>
      <AppNav />
      <div className="mx-auto flex h-[80vh] max-w-2xl flex-col py-8 px-6">
      <h1 className="mb-4 text-xl font-medium">Teacher AI Assistant</h1>

      <div className="mb-4 flex-1 space-y-4 overflow-y-auto rounded-lg border p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask anything — e.g. "How do I teach fractions with no manipulatives?"
          </p>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-8 rounded-lg bg-emerald-50 p-3 text-sm leading-relaxed">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-8 rounded-lg bg-neutral-100 p-3">
              <AssistantMessage content={m.content} />
            </div>
          )
        )}
        {sending && <div className="mr-8 rounded-lg bg-neutral-100 p-3 text-sm text-muted-foreground">Thinking…</div>}
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          rows={2}
          placeholder="Type your question…"
        />
        <Button onClick={handleSend} disabled={sending}>Send</Button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
    </>
  )
}

// Testing steps:
// 1. Ask "Suggest a fun activity for teaching the water cycle to Basic 6."
//    Expected: a practical, Ghana-appropriate suggestion appears, and if
//    the reply includes a list or bold terms, they render as real
//    formatting, not literal markdown characters.
// 2. Ask a follow-up like "make it shorter." Expected: the assistant
//    responds in a way that shows it remembers the previous question.
// 3. Ask "what's the exact NaCCA indicator code for fractions in Basic 4?"
//    Expected: the assistant should point you to the Lesson Generator /
//    curriculum data rather than confidently stating a code from memory —
//    a good check that the system prompt's guardrail is working.
// 4. Ask something likely to produce a numbered how-to list. Expected: a
//    real numbered list with spacing between items, easy to scan between
//    classes — the specific readability problem this page fixes.
