import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import type { ImportResult } from '../types/ai-parse.types'

interface ImportResultSummaryProps {
  result: ImportResult
  onClose: () => void
}

export function ImportResultSummary({ result, onClose }: ImportResultSummaryProps) {
  const handleCopyErrors = () => {
    if (result.errors.length === 0) return
    const text = result.errors.map((e) => `${e.rowKey}: ${e.message}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Đã copy danh sách lỗi vào clipboard')
    })
  }

  return (
    <div className='space-y-4'>
      {/* Summary cards */}
      <div className='grid grid-cols-3 gap-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Đã import</CardTitle>
            <CheckCircle2 className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>{result.imported}</div>
            <p className='text-xs text-muted-foreground'>report thành công</p>
          </CardContent>
        </Card>

        {result.overwritten > 0 && (
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Ghi đè</CardTitle>
              <AlertTriangle className='h-4 w-4 text-amber-600' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-amber-600'>{result.overwritten}</div>
              <p className='text-xs text-muted-foreground'>report được thay thế</p>
            </CardContent>
          </Card>
        )}

        {result.skipped > 0 && (
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Bỏ qua</CardTitle>
              <Info className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-muted-foreground'>{result.skipped}</div>
              <p className='text-xs text-muted-foreground'>report đã tồn tại</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Error list */}
      {result.errors.length > 0 && (
        <Alert variant='destructive'>
          <XCircle className='h-4 w-4' />
          <AlertDescription className='space-y-1'>
            <p className='font-medium'>
              {result.errors.length} lỗi khi import
            </p>
            <ul className='list-disc list-inside text-xs space-y-0.5'>
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>
                  <span className='font-medium'>{e.rowKey}:</span> {e.message}
                </li>
              ))}
              {result.errors.length > 5 && (
                <li className='italic'>... và {result.errors.length - 5} lỗi khác</li>
              )}
            </ul>
            <Button variant='outline' size='sm' className='mt-2 h-7' onClick={handleCopyErrors}>
              Copy danh sách lỗi
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Close button */}
      <div className='flex justify-end'>
        <Button onClick={onClose} variant='outline'>
          Đóng
        </Button>
      </div>
    </div>
  )
}
