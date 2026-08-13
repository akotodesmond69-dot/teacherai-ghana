// Purpose: Reusable textarea component.
// Folder: components/ui/textarea.tsx

import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-chalkboard',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
