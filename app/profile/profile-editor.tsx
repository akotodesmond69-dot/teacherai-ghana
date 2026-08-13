// Purpose: The interactive part of the profile page — editable name/school
// fields, direct-to-Supabase-Storage avatar upload, and a weekly timetable
// grid.
// Folder: app/profile/profile-editor.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateProfileAction, saveTimetableAction, updateAvatarUrlAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DEFAULT_PERIODS = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6']

interface TimetableRow {
  day_of_week: string
  period_label: string
  subject_label: string
  class_label: string
}

export function ProfileEditor({
  fullName, schoolName, avatarUrl, email, lessonsCount, timetable,
}: {
  fullName: string
  schoolName: string
  avatarUrl: string | null
  email: string
  lessonsCount: number
  timetable: TimetableRow[]
}) {
  const supabase = createClient()

  const [name, setName] = useState(fullName)
  const [school, setSchool] = useState(schoolName)
  const [avatar, setAvatar] = useState(avatarUrl)
  const [uploading, setUploading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingTimetable, setSavingTimetable] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Build a lookup grid from the flat timetable rows for easy editing.
  const [grid, setGrid] = useState<Record<string, string>>(() => {
    const g: Record<string, string> = {}
    for (const row of timetable) {
      g[`${row.day_of_week}__${row.period_label}`] = row.subject_label
    }
    return g
  })
  const periods = Array.from(new Set([...DEFAULT_PERIODS, ...timetable.map((t) => t.period_label)]))

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5MB
    if (file.size > MAX_AVATAR_SIZE) {
      setMessage('That photo is too large. Please use an image under 5MB.')
      return
    }

    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    // WHY the file path starts with the user's own id: this is exactly
    // what the Phase 17 storage RLS policy checks — a teacher can only
    // write to a path starting with their own id, so this naming isn't
    // just organizational, it's the actual security boundary.
    const filePath = `${user.id}/avatar.${file.name.split('.').pop()}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      setUploading(false)
      setMessage('Could not upload photo.')
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
    await updateAvatarUrlAction(urlData.publicUrl)
    setAvatar(urlData.publicUrl)
    setUploading(false)
    setMessage('Photo updated ✓')
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    const result = await updateProfileAction(name, school)
    setSavingProfile(false)
    setMessage(result.error ?? 'Profile saved ✓')
  }

  async function handleSaveTimetable() {
    setSavingTimetable(true)
    const entries = Object.entries(grid)
      .filter(([, subject]) => subject.trim() !== '')
      .map(([key, subject]) => {
        const [day_of_week, period_label] = key.split('__')
        return { day_of_week, period_label, subject_label: subject, class_label: '' }
      })
    const result = await saveTimetableAction(entries)
    setSavingTimetable(false)
    setMessage(result.error ?? 'Timetable saved ✓')
  }

  return (
    <div className="space-y-8">
      {/* Avatar + basic info */}
      <div className="flex flex-col items-center gap-6 rounded-lg border p-6 sm:flex-row sm:items-start">
        <div>
          {avatar ? (
            <img src={avatar} alt="Profile" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-200 text-2xl text-neutral-500">
              {name ? name[0].toUpperCase() : '?'}
            </div>
          )}
          <label className="mt-2 block cursor-pointer text-center text-xs text-info-blue underline">
            {uploading ? 'Uploading…' : 'Change photo'}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
          </label>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <Label className="mb-1 block text-xs">Email</Label>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">School</Label>
            <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Your school" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Lessons generated</Label>
            <p className="text-sm font-medium">{lessonsCount}</p>
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </div>

      {/* Timetable */}
      <div className="rounded-lg border p-6">
        <h2 className="mb-3 font-medium">Weekly Timetable</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-1 text-left">Period</th>
                {DAYS.map((d) => <th key={d} className="p-1 text-left">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period}>
                  <td className="p-1 font-medium">{period}</td>
                  {DAYS.map((day) => {
                    const key = `${day}__${period}`
                    return (
                      <td key={key} className="p-1">
                        <input
                          className="w-24 rounded border px-1 py-0.5"
                          value={grid[key] ?? ''}
                          onChange={(e) => setGrid((g) => ({ ...g, [key]: e.target.value }))}
                          placeholder="—"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button onClick={handleSaveTimetable} disabled={savingTimetable} className="mt-4">
          {savingTimetable ? 'Saving…' : 'Save timetable'}
        </Button>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}

// Testing steps:
// 1. Upload a photo. Expected: it appears immediately, and persists after
//    a page refresh (confirms it saved to Storage AND the teachers row).
// 2. Fill in a few timetable cells, save, refresh. Expected: they persist.
// 3. As a different teacher, try guessing another teacher's avatar file
//    path — the RLS policy should prevent writing to it, though reading
//    (viewing) any avatar is intentionally public, same as most apps.
