// Purpose: Receives Paystack's server-to-server confirmation that a
// payment succeeded. This is the AUTHORITATIVE source of truth — unlike
// the callback page (app/billing/callback/page.tsx), which is a nice-to-have
// for immediate UI feedback, this webhook is what guarantees a subscription
// activates even if the teacher's browser never makes it back to our site.
// Folder: app/api/paystack/webhook/route.ts
// Depends on: PAYSTACK_SECRET_KEY, crypto (built into Node.js)

import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { PLANS } from '@/lib/payments/plans'

export async function POST(request: Request) {
  // WHY we read the RAW text body, not request.json(): signature
  // verification must be computed over the exact bytes Paystack sent —
  // parsing to JSON and re-serializing can produce different byte output
  // (key order, spacing) and silently break the signature check.
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature') ?? ''

  const expectedSignature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex')

  // WHY timingSafeEqual instead of a plain === comparison: a normal string
  // comparison can leak timing information that helps an attacker guess
  // the correct signature byte by byte. This isn't paranoia for its own
  // sake — it's the standard, correct way to compare secrets.
  const isValid =
    signature.length === expectedSignature.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

  if (!isValid) {
    console.error('Paystack webhook: invalid signature — rejecting request')
    return new Response('Invalid signature', { status: 401 })
  }

  const event = JSON.parse(rawBody)

  if (event.event === 'charge.success') {
    const reference: string = event.data.reference
    const teacherId: string = event.data.metadata?.teacher_id
    const planId: keyof typeof PLANS = event.data.metadata?.plan_id
    const plan = PLANS[planId]

    const serviceClient = createServiceClient()

    // Idempotency: if we've already marked this exact reference as
    // successful (likely via the callback page beating the webhook here),
    // don't process it again.
    const { data: existing } = await serviceClient
      .from('payments')
      .select('status')
      .eq('paystack_reference', reference)
      .single()

    if (existing?.status !== 'success' && teacherId && plan) {
      const expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000)

      await serviceClient
        .from('teachers')
        .update({ subscription_tier: 'paid', subscription_expires_at: expiresAt.toISOString() })
        .eq('id', teacherId)

      await serviceClient
        .from('payments')
        .update({ status: 'success' })
        .eq('paystack_reference', reference)
    }
  }

  // WHY we respond 200 quickly and unconditionally (once signature-valid):
  // Paystack expects an HTTP 200 within 30 seconds, or it will retry
  // delivery — responding fast and simple avoids unnecessary retries.
  return new Response('OK', { status: 200 })
}

// ----------------------------------------------------------------------------
// Setup step this file can't do for you: after deploying, go to your
// Paystack Dashboard > Settings > API Keys & Webhooks, and set the Webhook
// URL to: https://your-real-domain.com/api/paystack/webhook
// While developing locally, Paystack can't reach localhost directly — the
// Paystack CLI's "webhook listen" command (mentioned in their docs) tunnels
// webhook events to your local machine for testing before you deploy.
//
// Testing steps (after webhook URL is configured):
// 1. Complete a test payment. Expected: this endpoint receives a POST,
//    signature validates, teachers.subscription_tier becomes 'paid'.
// 2. Manually POST a fake payload with a wrong signature.
//    Expected: 401 Invalid signature, no database changes.
// ----------------------------------------------------------------------------
