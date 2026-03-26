-- ─────────────────────────────────────────────────────────────────────────────
-- Story 9.3: Thêm 'incident_resolved' vào notification_type ENUM
-- Cần trước khi Edge Function notify-resolution có thể INSERT notification
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'incident_resolved';
