-- Migration: Add email column to public.users
-- Sync từ auth.users — cần cho MemberList hiển thị email (AC2, Story 1.5)

-- 1. Thêm cột email (nullable để tránh lỗi khi backfill)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email text;

-- 2. Backfill email cho tất cả rows hiện tại từ auth.users
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id;

-- 3. Sau backfill: thêm NOT NULL constraint
--    Dùng DEFAULT '' để safe nếu có orphan rows (không nên có, nhưng phòng ngừa)
ALTER TABLE public.users
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN email SET DEFAULT '';

-- 4. Unique index để tránh trùng email (email là identifier của user)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users(email);

-- 5. Cập nhật trigger handle_new_user để include email khi tạo user mới
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url, timezone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN public.is_valid_timezone(
             COALESCE(NEW.raw_user_meta_data->>'timezone', '')
           )
      THEN NEW.raw_user_meta_data->>'timezone'
      ELSE 'UTC'
    END,
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 6. Trigger sync email khi auth.users thay đổi email (vd: user đổi email)
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users SET email = COALESCE(NEW.email, '') WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE TRIGGER on_auth_user_email_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_update();
