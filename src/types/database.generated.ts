export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_config: {
        Row: {
          default_currency: string
          locale: string
          schema_version: number
          singleton: boolean
          time_zone: string
          updated_at: string
        }
        Insert: {
          default_currency: string
          locale: string
          schema_version: number
          singleton?: boolean
          time_zone: string
          updated_at?: string
        }
        Update: {
          default_currency?: string
          locale?: string
          schema_version?: number
          singleton?: boolean
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_methods: {
        Row: {
          blind_index: string | null
          blind_index_key_version: number | null
          contact_id: string
          created_at: string
          created_by: string
          encryption_algorithm: string
          encryption_key_version: number
          id: string
          is_primary: boolean
          method_type: Database["public"]["Enums"]["contact_method_type"]
          updated_at: string
          value_auth_tag: string
          value_ciphertext: string
          value_nonce: string
          workspace_id: string
        }
        Insert: {
          blind_index?: string | null
          blind_index_key_version?: number | null
          contact_id: string
          created_at?: string
          created_by: string
          encryption_algorithm: string
          encryption_key_version: number
          id?: string
          is_primary?: boolean
          method_type: Database["public"]["Enums"]["contact_method_type"]
          updated_at?: string
          value_auth_tag: string
          value_ciphertext: string
          value_nonce: string
          workspace_id: string
        }
        Update: {
          blind_index?: string | null
          blind_index_key_version?: number | null
          contact_id?: string
          created_at?: string
          created_by?: string
          encryption_algorithm?: string
          encryption_key_version?: number
          id?: string
          is_primary?: boolean
          method_type?: Database["public"]["Enums"]["contact_method_type"]
          updated_at?: string
          value_auth_tag?: string
          value_ciphertext?: string
          value_nonce?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_methods_contact_workspace_fkey"
            columns: ["workspace_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "contact_methods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_methods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          display_name_algorithm: string | null
          display_name_auth_tag: string | null
          display_name_ciphertext: string | null
          display_name_key_version: number | null
          display_name_nonce: string | null
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          display_name_algorithm?: string | null
          display_name_auth_tag?: string | null
          display_name_ciphertext?: string | null
          display_name_key_version?: number | null
          display_name_nonce?: string | null
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          display_name_algorithm?: string | null
          display_name_auth_tag?: string | null
          display_name_ciphertext?: string | null
          display_name_key_version?: number | null
          display_name_nonce?: string | null
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_price_history: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          id: string
          listing_id: string
          observed_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          listing_id: string
          observed_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          listing_id?: string
          observed_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_price_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_price_history_listing_workspace_fkey"
            columns: ["workspace_id", "listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "listing_price_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          archived_at: string | null
          asking_price: number
          canonical_url: string | null
          created_at: string
          created_by: string
          currency: string
          external_listing_id: string
          first_seen_at: string
          id: string
          last_seen_at: string
          platform: string
          property_id: string
          published_at: string | null
          status: Database["public"]["Enums"]["listing_status"]
          transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          asking_price: number
          canonical_url?: string | null
          created_at?: string
          created_by: string
          currency?: string
          external_listing_id: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          platform: string
          property_id: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          asking_price?: number
          canonical_url?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          external_listing_id?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          property_id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          transaction_type?: Database["public"]["Enums"]["listing_transaction_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_property_workspace_fkey"
            columns: ["workspace_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "listings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          archived_at: string | null
          city: string | null
          created_at: string
          created_by: string
          district: string | null
          gross_area_sqm: number | null
          id: string
          living_room_count: number | null
          neighborhood: string | null
          net_area_sqm: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          room_count: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          created_at?: string
          created_by: string
          district?: string | null
          gross_area_sqm?: number | null
          id?: string
          living_room_count?: number | null
          neighborhood?: string | null
          net_area_sqm?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          room_count?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          created_at?: string
          created_by?: string
          district?: string | null
          gross_area_sqm?: number | null
          id?: string
          living_room_count?: number | null
          neighborhood?: string | null
          net_area_sqm?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          room_count?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      property_contacts: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string
          id: string
          is_primary: boolean
          property_id: string
          relationship_role: Database["public"]["Enums"]["property_contact_role"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by: string
          id?: string
          is_primary?: boolean
          property_id: string
          relationship_role?: Database["public"]["Enums"]["property_contact_role"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_primary?: boolean
          property_id?: string
          relationship_role?: Database["public"]["Enums"]["property_contact_role"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_contacts_contact_workspace_fkey"
            columns: ["workspace_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "property_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_contacts_property_workspace_fkey"
            columns: ["workspace_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "property_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          created_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      app_public_config: {
        Row: {
          default_currency: string | null
          locale: string | null
          schema_version: number | null
          time_zone: string | null
        }
        Insert: {
          default_currency?: string | null
          locale?: string | null
          schema_version?: number | null
          time_zone?: string | null
        }
        Update: {
          default_currency?: string | null
          locale?: string | null
          schema_version?: number | null
          time_zone?: string | null
        }
        Relationships: []
      }
      current_workspace_access: {
        Row: {
          membership_created_at: string | null
          membership_role: Database["public"]["Enums"]["workspace_role"] | null
          workspace_id: string | null
          workspace_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      current_workspace_entity_counts: {
        Row: {
          contact_count: number | null
          listing_count: number | null
          property_count: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bootstrap_workspace: {
        Args: { requested_name: string }
        Returns: {
          membership_role: Database["public"]["Enums"]["workspace_role"]
          workspace_id: string
          workspace_name: string
        }[]
      }
    }
    Enums: {
      contact_method_type: "phone" | "email"
      listing_status: "active" | "inactive" | "closed"
      listing_transaction_type: "sale" | "rent"
      property_contact_role:
        | "owner"
        | "authorized_representative"
        | "tenant"
        | "other"
      property_type:
        | "apartment"
        | "detached_house"
        | "residence"
        | "commercial"
        | "land"
        | "other"
      workspace_role: "owner" | "advisor" | "viewer"
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
      contact_method_type: ["phone", "email"],
      listing_status: ["active", "inactive", "closed"],
      listing_transaction_type: ["sale", "rent"],
      property_contact_role: [
        "owner",
        "authorized_representative",
        "tenant",
        "other",
      ],
      property_type: [
        "apartment",
        "detached_house",
        "residence",
        "commercial",
        "land",
        "other",
      ],
      workspace_role: ["owner", "advisor", "viewer"],
    },
  },
} as const
