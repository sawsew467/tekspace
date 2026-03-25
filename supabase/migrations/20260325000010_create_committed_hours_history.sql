-- ─────────────────────────────────────────────────────────────────────────────
-- committed_hours_history: lưu lịch sử thay đổi giờ cam kết theo từng member
-- Story: 8-5-committed-hours-history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.committed_hours_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id),
  committed_hours  smallint    NOT NULL
                  CONSTRAINT committed_hours_history_hours_valid
                    CHECK (committed_hours BETWEEN 1 AND 168),
  effective_from   date        NOT NULL,
  effective_to     date,                           -- NULL = đang áp dụng (current record)
  set_by           uuid        REFERENCES auth.users(id),  -- manager đã set
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT committed_hours_history_no_overlap
    UNIQUE (tenant_id, user_id, effective_from)    -- không 2 record cùng ngày bắt đầu
);

CREATE INDEX idx_committed_hours_history_lookup
  ON public.committed_hours_history (tenant_id, user_id, effective_from, effective_to);

ALTER TABLE public.committed_hours_history ENABLE ROW LEVEL SECURITY;

-- SELECT: manager/owner thấy toàn team; member thấy record của mình
CREATE POLICY committed_hours_history_select ON public.committed_hours_history
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.is_tenant_manager()
    )
  );

-- INSERT: chỉ manager/owner
CREATE POLICY committed_hours_history_insert ON public.committed_hours_history
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

-- UPDATE: chỉ manager/owner (để close record: set effective_to)
CREATE POLICY committed_hours_history_update ON public.committed_hours_history
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: chuyển committed_hours hiện tại của mỗi member thành record lịch sử đầu tiên
-- effective_from = created_at của tenant_member
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.committed_hours_history (
  tenant_id, user_id, committed_hours, effective_from, set_by
)
SELECT
  tm.tenant_id,
  tm.user_id,
  COALESCE(tm.committed_hours, t.default_committed_hours) AS committed_hours,
  tm.created_at::date                                      AS effective_from,
  NULL                                                     AS set_by         -- system seed
FROM public.tenant_members tm
JOIN public.tenants t ON t.id = tm.tenant_id
WHERE tm.status = 'active'
  AND COALESCE(tm.committed_hours, t.default_committed_hours) IS NOT NULL  -- skip members với không có giá trị nào
ON CONFLICT (tenant_id, user_id, effective_from) DO NOTHING;
