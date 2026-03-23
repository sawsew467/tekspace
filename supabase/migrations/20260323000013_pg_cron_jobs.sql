-- Migration: pg_cron Jobs
-- Tất cả jobs dùng UTC time, tương đương giờ Việt Nam (ICT = UTC+7)
-- D-2: Jobs hiện tại fire global cho tất cả tenants cùng lúc.
--      Edge function cần tự xử lý per-tenant timezone khi nhận request.

-- Enable extensions (idempotent — safe to run nhiều lần)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- P-26: KHÔNG grant cron schema cho authenticated — chỉ service_role cần
-- (GRANT USAGE ON SCHEMA cron TO authenticated đã bị xóa)

-- ================================================================
-- Job 1: Nhắc nhở đăng ký lịch làm việc
-- Chủ nhật 8PM ICT = Chủ nhật 13:00 UTC
-- ================================================================
SELECT cron.schedule(
  'remind-schedule-submission',
  '0 13 * * 0',
  $$
  SELECT net.http_post(
    url     := current_setting('app.edge_function_url', true) || '/notify-schedule-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"action": "schedule_reminder"}'::jsonb
  )
  $$
);

-- ================================================================
-- Job 2: Tự động tạo schedule trống nếu chưa đăng ký
-- Chủ nhật 11:59PM ICT = Chủ nhật 16:59 UTC
-- ================================================================
SELECT cron.schedule(
  'auto-create-empty-schedule',
  '59 16 * * 0',
  $$
  SELECT net.http_post(
    url     := current_setting('app.edge_function_url', true) || '/notify-schedule-change',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"action": "auto_create_empty"}'::jsonb
  )
  $$
);

-- ================================================================
-- Job 3: Nhắc nhở nộp báo cáo hàng ngày
-- Hàng ngày 7PM ICT = 12:00 UTC
-- P-28: Endpoint riêng cho daily-report reminder (không dùng notify-schedule-reminder)
-- ================================================================
SELECT cron.schedule(
  'remind-daily-report',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.edge_function_url', true) || '/notify-schedule-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"action": "daily_report_reminder"}'::jsonb
  )
  $$
);

-- ================================================================
-- Job 4: Thông báo bỏ lỡ deadline đăng ký lịch
-- Chủ nhật 11:59PM+5min ICT = Chủ nhật 17:04 UTC
-- ================================================================
SELECT cron.schedule(
  'deadline-missed-notify',
  '4 17 * * 0',
  $$
  SELECT net.http_post(
    url     := current_setting('app.edge_function_url', true) || '/notify-schedule-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := '{"action": "deadline_missed"}'::jsonb
  )
  $$
);

-- ================================================================
-- ⚠️ MANUAL SETUP REQUIRED (trước khi apply migration này):
-- Chạy các lệnh sau trong Supabase SQL Editor (với service_role):
--   ALTER DATABASE postgres SET app.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';
--   ALTER DATABASE postgres SET app.service_role_key  = '<your-service-role-key>';
-- ================================================================
