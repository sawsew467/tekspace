import { supabase } from '@/lib/supabase-browser'
import type { Tables } from '@/lib/supabase-types'

export type Incident = Tables<'incidents'>
export type IncidentAppeal = Tables<'incident_appeals'>
export type IncidentOutcomeNote = Tables<'incident_outcome_notes'>
export type IncidentResolution = Tables<'incident_resolutions'>

export const IncidentService = {
  getIncidents: async (tenantId: string): Promise<Incident[]> => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  createIncident: async (params: {
    tenantId: string
    memberId: string
    managerId: string
    category: string
    note: string
  }): Promise<Incident> => {
    // INSERT incident — append-only, không có UPDATE hay DELETE
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .insert({
        tenant_id:  params.tenantId,
        member_id:  params.memberId,
        manager_id: params.managerId,
        category:   params.category as Tables<'incidents'>['category'],
        note:       params.note,
      })
      .select()
      .single()
    if (incidentError) throw incidentError

    // INSERT in-app notification cho member — qua Edge Function (service role bypass RLS)
    // notifications_insert_policy yêu cầu user_id = auth.uid() → client không thể INSERT cho người khác
    // Best-effort: nếu notification fail → bỏ qua, incident đã được tạo thành công
    try {
      await supabase.functions.invoke('notify-incident', {
        body: {
          tenantId:   params.tenantId,
          memberId:   params.memberId,
          incidentId: incident.id,
        },
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[createIncident] notification failed (best-effort):', err)
    }

    return incident
  },

  getIncidentAppeals: async (tenantId: string): Promise<IncidentAppeal[]> => {
    const { data, error } = await supabase
      .from('incident_appeals')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  createAppeal: async (params: {
    tenantId: string
    incidentId: string
    memberId: string
    response: string
  }): Promise<IncidentAppeal> => {
    // INSERT appeal — member_id = auth.uid(), RLS enforce victim check tự động
    const { data: appeal, error: appealError } = await supabase
      .from('incident_appeals')
      .insert({
        tenant_id:   params.tenantId,
        incident_id: params.incidentId,
        member_id:   params.memberId,
        response:    params.response,
      })
      .select()
      .single()
    if (appealError) throw appealError

    // Notify managers qua Edge Function (service role bypass RLS)
    // Member không thể INSERT notification cho manager trực tiếp
    // Best-effort: appeal đã tạo thành công dù notification fail
    try {
      await supabase.functions.invoke('notify-appeal', {
        body: {
          incidentId: params.incidentId,
          tenantId:   params.tenantId,
        },
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[createAppeal] notification failed (best-effort):', err)
    }

    return appeal
  },

  getIncidentOutcomeNotes: async (
    incidentId: string,
    tenantId: string
  ): Promise<IncidentOutcomeNote[]> => {
    const { data, error } = await supabase
      .from('incident_outcome_notes')
      .select('*')
      .eq('incident_id', incidentId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })  // chronological — cũ nhất trước (audit trail)
    if (error) throw error
    return data ?? []
  },

  createOutcomeNote: async (params: {
    tenantId:   string
    incidentId: string
    managerId:  string
    memberId:   string   // member của incident — để Edge Function INSERT notification
    note:       string
  }): Promise<IncidentOutcomeNote> => {
    // INSERT outcome note — manager_id = auth.uid(), RLS enforce is_tenant_manager()
    const { data: outcomeNote, error: noteError } = await supabase
      .from('incident_outcome_notes')
      .insert({
        tenant_id:   params.tenantId,
        incident_id: params.incidentId,
        manager_id:  params.managerId,
        note:        params.note,
      })
      .select()
      .single()
    if (noteError) throw noteError

    // Notify member qua Edge Function (service role bypass RLS)
    // notifications_insert_policy: user_id = auth.uid() → manager không thể INSERT cho member trực tiếp
    // Best-effort: outcome note đã tạo thành công dù notification fail
    try {
      await supabase.functions.invoke('notify-outcome-note', {
        body: {
          incidentId: params.incidentId,
          memberId:   params.memberId,
          tenantId:   params.tenantId,
        },
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[createOutcomeNote] notification failed (best-effort):', err)
    }

    return outcomeNote
  },

  getIncidentsPaged: async (
    tenantId: string,
    from: number,
    to: number
  ): Promise<Incident[]> => {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    return data ?? []
  },

  getResolutions: async (tenantId: string): Promise<IncidentResolution[]> => {
    const { data, error } = await supabase
      .from('incident_resolutions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('resolved_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  createResolution: async (params: {
    tenantId:   string
    incidentId: string
    memberId:   string   // member của incident — để Edge Function INSERT notification
    resolvedBy: string
    outcome:    'dismissed' | 'upheld'
    note?:      string
  }): Promise<IncidentResolution> => {
    // INSERT resolution — append-only, UNIQUE constraint enforce 1 resolution per incident
    const { data: resolution, error: resolutionError } = await supabase
      .from('incident_resolutions')
      .insert({
        tenant_id:   params.tenantId,
        incident_id: params.incidentId,
        outcome:     params.outcome,
        note:        params.note ?? null,
        resolved_by: params.resolvedBy,
      })
      .select()
      .single()
    if (resolutionError) throw resolutionError

    // Notify member qua Edge Function — best-effort (service role bypass RLS)
    // Member không thể nhận notification INSERT trực tiếp từ manager
    try {
      await supabase.functions.invoke('notify-resolution', {
        body: {
          tenantId:   params.tenantId,
          memberId:   params.memberId,
          incidentId: params.incidentId,
          outcome:    params.outcome,
        },
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[createResolution] notification failed (best-effort):', err)
    }

    return resolution
  },
}

