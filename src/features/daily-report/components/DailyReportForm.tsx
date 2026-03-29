import { useEffect, useRef } from 'react'
import { useForm, useFieldArray, useWatch, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Loader2, TriangleAlert } from 'lucide-react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  dailyReportFormSchema,
  type DailyReportFormValues,
  OUTPUT_TYPE_LABELS,
  OUTPUT_TYPE_PLACEHOLDERS,
  type OutputType,
  hasDiscrepancy,
} from '@/features/daily-report/schemas/daily-report.schema'

// ── CompletedTaskRow ──────────────────────────────────────────────────────────
// Section 1: Tasks Completed Today — có project_tag + description + output + hours

type TaskRowProps = {
  index: number
  control: Control<DailyReportFormValues>
  canRemove: boolean
  onRemove: () => void
}

function CompletedTaskRow({ index, control, canRemove, onRemove }: TaskRowProps) {
  const outputType = useWatch({
    control,
    name: `tasks.${index}.output_type`,
  }) as OutputType

  return (
    <div className='rounded-lg border p-4 space-y-3'>
      <div className='flex items-center justify-between'>
        <span className='text-xs font-medium text-muted-foreground'>Công việc {index + 1}</span>
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

      {/* Project Tag (optional) */}
      <FormField
        control={control}
        name={`tasks.${index}.project_tag`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-xs text-muted-foreground'>Tag dự án</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder='VD: TekSpace, Backend, Mobile...'
                className='h-8 text-sm'
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* Description */}
      <FormField
        control={control}
        name={`tasks.${index}.description`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mô tả task <span className='text-destructive'>*</span></FormLabel>
            <FormControl>
              <Textarea {...field} placeholder='VD: Implement login page, Fix bug #123...' rows={2} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Hours + Output type/link */}
      <div className='flex gap-3 items-start'>
        <FormField
          control={control}
          name={`tasks.${index}.hours`}
          render={({ field }) => (
            <FormItem className='w-[80px] shrink-0'>
              <FormLabel>Số giờ <span className='text-destructive'>*</span></FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={0.5}
                  max={24}
                  step={0.5}
                  placeholder='VD: 2'
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    field.onChange(isNaN(val) ? undefined : val)
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex-1 min-w-0 space-y-1.5'>
          <p className='text-sm font-medium leading-none'>Output</p>
          <div className='flex gap-2'>
            <FormField
              control={control}
              name={`tasks.${index}.output_type`}
              render={({ field }) => (
                <FormItem className='w-[120px] shrink-0'>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Loại' />
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
            <FormField
              control={control}
              name={`tasks.${index}.output_link`}
              render={({ field }) => (
                <FormItem className='flex-1 min-w-0'>
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
        </div>
      </div>
    </div>
  )
}

// ── InProgressTaskRow ─────────────────────────────────────────────────────────
// Section 2: In Progress / Ongoing — project_tag + description + hours (bắt buộc)

type InProgressRowProps = {
  index: number
  control: Control<DailyReportFormValues>
  onRemove: () => void
}

function InProgressTaskRow({ index, control, onRemove }: InProgressRowProps) {
  return (
    <div className='rounded-lg border border-dashed p-4 space-y-3'>
      <div className='flex items-center justify-between'>
        <span className='text-xs font-medium text-muted-foreground'>Đang làm {index + 1}</span>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={onRemove}
          className='h-7 w-7 p-0 text-muted-foreground hover:text-destructive'
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      </div>

      <FormField
        control={control}
        name={`in_progress_tasks.${index}.project_tag`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-xs text-muted-foreground'>Tag dự án</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder='VD: TekSpace, Backend...'
                className='h-8 text-sm'
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`in_progress_tasks.${index}.description`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mô tả task đang làm <span className='text-destructive'>*</span></FormLabel>
            <FormControl>
              <Textarea {...field} placeholder='VD: Đang implement API authentication...' rows={2} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`in_progress_tasks.${index}.hours`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Số giờ đã bỏ hôm nay <span className='text-destructive'>*</span></FormLabel>
            <FormControl>
              <Input
                type='number'
                step='0.5'
                min='0.5'
                max='24'
                placeholder='VD: 1.5'
                className='h-8 text-sm w-28'
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// ── DailyReportForm ───────────────────────────────────────────────────────────

type Props = {
  onSubmit: (values: DailyReportFormValues) => void
  isPending: boolean
  defaultValues?: DailyReportFormValues
  submitLabel?: string
  onCancel?: () => void
}

export function DailyReportForm({ onSubmit, isPending, defaultValues, submitLabel, onCancel }: Props) {
  const form = useForm<DailyReportFormValues>({
    resolver: zodResolver(dailyReportFormSchema) as any,
    defaultValues: defaultValues ?? {
      tasks: [{ task_type: 'completed' as const, description: '', output_type: 'other', output_link: '', hours: undefined }],
      in_progress_tasks: [],
      plan_for_tomorrow: '',
      blockers: '',
      hours_logged: 0,
    },
  })

  // Section 1: Tasks Completed
  const { fields: completedFields, append: appendCompleted, remove: removeCompleted } = useFieldArray({
    control: form.control,
    name: 'tasks',
  })

  // Section 2: In Progress
  const { fields: inProgressFields, append: appendInProgress, remove: removeInProgress } = useFieldArray({
    control: form.control,
    name: 'in_progress_tasks',
  })

  // Watch cả Section 1 và Section 2 cho hours auto-compute
  const hoursWatched = useWatch({ control: form.control, name: 'hours_logged' })
  const tasksWatched = useWatch({ control: form.control, name: 'tasks' })
  const inProgressWatched = useWatch({ control: form.control, name: 'in_progress_tasks' })

  // Auto-compute hours_logged = sum(Section 1 hours) + sum(Section 2 hours)
  // Chỉ auto-compute khi TẤT CẢ tasks (cả 2 section) đều đã nhập hours > 0
  const didMountRef = useRef(false)
  useEffect(() => {
    const completed = tasksWatched ?? []
    const inProgress = inProgressWatched ?? []
    const allCompletedFilled = completed.length > 0 && completed.every(t => t.hours !== undefined && t.hours > 0)
    const allInProgressFilled = inProgress.every(t => t.hours !== undefined && t.hours > 0)
    if (allCompletedFilled && allInProgressFilled) {
      const sum =
        completed.reduce((acc, t) => acc + (t.hours ?? 0), 0) +
        inProgress.reduce((acc, t) => acc + (t.hours ?? 0), 0)
      form.setValue('hours_logged', sum, { shouldDirty: false, shouldValidate: false })
    } else if (didMountRef.current) {
      form.setValue('hours_logged', 0, { shouldDirty: false, shouldValidate: false })
    }
    didMountRef.current = true
  }, [tasksWatched, inProgressWatched, form])

  const showFlag = hasDiscrepancy(hoursWatched ?? 0, tasksWatched ?? [])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <fieldset disabled={isPending} className='space-y-6'>

          {/* ── Section 1: Tasks Completed Today ──────────────────────────── */}
          <div className='space-y-4'>
            <h3 className='text-sm font-semibold flex items-center gap-2'>
              ✅ Các task đã hoàn thành
            </h3>

            {completedFields.map((field, index) => (
              <CompletedTaskRow
                key={field.id}
                index={index}
                control={form.control}
                canRemove={completedFields.length > 1}
                onRemove={() => removeCompleted(index)}
              />
            ))}

            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => appendCompleted({
                task_type: 'completed',
                project_tag: '',
                description: '',
                output_type: 'other',
                output_link: '',
                hours: undefined as unknown as number,
              })}
              className='w-full'
            >
              <Plus className='mr-2 h-4 w-4' />
              Thêm task đã hoàn thành
            </Button>
          </div>

          <Separator />

          {/* ── Section 2: In Progress / Ongoing ──────────────────────────── */}
          <div className='space-y-4'>
            <h3 className='text-sm font-semibold flex items-center gap-2'>
              🔄 Đang làm dở
            </h3>

            {inProgressFields.length === 0 && (
              <p className='text-xs text-muted-foreground italic'>Không có task nào đang dở.</p>
            )}

            {inProgressFields.map((field, index) => (
              <InProgressTaskRow
                key={field.id}
                index={index}
                control={form.control}
                onRemove={() => removeInProgress(index)}
              />
            ))}

            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => appendInProgress({ task_type: 'in_progress', project_tag: '', description: '', hours: undefined as unknown as number })}
              className='w-full border-dashed'
            >
              <Plus className='mr-2 h-4 w-4' />
              Thêm task đang làm
            </Button>
          </div>

          <Separator />

          {/* ── Tổng giờ (từ Section 1) ────────────────────────────────────── */}
          <div className='flex items-center justify-between rounded-lg border px-4 py-3'>
            <p className='text-sm font-medium'>Tổng giờ làm việc</p>
            {(hoursWatched ?? 0) > 0 ? (
              <p className='text-sm font-semibold'>{hoursWatched}h</p>
            ) : (
              <p className='text-sm text-muted-foreground'>—</p>
            )}
          </div>

          {/* Discrepancy flag */}
          {showFlag && (
            <Alert className='border-yellow-200 bg-yellow-50 text-yellow-800'>
              <TriangleAlert className='h-4 w-4 text-yellow-600' aria-hidden='true' />
              <AlertDescription>
                <p>
                  Bạn báo cáo {hoursWatched}h nhưng số lượng tasks có vẻ ít — muốn thêm task không?
                </p>
                <div className='mt-2 flex gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    className='border-yellow-300 bg-white text-yellow-800 hover:bg-yellow-50'
                    onClick={() => appendCompleted({
                      task_type: 'completed',
                      project_tag: '',
                      description: '',
                      output_type: 'other',
                      output_link: '',
                      hours: undefined as unknown as number,
                    })}
                  >
                    <Plus className='mr-1 h-3 w-3' />
                    Thêm công việc
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-yellow-700 hover:bg-yellow-100'
                    onClick={() => form.handleSubmit(onSubmit)()}
                  >
                    Bỏ qua, nộp luôn
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* ── Section 3: Plan for Tomorrow ──────────────────────────────── */}
          <FormField
            control={form.control}
            name='plan_for_tomorrow'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='text-sm font-semibold'>📋 Plan for Tomorrow</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    placeholder='Kế hoạch ngày mai... VD: Viết unit tests cho auth module, Review PR của team...'
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Section 4: Blockers / Issues ──────────────────────────────── */}
          <FormField
            control={form.control}
            name='blockers'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='text-sm font-semibold'>🚧 Blockers / Issues</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    placeholder='Có blockers hay issues nào không? VD: Blocked bởi API chưa ready, Cần review architecture trước khi tiếp tục...'
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Submit / Cancel ───────────────────────────────────────────── */}
          <Button type='submit' className='w-full'>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {submitLabel ?? 'Nộp báo cáo'}
          </Button>
          {onCancel && (
            <Button
              type='button'
              variant='ghost'
              className='w-full'
              onClick={onCancel}
              disabled={isPending}
            >
              Huỷ
            </Button>
          )}
        </fieldset>
      </form>
    </Form>
  )
}
