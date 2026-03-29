-- ============================================================
-- Seed: 5 test users cho dashboard heatmap testing
-- Tenant: Tekmium (ca607e86-34af-4eac-a73b-2ea95e0254b7)
-- Week: 2026-03-23 ICT (bd531691-c8a8-4e8e-866f-cee392ca5ade)
-- Tất cả giờ ICT (UTC+7); UTC = ICT - 7h
-- Xóa bằng: DELETE FROM auth.users WHERE id LIKE '5eed%'
-- ============================================================

BEGIN;

-- ── Step 1: auth.users → trigger handle_new_user() tự tạo public.users ───────

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0001-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'linh.nguyen@tekmium.test',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"sub":"5eed0001-0000-4000-8000-000000000001","email":"linh.nguyen@tekmium.test","full_name":"Linh Nguyễn","timezone":"Asia/Ho_Chi_Minh","email_verified":true,"phone_verified":false}',
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0002-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'minh.tran@tekmium.test',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"sub":"5eed0002-0000-4000-8000-000000000002","email":"minh.tran@tekmium.test","full_name":"Minh Trần","timezone":"Asia/Ho_Chi_Minh","email_verified":true,"phone_verified":false}',
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0003-0000-4000-8000-000000000003',
    'authenticated', 'authenticated',
    'hoa.le@tekmium.test',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"sub":"5eed0003-0000-4000-8000-000000000003","email":"hoa.le@tekmium.test","full_name":"Hoa Lê","timezone":"Asia/Ho_Chi_Minh","email_verified":true,"phone_verified":false}',
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0004-0000-4000-8000-000000000004',
    'authenticated', 'authenticated',
    'nam.pham@tekmium.test',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"sub":"5eed0004-0000-4000-8000-000000000004","email":"nam.pham@tekmium.test","full_name":"Nam Phạm","timezone":"Asia/Ho_Chi_Minh","email_verified":true,"phone_verified":false}',
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0005-0000-4000-8000-000000000005',
    'authenticated', 'authenticated',
    'thu.vo@tekmium.test',
    crypt('123456789', gen_salt('bf')), NOW(),
    '{"sub":"5eed0005-0000-4000-8000-000000000005","email":"thu.vo@tekmium.test","full_name":"Thu Võ","timezone":"Asia/Ho_Chi_Minh","email_verified":true,"phone_verified":false}',
    NOW(), NOW()
  );

-- ── Step 2: tenant_members ────────────────────────────────────────────────────

INSERT INTO public.tenant_members (tenant_id, user_id, role, status, committed_hours)
VALUES
  -- Linh: manager, full-time
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7', '5eed0001-0000-4000-8000-000000000001', 'manager', 'active', 40),
  -- Minh: member, full-time afternoon
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7', '5eed0002-0000-4000-8000-000000000002', 'member',  'active', 40),
  -- Hoa: member, split schedule
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7', '5eed0003-0000-4000-8000-000000000003', 'member',  'active', 35),
  -- Nam: member, overnight
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7', '5eed0004-0000-4000-8000-000000000004', 'member',  'active', 30),
  -- Thu: member, part-time
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7', '5eed0005-0000-4000-8000-000000000005', 'member',  'active', 20);

-- ── Step 3: schedule_slots ────────────────────────────────────────────────────
-- week_id: bd531691-c8a8-4e8e-866f-cee392ca5ade (tuần 2026-03-23 ICT)
-- slot_date: ngày ICT của start_time (không còn overnight support — ca qua đêm vẫn lưu ngày bắt đầu, heatmap tách 2 phần để hiển thị)
-- start_time: UTC (ICT - 7h)

INSERT INTO public.schedule_slots
  (tenant_id, user_id, week_id, slot_date, start_time, duration_minutes)
VALUES

-- ── Linh Nguyễn (5eed0001): sáng 09-12 + chiều 13:30-17:30, T2-T5; T6 liên tục ──
  -- T2 23/3: 09:00-12:00 ICT = 02:00-05:00 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0001-0000-4000-8000-000000000001','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-23','2026-03-23T02:00:00Z',180),
  -- T2 23/3: 13:30-17:30 ICT = 06:30-10:30 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0001-0000-4000-8000-000000000001','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-23','2026-03-23T06:30:00Z',240),
  -- T3 24/3: 09:00-12:00 ICT
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0001-0000-4000-8000-000000000001','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-24','2026-03-24T02:00:00Z',180),
  -- T3 24/3: 13:30-17:30 ICT
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0001-0000-4000-8000-000000000001','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-24','2026-03-24T06:30:00Z',240),
  -- T4 25/3: 09:00-12:00 ICT (nghỉ chiều)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0001-0000-4000-8000-000000000001','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-25','2026-03-25T02:00:00Z',180),
  -- T5 26/3: 09:00-12:00 ICT
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0001-0000-4000-8000-000000000001','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-26','2026-03-26T02:00:00Z',180),
  -- T5 26/3: 13:30-17:30 ICT
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0001-0000-4000-8000-000000000001','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-26','2026-03-26T06:30:00Z',240),
  -- T6 27/3: 09:00-17:30 ICT liên tục (510 min)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0001-0000-4000-8000-000000000001','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-27','2026-03-27T02:00:00Z',510),

-- ── Minh Trần (5eed0002): chiều muộn 14:00-22:00, T2-T5 + T7 ──────────────
  -- T2 23/3: 14:00-22:00 ICT = 07:00-15:00 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0002-0000-4000-8000-000000000002','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-23','2026-03-23T07:00:00Z',480),
  -- T3 24/3: 14:00-22:00 ICT
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0002-0000-4000-8000-000000000002','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-24','2026-03-24T07:00:00Z',480),
  -- T4 25/3: 13:30-19:30 ICT = 06:30-12:30 UTC (360 min)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0002-0000-4000-8000-000000000002','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-25','2026-03-25T06:30:00Z',360),
  -- T5 26/3: 14:00-22:00 ICT
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0002-0000-4000-8000-000000000002','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-26','2026-03-26T07:00:00Z',480),
  -- T7 28/3: 10:00-16:00 ICT = 03:00-09:00 UTC (360 min)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0002-0000-4000-8000-000000000002','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-28','2026-03-28T03:00:00Z',360),

-- ── Hoa Lê (5eed0003): sáng sớm 07-11 + 13-16 (split), T2+T4+T6+T7+CN ─────
  -- T2 23/3: 07:00-11:00 ICT = 00:00-04:00 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0003-0000-4000-8000-000000000003','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-23','2026-03-23T00:00:00Z',240),
  -- T2 23/3: 13:00-16:00 ICT = 06:00-09:00 UTC (không overlap: 04:00 < 06:00)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0003-0000-4000-8000-000000000003','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-23','2026-03-23T06:00:00Z',180),
  -- T4 25/3: 07:00-11:00 ICT = 00:00-04:00 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0003-0000-4000-8000-000000000003','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-25','2026-03-25T00:00:00Z',240),
  -- T4 25/3: 13:00-16:00 ICT = 06:00-09:00 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0003-0000-4000-8000-000000000003','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-25','2026-03-25T06:00:00Z',180),
  -- T6 27/3: 07:00-11:00 ICT = 00:00-04:00 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0003-0000-4000-8000-000000000003','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-27','2026-03-27T00:00:00Z',240),
  -- T7 28/3: 08:00-12:00 ICT = 01:00-05:00 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0003-0000-4000-8000-000000000003','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-28','2026-03-28T01:00:00Z',240),
  -- CN 29/3: 08:00-12:00 ICT = 01:00-05:00 UTC
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0003-0000-4000-8000-000000000003','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-29','2026-03-29T01:00:00Z',240),

-- ── Nam Phạm (5eed0004): ca đêm overnight 22:xx→04:xx, T2+T3+T5+T7 ──────────
-- Tests overnight expansion: grid sẽ mở rộng về 00:00 và lên 24:00
  -- T2 23/3: 22:00 ICT → T3 04:00 ICT = 15:00 UTC start, 360 min
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0004-0000-4000-8000-000000000004','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-23','2026-03-23T15:00:00Z',360),
  -- T3 24/3: 22:30 ICT → T4 04:30 ICT = 15:30 UTC start, 360 min
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0004-0000-4000-8000-000000000004','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-24','2026-03-24T15:30:00Z',360),
  -- T5 26/3: 23:00 ICT → T6 05:00 ICT = 16:00 UTC start, 360 min
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0004-0000-4000-8000-000000000004','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-26','2026-03-26T16:00:00Z',360),
  -- T7 28/3: 22:00 ICT → CN 04:00 ICT = 15:00 UTC start, 360 min
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0004-0000-4000-8000-000000000004','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-28','2026-03-28T15:00:00Z',360),

-- ── Thu Võ (5eed0005): part-time, rải rác T3+T4+T5+T7+CN ────────────────────
  -- T3 24/3: 08:30-12:30 ICT = 01:30-05:30 UTC (240 min)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0005-0000-4000-8000-000000000005','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-24','2026-03-24T01:30:00Z',240),
  -- T4 25/3: 14:00-17:30 ICT = 07:00-10:30 UTC (210 min)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0005-0000-4000-8000-000000000005','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-25','2026-03-25T07:00:00Z',210),
  -- T5 26/3: 08:30-12:30 ICT = 01:30-05:30 UTC (240 min)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0005-0000-4000-8000-000000000005','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-26','2026-03-26T01:30:00Z',240),
  -- T7 28/3: 09:00-13:00 ICT = 02:00-06:00 UTC (240 min)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0005-0000-4000-8000-000000000005','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-28','2026-03-28T02:00:00Z',240),
  -- CN 29/3: 13:00-17:00 ICT = 06:00-10:00 UTC (240 min)
  ('ca607e86-34af-4eac-a73b-2ea95e0254b7','5eed0005-0000-4000-8000-000000000005','bd531691-c8a8-4e8e-866f-cee392ca5ade','2026-03-29','2026-03-29T06:00:00Z',240);

COMMIT;

-- Verify
SELECT u.full_name, u.email, tm.role
FROM public.users u
JOIN public.tenant_members tm ON tm.user_id = u.id
WHERE u.id LIKE '5eed%'
ORDER BY u.full_name;
