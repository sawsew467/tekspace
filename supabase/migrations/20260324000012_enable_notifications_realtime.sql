-- Enable Realtime for notifications table
-- Required for Supabase postgres_changes subscription in NotificationBell component
-- NOTE (IG-1): Migration này thuộc scope Story 6.1 (In-App Notification Center).
--              Include ở đây vì Story 6.1 develop song song với Story 2.3 —
--              NotificationBell cần Realtime để hiển thị notifications real-time.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
