import { useState, useMemo } from 'react'
import { Bot, Upload, Loader2, AlertTriangle, Info } from 'lucide-react'
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
import { AiImportService } from '../services/ai-import.service'
import { autoMapAuthors, updateMapping, findBestMatch } from '../lib/user-mapping'
import { ImportPreviewTable } from './ImportPreviewTable'
import { UserMappingModal } from './UserMappingModal'
import { ImportResultSummary } from './ImportResultSummary'
import type { AuthorMapping, ImportReportRow, ImportResult, AiParseResponse } from '../types/ai-parse.types'

interface ImportPageProps {
  tenantId: string
}

type ImportPhase = 'input' | 'preview' | 'result'

export function ImportPage({ tenantId }: ImportPageProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [rawText, setRawText] = useState('')
  const [phase, setPhase] = useState<ImportPhase>('input')
  const [importRows, setImportRows] = useState<ImportReportRow[]>([])
  const [mappings, setMappings] = useState<Record<string, AuthorMapping>>({})
  const [importMode, setImportMode] = useState<'skip' | 'overwrite'>('skip')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [selectedAuthor, setSelectedAuthor] = useState('')

  // ── Fetch TekSpace users ───────────────────────────────────────────────────
  const {
    data: tenantUsers = [],
    isLoading: isLoadingUsers,
  } = useQuery({
    queryKey: ['tenant-users-for-import', tenantId],
    queryFn: () => AiImportService.getTenantUsers(tenantId),
    enabled: phase !== 'input',
  })

  // ── Parse mutation ─────────────────────────────────────────────────────────
  const parseMutation = useMutation({
    mutationFn: (text: string) => AiImportService.parseReports(text),
    onSuccess: (data: AiParseResponse) => {
      const uniqueAuthors = [...new Set(data.reports.map((r) => r.author))]
      const autoMappings = autoMapAuthors(uniqueAuthors, tenantUsers, tenantId)
      const rows = AiImportService.buildImportRows(data.reports, autoMappings)
      setMappings(autoMappings)
      setImportRows(rows)
      setPhase('preview')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Parse thất bại. Vui lòng thử lại.')
    },
  })

  // ── Import mutation ────────────────────────────────────────────────────────
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

  // ── Derived state ─────────────────────────────────────────────────────────
  const unmappedRows = useMemo(
    () => importRows.filter((r) => r.isUnmapped),
    [importRows]
  )

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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleParse = () => {
    if (!rawText.trim()) {
      toast.error('Vui lòng dán nội dung chat export vào')
      return
    }
    parseMutation.mutate(rawText)
  }

  const handleOpenMappingModal = (author: string) => {
    setSelectedAuthor(author)
    setMappingModalOpen(true)
  }

  const handleConfirmMapping = (userId: string) => {
    const user = tenantUsers.find((u) => u.id === userId)
    if (!user) return

    const newMapping: AuthorMapping = {
      externalAuthor: selectedAuthor,
      userId,
      confidence: 1.0,
    }

    updateMapping(tenantId, selectedAuthor, newMapping)
    setMappings((prev) => ({ ...prev, [selectedAuthor]: newMapping }))
    setImportRows((prev) => AiImportService.updateRowMapping(prev, selectedAuthor, userId))
    setMappingModalOpen(false)
    toast.success(`Đã map "${selectedAuthor}" → "${user.full_name}"`)
  }

  const handleImport = (importOnlyMapped: boolean) => {
    importMutation.mutate(importOnlyMapped)
  }

  const handleBackToInput = () => {
    setPhase('input')
    setImportRows([])
    setMappings({})
    setImportResult(null)
    setRawText('')
  }

  const suggestedMatch = useMemo(() => {
    if (!selectedAuthor) return null
    return findBestMatch(selectedAuthor, tenantUsers)
  }, [selectedAuthor, tenantUsers])

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
                AI có thể xử lý nhiều format khác nhau. Càng nhiều context (tên, ngày, task descriptions) thì
                parse càng chính xác.
              </AlertDescription>
            </Alert>

            <div className='flex justify-end'>
              <Button
                onClick={() => void handleParse()}
                disabled={!rawText.trim() || parseMutation.isPending}
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Đang parse...
                  </>
                ) : (
                  <>
                    <Bot className='h-4 w-4' />
                    Parse with AI 🤖
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
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
          <Button variant='outline' onClick={handleBackToInput}>
            ← Quay lại
          </Button>
        </div>

        {unmappedRows.length > 0 && (
          <Alert className='border-yellow-500'>
            <AlertTriangle className='h-4 w-4 text-yellow-600' />
            <AlertDescription className='flex items-center justify-between'>
              <span>
                <strong>{unmappedRows.length}</strong> author chưa được map.{' '}
                {allUnmapped
                  ? 'Import button sẽ bị disabled.'
                  : 'Nhấn vào badge "Chưa map" để map từng author.'}
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
                onClick={() => handleImport(false)}
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
                  onClick={() => handleImport(true)}
                  disabled={importMutation.isPending}
                >
                  Import only mapped ({importRows.length - unmappedRows.length})
                </Button>
              )}

              {unmappedRows.length > 0 && !allUnmapped && (
                <Alert className='flex-1 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'>
                  <AlertDescription className='text-xs text-yellow-800 dark:text-yellow-300'>
                    {unmappedRows.length} report sẽ bị skip khi dùng "Import only mapped"
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

        <ImportResultSummary
          result={importResult}
          onClose={handleBackToInput}
        />
      </div>
    )
  }

  return null
}
