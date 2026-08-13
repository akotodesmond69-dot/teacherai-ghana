// Purpose: Reusable button component, styled with Phase 2's design tokens.
// Folder: components/ui/button.tsx

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
          variant === 'default' && 'bg-gold-thread text-amber-950 hover:opacity-90',
          variant === 'outline' && 'border border-neutral-300 bg-transparent hover:bg-neutral-50',
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
