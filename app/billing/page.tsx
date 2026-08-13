// Purpose: The "Upgrade to Premium" page — shows the plan and starts payment.
// Folder: app/billing/page.tsx
'use client'

import { useState } from 'react'
import { startSubscriptionPaymentAction } from './actions'
import { PLANS } from '@/lib/payments/plans'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/app-nav'

// WHY we compute the displayed price from PLANS instead of writing "GH₵20"
// as static text: the actual amount charged also comes from PLANS
// (amountPesewas, used in startSubscriptionPaymentAction). If the display
// price and the real charge came from two different places, a future price
// change could easily update one and forget the other — showing a teacher
// one number and charging them a different one. Deriving both from the
// same source makes that class of bug structurally impossible.
const plan = PLANS.teacher_premium_term
const displayPrice = `GH₵${(plan.amountPesewas / 100).toFixed(0)}`

export default function BillingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    setLoading(true)
    setError(null)

    try {
      const result = await startSubscriptionPaymentAction('teacher_premium_term')

      if (result.error || !result.authorizationUrl) {
        setError(result.error ?? 'Something went wrong.')
        return
      }

      // Send them to Paystack's hosted checkout page — this is where they
      // actually enter their MTN MoMo number and approve the payment.
      window.location.href = result.authorizationUrl
    } catch (err) {
      // WHY this catch matters: without it, any unexpected server-side
      // failure (a missing environment variable, a network blip) leaves
      // the button stuck on "Starting payment…" forever with no
      // explanation — exactly the bug this fixes.
      console.error('handleUpgrade failed:', err)
      setError('Something went wrong starting your payment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-2 text-2xl font-medium">Teacher Premium</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Unlimited lesson notes, assessments, and schemes of learning for one
        full school term.
      </p>

      <div className="mb-6 rounded-lg border p-6">
        <div className="mb-1 text-3xl font-medium">{displayPrice}</div>
        <div className="text-sm text-muted-foreground">per term</div>
      </div>

      <Button onClick={handleUpgrade} disabled={loading} className="w-full">
        {loading ? 'Starting payment…' : 'Pay with MTN MoMo or Card'}
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
    </>
  )
}

// Testing steps:
// 1. Click "Pay with MTN MoMo or Card". Expected: redirected to a real
//    Paystack checkout page.
// 2. In TEST mode, Paystack lets you complete a fake mobile money payment
//    without a real phone — check Paystack's test card/MoMo numbers in
//    their docs for the exact test values to use.
