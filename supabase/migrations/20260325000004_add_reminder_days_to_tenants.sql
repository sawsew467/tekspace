-- Story 6.3b: Per-tenant reminder_days configuration
-- Thêm cột reminder_days vào tenants để owner/manager chỉnh ngày gửi daily report reminder
-- ISO weekday: 1=Thứ 2, 2=Thứ 3, 3=Thứ 4, 4=Thứ 5, 5=Thứ 6, 6=Thứ 7, 7=Chủ Nhật
-- Default: {1,2,3,4,5} = Mon–Fri (không gửi T7/CN)

ALTER TABLE public.tenants
  ADD COLUMN reminder_days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}';

-- Validate: mọi phần tử phải nằm trong [1..7], không cho giá trị ngoài range
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_reminder_days_valid
  CHECK (reminder_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]);

COMMENT ON COLUMN public.tenants.reminder_days IS
  'Ngày trong tuần gửi daily report reminder (ISO weekday: 1=Mon…7=Sun). Empty array = tắt hoàn toàn.';
