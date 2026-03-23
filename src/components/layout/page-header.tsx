import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2',
        className
      )}
    >
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>{title}</h2>
        {description && <p className='text-muted-foreground'>{description}</p>}
      </div>
      {children && <div className='flex items-center gap-2'>{children}</div>}
    </div>
  )
}
