// Purpose: Starts a Paystack payment for a subscription plan, returning the
// hosted checkout URL to redirect the teacher to.
// Folder: app/billing/actions.ts
'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { initializeTransaction } from '@/lib/payments/paystack'
import { PLANS } from '@/lib/payments/plans'

export async function startSubscriptionPaymentAction(planId: keyof typeof PLANS) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'You must be logged in to subscribe.' }

  const plan = PLANS[planId]
  if (!plan) return { error: 'Unknown plan.' }

  // A unique reference we control, not just whatever Paystack generates —
  // this becomes our idempotency key when the webhook fires later.
  const reference = `teacherai_${planId}_${randomUUID()}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  let result
  try {
    result = await initializeTransaction({
      email: user.email,
      amountPesewas: plan.amountPesewas,
      reference,
      callbackUrl: `${appUrl}/billing/callback`,
      metadata: { teacher_id: user.id, plan_id: planId },
    })
  } catch (err) {
    console.error('startSubscriptionPaymentAction: Paystack initialize failed:', err)
    return { error: 'Could not start payment. Please try again.' }
  }

  // Log the pending attempt now, before the teacher even pays — this is
  // what lets the webhook (or the callback page) look up "which plan was
  // this reference for" later, and gives us a record even if the teacher
  // abandons the payment halfway through.
  // WHY the service client here, not the regular session-based one: the
  // Phase 14 RLS policy deliberately gives teachers read-only access to
  // their own payments — even legitimate writes from server code go
  // through the service client, kept consistent with how the webhook
  // (which has no session at all) also has to write this table.
  const serviceClient = createServiceClient()
  await serviceClient.from('payments').insert({
    teacher_id: user.id,
    paystack_reference: reference,
    amount_pesewas: plan.amountPesewas,
    plan: planId,
    status: 'pending',
  })

  return { authorizationUrl: result.authorizationUrl }
}

// Testing steps:
// 1. Call this with 'teacher_premium_term'. Expected: { authorizationUrl }
//    pointing to a real Paystack checkout page (paystack.com domain).
// 2. Check the payments table: a new row with status = 'pending'.
