-- Migration: Enable Realtime for incident_appeals table
-- Story 7-2: Manager cần nhận realtime update khi member submit appeal
--
-- incident_appeals chưa có trong supabase_realtime publication.
-- REPLICA IDENTITY FULL cần thiết để Supabase Realtime broadcast đủ thông tin row
-- khi có INSERT (bao gồm cả cột dùng để filter client-side như tenant_id).

ALTER TABLE public.incident_appeals REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_appeals;
