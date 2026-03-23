import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings/team')({
  component: TeamSettingsPage,
})

function TeamSettingsPage() {
  return (
    <div className='text-muted-foreground py-8 text-center text-sm'>
      Cài đặt nhóm — tính năng đang phát triển
    </div>
  )
}
