-- Migration: Create users table
-- Cross-tenant profile synced với auth.users

-- ================================================================
-- Helper: validate IANA timezone string (dùng chung cho users + tenants)
-- ================================================================
CREATE OR REPLACE FUNCTION public.is_valid_timezone(tz text)
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = tz)
$$ LANGUAGE sql STABLE SET search_path = '';

CREATE TABLE public.users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  avatar_url  text,
  timezone    text NOT NULL DEFAULT 'UTC'
                   CONSTRAINT users_timezone_valid CHECK (public.is_valid_timezone(timezone)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- updated_at helper — dùng chung cho tất cả tables
-- SET search_path: ngăn schema injection attack
-- ================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ================================================================
-- Trigger function: auto-insert khi auth.users tạo mới
-- SECURITY DEFINER: cần để insert vào public.users từ auth schema trigger
-- SET search_path: ngăn schema injection
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    -- P-27: Lấy timezone từ OAuth metadata nếu hợp lệ, fallback về 'UTC'
    CASE
      WHEN public.is_valid_timezone(
             COALESCE(NEW.raw_user_meta_data->>'timezone', '')
           )
      THEN NEW.raw_user_meta_data->>'timezone'
      ELSE 'UTC'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Attach trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
