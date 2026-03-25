export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      committed_hours_history: {
        Row: {
          committed_hours: number
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          set_by: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          committed_hours: number
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          set_by?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          committed_hours?: number
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          set_by?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "committed_hours_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          created_at: string
          hours_logged: number
          id: string
          is_late: boolean
          report_date: string
          submitted_at: string
          tasks: Json
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          hours_logged?: number
          id?: string
          is_late?: boolean
          report_date: string
          submitted_at?: string
          tasks?: Json
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          hours_logged?: number
          id?: string
          is_late?: boolean
          report_date?: string
          submitted_at?: string
          tasks?: Json
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_appeals: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          member_id: string
          response: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          member_id: string
          response: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          member_id?: string
          response?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_appeals_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_appeals_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_appeals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_outcome_notes: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          manager_id: string
          note: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          manager_id: string
          note: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          manager_id?: string
          note?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_outcome_notes_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_outcome_notes_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_outcome_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          category: Database["public"]["Enums"]["incident_category"]
          created_at: string
          id: string
          manager_id: string
          member_id: string
          note: string
          tenant_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          id?: string
          manager_id: string
          member_id: string
          note: string
          tenant_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          id?: string
          manager_id?: string
          member_id?: string
          note?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      member_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_audit_logs_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link_to: string | null
          message: string
          tenant_id: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_to?: string | null
          message: string
          tenant_id: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_to?: string | null
          message?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slot_changes: {
        Row: {
          change_type: Database["public"]["Enums"]["slot_change_type"]
          changed_by: string
          created_at: string
          id: string
          reason: string
          slot_id: string
          tenant_id: string
        }
        Insert: {
          change_type: Database["public"]["Enums"]["slot_change_type"]
          changed_by: string
          created_at?: string
          id?: string
          reason?: string
          slot_id: string
          tenant_id: string
        }
        Update: {
          change_type?: Database["public"]["Enums"]["slot_change_type"]
          changed_by?: string
          created_at?: string
          id?: string
          reason?: string
          slot_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slot_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slot_changes_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "schedule_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slot_changes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_slots: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          slot_date: string
          start_time: string
          tenant_id: string
          updated_at: string
          user_id: string
          week_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          slot_date: string
          start_time: string
          tenant_id: string
          updated_at?: string
          user_id: string
          week_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          slot_date?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_slots_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "schedule_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_weeks: {
        Row: {
          created_at: string
          deadline: string
          id: string
          is_locked: boolean
          tenant_id: string
          week_of: string
        }
        Insert: {
          created_at?: string
          deadline: string
          id?: string
          is_locked?: boolean
          tenant_id: string
          week_of: string
        }
        Update: {
          created_at?: string
          deadline?: string
          id?: string
          is_locked?: boolean
          tenant_id?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_weeks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          status: Database["public"]["Enums"]["invite_status"]
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          tenant_id: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          committed_hours: number | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["member_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          committed_hours?: number | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          committed_hours?: number | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["member_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          daily_report_deadline_hour: number
          default_committed_hours: number
          id: string
          logo_url: string | null
          name: string
          reminder_days: number[]
          schedule_deadline_day: number
          schedule_deadline_hour: number
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_report_deadline_hour?: number
          default_committed_hours?: number
          id?: string
          logo_url?: string | null
          name: string
          reminder_days?: number[]
          schedule_deadline_day?: number
          schedule_deadline_hour?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_report_deadline_hour?: number
          default_committed_hours?: number
          id?: string
          logo_url?: string | null
          name?: string
          reminder_days?: number[]
          schedule_deadline_day?: number
          schedule_deadline_hour?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          active_tenant_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_create_missing_schedules: {
        Args: { p_week_of: string }
        Returns: Json
      }
      current_tenant_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_slot_with_reason: {
        Args: {
          p_is_emergency_override?: boolean
          p_reason: string
          p_slot_id: string
        }
        Returns: undefined
      }
      format_slot_label: {
        Args: { p_ts: string; p_tz: string }
        Returns: string
      }
      get_or_create_schedule_week: {
        Args: { p_week_of: string }
        Returns: string
      }
      get_team_avg_commitment_rate: {
        Args: { p_week_end: string; p_week_start: string }
        Returns: Json
      }
      is_incident_victim: { Args: { p_incident_id: string }; Returns: boolean }
      is_member_of_current_tenant: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      is_tenant_manager: { Args: never; Returns: boolean }
      is_tenant_manager_or_owner: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      is_valid_timezone: { Args: { tz: string }; Returns: boolean }
      update_slot_with_reason: {
        Args: {
          p_is_emergency_override?: boolean
          p_new_duration_minutes: number
          p_new_start_time: string
          p_reason: string
          p_slot_id: string
        }
        Returns: undefined
      }
      upsert_week_slots: {
        Args: { p_slots: Json; p_week_id: string }
        Returns: undefined
      }
    }
    Enums: {
      incident_category:
        | "late_schedule"
        | "missed_report"
        | "low_commitment"
        | "policy_violation"
      invite_status: "pending" | "accepted" | "expired" | "declined" | "revoked"
      member_role: "owner" | "manager" | "member"
      member_status: "active" | "inactive"
      notification_type:
        | "schedule_reminder"
        | "schedule_missed"
        | "schedule_changed"
        | "daily_report_reminder"
        | "member_removed"
        | "invite_sent"
        | "invite_accepted"
        | "invite_expired"
        | "incident_logged"
        | "appeal_submitted"
        | "appeal_reviewed"
      slot_change_type: "created" | "updated" | "deleted" | "emergency_override"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      incident_category: [
        "late_schedule",
        "missed_report",
        "low_commitment",
        "policy_violation",
      ],
      invite_status: ["pending", "accepted", "expired", "declined", "revoked"],
      member_role: ["owner", "manager", "member"],
      member_status: ["active", "inactive"],
      notification_type: [
        "schedule_reminder",
        "schedule_missed",
        "schedule_changed",
        "daily_report_reminder",
        "member_removed",
        "invite_sent",
        "invite_accepted",
        "invite_expired",
        "incident_logged",
        "appeal_submitted",
        "appeal_reviewed",
      ],
      slot_change_type: ["created", "updated", "deleted", "emergency_override"],
    },
  },
} as const

