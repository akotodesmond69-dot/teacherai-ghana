// Purpose: Thin wrapper around Paystack's REST API — initializing a
// payment (getting a hosted checkout URL) and verifying one after the fact.
// Folder: lib/payments/paystack.ts
// Depends on: PAYSTACK_SECRET_KEY (server-only environment variable)

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

export interface InitializeTransactionInput {
  email: string
  amountPesewas: number
  reference: string
  callbackUrl: string
  metadata: Record<string, unknown>
}

export interface InitializeTransactionResult {
  authorizationUrl: string
  accessCode: string
  reference: string
}

export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<InitializeTransactionResult> {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountPesewas, // Paystack expects the smallest currency unit
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: 'GHS',
      channels: ['mobile_money', 'card'], // WHY explicit: without this,
      // Paystack may default to a channel list that doesn't include mobile
      // money first, and mobile money is how most of our teachers will pay.
      metadata: input.metadata,
    }),
  })

  const data = await response.json()
  if (!response.ok || !data.status) {
    throw new Error(`Paystack initialize failed: ${data.message ?? response.status}`)
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  }
}

export interface VerifyTransactionResult {
  status: 'success' | 'failed' | 'abandoned' | string
  reference: string
  amountPesewas: number
  metadata: Record<string, unknown>
}

export async function verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  })

  const data = await response.json()
  if (!response.ok || !data.status) {
    throw new Error(`Paystack verify failed: ${data.message ?? response.status}`)
  }

  return {
    status: data.data.status,
    reference: data.data.reference,
    amountPesewas: data.data.amount,
    metadata: data.data.metadata ?? {},
  }
}
