import { type HTMLAttributes } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TableCell, TableRow } from '@/components/ui/table'

type DraggableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  id: string
  isSelected?: boolean
}

export function DraggableRow({
  id,
  isSelected,
  children,
  className,
  ...props
}: DraggableRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={isSelected && 'selected'}
      className={cn('group/row relative', className)}
      {...props}
    >
      <TableCell
        className={cn(
          'w-8 cursor-grab bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted active:cursor-grabbing'
        )}
        aria-label='Reorder row'
        {...attributes}
        {...listeners}
      >
        <GripVertical
          className='h-4 w-4 text-muted-foreground'
          aria-hidden='true'
        />
      </TableCell>
      {children}
    </TableRow>
  )
}
