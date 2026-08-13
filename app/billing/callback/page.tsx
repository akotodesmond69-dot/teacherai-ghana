// Purpose: Paystack redirects the teacher's browser here after they
// attempt payment. We verify the transaction directly (for immediate
// feedback) — the webhook (route.ts in api/paystack/webhook) is the
// authoritative confirmation and will also process it if this page is
// somehow skipped (e.g. the teacher closes the tab before the redirect).
// Folder: app/billing/callback/page.tsx

import Link from 'next/link'
import { verifyTransaction } from '@/lib/payments/paystack'
import { createServiceClient } from '@/lib/supabase/service'
import { PLANS } from '@/lib/payments/plans'

export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>
}) {
  const { reference, trxref } = await searchParams
  const ref = reference ?? trxref

  if (!ref) {
    return <CallbackMessage title="No payment reference found" ok={false} />
  }

  let verified
  try {
    verified = await verifyTransaction(ref)
  } catch (err) {
    console.error('Billing callback: verify failed:', err)
    return <CallbackMessage title="Could not verify your payment. If money left your account, it will be confirmed automatically shortly." ok={false} />
  }

  if (verified.status !== 'success') {
    return <CallbackMessage title="Payment was not completed." ok={false} />
  }

  // Idempotency: only activate once, even if this page and the webhook
  // both process the same successful reference.
  const serviceClient = createServiceClient()
  const { data: existingPayment } = await serviceClient
    .from('payments')
    .select('status')
    .eq('paystack_reference', ref)
    .single()

  if (existingPayment?.status !== 'success') {
    const teacherId = verified.metadata.teacher_id as string
    const planId = verified.metadata.plan_id as keyof typeof PLANS
    const plan = PLANS[planId]

    if (teacherId && plan) {
      const expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000)

      await serviceClient
        .from('teachers')
        .update({ subscription_tier: 'paid', subscription_expires_at: expiresAt.toISOString() })
        .eq('id', teacherId)

      await serviceClient
        .from('payments')
        .update({ status: 'success' })
        .eq('paystack_reference', ref)
    }
  }

  return <CallbackMessage title="Payment successful — your Premium subscription is active!" ok={true} />
}

function CallbackMessage({ title, ok }: { title: string; ok: boolean }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className={`mb-4 text-xl font-medium ${ok ? 'text-chalkboard' : 'text-red-600'}`}>
        {title}
      </h1>
      <Link href="/dashboard" className="text-sm text-info-blue underline">
        Go to your dashboard
      </Link>
    </div>
  )
}

// Testing steps:
// 1. Complete a test payment. Expected: redirected here, "Payment
//    successful" message, and teachers.subscription_tier becomes 'paid'
//    with a subscription_expires_at roughly 120 days out.
// 2. Refresh this exact URL again (same reference). Expected: still shows
//    success, but the payments row's status stays 'success' rather than
//    being processed twice — confirms the idempotency check works.
