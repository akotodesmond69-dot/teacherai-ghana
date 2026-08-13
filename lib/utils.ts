// Purpose: Merges Tailwind classes safely, resolving conflicts (e.g. two
// different "p-4" values passed to the same component). Standard shadcn/ui
// utility — every component in components/ui/ imports this.
// Folder: lib/utils.ts

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
