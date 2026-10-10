// Purpose: Given the deterministic week groupings from buildWeeklyGroups.ts,
// asks the AI to write one short, readable "focus for the week" summary
// per week — grounded ONLY in that week's real indicator text.
// Folder: lib/scheme/generateWeeklyFocusSummaries.ts

import type { WeekGroup } from './buildWeeklyGroups'
import { geminiChat, extractJson } from '@/lib/ai/gemini'

export interface WeekWithFocus extends WeekGroup {
  focus_summary: string
}

const SYSTEM_PROMPT = `You write short weekly focus summaries for a Ghanaian
teacher's scheme of learning. For each week you are given a list of real
curriculum indicators. Write ONE short paragraph (2-3 sentences) per week
describing, in plain language, what the class will focus on that week.

Rules:
- Use ONLY the indicator text given for each week. Do not add topics,
  standards, or content not listed.
- Respond with ONLY a JSON array, no explanation, no markdown fences,
  in this exact shape:
[{ "week_number": number, "focus_summary": "string" }]`

export async function generateWeeklyFocusSummaries(
  weeks: WeekGroup[]
): Promise<WeekWithFocus[]> {
  const userPrompt = weeks
    .map(
      (w) =>
        `Week ${w.week_number}:\n` +
        w.indicators.map((i) => `- ${i.strand} / ${i.sub_strand}: ${i.indicator_text}`).join('\n')
    )
    .join('\n\n')

  // This prompt asks for a top-level JSON ARRAY, so we do NOT use Gemini's
  // json_object mode (that forces an object). extractJson() handles fences
  // and stray text instead; and we accept an array wrapped in an object too.
  const text = await geminiChat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  })
  const raw = extractJson(text)
  const summaries: { week_number: number; focus_summary: string }[] = Array.isArray(raw)
    ? raw
    : ((Object.values(raw as Record<string, unknown>).find(Array.isArray) as any[]) ?? [])

  // Merge the AI's summaries back onto the original (already-correct)
  // week groupings — we never let the AI's response change which
  // indicators are in which week, only add the summary text.
  return weeks.map((week) => {
    const match = summaries.find((s) => s.week_number === week.week_number)
    return { ...week, focus_summary: match?.focus_summary ?? '' }
  })
}

// WHY we merge the AI's output back onto our own data structure instead of
// trusting the AI's response as the source of truth: if the AI drops a week
// or reorders things, our real indicator groupings are untouched — worst
// case, one week is missing its nice summary text, never missing or wrong
// curriculum content.
