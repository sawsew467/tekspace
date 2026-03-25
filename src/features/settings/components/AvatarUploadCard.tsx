import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUploadAvatar, useDeleteAvatar } from '../hooks/use-upload-avatar'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

type AvatarUploadCardProps = {
  avatarUrl: string | null
  fullName: string
}

// P-4: Guard đầu hàm để tránh trả 'UN' khi name rỗng
function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

async function cropImageToSquare(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 256
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Cannot get canvas context'))
        return
      }
      // Center crop: lấy vùng vuông ở giữa ảnh
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/jpeg',
        0.9,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

export function AvatarUploadCard({ avatarUrl, fullName }: AvatarUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  // P-9: Guard chống rapid double file-select (memory leak blob URL)
  const [isProcessing, setIsProcessing] = useState(false)

  const uploadMutation = useUploadAvatar()
  const deleteMutation = useDeleteAvatar()

  const initials = getInitials(fullName)
  const isPending = uploadMutation.isPending || deleteMutation.isPending

  const openFilePicker = () => {
    if (isPending || isProcessing) return
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input để có thể chọn lại cùng file
    e.target.value = ''

    // P-8: Validate kích thước file trước khi chạy canvas pipeline
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Ảnh không được vượt quá 5MB.')
      return
    }

    // P-9: Block rapid double-select để tránh orphaned blob URL
    if (isProcessing) return
    setIsProcessing(true)

    try {
      const blob = await cropImageToSquare(file)
      const url = URL.createObjectURL(blob)
      setPreviewBlob(blob)
      setPreviewUrl(url)
      setDialogOpen(true)
    } catch {
      // P-5: Toast error khi crop thất bại thay vì silent fail
      toast.error('Không thể xử lý ảnh. Vui lòng thử lại.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSave = async () => {
    if (!previewBlob) return
    // P-1: Truyền currentAvatarUrl để hook cleanup file cũ trong storage
    uploadMutation.mutate(
      { blob: previewBlob, currentAvatarUrl: avatarUrl },
      {
        onSuccess: () => {
          handleCloseDialog()
        },
      },
    )
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewBlob(null)
    setPreviewUrl(null)
  }

  const handleDelete = () => {
    deleteMutation.mutate(avatarUrl)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Ảnh đại diện</CardTitle>
          <CardDescription>Ảnh hiển thị trong sidebar và danh sách thành viên</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-5'>
            {/* Avatar hiện tại */}
            <button
              type='button'
              onClick={openFilePicker}
              disabled={isPending || isProcessing}
              className='relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed'
              aria-label='Thay đổi ảnh đại diện'
            >
              <Avatar className='h-20 w-20'>
                <AvatarImage src={avatarUrl ?? undefined} alt={fullName} />
                <AvatarFallback className='text-lg'>{initials}</AvatarFallback>
              </Avatar>
              {/* Overlay camera icon khi hover */}
              <span className='absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100'>
                <Camera className='h-6 w-6 text-white' />
              </span>
            </button>

            {/* Actions */}
            <div className='space-y-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={openFilePicker}
                disabled={isPending || isProcessing}
              >
                {uploadMutation.isPending ? 'Đang tải...' : 'Chọn ảnh'}
              </Button>
              {avatarUrl && (
                <div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={handleDelete}
                    disabled={isPending}
                    className='text-destructive hover:text-destructive'
                  >
                    <Trash2 className='mr-1.5 h-3.5 w-3.5' />
                    {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa ảnh'}
                  </Button>
                </div>
              )}
              <p className='text-muted-foreground text-xs'>JPG, PNG hoặc WebP. Tối đa 5MB.</p>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type='file'
            accept='image/jpeg,image/png,image/webp'
            className='hidden'
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* Crop preview dialog */}
      {/* P-10: Không cho dismiss khi upload đang in-flight */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !uploadMutation.isPending) handleCloseDialog()
        }}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Xem trước ảnh đại diện</DialogTitle>
            <DialogDescription>
              Ảnh sẽ được cắt thành hình vuông và lưu với kích thước 256×256px.
            </DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <div className='flex justify-center py-2'>
              <img
                src={previewUrl}
                alt='Preview'
                className='h-40 w-40 rounded-full object-cover ring-2 ring-border'
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={handleCloseDialog}
              disabled={uploadMutation.isPending}
            >
              Hủy
            </Button>
            <Button type='button' onClick={handleSave} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Đang lưu...' : 'Lưu ảnh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
