// Purpose: Reusable text input component.
// Folder: components/ui/input.tsx

import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-chalkboard',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
