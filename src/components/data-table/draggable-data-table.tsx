import {
  type ColumnDef,
  type Table as TanstackTable,
  flexRender,
} from '@tanstack/react-table'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DraggableRow } from './draggable-row'
import { DataTablePagination } from './pagination'

type DraggableDataTableProps<TData, TValue> = {
  table: TanstackTable<TData>
  columns: ColumnDef<TData, TValue>[]
  toolbar?: React.ReactNode
  bulkActions?: React.ReactNode
  emptyMessage?: string
  className?: string
  showPagination?: boolean
  onDragEnd: (event: DragEndEvent) => void
  getRowId: (row: TData) => string
  dragDisabled?: boolean
}

export function DraggableDataTable<TData, TValue>({
  table,
  columns,
  toolbar,
  bulkActions,
  emptyMessage = 'Không có kết quả.',
  className,
  showPagination = true,
  onDragEnd,
  getRowId,
  dragDisabled = false,
}: DraggableDataTableProps<TData, TValue>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const rows = table.getRowModel().rows
  const rowIds = rows.map((row) => getRowId(row.original))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    onDragEnd(event)
  }

  const renderTableHeader = () => (
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} className='group/row'>
          {!dragDisabled && (
            <TableHead className='sticky left-0 w-8 bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted' />
          )}
          {headerGroup.headers.map((header) => (
            <TableHead
              key={header.id}
              colSpan={header.colSpan}
              className={cn(
                'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                header.column.columnDef.meta?.className,
                header.column.columnDef.meta?.thClassName
              )}
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
            </TableHead>
          ))}
        </TableRow>
      ))}
    </TableHeader>
  )

  const renderTableBody = () => {
    const renderCells = (row: (typeof rows)[number]) =>
      row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
            cell.column.columnDef.meta?.className,
            cell.column.columnDef.meta?.tdClassName
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))

    const emptyRow = (
      <TableRow>
        <TableCell
          colSpan={columns.length + (dragDisabled ? 0 : 1)}
          className='h-24 text-center'
        >
          {emptyMessage}
        </TableCell>
      </TableRow>
    )

    if (!rows?.length) {
      return <TableBody>{emptyRow}</TableBody>
    }

    if (dragDisabled) {
      return (
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={getRowId(row.original)}
              data-state={row.getIsSelected() && 'selected'}
              className='group/row'
            >
              {renderCells(row)}
            </TableRow>
          ))}
        </TableBody>
      )
    }

    return (
      <TableBody>
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          {rows.map((row) => (
            <DraggableRow
              key={getRowId(row.original)}
              id={getRowId(row.original)}
              isSelected={row.getIsSelected()}
            >
              {renderCells(row)}
            </DraggableRow>
          ))}
        </SortableContext>
      </TableBody>
    )
  }

  const tableContent = (
    <div className='overflow-hidden rounded-md border'>
      <Table>
        {renderTableHeader()}
        {renderTableBody()}
      </Table>
    </div>
  )

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4',
        className
      )}
    >
      {toolbar}

      {dragDisabled ? (
        tableContent
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          {tableContent}
        </DndContext>
      )}

      {bulkActions}
      {showPagination && <DataTablePagination table={table} />}
    </div>
  )
}
