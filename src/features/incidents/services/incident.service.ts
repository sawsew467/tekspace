import { supabase } from '@/lib/supabase-browser'
import type { Tables } from '@/lib/supabase-types'

export type Incident = Tables<'incidents'>
export type IncidentAppeal = Tables<'incident_appeals'>

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
}
