// Purpose: The single shared definition of "which band does this class
// belong to" — Lower Primary (Basic 1–3), Upper Primary (Basic 4–6), or
// JHS (JHS 1–3). Used by the exam structure logic AND every subject/class
// picker in the app, so a class is grouped the same way everywhere.
// Folder: lib/curriculum/bands.ts

export type ClassBand = 'lower_primary' | 'upper_primary' | 'jhs'

export const BAND_LABELS: Record<ClassBand, string> = {
  lower_primary: 'Lower Primary (Basic 1–3)',
  upper_primary: 'Upper Primary (Basic 4–6)',
  jhs: 'JHS (JHS 1–3)',
}

export function getClassBand(classLevel: string): ClassBand {
  const lower = classLevel.toLowerCase()
  if (lower.includes('jhs')) return 'jhs'
  const num = parseInt(classLevel.replace(/\D/g, ''), 10)
  if (!isNaN(num) && num <= 3) return 'lower_primary'
  return 'upper_primary'
}

// WHY this ordering constant exists: object/map key order isn't guaranteed
// meaningful in JS — when we render band groups in a picker, we want
// Lower Primary, then Upper Primary, then JHS, always in that order.
export const BAND_ORDER: ClassBand[] = ['lower_primary', 'upper_primary', 'jhs']
