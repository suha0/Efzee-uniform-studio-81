export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          metadata: Json
          order_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      alterations: {
        Row: {
          affected_quantity: number
          assigned_to: string | null
          completed_at: string | null
          correction_required: string | null
          created_at: string
          id: string
          issue_description: string
          notes: string | null
          order_id: string
          priority: Database["public"]["Enums"]["order_priority"]
          status: Database["public"]["Enums"]["alteration_status"]
          updated_at: string
        }
        Insert: {
          affected_quantity?: number
          assigned_to?: string | null
          completed_at?: string | null
          correction_required?: string | null
          created_at?: string
          id?: string
          issue_description: string
          notes?: string | null
          order_id: string
          priority?: Database["public"]["Enums"]["order_priority"]
          status?: Database["public"]["Enums"]["alteration_status"]
          updated_at?: string
        }
        Update: {
          affected_quantity?: number
          assigned_to?: string | null
          completed_at?: string | null
          correction_required?: string | null
          created_at?: string
          id?: string
          issue_description?: string
          notes?: string | null
          order_id?: string
          priority?: Database["public"]["Enums"]["order_priority"]
          status?: Database["public"]["Enums"]["alteration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alterations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          customer_code: string
          customer_name: string
          email: string | null
          id: string
          notes: string | null
          organization: string | null
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          customer_code: string
          customer_name: string
          email?: string | null
          id?: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          customer_code?: string
          customer_name?: string
          email?: string | null
          id?: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          order_id: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          order_id?: string | null
          recipient_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          order_id?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          customization: string | null
          description: string | null
          fabric: string | null
          id: string
          order_id: string
          product_name: string
          product_type: string | null
          quantity: number
          size_quantities: Json
          total_price: number
          unit_price: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          customization?: string | null
          description?: string | null
          fabric?: string | null
          id?: string
          order_id: string
          product_name: string
          product_type?: string | null
          quantity?: number
          size_quantities?: Json
          total_price?: number
          unit_price?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          customization?: string | null
          description?: string | null
          fabric?: string | null
          id?: string
          order_id?: string
          product_name?: string
          product_type?: string | null
          quantity?: number
          size_quantities?: Json
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accessory_details: string | null
          batch_number: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customization_details: string | null
          expected_delivery_date: string | null
          fabric_details: string | null
          id: string
          order_date: string
          order_number: string
          priority: Database["public"]["Enums"]["order_priority"]
          product_category: string | null
          product_name: string | null
          remarks: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_quantity: number
          updated_at: string
        }
        Insert: {
          accessory_details?: string | null
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customization_details?: string | null
          expected_delivery_date?: string | null
          fabric_details?: string | null
          id?: string
          order_date?: string
          order_number: string
          priority?: Database["public"]["Enums"]["order_priority"]
          product_category?: string | null
          product_name?: string | null
          remarks?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_quantity?: number
          updated_at?: string
        }
        Update: {
          accessory_details?: string | null
          batch_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customization_details?: string | null
          expected_delivery_date?: string | null
          fabric_details?: string | null
          id?: string
          order_date?: string
          order_number?: string
          priority?: Database["public"]["Enums"]["order_priority"]
          product_category?: string | null
          product_name?: string | null
          remarks?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          address: string | null
          company_name: string
          email: string | null
          id: number
          logo_url: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string
          email?: string | null
          id?: number
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string
          email?: string | null
          id?: number
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      production_images: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string
          order_id: string
          stage: Database["public"]["Enums"]["production_stage"] | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path: string
          order_id: string
          stage?: Database["public"]["Enums"]["production_stage"] | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string
          order_id?: string
          stage?: Database["public"]["Enums"]["production_stage"] | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_images_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_stages: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          created_at: string
          id: string
          issues: string | null
          notes: string | null
          order_id: string
          progress: number
          stage: Database["public"]["Enums"]["production_stage"]
          started_date: string | null
          status: Database["public"]["Enums"]["stage_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          id?: string
          issues?: string | null
          notes?: string | null
          order_id: string
          progress?: number
          stage: Database["public"]["Enums"]["production_stage"]
          started_date?: string | null
          status?: Database["public"]["Enums"]["stage_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          id?: string
          issues?: string | null
          notes?: string | null
          order_id?: string
          progress?: number
          stage?: Database["public"]["Enums"]["production_stage"]
          started_date?: string | null
          status?: Database["public"]["Enums"]["stage_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          organization: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization?: string
          updated_at?: string
        }
        Relationships: []
      }
      quality_inspections: {
        Row: {
          client_feedback: string | null
          created_at: string
          defect_count: number
          id: string
          inspection_date: string
          inspector_id: string | null
          order_id: string
          quality_notes: string | null
          quantity_failed: number
          quantity_inspected: number
          quantity_passed: number
          status: Database["public"]["Enums"]["quality_status"]
          updated_at: string
        }
        Insert: {
          client_feedback?: string | null
          created_at?: string
          defect_count?: number
          id?: string
          inspection_date?: string
          inspector_id?: string | null
          order_id: string
          quality_notes?: string | null
          quantity_failed?: number
          quantity_inspected?: number
          quantity_passed?: number
          status?: Database["public"]["Enums"]["quality_status"]
          updated_at?: string
        }
        Update: {
          client_feedback?: string | null
          created_at?: string
          defect_count?: number
          id?: string
          inspection_date?: string
          inspector_id?: string | null
          order_id?: string
          quality_notes?: string | null
          quantity_failed?: number
          quantity_inspected?: number
          quantity_passed?: number
          status?: Database["public"]["Enums"]["quality_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_inspections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_produce: { Args: never; Returns: boolean }
      can_sell: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      alteration_status: "open" | "in_progress" | "completed" | "verified"
      app_role: "admin" | "sales" | "production"
      order_priority: "low" | "normal" | "high" | "urgent"
      order_status:
        | "draft"
        | "confirmed"
        | "in_production"
        | "quality_check"
        | "alteration_required"
        | "ready_for_delivery"
        | "delivered"
        | "completed"
        | "cancelled"
      production_stage:
        | "fabric_procurement"
        | "cutting"
        | "stitching"
        | "embroidery_printing"
        | "packing"
      quality_status:
        | "pending_inspection"
        | "passed"
        | "failed"
        | "alteration_required"
        | "ready_for_delivery"
        | "delivered"
        | "completed"
      stage_status: "not_started" | "in_progress" | "completed" | "blocked"
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
  public: {
    Enums: {
      alteration_status: ["open", "in_progress", "completed", "verified"],
      app_role: ["admin", "sales", "production"],
      order_priority: ["low", "normal", "high", "urgent"],
      order_status: [
        "draft",
        "confirmed",
        "in_production",
        "quality_check",
        "alteration_required",
        "ready_for_delivery",
        "delivered",
        "completed",
        "cancelled",
      ],
      production_stage: [
        "fabric_procurement",
        "cutting",
        "stitching",
        "embroidery_printing",
        "packing",
      ],
      quality_status: [
        "pending_inspection",
        "passed",
        "failed",
        "alteration_required",
        "ready_for_delivery",
        "delivered",
        "completed",
      ],
      stage_status: ["not_started", "in_progress", "completed", "blocked"],
    },
  },
} as const
