import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Plus, Copy, KeyRound, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DataTable } from '@/components/data-table/data-table'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useAuthStore } from '@/stores/auth-store'
import type { DeviceTokenRow } from '@/lib/usage-types'

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/account/tokens')({
  head: () => ({
    meta: [{ title: 'API Tokens — TekSpace' }],
  }),
  component: AccountTokensPage,
})

// ── Untyped client helper ─────────────────────────────────────────────────────
// The generated Database type does not yet include the usage-tracking tables
// (migration applied locally but not regenerated against cloud).
// We cast through `unknown` at the query boundary only, keeping all call-site
// types explicit via our local DeviceTokenRow / UsageSnapshotRow types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, args?: unknown) => any }

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchDeviceTokens(): Promise<DeviceTokenRow[]> {
  const { data, error } = await (db.from('device_tokens') as ReturnType<typeof db.from>)
    .select('id, user_id, tenant_id, token_hash, token_prefix, label, last_used_at, created_at, revoked_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as DeviceTokenRow[]
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Show-once screen displayed after a token is successfully created */
function CreatedTokenDisplay({
  rawToken,
  onClose,
}: {
  rawToken: string
  onClose: () => void
}) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawToken)
      toast.success('Đã sao chép token vào clipboard')
    } catch {
      toast.error('Không thể sao chép. Vui lòng sao chép thủ công.')
    }
  }

  return (
    <div className='space-y-4'>
      <div className='rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'>
        <p className='font-semibold'>Token chỉ hiển thị một lần duy nhất.</p>
        <p className='mt-1'>Sao chép ngay — bạn sẽ không thể xem lại sau khi đóng cửa sổ này.</p>
      </div>

      <div className='space-y-2'>
        <Label>Token của bạn</Label>
        <div className='flex items-center gap-2'>
          <code className='flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-sm'>
            {rawToken}
          </code>
          <Button type='button' variant='outline' size='icon' onClick={handleCopy} title='Sao chép'>
            <Copy className='size-4' />
          </Button>
        </div>
      </div>

      <div className='rounded-md border bg-muted p-3 text-xs text-muted-foreground'>
        <p className='font-medium mb-1'>Cách sử dụng:</p>
        <p>
          Thêm dòng sau vào file{' '}
          <code className='font-mono text-foreground'>~/.claude/.env</code>:
        </p>
        <code className='mt-1 block font-mono text-foreground break-all'>
          TEAM_USAGE_TOKEN={rawToken}
        </code>
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Tôi đã sao chép token</Button>
      </DialogFooter>
    </div>
  )
}

/** Dialog for creating a new device token */
function CreateTokenDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [rawToken, setRawToken] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: async (tokenLabel: string) => {
      const { data, error } = await db.rpc('create_device_token', {
        p_label: tokenLabel,
      })
      if (error) throw new Error(error.message)
      if (!data || typeof data !== 'string') throw new Error('Server did not return a token')
      return data as string
    },
    onSuccess: (token) => {
      setRawToken(token)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.deviceTokens] })
      onCreated()
    },
    onError: (err) => {
      toast.error(`Không thể tạo token: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`)
    },
  })

  const handleClose = () => {
    setOpen(false)
    // Reset state after animation
    setTimeout(() => {
      setLabel('')
      setRawToken(null)
    }, 300)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) {
      toast.error('Vui lòng nhập nhãn cho token')
      return
    }
    createMutation.mutate(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button size='sm'>
          <Plus className='size-4' />
          Tạo token mới
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo API Token</DialogTitle>
          <DialogDescription>
            Token được dùng để gửi dữ liệu Claude usage từ máy của bạn về TekSpace.
          </DialogDescription>
        </DialogHeader>

        {rawToken ? (
          <CreatedTokenDisplay rawToken={rawToken} onClose={handleClose} />
        ) : (
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='token-label'>Nhãn token</Label>
              <Input
                id='token-label'
                placeholder='Ví dụ: Laptop cá nhân'
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={100}
                autoFocus
              />
              <p className='text-xs text-muted-foreground'>
                Đặt tên để dễ nhận biết thiết bị sử dụng token này.
              </p>
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={handleClose}>
                Hủy
              </Button>
              <Button type='submit' disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo...' : 'Tạo token'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Column definitions ─────────────────────────────────────────────────────────

function useTokenColumns(onRevoke: (id: string) => void): ColumnDef<DeviceTokenRow>[] {
  return [
    {
      accessorKey: 'label',
      header: 'Nhãn',
      cell: ({ row }) => (
        <div className='flex items-center gap-2'>
          <KeyRound className='size-3.5 shrink-0 text-muted-foreground' />
          <span className='font-medium'>{row.original.label}</span>
        </div>
      ),
    },
    {
      accessorKey: 'token_prefix',
      header: 'Prefix',
      cell: ({ row }) => (
        <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-xs'>
          {row.original.token_prefix}…
        </code>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Tạo lúc',
      cell: ({ row }) => (
        <span className='text-sm text-muted-foreground'>
          {format(new Date(row.original.created_at), 'dd/MM/yyyy HH:mm')}
        </span>
      ),
    },
    {
      accessorKey: 'last_used_at',
      header: 'Dùng lần cuối',
      cell: ({ row }) => {
        const val = row.original.last_used_at
        return (
          <span className='text-sm text-muted-foreground'>
            {val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '—'}
          </span>
        )
      },
    },
    {
      accessorKey: 'revoked_at',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const isRevoked = !!row.original.revoked_at
        return isRevoked ? (
          <Badge variant='destructive'>Đã thu hồi</Badge>
        ) : (
          <Badge variant='secondary' className='text-green-700 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800'>
            Hoạt động
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const isRevoked = !!row.original.revoked_at
        if (isRevoked) return null
        return (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant='ghost' size='icon' className='text-destructive hover:text-destructive'>
                <Trash2 className='size-4' />
                <span className='sr-only'>Thu hồi token</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Thu hồi token?</AlertDialogTitle>
                <AlertDialogDescription>
                  Token <strong>{row.original.label}</strong> sẽ bị vô hiệu hóa ngay lập tức. Thiết bị dùng token này sẽ không thể gửi dữ liệu nữa. Thao tác này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  className='bg-destructive text-white hover:bg-destructive/90'
                  onClick={() => onRevoke(row.original.id)}
                >
                  Thu hồi
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      },
    },
  ]
}

// ── Main page ──────────────────────────────────────────────────────────────────

function AccountTokensPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: [QUERY_KEYS.deviceTokens, user?.id],
    queryFn: fetchDeviceTokens,
    enabled: !!user?.id,
  })

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc('revoke_device_token', { p_id: id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      toast.success('Đã thu hồi token')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.deviceTokens] })
    },
    onError: (err) => {
      toast.error(`Không thể thu hồi: ${err instanceof Error ? err.message : 'Lỗi không xác định'}`)
    },
  })

  const columns = useTokenColumns((id) => revokeMutation.mutate(id))

  const table = useReactTable({
    data: tokens,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-semibold'>API Tokens</h1>
        <p className='text-muted-foreground mt-1 text-sm'>
          Quản lý token để gửi dữ liệu Claude usage từ các thiết bị của bạn
        </p>
      </div>

      <Card>
        <CardHeader className='flex-row items-center justify-between space-y-0 pb-4'>
          <div>
            <CardTitle>Danh sách token</CardTitle>
            <CardDescription className='mt-1'>
              Mỗi token gắn với một thiết bị. Thu hồi ngay nếu thiết bị bị mất hoặc không còn sử dụng.
            </CardDescription>
          </div>
          <CreateTokenDialog onCreated={() => {}} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-2'>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : (
            <DataTable
              table={table}
              columns={columns}
              emptyMessage='Chưa có token nào. Tạo token đầu tiên để bắt đầu.'
              showPagination={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
