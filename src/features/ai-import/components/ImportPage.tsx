import { useState, useMemo, useCallback } from 'react'
import { Bot, Upload, Loader2, AlertTriangle, Info, ChevronDown, ChevronUp, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AiImportService, buildBatches } from '../services/ai-import.service'
import { updateMapping, findBestMatch } from '../lib/user-mapping'
import { ImportPreviewTable } from './ImportPreviewTable'
import { UserMappingModal } from './UserMappingModal'
import { ImportResultSummary } from './ImportResultSummary'
import type { AuthorMapping, ImportReportRow, ImportResult } from '../types/ai-parse.types'

interface ImportPageProps {
  tenantId: string
}

type ImportPhase = 'input' | 'batch-select' | 'preview' | 'result'

export interface Batch {
  id: string
  text: string
  dateRange: string
  preview: string
}

interface BatchState {
  batch: Batch
  status: 'pending' | 'loading' | 'success' | 'error'
  error?: string
  reportCount?: number
  selected: boolean
}

export function ImportPage({ tenantId }: ImportPageProps) {
  // ── Phase state ─────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<ImportPhase>('input')
  const [rawText, setRawText] = useState('')
  const [batches, setBatches] = useState<BatchState[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [batchShowAll, setBatchShowAll] = useState(false)
  const [importRows, setImportRows] = useState<ImportReportRow[]>([])
  const [mappings, setMappings] = useState<Record<string, AuthorMapping>>({})
  const [importMode, setImportMode] = useState<'skip' | 'overwrite'>('skip')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [selectedAuthor, setSelectedAuthor] = useState('')

  // ── Fetch TekSpace users ───────────────────────────────────────────────────
  const { data: tenantUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['tenant-users-for-import', tenantId],
    queryFn: () => AiImportService.getTenantUsers(tenantId),
    enabled: phase !== 'input',
  })

  // ── Derived state ───────────────────────────────────────────────────────────
  const selectedBatches = useMemo(
    () => batches.filter((b) => b.selected),
    [batches]
  )

  const pendingBatches = useMemo(
    () => batches.filter((b) => b.status === 'pending' && b.selected),
    [batches]
  )

  const failedBatches = useMemo(
    () => batches.filter((b) => b.status === 'error'),
    [batches]
  )

  const unmappedRows = useMemo(() => importRows.filter((r) => r.isUnmapped), [importRows])
  const allUnmapped = useMemo(
    () => unmappedRows.length === importRows.length && importRows.length > 0,
    [unmappedRows, importRows]
  )

  const authorDisplayNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const row of importRows) {
      const mapping = mappings[row.author]
      const user = tenantUsers.find((u) => u.id === mapping?.userId)
      if (user) names[row.author] = user.full_name
    }
    return names
  }, [importRows, mappings, tenantUsers])

  const suggestedMatch = useMemo(() => {
    if (!selectedAuthor) return null
    return findBestMatch(selectedAuthor, tenantUsers)
  }, [selectedAuthor, tenantUsers])

  // ── Step 1: Preview batches ────────────────────────────────────────────────
  const handlePreviewBatches = () => {
    if (!rawText.trim()) {
      toast.error('Vui lòng dán nội dung chat export vào')
      return
    }
    const batchList = buildBatches(rawText)
    setBatches(
      batchList.map((batch) => ({
        batch,
        status: 'pending' as const,
        selected: true,
      }))
    )
    setPhase('batch-select')
    setParseError(null)
  }

  // ── Step 2: Parse selected batches (concurrent) ────────────────────────────
  const handleParseAll = useCallback(async () => {
    const toParse = batches.filter((b) => b.status === 'pending' && b.selected)
    if (toParse.length === 0) {
      toast.error('Không có batch nào để parse')
      return
    }

    // Mark selected pending batches as loading
    setBatches((prev) =>
      prev.map((b) =>
        b.status === 'pending' && b.selected ? { ...b, status: 'loading' as const } : b
      )
    )

    // Concurrent parse with semaphore (max 3 at once)
    const CONCURRENCY = 3
    let running = 0
    let queueIdx = 0
    const totalReports: Awaited<ReturnType<typeof AiImportService.parseReports>>['reports'] = []
    let hasError = false

    const processBatch = async (batchState: typeof toParse[number]): Promise<void> => {
      try {
        const result = await AiImportService.parseReports(batchState.batch.text)
        setBatches((prev) =>
          prev.map((b) =>
            b.batch.id === batchState.batch.id
              ? { ...b, status: 'success' as const, reportCount: result.reports.length }
              : b
          )
        )
        totalReports.push(...result.reports)
      } catch (err) {
        hasError = true
        setBatches((prev) =>
          prev.map((b) =>
            b.batch.id === batchState.batch.id
              ? {
                  ...b,
                  status: 'error' as const,
                  error: err instanceof Error ? err.message : 'Parse thất bại',
                }
              : b
          )
        )
      }
    }

    await new Promise<void>((resolve) => {
      const startNext = () => {
        if (queueIdx >= toParse.length) {
          if (running === 0) resolve()
          return
        }
        running++
        const batch = toParse[queueIdx++]
        processBatch(batch).finally(() => {
          running--
          startNext()
        })
      }
      for (let i = 0; i < Math.min(CONCURRENCY, toParse.length); i++) startNext()
    })

    if (totalReports.length > 0) {
      // Merge with existing importRows (deduplicate)
      setImportRows((prev) => {
        const seen = new Set(prev.map((r) => r.rowKey))
        const newRows = AiImportService.buildImportRows(totalReports, {}).filter((r) => !seen.has(r.rowKey))
        return [...prev, ...newRows]
      })
      setPhase('preview')
    } else if (hasError) {
      setParseError('Tất cả batch đều thất bại. Nhấn Retry để thử lại từng batch.')
    }
  }, [batches])

  // ── Step 3: Retry single batch ──────────────────────────────────────────────
  const handleRetryBatch = useCallback(async (batchId: string) => {
    const batchState = batches.find((b) => b.batch.id === batchId)
    if (!batchState) return

    const parseWithRetry = async (): Promise<void> => {
      const delays = [0, 5000, 12000]
      let lastError: Error | null = null

      for (let attempt = 0; attempt <= 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt]))

        setBatches((prev) =>
          prev.map((b) =>
            b.batch.id === batchId
              ? { ...b, status: 'loading' as const, error: undefined } : b
          )
        )

        try {
          const result = await AiImportService.parseReports(batchState.batch.text)
          const newRows = AiImportService.buildImportRows(result.reports, {})

          setImportRows((prev) => {
            const seen = new Set(prev.map((r) => r.rowKey))
            const added = newRows.filter((r) => !seen.has(r.rowKey))
            return [...prev, ...added]
          })

          setBatches((prev) =>
            prev.map((b) =>
              b.batch.id === batchId
                ? { ...b, status: 'success' as const, reportCount: result.reports.length }
                : b
            )
          )
          if (attempt > 0) toast.success(`Batch đã parse thành công sau ${attempt} retry`)
          return
        } catch (err) {
          lastError = err instanceof Error ? err : new Error('Parse thất bại')
          // If 429, continue to retry; otherwise break on other errors
          if (!lastError.message.includes('429') && !lastError.message.includes('rate')) {
            break
          }
        }
      }

      setBatches((prev) =>
        prev.map((b) =>
          b.batch.id === batchId
            ? { ...b, status: 'error' as const, error: lastError?.message ?? 'Parse thất bại' }
            : b
        )
      )
    }

    void parseWithRetry()
  }, [batches])

  // ── Toggle batch selection ─────────────────────────────────────────────────
  const toggleBatch = useCallback((batchId: string) => {
    setBatches((prev) =>
      prev.map((b) =>
        b.batch.id === batchId && b.status !== 'loading' ? { ...b, selected: !b.selected } : b
      )
    )
  }, [])

  // ── Import ──────────────────────────────────────────────────────────────────
  const importMutation = useMutation({
    mutationFn: (importOnlyMapped: boolean) =>
      AiImportService.importReports(importRows, importMode, tenantId, importOnlyMapped),
    onSuccess: (result: ImportResult) => {
      setImportResult(result)
      setPhase('result')
      toast.success(`Đã import ${result.imported} report`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Import thất bại')
    },
  })

  const handleOpenMappingModal = (author: string) => {
    setSelectedAuthor(author)
    setMappingModalOpen(true)
  }

  const handleConfirmMapping = (userId: string) => {
    const user = tenantUsers.find((u) => u.id === userId)
    if (!user) return
    const newMapping: AuthorMapping = { externalAuthor: selectedAuthor, userId, confidence: 1.0 }
    updateMapping(tenantId, selectedAuthor, newMapping)
    setMappings((prev) => ({ ...prev, [selectedAuthor]: newMapping }))
    setImportRows((prev) => AiImportService.updateRowMapping(prev, selectedAuthor, userId))
    setMappingModalOpen(false)
    toast.success(`Đã map "${selectedAuthor}" → "${user.full_name}"`)
  }

  const handleBackToInput = () => {
    setPhase('input')
    setImportRows([])
    setMappings({})
    setImportResult(null)
    setRawText('')
    setBatches([])
    setParseError(null)
  }

  const handleBackToBatchSelect = () => {
    setPhase('batch-select')
    // Keep importRows + mappings — they persist across batch retries
  }

  // ── Render: Input Phase ────────────────────────────────────────────────────
  if (phase === 'input') {
    return (
      <div className='max-w-3xl mx-auto space-y-6'>
        <div className='space-y-1.5'>
          <h1 className='text-2xl font-bold'>Import Daily Reports</h1>
          <p className='text-sm text-muted-foreground'>
            Dán nội dung export từ Slack, Discord, MS Teams... và để AI parse thành structured data.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='text-base flex items-center gap-2'>
              <Upload className='h-4 w-4' />
              Nội dung chat export
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='chat-export' className='text-sm'>
                Dán nội dung vào đây
              </Label>
              <Textarea
                id='chat-export'
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Ví dụ format Slack:\n[9:00 AM] @nguyen_van_a:\nCompleted: Task A (2h), Task B (1h)\nIn Progress: Task C (3h)\nBlockers: None\nPlan: Fix bug X\n\n[9:05 AM] @tran_thi_b:\nCompleted: Feature Y (4h)\n...`}
                className='min-h-64 font-mono text-sm'
              />
            </div>

            <Alert>
              <Info className='h-4 w-4' />
              <AlertDescription className='text-sm'>
                AI có thể xử lý nhiều format khác nhau. Càng nhiều context thì parse càng chính xác.
              </AlertDescription>
            </Alert>

            <div className='flex justify-end gap-2'>
              {importRows.length > 0 && (
                <Button
                  variant='outline'
                  onClick={() => setPhase('preview')}
                >
                  ← Quay lại review ({importRows.length} reports)
                </Button>
              )}
              <Button onClick={handlePreviewBatches} disabled={!rawText.trim()}>
                <Bot className='h-4 w-4' />
                Xem trước batches
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render: Batch Select Phase ───────────────────────────────────────────────
  if (phase === 'batch-select') {
    const displayed = batchShowAll ? batches : batches.slice(0, 10)
    const loadingCount = batches.filter((b) => b.status === 'loading').length
    const isParsing = loadingCount > 0

    return (
      <div className='max-w-3xl mx-auto space-y-6'>
        <div className='flex items-center justify-between'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold'>Chọn Batches để Parse</h1>
            <p className='text-sm text-muted-foreground'>
              {selectedBatches.length} / {batches.length} batch được chọn
              {failedBatches.length > 0 && (
                <span className='text-red-600 ml-2'>· {failedBatches.length} batch lỗi</span>
              )}
            </p>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={handleBackToInput}>
              ← Quay lại
            </Button>
            <Button
              onClick={() => void handleParseAll()}
              disabled={pendingBatches.length === 0 || isParsing}
            >
              {isParsing ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Đang parse...
                </>
              ) : (
                <>
                  <Bot className='h-4 w-4' />
                  Parse {selectedBatches.length} batch
                </>
              )}
            </Button>
            {importRows.length > 0 && (
              <Button variant='default' onClick={() => setPhase('preview')}>
                Review & Map →
              </Button>
            )}
          </div>
        </div>

        {/* Batch stats */}
        <div className='flex gap-4 text-sm'>
          <span className='flex items-center gap-1'>
            <span className='h-2 w-2 rounded-full bg-gray-400' />
            {batches.filter((b) => b.status === 'pending').length} chờ
          </span>
          <span className='flex items-center gap-1'>
            <span className='h-2 w-2 rounded-full bg-green-500' />
            {batches.filter((b) => b.status === 'success').length} thành công
          </span>
          <span className='flex items-center gap-1'>
            <span className='h-2 w-2 rounded-full bg-red-500' />
            {batches.filter((b) => b.status === 'error').length} lỗi
          </span>
        </div>

        {parseError && (
          <Alert variant='destructive'>
            <AlertTriangle className='h-4 w-4' />
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}

        {/* Batch list */}
        <div className='space-y-2'>
          {displayed.map((bs) => (
            <BatchCardItem
              key={bs.batch.id}
              bs={bs}
              onToggle={() => toggleBatch(bs.batch.id)}
              onRetry={() => void handleRetryBatch(bs.batch.id)}
            />
          ))}
          {batches.length > 10 && (
            <Button
              variant='ghost'
              className='w-full'
              onClick={() => setBatchShowAll((v) => !v)}
            >
              {batchShowAll ? (
                <>
                  <ChevronUp className='h-4 w-4' />
                  Ẩn bớt
                </>
              ) : (
                <>
                  <ChevronDown className='h-4 w-4' />
                  Xem thêm {batches.length - 10} batch
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Render: Loading users ────────────────────────────────────────────────────
  if (phase === 'preview' && isLoadingUsers) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  // ── Render: Preview Phase ────────────────────────────────────────────────────
  if (phase === 'preview') {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold'>Preview Import</h1>
            <p className='text-sm text-muted-foreground'>
              {importRows.length} report · {unmappedRows.length} chưa map
            </p>
          </div>
          <Button variant='outline' onClick={handleBackToBatchSelect}>
            ← Quay lại batches
          </Button>
        </div>

        {unmappedRows.length > 0 && (
          <Alert className='border-yellow-500'>
            <AlertTriangle className='h-4 w-4 text-yellow-600' />
            <AlertDescription className='flex items-center justify-between'>
              <span>
                <strong>{unmappedRows.length}</strong> author chưa được map.
                {allUnmapped ? ' Import button sẽ bị disabled.' : ' Nhấn vào badge để map.'}
              </span>
              {unmappedRows.length > 0 && !allUnmapped && (
                <Button
                  variant='outline'
                  size='sm'
                  className='h-7 text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-50'
                  onClick={() => handleOpenMappingModal(unmappedRows[0].author)}
                >
                  Map author
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <ImportPreviewTable
          rows={importRows}
          onOpenMappingModal={handleOpenMappingModal}
          authorDisplayNames={authorDisplayNames}
        />

        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Tùy chọn Import</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center gap-6'>
              <div className='space-y-1.5'>
                <Label className='text-xs text-muted-foreground'>Khi report đã tồn tại</Label>
                <Select
                  value={importMode}
                  onValueChange={(v) => setImportMode(v as 'skip' | 'overwrite')}
                >
                  <SelectTrigger className='w-48'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='skip'>Skip (giữ nguyên)</SelectItem>
                    <SelectItem value='overwrite'>Overwrite (ghi đè)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {allUnmapped && (
              <Alert variant='destructive'>
                <AlertTriangle className='h-4 w-4' />
                <AlertDescription>
                  Không có report nào được map. Vui lòng map author trước khi import.
                </AlertDescription>
              </Alert>
            )}

            <div className='flex gap-3'>
              <Button
                onClick={() => importMutation.mutate(false)}
                disabled={allUnmapped || importMutation.isPending}
              >
                {importMutation.isPending && importMutation.variables === false ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : null}
                Import tất cả
              </Button>

              {!allUnmapped && unmappedRows.length > 0 && (
                <Button
                  variant='outline'
                  onClick={() => importMutation.mutate(true)}
                  disabled={importMutation.isPending}
                >
                  Import only mapped ({importRows.length - unmappedRows.length})
                </Button>
              )}

              {unmappedRows.length > 0 && !allUnmapped && (
                <Alert className='flex-1 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'>
                  <AlertDescription className='text-xs text-yellow-800 dark:text-yellow-300'>
                    {unmappedRows.length} report sẽ bị skip
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        <UserMappingModal
          open={mappingModalOpen}
          onOpenChange={setMappingModalOpen}
          externalAuthor={selectedAuthor}
          suggestedMatch={suggestedMatch}
          availableUsers={tenantUsers}
          currentMapping={mappings[selectedAuthor]}
          onConfirm={handleConfirmMapping}
        />
      </div>
    )
  }

  // ── Render: Result Phase ────────────────────────────────────────────────────
  if (phase === 'result' && importResult) {
    return (
      <div className='max-w-3xl mx-auto space-y-6'>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold'>Kết quả Import</h1>
          <Button variant='outline' onClick={handleBackToInput}>
            Import thêm
          </Button>
        </div>
        <ImportResultSummary result={importResult} onClose={handleBackToInput} />
      </div>
    )
  }

  return null
}

// ── Inline batch card ───────────────────────────────────────────────────────────

import { cn } from '@/lib/utils'

function BatchCardItem({
  bs,
  onToggle,
  onRetry,
}: {
  bs: BatchState
  onToggle: () => void
  onRetry: () => void
}) {
  const { batch, status, error, reportCount, selected } = bs
  const isLoading = status === 'loading'

  return (
    <div
      className={cn(
        'border rounded-lg p-4 transition-all',
        selected && status === 'pending' && 'border-blue-400 bg-blue-50 dark:bg-blue-950/20',
        status === 'success' && 'border-green-400 bg-green-50 dark:bg-green-950/20',
        status === 'error' && 'border-red-400 bg-red-50 dark:bg-red-950/20',
        !selected && status === 'pending' && 'opacity-50',
        isLoading && 'border-blue-400 bg-blue-50 dark:bg-blue-950/20',
      )}
    >
      <div className='flex items-start gap-3'>
        <input
          type='checkbox'
          checked={selected}
          onChange={onToggle}
          disabled={isLoading}
          className='mt-1 h-4 w-4 rounded border-gray-400 cursor-pointer'
        />
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-1 flex-wrap'>
            <span className='text-sm font-medium'>{batch.dateRange}</span>
            {status === 'pending' && (
              <span className='text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'>
                Chờ
              </span>
            )}
            {isLoading && (
              <span className='flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200'>
                <Loader2 className='h-3 w-3 animate-spin' />
                Đang parse...
              </span>
            )}
            {status === 'success' && (
              <span className='flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-200'>
                <CheckCircle className='h-3 w-3' />
                {reportCount ?? '?'} reports
              </span>
            )}
            {status === 'error' && (
              <span className='flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200'>
                <XCircle className='h-3 w-3' />
                Lỗi
              </span>
            )}
          </div>
          <p className='text-xs text-muted-foreground truncate font-mono'>{batch.preview}</p>
          {status === 'error' && error && (
            <p className='text-xs text-red-600 dark:text-red-400 mt-1'>{error}</p>
          )}
        </div>
        {status === 'error' && (
          <Button
            variant='ghost'
            size='sm'
            className='h-8 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0'
            onClick={onRetry}
          >
            <RotateCcw className='h-3 w-3' />
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}
