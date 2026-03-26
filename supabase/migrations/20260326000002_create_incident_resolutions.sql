-- ─────────────────────────────────────────────────────────────────────────────
-- Story 9.3: Incident Lifecycle — Dismiss/Uphold
-- Tạo bảng incident_resolutions (append-only, UNIQUE per incident)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.incident_resolutions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  incident_id uuid        NOT NULL REFERENCES public.incidents(id)  ON DELETE RESTRICT,
  outcome     text        NOT NULL CHECK (outcome IN ('dismissed', 'upheld')),
  note        text        CHECK (char_length(note) <= 2000),
  resolved_by uuid        NOT NULL REFERENCES public.users(id),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  -- Enforce 1 resolution per incident — Manager không thể resolve 2 lần
  UNIQUE (incident_id)
  -- KHÔNG có updated_at — immutable, không bao giờ UPDATE hay DELETE
);

CREATE INDEX idx_incident_resolutions_tenant_id   ON public.incident_resolutions(tenant_id);
CREATE INDEX idx_incident_resolutions_incident_id ON public.incident_resolutions(incident_id);

ALTER TABLE public.incident_resolutions ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: Manager/Owner thấy tất cả trong tenant
--         Member chỉ thấy resolution của incident mà mình là victim
-- DÙNG is_incident_victim() ĐÃ CÓ (SECURITY DEFINER) — KHÔNG viết lại inline subquery
-- Lý do: inline subquery vào public.incidents (có RLS) → gây lỗi stack depth / infinite recursion
CREATE POLICY incident_resolutions_select_policy ON public.incident_resolutions
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.is_tenant_manager()
      OR public.is_incident_victim(incident_id)   -- SECURITY DEFINER → safe, no recursion
    )
  );

-- INSERT: Chỉ manager/owner được INSERT, resolved_by phải là auth.uid()
CREATE POLICY incident_resolutions_insert_policy ON public.incident_resolutions
  FOR INSERT WITH CHECK (
    tenant_id   = public.current_tenant_id()
    AND resolved_by = auth.uid()
    AND public.is_tenant_manager()
  );

-- Enforce immutability: revoke UPDATE/DELETE từ client roles
-- RLS chỉ chặn row-level; table-level privilege của authenticated cần được revoke riêng
REVOKE UPDATE, DELETE ON public.incident_resolutions FROM authenticated, anon;
