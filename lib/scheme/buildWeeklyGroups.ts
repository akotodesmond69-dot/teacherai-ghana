// Purpose: Splits a subject's curriculum indicators evenly across the
// weeks of a term, in curriculum order. This is plain, deterministic
// logic — no AI — because the sequence NaCCA defines is already correct;
// our job is only to distribute it across available weeks.
// Folder: lib/scheme/buildWeeklyGroups.ts

export interface IndicatorForScheme {
  id: string
  indicator_code: string
  strand: string
  sub_strand: string
  indicator_text: string
}

export interface WeekGroup {
  week_number: number
  indicators: IndicatorForScheme[]
}

export function buildWeeklyGroups(
  indicators: IndicatorForScheme[],
  numWeeks: number
): WeekGroup[] {
  // Always process in official curriculum order — sorting by code keeps
  // the sequence exactly as NaCCA defines it, regardless of the order
  // rows happen to come back from the database.
  const sorted = [...indicators].sort((a, b) =>
    a.indicator_code.localeCompare(b.indicator_code)
  )

  const weeks: WeekGroup[] = Array.from({ length: numWeeks }, (_, i) => ({
    week_number: i + 1,
    indicators: [],
  }))

  // Distribute indicators round-robin across weeks. If there are more
  // indicators than weeks, later weeks pick up more than one — better than
  // silently dropping indicators that don't fit evenly.
  sorted.forEach((indicator, i) => {
    weeks[i % numWeeks].indicators.push(indicator)
  })

  return weeks.filter((w) => w.indicators.length > 0)
}

// Testing steps:
// 1. Call buildWeeklyGroups(indicators, 12) with, say, 2 seeded indicators.
//    Expected: 2 week groups returned (weeks with zero indicators are
//    filtered out), each containing one indicator, in code order.
// 2. This is a pure function — no database, no network — so it's the
//    easiest kind of code in this project to unit test directly.
