// Purpose: Generates the AI assistant's reply, given a conversation history.
// Folder: lib/assistant/generateAssistantReply.ts
// Unlike lessons/assessments/schemes, this assistant is NOT restricted to
// only using data we provide — general teaching advice (activities,
// differentiation ideas, classroom management tips) is exactly the kind
// of knowledge a language model is good at drawing on. What we DO still
// guard against: confidently stating specific NaCCA content standards or
// codes from memory, since those must come from our database, not a guess.

const SYSTEM_PROMPT = `You are a friendly, practical teaching assistant for
Ghanaian primary and JHS teachers. Teachers will ask you things like "how do
I teach fractions with no manipulatives" or "suggest a classroom management
activity for a noisy class."

Guidelines:
- Give concrete, practical suggestions suited to a Ghanaian classroom:
  assume large class sizes and limited materials; favor low-cost, locally
  available resources (bottle caps, stones, chalk, local examples) over
  suggestions that assume manipulatives or internet access are available.
- You may draw on your general teaching knowledge freely for pedagogy,
  activity ideas, and classroom strategies.
- If a teacher asks you to state a specific official NaCCA content standard,
  indicator, or code, do NOT state one from memory — tell them to check it
  against their Curriculum or Lesson Generator screens in the app, where
  the real, verified curriculum text is used.
- Keep answers focused and skimmable — a teacher is likely reading this
  between classes, not at leisure.`

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function generateAssistantReply(history: ChatMessage[]): Promise<string> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      temperature: 0.6, // higher than our grounded features — natural,
                         // conversational advice benefits from more variety
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini request failed: ${response.status} — ${errorBody}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? "Sorry, I couldn't come up with a response — please try again."
}

// Note on why there's no JSON validation here, unlike Phases 6/9/10:
// this is free-form conversational text, not structured data we need to
// store in typed fields — there's nothing to validate the "shape" of.
