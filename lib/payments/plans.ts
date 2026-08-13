// Purpose: Defines available subscription plans and the one shared rule
// for "is this teacher's premium currently active" — used by every AI
// feature's usage-limit check (lessons, assessments, schemes, assistant),
// so there's exactly one place this logic lives, not four slightly
// different copies.
// Folder: lib/payments/plans.ts

export interface SubscriptionPlan {
  id: string
  label: string
  amountPesewas: number // Ghana's smallest currency unit — 100 pesewas = GHS 1
  durationDays: number
}

// WHY term-based, not monthly: matches Ghana's 3-term school year, and
// cuts Paystack transaction fees to 3x/year instead of 12x/year for the
// same teacher.
export const PLANS: Record<string, SubscriptionPlan> = {
  teacher_premium_term: {
    id: 'teacher_premium_term',
    label: 'Teacher Premium (one term)',
    amountPesewas: 4000, // GHS 40.00
    durationDays: 120,   // roughly one school term
  },
}

export interface TeacherSubscriptionStatus {
  subscription_tier: string
  subscription_expires_at: string | null
}

// The single source of truth for "does this teacher currently have active
// premium access". A teacher can be subscription_tier = 'paid' but past
// their subscription_expires_at date — that should NOT count as active.
export function hasActivePremium(teacher: TeacherSubscriptionStatus): boolean {
  if (teacher.subscription_tier !== 'paid') return false
  if (!teacher.subscription_expires_at) return false
  return new Date(teacher.subscription_expires_at) > new Date()
}
