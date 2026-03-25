-- ─────────────────────────────────────────────────────────────────────────────
-- Story 7.3: Incident History & Audit Trail
-- Tạo bảng incident_outcome_notes + RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper SECURITY DEFINER: Check caller là victim của incident (bypass RLS trên incidents table)
-- BẮT BUỘC dùng SECURITY DEFINER vì policy này sẽ query public.incidents có RLS
-- Không có → gây lỗi "stack depth limit exceeded" / infinite recursion
-- PHẢI có tenant_id check để tránh cross-tenant data leak:
--   user có thể là victim của incident ở tenant khác → thiếu check tenant_id → đọc được notes của tenant khác
CREATE OR REPLACE FUNCTION public.is_incident_victim(p_incident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.incidents
    WHERE id          = p_incident_id
      AND member_id   = auth.uid()
      AND tenant_id   = public.current_tenant_id()   -- bắt buộc: chặn cross-tenant leak
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Outcome notes table (append-only, immutable)
-- Manager add ghi chú / review note cho một incident — không edit, không xóa
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.incident_outcome_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id)   ON DELETE CASCADE,
  incident_id uuid        NOT NULL REFERENCES public.incidents(id)  ON DELETE RESTRICT,
  manager_id  uuid        NOT NULL REFERENCES public.users(id),
  note        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Enforce max length tại DB layer (consistent với Zod schema max 2000)
  CONSTRAINT note_length_check CHECK (length(note) <= 2000)
  -- KHÔNG có updated_at — immutable append-only
);

CREATE INDEX idx_incident_outcome_notes_incident_id ON public.incident_outcome_notes(incident_id);
CREATE INDEX idx_incident_outcome_notes_tenant_id   ON public.incident_outcome_notes(tenant_id);

ALTER TABLE public.incident_outcome_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: Manager/Owner thấy tất cả trong tenant
--         Member chỉ thấy notes của incidents được log cho chính mình
CREATE POLICY incident_outcome_notes_select_policy ON public.incident_outcome_notes
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (
      public.is_tenant_manager()
      OR public.is_incident_victim(incident_id)   -- SECURITY DEFINER → safe, no recursion
    )
  );

-- INSERT: Chỉ manager/owner được INSERT, manager_id phải là auth.uid()
CREATE POLICY incident_outcome_notes_insert_policy ON public.incident_outcome_notes
  FOR INSERT WITH CHECK (
    tenant_id  = public.current_tenant_id()
    AND manager_id = auth.uid()
    AND public.is_tenant_manager()
  );
