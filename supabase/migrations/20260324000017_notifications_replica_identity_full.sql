-- Story 6-1: Fix Realtime subscription
-- postgres_changes filter (user_id=eq.X) yêu cầu REPLICA IDENTITY FULL
-- để Supabase WAL có đủ column data cho server-side filtering
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
