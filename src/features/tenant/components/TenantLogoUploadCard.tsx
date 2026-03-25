import { useRef, useState } from 'react'
import { Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog'
import { useUploadTenantLogo, useDeleteTenantLogo } from '../hooks/use-upload-tenant-logo'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
// Fix F8: danh sách MIME types hợp lệ để validate client-side
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type TenantLogoUploadCardProps = {
  logoUrl: string | null
  teamName: string
}

// Reuse pattern từ AvatarUploadCard — canvas 256×256 center crop
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

export function TenantLogoUploadCard({ logoUrl, teamName }: TenantLogoUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  // Fix F9: state cho confirm delete dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const uploadMutation = useUploadTenantLogo()
  const deleteMutation = useDeleteTenantLogo()

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

    // Fix F8: validate MIME type client-side trước khi xử lý
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error('Chỉ chấp nhận JPG, PNG hoặc WebP.')
      return
    }

    // Validate kích thước file
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Ảnh không được vượt quá 5MB.')
      return
    }

    // Guard chống rapid double-select
    if (isProcessing) return
    setIsProcessing(true)

    try {
      const blob = await cropImageToSquare(file)
      const url = URL.createObjectURL(blob)
      setPreviewBlob(blob)
      setPreviewUrl(url)
      setDialogOpen(true)
    } catch {
      toast.error('Không thể xử lý ảnh. Vui lòng thử lại.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSave = () => {
    if (!previewBlob) return
    uploadMutation.mutate(
      // Fix F1: truyền currentLogoUrl để hook xóa logo cũ sau upload thành công
      { blob: previewBlob, currentLogoUrl: logoUrl },
      {
        onSuccess: () => handleCloseDialog(),
        // Fix F6: đóng dialog khi upload fail để user có thể retry
        onError: () => handleCloseDialog(),
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

  // Fix F9: confirm delete trước khi xóa
  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = () => {
    setDeleteConfirmOpen(false)
    deleteMutation.mutate(logoUrl)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Logo nhóm</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-4'>
            {/* Logo hiện tại */}
            <button
              type='button'
              onClick={openFilePicker}
              disabled={isPending || isProcessing}
              className='flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50'
              aria-label='Thay đổi logo nhóm'
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  className='size-20 object-cover'
                  alt={`Logo ${teamName}`}
                />
              ) : (
                <Building2 className='size-10 text-muted-foreground' />
              )}
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
                {uploadMutation.isPending ? 'Đang tải...' : 'Chọn logo'}
              </Button>
              {logoUrl && (
                <div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={handleDeleteClick}
                    disabled={isPending}
                    className='text-destructive hover:text-destructive'
                  >
                    {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa logo'}
                  </Button>
                </div>
              )}
              <p className='text-xs text-muted-foreground'>JPG, PNG hoặc WebP. Tối đa 5MB.</p>
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
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && !uploadMutation.isPending) handleCloseDialog()
        }}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Xem trước logo</DialogTitle>
            <DialogDescription>
              Ảnh sẽ được cắt thành hình vuông và lưu với kích thước 256×256px.
            </DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <div className='flex justify-center py-2'>
              <img
                src={previewUrl}
                alt='Preview'
                className='h-40 w-40 rounded-lg object-cover ring-2 ring-border'
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
              {uploadMutation.isPending ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fix F9: Confirm delete dialog — tránh xóa nhầm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa logo nhóm?</AlertDialogTitle>
            <AlertDialogDescription>
              Logo sẽ bị xóa vĩnh viễn. Bạn có thể upload logo mới bất kỳ lúc nào.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
