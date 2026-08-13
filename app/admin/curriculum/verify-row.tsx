// Purpose: The interactive part of each pending-indicator row — the
// server page above can't have onClick handlers itself, so this small
// client component holds just the buttons and their loading state.
// Folder: app/admin/curriculum/verify-row.tsx
'use client'

import { useState } from 'react'
import { verifyIndicatorAction, deleteIndicatorAction } from './actions'
import { Button } from '@/components/ui/button'

export function VerifyRow({
  id, subjectLabel, strand, subStrand, indicatorText, indicatorCode, submittedBySchool,
}: {
  id: string
  subjectLabel: string
  strand: string
  subStrand: string
  indicatorText: string
  indicatorCode: string
  submittedBySchool: string
}) {
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState(false)

  async function handleVerify() {
    setBusy(true)
    const result = await verifyIndicatorAction(id)
    setBusy(false)
    if (!result.error) setHidden(true)
  }

  async function handleDelete() {
    setBusy(true)
    const result = await deleteIndicatorAction(id)
    setBusy(false)
    if (!result.error) setHidden(true)
  }

  if (hidden) return null

  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <span className="font-medium">{subjectLabel}</span>
        <span className="text-xs text-muted-foreground">Submitted by {submittedBySchool}</span>
      </div>
      <p className="mb-3 text-muted-foreground">
        {strand} → {subStrand} — {indicatorText} ({indicatorCode})
      </p>
      <div className="flex gap-2">
        <Button onClick={handleVerify} disabled={busy}>Verify</Button>
        <Button variant="outline" onClick={handleDelete} disabled={busy}>Delete</Button>
      </div>
    </div>
  )
}
