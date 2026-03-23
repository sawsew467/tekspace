-- Migration: Create notifications table
-- In-app notification center

-- IG-5: Thêm lifecycle events còn thiếu
CREATE TYPE public.notification_type AS ENUM (
  'schedule_reminder', 'schedule_missed', 'schedule_changed',
  'daily_report_reminder', 'member_removed', 'invite_sent',
  'invite_accepted', 'invite_expired',
  'incident_logged', 'appeal_submitted', 'appeal_reviewed'
);

CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id),
  type        public.notification_type NOT NULL,
  message     text NOT NULL,
  is_read     boolean NOT NULL DEFAULT false,
  link_to     text,   -- route path (e.g. '/schedule', '/incidents')
  created_at  timestamptz NOT NULL DEFAULT now()
  -- KHÔNG có updated_at — chỉ update is_read
);

-- D-1: Composite index cho query pattern phổ biến nhất
CREATE INDEX idx_notifications_user_tenant_time
  ON public.notifications(user_id, tenant_id, created_at DESC);
CREATE INDEX idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX idx_notifications_unread
  ON public.notifications(user_id, tenant_id)
  WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
