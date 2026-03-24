import { useForm, useFieldArray, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  dailyReportFormSchema,
  type DailyReportFormValues,
  OUTPUT_TYPE_LABELS,
  OUTPUT_TYPE_PLACEHOLDERS,
  type OutputType,
} from '@/features/daily-report/schemas/daily-report.schema'

// ── TaskRow — sub-component để tránh form.watch() trong map callback ─────────

type TaskRowProps = {
  index: number
  control: Control<DailyReportFormValues>
  canRemove: boolean
  onRemove: () => void
}

function TaskRow({ index, control, canRemove, onRemove }: TaskRowProps) {
  // useWatch là memoization-safe thay cho form.watch() trong loop
  const outputType = useWatch({
    control,
    name: `tasks.${index}.output_type`,
  }) as OutputType

  return (
    <div className='rounded-lg border p-4 space-y-3'>
      <div className='flex items-center justify-between'>
        <span className='text-xs font-medium text-muted-foreground'>Task {index + 1}</span>
        {canRemove && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={onRemove}
            className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        )}
      </div>

      {/* Description */}
      <FormField
        control={control}
        name={`tasks.${index}.description`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mô tả task</FormLabel>
            <FormControl>
              <Textarea {...field} placeholder='VD: Implement login page, Fix bug #123...' rows={2} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Output type */}
      <FormField
        control={control}
        name={`tasks.${index}.output_type`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Loại output</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Chọn loại output' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(OUTPUT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Output link */}
      <FormField
        control={control}
        name={`tasks.${index}.output_link`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Output link{' '}
              <span className='text-muted-foreground font-normal'>(optional)</span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={OUTPUT_TYPE_PLACEHOLDERS[outputType]}
                type={outputType === 'other' ? 'text' : 'url'}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// ── DailyReportForm ──────────────────────────────────────────────────────────

type Props = {
  onSubmit: (values: DailyReportFormValues) => void
  isPending: boolean
}

export function DailyReportForm({ onSubmit, isPending }: Props) {
  const form = useForm<DailyReportFormValues>({
    resolver: zodResolver(dailyReportFormSchema),
    defaultValues: {
      tasks: [{ description: '', output_type: 'other', output_link: '' }],
      hours_logged: 0,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tasks',
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <fieldset disabled={isPending} className='space-y-6'>
          {/* Tasks list */}
          <div className='space-y-4'>
            <h3 className='text-sm font-medium'>Danh sách tasks ({fields.length})</h3>

            {fields.map((field, index) => (
              <TaskRow
                key={field.id}
                index={index}
                control={form.control}
                canRemove={fields.length > 1}
                onRemove={() => remove(index)}
              />
            ))}

            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => append({ description: '', output_type: 'other', output_link: '' })}
              className='w-full'
            >
              <Plus className='mr-2 h-4 w-4' />
              Thêm task
            </Button>
          </div>

          <Separator />

          {/* Hours logged */}
          <FormField
            control={form.control}
            name='hours_logged'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số giờ đã làm việc</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type='number'
                    min={0}
                    max={24}
                    step={0.5}
                    placeholder='VD: 8'
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type='submit' className='w-full'>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Nộp Daily Report
          </Button>
        </fieldset>
      </form>
    </Form>
  )
}
