import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageContainerProps = {
  variant?: 'default' | 'wide'
  children: ReactNode
  className?: string
}

export function PageContainer({ variant = 'default', children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        'py-6',
        variant === 'default' && 'container max-w-2xl',
        variant === 'wide' && 'w-full px-4 md:px-6',
        className
      )}
    >
      {children}
    </div>
  )
}
