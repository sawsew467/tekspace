-- =============================================================
-- Dev Seed — TekSpace local
-- Tạo: 1 owner (login được) + 5 members + data đầy đủ
--
-- Login:  thang@tekmium.com  /  Test@123456
-- Tenant: Tekmium (aaaa0001-0000-4000-8000-000000000001)
--
-- Xóa sạch: DELETE FROM auth.users WHERE id LIKE 'cccc%';
--            DELETE FROM public.tenants WHERE id = 'aaaa0001-0000-4000-8000-000000000001';
-- =============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. AUTH USERS
--    Thắng (owner) có password để login
--    5 members không cần login (encrypted_password = NULL)
-- ──────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  -- Thắng Nguyễn — owner, CÓ password để login
  (
    '00000000-0000-0000-0000-000000000000',
    'cccc0001-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'thang@tekmium.com',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"full_name":"Thắng Nguyễn","timezone":"Asia/Ho_Chi_Minh","email_verified":true}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  ),
  -- Linh Nguyễn — manager
  (
    '00000000-0000-0000-0000-000000000000',
    'cccc0002-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'linh@tekmium.com',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"full_name":"Linh Nguyễn","timezone":"Asia/Ho_Chi_Minh","email_verified":true}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  ),
  -- Minh Trần — member
  (
    '00000000-0000-0000-0000-000000000000',
    'cccc0003-0000-4000-8000-000000000003',
    'authenticated', 'authenticated',
    'minh@tekmium.com',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"full_name":"Minh Trần","timezone":"Asia/Ho_Chi_Minh","email_verified":true}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  ),
  -- Hoa Lê — member
  (
    '00000000-0000-0000-0000-000000000000',
    'cccc0004-0000-4000-8000-000000000004',
    'authenticated', 'authenticated',
    'hoa@tekmium.com',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"full_name":"Hoa Lê","timezone":"Asia/Ho_Chi_Minh","email_verified":true}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  ),
  -- Nam Phạm — member
  (
    '00000000-0000-0000-0000-000000000000',
    'cccc0005-0000-4000-8000-000000000005',
    'authenticated', 'authenticated',
    'nam@tekmium.com',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"full_name":"Nam Phạm","timezone":"Asia/Ho_Chi_Minh","email_verified":true}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  ),
  -- Thu Võ — member
  (
    '00000000-0000-0000-0000-000000000000',
    'cccc0006-0000-4000-8000-000000000006',
    'authenticated', 'authenticated',
    'thu@tekmium.com',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"full_name":"Thu Võ","timezone":"Asia/Ho_Chi_Minh","email_verified":true}'::jsonb,
    NOW(), NOW(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- public.users tự tạo bởi trigger handle_new_user khi insert auth.users.
-- Nếu trigger không set timezone, update thủ công:
UPDATE public.users SET timezone = 'Asia/Ho_Chi_Minh'
WHERE id IN (
  'cccc0001-0000-4000-8000-000000000001',
  'cccc0002-0000-4000-8000-000000000002',
  'cccc0003-0000-4000-8000-000000000003',
  'cccc0004-0000-4000-8000-000000000004',
  'cccc0005-0000-4000-8000-000000000005',
  'cccc0006-0000-4000-8000-000000000006'
);

-- ──────────────────────────────────────────────────────────────
-- 2. TENANT
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.tenants DISABLE TRIGGER on_tenant_created;

INSERT INTO public.tenants (id, name, timezone,
  schedule_deadline_day, schedule_deadline_hour,
  daily_report_deadline_hour, default_committed_hours, reminder_days)
VALUES (
  'aaaa0001-0000-4000-8000-000000000001',
  'Tekmium',
  'Asia/Ho_Chi_Minh',
  0,   -- Sunday
  23,  -- 23:00 ICT
  3,   -- 03:00 ICT (= 20:00 UTC prev day)
  40,
  ARRAY[1,2,3,4,5]::smallint[]
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tenants ENABLE TRIGGER on_tenant_created;

-- ──────────────────────────────────────────────────────────────
-- 3. TENANT MEMBERS
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.tenant_members (tenant_id, user_id, role, status, committed_hours)
VALUES
  ('aaaa0001-0000-4000-8000-000000000001', 'cccc0001-0000-4000-8000-000000000001', 'owner',   'active', 40),
  ('aaaa0001-0000-4000-8000-000000000001', 'cccc0002-0000-4000-8000-000000000002', 'manager', 'active', 40),
  ('aaaa0001-0000-4000-8000-000000000001', 'cccc0003-0000-4000-8000-000000000003', 'member',  'active', 40),
  ('aaaa0001-0000-4000-8000-000000000001', 'cccc0004-0000-4000-8000-000000000004', 'member',  'active', 35),
  ('aaaa0001-0000-4000-8000-000000000001', 'cccc0005-0000-4000-8000-000000000005', 'member',  'active', 30),
  ('aaaa0001-0000-4000-8000-000000000001', 'cccc0006-0000-4000-8000-000000000006', 'member',  'active', 20)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 4. SCHEDULE WEEKS
--    deadline = Sunday 23:00 ICT = Sunday 16:00 UTC
--    Tuần hiện tại (03-23): chưa lock
--    3 tuần trước: đã lock
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.schedule_weeks (id, tenant_id, week_of, deadline, is_locked) VALUES
  -- Tuần 2026-03-23 (current, chưa lock)
  ('dddd0001-0000-4000-8000-000000000001', 'aaaa0001-0000-4000-8000-000000000001',
   '2026-03-23', '2026-03-29T16:00:00Z', false),
  -- Tuần 2026-03-16 (locked)
  ('dddd0002-0000-4000-8000-000000000002', 'aaaa0001-0000-4000-8000-000000000001',
   '2026-03-16', '2026-03-22T16:00:00Z', true),
  -- Tuần 2026-03-09 (locked)
  ('dddd0003-0000-4000-8000-000000000003', 'aaaa0001-0000-4000-8000-000000000001',
   '2026-03-09', '2026-03-15T16:00:00Z', true),
  -- Tuần 2026-03-02 (locked)
  ('dddd0004-0000-4000-8000-000000000004', 'aaaa0001-0000-4000-8000-000000000001',
   '2026-03-02', '2026-03-08T16:00:00Z', true)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 5. SCHEDULE SLOTS — tuần hiện tại (03-23)
--    Tất cả start_time là UTC (ICT - 7h)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.schedule_slots (tenant_id, user_id, week_id, slot_date, start_time, duration_minutes) VALUES

-- Thắng (owner): sáng 09-12 + chiều 13:30-17:30, T2-T6
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-23','2026-03-23T02:00:00Z',180),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-23','2026-03-23T06:30:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-24','2026-03-24T02:00:00Z',180),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-24','2026-03-24T06:30:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-25','2026-03-25T02:00:00Z',180),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-25','2026-03-25T06:30:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-26','2026-03-26T02:00:00Z',180),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-26','2026-03-26T06:30:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','dddd0001-0000-4000-8000-000000000001','2026-03-27','2026-03-27T02:00:00Z',510),

-- Linh (manager): chiều 13:30-18:30, T2-T6
('aaaa0001-0000-4000-8000-000000000001','cccc0002-0000-4000-8000-000000000002','dddd0001-0000-4000-8000-000000000001','2026-03-23','2026-03-23T06:30:00Z',300),
('aaaa0001-0000-4000-8000-000000000001','cccc0002-0000-4000-8000-000000000002','dddd0001-0000-4000-8000-000000000001','2026-03-24','2026-03-24T06:30:00Z',300),
('aaaa0001-0000-4000-8000-000000000001','cccc0002-0000-4000-8000-000000000002','dddd0001-0000-4000-8000-000000000001','2026-03-25','2026-03-25T06:30:00Z',300),
('aaaa0001-0000-4000-8000-000000000001','cccc0002-0000-4000-8000-000000000002','dddd0001-0000-4000-8000-000000000001','2026-03-26','2026-03-26T06:30:00Z',300),
('aaaa0001-0000-4000-8000-000000000001','cccc0002-0000-4000-8000-000000000002','dddd0001-0000-4000-8000-000000000001','2026-03-27','2026-03-27T06:30:00Z',300),

-- Minh (member): sáng sớm 08:00-12:00 + chiều 14:00-18:00, T2-T5
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','dddd0001-0000-4000-8000-000000000001','2026-03-23','2026-03-23T01:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','dddd0001-0000-4000-8000-000000000001','2026-03-23','2026-03-23T07:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','dddd0001-0000-4000-8000-000000000001','2026-03-24','2026-03-24T01:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','dddd0001-0000-4000-8000-000000000001','2026-03-24','2026-03-24T07:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','dddd0001-0000-4000-8000-000000000001','2026-03-25','2026-03-25T01:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','dddd0001-0000-4000-8000-000000000001','2026-03-25','2026-03-25T07:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','dddd0001-0000-4000-8000-000000000001','2026-03-26','2026-03-26T01:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','dddd0001-0000-4000-8000-000000000001','2026-03-26','2026-03-26T07:00:00Z',240),

-- Hoa (member): ca đêm 22:00-04:00, T2+T3+T5
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','dddd0001-0000-4000-8000-000000000001','2026-03-23','2026-03-23T15:00:00Z',360),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','dddd0001-0000-4000-8000-000000000001','2026-03-24','2026-03-24T15:00:00Z',360),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','dddd0001-0000-4000-8000-000000000001','2026-03-26','2026-03-26T15:00:00Z',360),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','dddd0001-0000-4000-8000-000000000001','2026-03-28','2026-03-28T02:00:00Z',360),

-- Nam (member): part-time sáng 09:00-13:00, T2+T4+T6
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','dddd0001-0000-4000-8000-000000000001','2026-03-23','2026-03-23T02:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','dddd0001-0000-4000-8000-000000000001','2026-03-25','2026-03-25T02:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','dddd0001-0000-4000-8000-000000000001','2026-03-27','2026-03-27T02:00:00Z',240),

-- Thu (member): part-time chiều 14:00-18:00, T3+T5+T7
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','dddd0001-0000-4000-8000-000000000001','2026-03-24','2026-03-24T07:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','dddd0001-0000-4000-8000-000000000001','2026-03-26','2026-03-26T07:00:00Z',240),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','dddd0001-0000-4000-8000-000000000001','2026-03-28','2026-03-28T07:00:00Z',240);

-- ──────────────────────────────────────────────────────────────
-- 6. DAILY REPORTS
--    3 tuần đầy đủ + tuần hiện tại 2 ngày (03-23, 03-24)
--    submitted_at = 20:00 ICT = 13:00 UTC (đúng giờ, không trễ)
--    Một vài is_late=true để test discrepancy
-- ──────────────────────────────────────────────────────────────

-- Helper macro: tasks JSON mặc định
-- tasks_a = công việc bình thường, tasks_b = công việc khác

INSERT INTO public.daily_reports
  (tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at)
VALUES

-- ── Tuần 03-02 ────────────────────────────────────────────────
-- Thắng
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-02','[{"description":"Review sprint planning","output_type":"other"},{"description":"Fix auth bug","output_type":"bugfix"}]'::jsonb,8,false,'2026-03-02T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-03','[{"description":"Code review cho team","output_type":"review"}]'::jsonb,7,false,'2026-03-03T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-04','[{"description":"Setup CI/CD pipeline","output_type":"devops"}]'::jsonb,8,false,'2026-03-04T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-05','[{"description":"Meeting với client","output_type":"meeting"},{"description":"Update tài liệu","output_type":"docs"}]'::jsonb,6,false,'2026-03-05T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-06','[{"description":"Nghiên cứu tech mới","output_type":"research"}]'::jsonb,7,false,'2026-03-06T13:00:00Z'),
-- Minh
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-02','[{"description":"Implement feature A","output_type":"feature"}]'::jsonb,8,false,'2026-03-02T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-03','[{"description":"Fix UI bug","output_type":"bugfix"}]'::jsonb,7,false,'2026-03-03T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-04','[{"description":"Viết unit test","output_type":"test"}]'::jsonb,8,false,'2026-03-04T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-05','[{"description":"Review PR của Hoa","output_type":"review"}]'::jsonb,7,false,'2026-03-05T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-06','[{"description":"Deploy staging","output_type":"devops"}]'::jsonb,8,false,'2026-03-06T13:00:00Z'),
-- Hoa
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-02','[{"description":"Thiết kế UI màn hình mới","output_type":"feature"}]'::jsonb,7,false,'2026-03-02T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-03','[{"description":"Implement API endpoint","output_type":"feature"}]'::jsonb,7,false,'2026-03-03T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-04','[{"description":"Viết test API","output_type":"test"}]'::jsonb,6,false,'2026-03-04T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-05','[{"description":"Fix responsive mobile","output_type":"bugfix"}]'::jsonb,7,false,'2026-03-05T13:00:00Z'),
-- Hoa bỏ lỡ ngày 03-06 (is_late = true — nộp muộn)
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-06','[{"description":"Fix lỗi timeout","output_type":"bugfix"}]'::jsonb,5,true,'2026-03-07T05:00:00Z'),
-- Nam
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-02','[{"description":"Nghiên cứu lib mới","output_type":"research"}]'::jsonb,5,false,'2026-03-02T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-03','[{"description":"Implement module B","output_type":"feature"}]'::jsonb,6,false,'2026-03-03T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-04','[{"description":"Debug performance","output_type":"bugfix"}]'::jsonb,5,false,'2026-03-04T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-06','[{"description":"Hoàn thiện module","output_type":"feature"}]'::jsonb,5,false,'2026-03-06T13:00:00Z'),
-- Thu
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-03','[{"description":"Design mockup","output_type":"design"}]'::jsonb,4,false,'2026-03-03T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-05','[{"description":"Update component library","output_type":"feature"}]'::jsonb,4,false,'2026-03-05T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-06','[{"description":"QA testing","output_type":"test"}]'::jsonb,4,false,'2026-03-06T13:00:00Z'),

-- ── Tuần 03-09 ────────────────────────────────────────────────
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-09','[{"description":"Kick-off tuần mới","output_type":"meeting"}]'::jsonb,8,false,'2026-03-09T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-10','[{"description":"Architecture review","output_type":"review"}]'::jsonb,8,false,'2026-03-10T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-11','[{"description":"Implement core feature","output_type":"feature"}]'::jsonb,8,false,'2026-03-11T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-12','[{"description":"Testing và fix","output_type":"test"}]'::jsonb,7,false,'2026-03-12T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-13','[{"description":"Deploy production","output_type":"devops"}]'::jsonb,6,false,'2026-03-13T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-09','[{"description":"Build notification system","output_type":"feature"}]'::jsonb,8,false,'2026-03-09T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-10','[{"description":"Viết test cho notification","output_type":"test"}]'::jsonb,7,false,'2026-03-10T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-11','[{"description":"Integrate realtime","output_type":"feature"}]'::jsonb,8,false,'2026-03-11T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-12','[{"description":"Fix edge case notification","output_type":"bugfix"}]'::jsonb,7,false,'2026-03-12T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-13','[{"description":"Code review + deploy","output_type":"review"}]'::jsonb,6,false,'2026-03-13T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-09','[{"description":"Build incident module","output_type":"feature"}]'::jsonb,7,false,'2026-03-09T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-10','[{"description":"Implement RLS policy","output_type":"feature"}]'::jsonb,6,false,'2026-03-10T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-11','[{"description":"Test RLS thoroughly","output_type":"test"}]'::jsonb,7,false,'2026-03-11T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-12','[{"description":"Fix policy bug","output_type":"bugfix"}]'::jsonb,6,false,'2026-03-12T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-09','[{"description":"Làm module analytics","output_type":"feature"}]'::jsonb,5,false,'2026-03-09T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-10','[{"description":"Implement chart component","output_type":"feature"}]'::jsonb,6,false,'2026-03-10T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-11','[{"description":"Fix chart responsive","output_type":"bugfix"}]'::jsonb,5,false,'2026-03-11T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-13','[{"description":"Hoàn thiện analytics","output_type":"feature"}]'::jsonb,6,false,'2026-03-13T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-10','[{"description":"Design system update","output_type":"design"}]'::jsonb,4,false,'2026-03-10T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-12','[{"description":"Implement dark mode","output_type":"feature"}]'::jsonb,4,false,'2026-03-12T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-13','[{"description":"QA dark mode","output_type":"test"}]'::jsonb,4,false,'2026-03-13T13:00:00Z'),

-- ── Tuần 03-16 ────────────────────────────────────────────────
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-16','[{"description":"Sprint planning","output_type":"meeting"}]'::jsonb,8,false,'2026-03-16T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-17','[{"description":"Implement auth flow","output_type":"feature"}]'::jsonb,8,false,'2026-03-17T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-18','[{"description":"Code review team","output_type":"review"}]'::jsonb,7,false,'2026-03-18T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-19','[{"description":"Fix critical bug prod","output_type":"bugfix"}]'::jsonb,9,false,'2026-03-19T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-20','[{"description":"Sprint review + retro","output_type":"meeting"}]'::jsonb,6,false,'2026-03-20T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-16','[{"description":"Implement appeal flow","output_type":"feature"}]'::jsonb,8,false,'2026-03-16T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-17','[{"description":"Viết test cho appeal","output_type":"test"}]'::jsonb,7,false,'2026-03-17T13:00:00Z'),
-- Minh bỏ lỡ 03-18 (không nộp)
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-19','[{"description":"Fix appeal RLS","output_type":"bugfix"}]'::jsonb,8,false,'2026-03-19T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-20','[{"description":"Code review + deploy","output_type":"review"}]'::jsonb,7,false,'2026-03-20T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-16','[{"description":"Build outcome notes feature","output_type":"feature"}]'::jsonb,7,false,'2026-03-16T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-17','[{"description":"Implement audit trail","output_type":"feature"}]'::jsonb,6,false,'2026-03-17T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-18','[{"description":"Test audit trail","output_type":"test"}]'::jsonb,7,false,'2026-03-18T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-19','[{"description":"Code review fixes","output_type":"review"}]'::jsonb,6,false,'2026-03-19T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-20','[{"description":"Deploy feature","output_type":"devops"}]'::jsonb,5,false,'2026-03-20T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-16','[{"description":"Refactor codebase","output_type":"refactor"}]'::jsonb,5,false,'2026-03-16T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-18','[{"description":"Performance optimization","output_type":"other"}]'::jsonb,4,false,'2026-03-18T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-19','[{"description":"Fix slow query","output_type":"bugfix"}]'::jsonb,5,false,'2026-03-19T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-20','[{"description":"Deploy optimization","output_type":"devops"}]'::jsonb,4,false,'2026-03-20T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-17','[{"description":"New landing page design","output_type":"design"}]'::jsonb,4,false,'2026-03-17T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-19','[{"description":"Implement landing page","output_type":"feature"}]'::jsonb,4,false,'2026-03-19T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-20','[{"description":"QA và fix","output_type":"test"}]'::jsonb,4,false,'2026-03-20T13:00:00Z'),

-- ── Tuần 03-23 — chỉ T2 và T3 đã qua ─────────────────────────
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-23','[{"description":"Kick-off sprint mới","output_type":"meeting"},{"description":"Review story 7-3","output_type":"review"}]'::jsonb,8,false,'2026-03-23T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001','2026-03-24','[{"description":"Code review story 7-3","output_type":"review"},{"description":"Planning Q2","output_type":"meeting"}]'::jsonb,7,false,'2026-03-24T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-23','[{"description":"Implement story 7-3 filters","output_type":"feature"}]'::jsonb,8,false,'2026-03-23T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003','2026-03-24','[{"description":"Viết RLS tests","output_type":"test"}]'::jsonb,7,false,'2026-03-24T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-23','[{"description":"Implement outcome notes UI","output_type":"feature"}]'::jsonb,7,false,'2026-03-23T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0004-0000-4000-8000-000000000004','2026-03-24','[{"description":"Fix review comments","output_type":"bugfix"}]'::jsonb,6,false,'2026-03-24T13:00:00Z'),
('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005','2026-03-23','[{"description":"Bug fix module B","output_type":"bugfix"}]'::jsonb,5,false,'2026-03-23T13:00:00Z'),
-- Nam bỏ lỡ 03-24 (không nộp — có thể test discrepancy)
('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006','2026-03-24','[{"description":"Update component styles","output_type":"feature"}]'::jsonb,4,false,'2026-03-24T13:00:00Z');

-- ──────────────────────────────────────────────────────────────
-- 7. INCIDENTS
--    4 incidents ở các trạng thái khác nhau để test story 7-3:
--    1. Không có appeal (fresh)
--    2. Có appeal, chưa có outcome note
--    3. Có appeal + 1 outcome note (đã review)
--    4. Có appeal + 2 outcome notes (fully reviewed)
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.incidents (id, tenant_id, member_id, manager_id, category, note, created_at) VALUES
  -- Incident 1: Minh bỏ lỡ daily report ngày 03-18 — chưa appeal
  (
    'eeee0001-0000-4000-8000-000000000001',
    'aaaa0001-0000-4000-8000-000000000001',
    'cccc0003-0000-4000-8000-000000000003',  -- Minh
    'cccc0002-0000-4000-8000-000000000002',  -- Linh (manager)
    'missed_report',
    'Minh không nộp daily report ngày 18/03/2026 mà không có lý do.',
    '2026-03-19T08:00:00Z'
  ),
  -- Incident 2: Hoa đăng ký lịch trễ tuần 03-16 — đã appeal
  (
    'eeee0002-0000-4000-8000-000000000002',
    'aaaa0001-0000-4000-8000-000000000001',
    'cccc0004-0000-4000-8000-000000000004',  -- Hoa
    'cccc0001-0000-4000-8000-000000000001',  -- Thắng (owner)
    'late_schedule',
    'Hoa đăng ký lịch làm việc cho tuần 16/03 sau deadline (đăng ký ngày 17/03 lúc 10:00).',
    '2026-03-17T04:00:00Z'
  ),
  -- Incident 3: Nam cam kết giờ thấp tháng 3 — có appeal + outcome note
  (
    'eeee0003-0000-4000-8000-000000000003',
    'aaaa0001-0000-4000-8000-000000000001',
    'cccc0005-0000-4000-8000-000000000005',  -- Nam
    'cccc0001-0000-4000-8000-000000000001',  -- Thắng
    'low_commitment',
    'Nam chỉ đạt 18/30 giờ cam kết trong 2 tuần gần nhất (tuần 03-09 và 03-16).',
    '2026-03-20T09:00:00Z'
  ),
  -- Incident 4: Thu vi phạm quy định — có appeal + 2 outcome notes
  (
    'eeee0004-0000-4000-8000-000000000004',
    'aaaa0001-0000-4000-8000-000000000001',
    'cccc0006-0000-4000-8000-000000000006',  -- Thu
    'cccc0002-0000-4000-8000-000000000002',  -- Linh
    'policy_violation',
    'Thu đã merge code trực tiếp vào main branch mà không qua code review, vi phạm quy trình làm việc của team.',
    '2026-03-18T06:00:00Z'
  );

-- ──────────────────────────────────────────────────────────────
-- 8. INCIDENT APPEALS
--    Incident 1 (Minh): không có appeal
--    Incident 2 (Hoa): có appeal
--    Incident 3 (Nam): có appeal
--    Incident 4 (Thu): có appeal
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.incident_appeals (id, tenant_id, incident_id, member_id, response, created_at) VALUES
  -- Hoa appeal incident 2
  (
    'ffff0001-0000-4000-8000-000000000001',
    'aaaa0001-0000-4000-8000-000000000001',
    'eeee0002-0000-4000-8000-000000000002',
    'cccc0004-0000-4000-8000-000000000004',
    'Em xin lỗi vì đã đăng ký lịch trễ. Tuần đó em bị ốm nên không kịp vào đăng ký trước deadline. Em sẽ chú ý hơn trong các tuần tới.',
    '2026-03-18T04:00:00Z'
  ),
  -- Nam appeal incident 3
  (
    'ffff0002-0000-4000-8000-000000000002',
    'aaaa0001-0000-4000-8000-000000000001',
    'eeee0003-0000-4000-8000-000000000003',
    'cccc0005-0000-4000-8000-000000000005',
    'Em hiểu rằng số giờ của em thấp hơn cam kết. Trong giai đoạn đó em đang hỗ trợ một project khẩn cấp bên client. Tuần này em sẽ bù lại và đảm bảo đạt đủ giờ.',
    '2026-03-21T05:00:00Z'
  ),
  -- Thu appeal incident 4
  (
    'ffff0003-0000-4000-8000-000000000003',
    'aaaa0001-0000-4000-8000-000000000001',
    'eeee0004-0000-4000-8000-000000000004',
    'cccc0006-0000-4000-8000-000000000006',
    'Em xin lỗi về lần merge trực tiếp đó. Em tưởng là hotfix nhỏ nên merge luôn cho nhanh, không để ý quy trình. Em đã đọc lại team guidelines và hiểu rõ hơn rồi, sẽ không tái phạm.',
    '2026-03-19T08:30:00Z'
  );

-- ──────────────────────────────────────────────────────────────
-- 9. INCIDENT OUTCOME NOTES
--    Incident 3 (Nam): 1 note
--    Incident 4 (Thu): 2 notes
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.incident_outcome_notes (id, tenant_id, incident_id, manager_id, note, created_at) VALUES
  -- Note cho incident 3 (Nam) — Thắng review
  (
    'beef0001-0000-4000-8000-000000000001',
    'aaaa0001-0000-4000-8000-000000000001',
    'eeee0003-0000-4000-8000-000000000003',
    'cccc0001-0000-4000-8000-000000000001',  -- Thắng
    'Đã ghi nhận appeal của Nam. Trường hợp này có lý do chính đáng. Theo dõi thêm 2 tuần tiếp theo — nếu Nam đạt đủ giờ cam kết thì xem như đã giải quyết xong.',
    '2026-03-22T09:00:00Z'
  ),
  -- Note 1 cho incident 4 (Thu) — Linh review
  (
    'beef0002-0000-4000-8000-000000000002',
    'aaaa0001-0000-4000-8000-000000000001',
    'eeee0004-0000-4000-8000-000000000004',
    'cccc0002-0000-4000-8000-000000000002',  -- Linh
    'Đã nói chuyện trực tiếp với Thu. Thu đã nhận ra lỗi và cam kết tuân thủ quy trình. Lần đầu vi phạm nên xử lý ở mức nhắc nhở.',
    '2026-03-20T07:00:00Z'
  ),
  -- Note 2 cho incident 4 (Thu) — Thắng thêm ghi chú
  (
    'beef0003-0000-4000-8000-000000000003',
    'aaaa0001-0000-4000-8000-000000000001',
    'eeee0004-0000-4000-8000-000000000004',
    'cccc0001-0000-4000-8000-000000000001',  -- Thắng
    'Cập nhật: Thu đã hoàn thành buổi onboarding về git workflow. Incident đã được xử lý xong. Đánh dấu closed.',
    '2026-03-23T04:00:00Z'
  );

-- ──────────────────────────────────────────────────────────────
-- 10. NOTIFICATIONS cho Thắng (owner) — để test notification center
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.notifications (tenant_id, user_id, type, message, is_read, link_to, created_at) VALUES
  -- Minh bỏ lỡ daily report → incident_logged
  ('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001',
   'incident_logged','Linh Nguyễn đã ghi nhận incident cho Minh Trần.',
   true, '/incidents', '2026-03-19T08:00:00Z'),
  -- Nam gửi appeal
  ('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001',
   'appeal_submitted','Nam Phạm đã gửi appeal cho incident ngày 20/03/2026.',
   false, '/incidents', '2026-03-21T05:00:00Z'),
  -- Thu gửi appeal
  ('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001',
   'appeal_submitted','Thu Võ đã gửi appeal cho incident ngày 18/03/2026.',
   false, '/incidents', '2026-03-19T08:30:00Z'),
  -- Schedule reminder
  ('aaaa0001-0000-4000-8000-000000000001','cccc0001-0000-4000-8000-000000000001',
   'schedule_reminder','Nhắc nhở: Deadline đăng ký lịch tuần 23/03 là Chủ nhật 29/03 lúc 23:00.',
   true, '/schedule', '2026-03-24T02:00:00Z');

-- Notifications cho Minh (member) — appeal_reviewed
INSERT INTO public.notifications (tenant_id, user_id, type, message, is_read, link_to, created_at) VALUES
  ('aaaa0001-0000-4000-8000-000000000001','cccc0003-0000-4000-8000-000000000003',
   'incident_logged','Bạn đã bị ghi nhận incident: Bỏ lỡ Daily Report ngày 18/03/2026.',
   false, '/incidents', '2026-03-19T08:00:00Z');

-- Notifications cho Nam
INSERT INTO public.notifications (tenant_id, user_id, type, message, is_read, link_to, created_at) VALUES
  ('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005',
   'incident_logged','Bạn đã bị ghi nhận incident: Cam kết giờ thấp.',
   true, '/incidents', '2026-03-20T09:00:00Z'),
  ('aaaa0001-0000-4000-8000-000000000001','cccc0005-0000-4000-8000-000000000005',
   'appeal_reviewed','Manager đã thêm ghi chú về incident của bạn.',
   false, '/incidents/eeee0003-0000-4000-8000-000000000003', '2026-03-22T09:00:00Z');

-- Notifications cho Thu
INSERT INTO public.notifications (tenant_id, user_id, type, message, is_read, link_to, created_at) VALUES
  ('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006',
   'incident_logged','Bạn đã bị ghi nhận incident: Vi phạm quy định.',
   true, '/incidents', '2026-03-18T06:00:00Z'),
  ('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006',
   'appeal_reviewed','Manager đã thêm ghi chú về incident của bạn.',
   false, '/incidents/eeee0004-0000-4000-8000-000000000004', '2026-03-20T07:00:00Z'),
  ('aaaa0001-0000-4000-8000-000000000001','cccc0006-0000-4000-8000-000000000006',
   'appeal_reviewed','Manager đã thêm ghi chú về incident của bạn.',
   false, '/incidents/eeee0004-0000-4000-8000-000000000004', '2026-03-23T04:00:00Z');

-- ──────────────────────────────────────────────────────────────
-- 11. COMMITTED HOURS HISTORY
--     Tạo lịch sử thay đổi committed hours để test story 8-5:
--     trend chart dùng giá trị đúng theo từng tuần
--
--     Thắng  (cccc0001): 40h suốt (không đổi)
--     Linh   (cccc0002): 40h → đổi 36h từ 03-09
--     Minh   (cccc0003): 40h → đổi 32h từ 03-16
--     Hoa    (cccc0004): 32h → đổi 35h từ 03-02, đổi tiếp 40h từ 03-16
--     Nam    (cccc0005): 30h suốt (không đổi)
--     Thu    (cccc0006): 20h → đổi 24h từ 03-09
-- ──────────────────────────────────────────────────────────────

INSERT INTO public.committed_hours_history
  (tenant_id, user_id, committed_hours, effective_from, effective_to, set_by)
VALUES

-- ── Thắng (owner) — 40h, không thay đổi ──────────────────────
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0001-0000-4000-8000-000000000001',
  40, '2026-01-01', NULL, NULL   -- current record
),

-- ── Linh (manager) — 40h → 36h từ 03-09 ──────────────────────
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0002-0000-4000-8000-000000000002',
  40, '2026-01-01', '2026-03-09',
  'cccc0001-0000-4000-8000-000000000001'   -- Thắng set
),
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0002-0000-4000-8000-000000000002',
  36, '2026-03-09', NULL,
  'cccc0001-0000-4000-8000-000000000001'   -- current record
),

-- ── Minh (member) — 40h → 32h từ 03-16 ──────────────────────
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0003-0000-4000-8000-000000000003',
  40, '2026-01-01', '2026-03-16',
  NULL
),
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0003-0000-4000-8000-000000000003',
  32, '2026-03-16', NULL,
  'cccc0002-0000-4000-8000-000000000002'   -- Linh set (giảm vì low commitment)
),

-- ── Hoa (member) — 32h → 35h (03-02) → 40h (03-16) ──────────
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0004-0000-4000-8000-000000000004',
  32, '2026-01-01', '2026-03-02',
  NULL
),
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0004-0000-4000-8000-000000000004',
  35, '2026-03-02', '2026-03-16',
  'cccc0001-0000-4000-8000-000000000001'
),
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0004-0000-4000-8000-000000000004',
  40, '2026-03-16', NULL,
  'cccc0001-0000-4000-8000-000000000001'   -- current record, tăng vì hiệu quả tốt
),

-- ── Nam (member) — 30h suốt ──────────────────────────────────
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0005-0000-4000-8000-000000000005',
  30, '2026-01-01', NULL, NULL   -- current record
),

-- ── Thu (member) — 20h → 24h từ 03-09 ──────────────────────
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0006-0000-4000-8000-000000000006',
  20, '2026-01-01', '2026-03-09',
  NULL
),
(
  'aaaa0001-0000-4000-8000-000000000001',
  'cccc0006-0000-4000-8000-000000000006',
  24, '2026-03-09', NULL,
  'cccc0002-0000-4000-8000-000000000002'   -- current record
)

ON CONFLICT (tenant_id, user_id, effective_from) DO NOTHING;

COMMIT;

-- ──────────────────────────────────────────────────────────────
-- VERIFY
-- ──────────────────────────────────────────────────────────────
SELECT
  u.full_name,
  u.email,
  tm.role,
  tm.committed_hours
FROM public.users u
JOIN public.tenant_members tm ON tm.user_id = u.id
WHERE tm.tenant_id = 'aaaa0001-0000-4000-8000-000000000001'
ORDER BY
  CASE tm.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END,
  u.full_name;
