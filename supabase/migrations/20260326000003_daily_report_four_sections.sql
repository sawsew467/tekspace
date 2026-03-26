-- Migration: Story 9.2 — Daily Report Four Sections
-- Kiến trúc: Chuyển từ JSONB tasks sang relational report_tasks table.
-- Thêm plan_for_tomorrow + blockers columns vào daily_reports.

-- =============================================================
-- 1. Thêm columns mới vào daily_reports
-- =============================================================

ALTER TABLE public.daily_reports
  ADD COLUMN plan_for_tomorrow text,
  ADD COLUMN blockers          text;

-- =============================================================
-- 2. Tạo bảng report_tasks (relational thay thế JSONB tasks)
-- =============================================================

CREATE TABLE public.report_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id   uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  -- user_id denormalized từ daily_reports — để RLS đơn giản, tránh query bảng khác có RLS
  user_id     uuid NOT NULL REFERENCES public.users(id),

  -- task_type: 'completed' (Section 1) | 'in_progress' (Section 2)
  task_type   text NOT NULL DEFAULT 'completed'
              CHECK (task_type IN ('completed', 'in_progress')),

  -- Chung cho cả 2 loại task
  project_tag text,
  description text NOT NULL CHECK (description <> ''),
  sort_order  integer NOT NULL DEFAULT 0,

  -- Chỉ có ý nghĩa với task_type = 'completed'
  output_type text CHECK (
    output_type IS NULL
    OR output_type IN ('pr', 'figma', 'document', 'other')
  ),
  output_link text,
  hours       numeric(4,1) CHECK (
    hours IS NULL OR (hours >= 0 AND hours <= 24)
  ),

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_tasks_report_id ON public.report_tasks(report_id);
CREATE INDEX idx_report_tasks_tenant_id ON public.report_tasks(tenant_id);
CREATE INDEX idx_report_tasks_user_id   ON public.report_tasks(user_id);

-- =============================================================
-- 3. Migrate dữ liệu: JSONB daily_reports.tasks → report_tasks rows
-- =============================================================

INSERT INTO public.report_tasks (
  tenant_id, report_id, user_id,
  task_type, description, output_type, output_link, hours, sort_order
)
SELECT
  dr.tenant_id,
  dr.id                                             AS report_id,
  dr.user_id,
  'completed'                                       AS task_type,
  (t.value ->> 'description')                      AS description,
  -- Chỉ map output_type hợp lệ — giữ NULL nếu giá trị không thuộc enum (không coerce sang 'other')
  CASE
    WHEN (t.value ->> 'output_type') IN ('pr', 'figma', 'document', 'other')
    THEN (t.value ->> 'output_type')
    ELSE NULL
  END                                               AS output_type,
  NULLIF(t.value ->> 'output_link', '')            AS output_link,
  -- Safe cast: chỉ convert nếu value là số hợp lệ, tránh crash với string như "tbd" / "~2"
  CASE
    WHEN (t.value ->> 'hours') ~ '^\d+(\.\d+)?$'
    THEN (t.value ->> 'hours')::numeric
    ELSE NULL
  END                                               AS hours,
  (t.ordinality - 1)::integer                       AS sort_order
FROM public.daily_reports dr
CROSS JOIN LATERAL jsonb_array_elements(dr.tasks) WITH ORDINALITY t(value, ordinality)
WHERE dr.tasks IS NOT NULL
  AND jsonb_typeof(dr.tasks) = 'array'
  AND jsonb_array_length(dr.tasks) > 0
  AND (t.value ->> 'description') IS NOT NULL
  AND (t.value ->> 'description') <> '';

-- =============================================================
-- 4. DROP cột tasks khỏi daily_reports (không còn dùng JSONB nữa)
-- =============================================================

ALTER TABLE public.daily_reports DROP COLUMN tasks;

-- =============================================================
-- 5. RLS cho report_tasks
-- =============================================================

ALTER TABLE public.report_tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: member thấy tasks của chính mình; manager/owner thấy tất cả trong tenant
-- Pattern giống daily_reports_select_policy — dùng user_id denormalized, không query bảng khác
CREATE POLICY report_tasks_select_policy ON public.report_tasks
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (user_id = auth.uid() OR public.is_tenant_manager())
  );

-- INSERT: member chỉ insert task cho chính mình
CREATE POLICY report_tasks_insert_policy ON public.report_tasks
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );

-- DELETE: member chỉ xóa task của chính mình
-- (Cần cho update flow: DELETE old tasks + INSERT new tasks)
CREATE POLICY report_tasks_delete_policy ON public.report_tasks
  FOR DELETE USING (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );

-- UPDATE policy: explicit DENY — update flow dùng DELETE + INSERT, không UPDATE trực tiếp.
-- Policy này đảm bảo bất kỳ code path nào issue UPDATE sẽ bị chặn rõ ràng thay vì silently fail.
CREATE POLICY report_tasks_update_policy ON public.report_tasks
  FOR UPDATE USING (false);
