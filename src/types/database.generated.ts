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
      activity_history: {
        Row: {
          actor_id: string
          audit_log_id: string
          details: Json
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          occurred_at: string
          workspace_id: string
        }
        Insert: {
          actor_id: string
          audit_log_id: string
          details?: Json
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          occurred_at?: string
          workspace_id: string
        }
        Update: {
          actor_id?: string
          audit_log_id?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          occurred_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_history_audit_workspace_fkey"
            columns: ["workspace_id", "audit_log_id"]
            isOneToOne: false
            referencedRelation: "audit_logs"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "activity_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
      appointments: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          opportunity_id: string
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          opportunity_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          opportunity_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_contactable_opportunities"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "appointments_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_opportunity_detail"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "appointments_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_priority_call_queue"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "appointments_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_radar"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "appointments_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "appointments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          request_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          request_id?: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          request_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_blocks: {
        Row: {
          blocked_at: string
          blocked_by: string
          contact_id: string
          id: string
          lift_reason_algorithm: string | null
          lift_reason_auth_tag: string | null
          lift_reason_ciphertext: string | null
          lift_reason_key_version: number | null
          lift_reason_nonce: string | null
          lifted_at: string | null
          lifted_by: string | null
          reason_algorithm: string
          reason_auth_tag: string
          reason_ciphertext: string
          reason_key_version: number
          reason_nonce: string
          workspace_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          contact_id: string
          id?: string
          lift_reason_algorithm?: string | null
          lift_reason_auth_tag?: string | null
          lift_reason_ciphertext?: string | null
          lift_reason_key_version?: number | null
          lift_reason_nonce?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason_algorithm: string
          reason_auth_tag: string
          reason_ciphertext: string
          reason_key_version: number
          reason_nonce: string
          workspace_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          contact_id?: string
          id?: string
          lift_reason_algorithm?: string | null
          lift_reason_auth_tag?: string | null
          lift_reason_ciphertext?: string | null
          lift_reason_key_version?: number | null
          lift_reason_nonce?: string | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason_algorithm?: string
          reason_auth_tag?: string
          reason_ciphertext?: string
          reason_key_version?: number
          reason_nonce?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_blocks_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_blocks_contact_workspace_fkey"
            columns: ["workspace_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "communication_blocks_lifted_by_fkey"
            columns: ["lifted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_blocks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      conversations: {
        Row: {
          channel: Database["public"]["Enums"]["conversation_channel"]
          created_at: string
          created_by: string
          follow_up_at: string | null
          follow_up_purpose_algorithm: string | null
          follow_up_purpose_auth_tag: string | null
          follow_up_purpose_ciphertext: string | null
          follow_up_purpose_key_version: number | null
          follow_up_purpose_nonce: string | null
          id: string
          note_algorithm: string | null
          note_auth_tag: string | null
          note_ciphertext: string | null
          note_key_version: number | null
          note_nonce: string | null
          occurred_at: string
          opportunity_id: string
          requires_follow_up: boolean
          result: Database["public"]["Enums"]["conversation_result"]
          workspace_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          created_by: string
          follow_up_at?: string | null
          follow_up_purpose_algorithm?: string | null
          follow_up_purpose_auth_tag?: string | null
          follow_up_purpose_ciphertext?: string | null
          follow_up_purpose_key_version?: number | null
          follow_up_purpose_nonce?: string | null
          id?: string
          note_algorithm?: string | null
          note_auth_tag?: string | null
          note_ciphertext?: string | null
          note_key_version?: number | null
          note_nonce?: string | null
          occurred_at: string
          opportunity_id: string
          requires_follow_up?: boolean
          result: Database["public"]["Enums"]["conversation_result"]
          workspace_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          created_by?: string
          follow_up_at?: string | null
          follow_up_purpose_algorithm?: string | null
          follow_up_purpose_auth_tag?: string | null
          follow_up_purpose_ciphertext?: string | null
          follow_up_purpose_key_version?: number | null
          follow_up_purpose_nonce?: string | null
          id?: string
          note_algorithm?: string | null
          note_auth_tag?: string | null
          note_ciphertext?: string | null
          note_key_version?: number | null
          note_nonce?: string | null
          occurred_at?: string
          opportunity_id?: string
          requires_follow_up?: boolean
          result?: Database["public"]["Enums"]["conversation_result"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_contactable_opportunities"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "conversations_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_opportunity_detail"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "conversations_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_priority_call_queue"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "conversations_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_radar"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "conversations_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_reviews: {
        Row: {
          candidate_count: number
          created_at: string
          decision: Database["public"]["Enums"]["duplicate_review_decision"]
          id: string
          match_kinds: Database["public"]["Enums"]["duplicate_match_kind"][]
          primary_match_rank: number
          result_contact_id: string | null
          result_listing_id: string | null
          result_opportunity_id: string | null
          result_property_id: string | null
          reviewed_by: string
          selected_contact_id: string | null
          selected_listing_id: string | null
          selected_opportunity_id: string | null
          selected_property_id: string | null
          separation_reason_algorithm: string | null
          separation_reason_auth_tag: string | null
          separation_reason_ciphertext: string | null
          separation_reason_key_version: number | null
          separation_reason_nonce: string | null
          workspace_id: string
        }
        Insert: {
          candidate_count: number
          created_at?: string
          decision: Database["public"]["Enums"]["duplicate_review_decision"]
          id?: string
          match_kinds: Database["public"]["Enums"]["duplicate_match_kind"][]
          primary_match_rank: number
          result_contact_id?: string | null
          result_listing_id?: string | null
          result_opportunity_id?: string | null
          result_property_id?: string | null
          reviewed_by: string
          selected_contact_id?: string | null
          selected_listing_id?: string | null
          selected_opportunity_id?: string | null
          selected_property_id?: string | null
          separation_reason_algorithm?: string | null
          separation_reason_auth_tag?: string | null
          separation_reason_ciphertext?: string | null
          separation_reason_key_version?: number | null
          separation_reason_nonce?: string | null
          workspace_id: string
        }
        Update: {
          candidate_count?: number
          created_at?: string
          decision?: Database["public"]["Enums"]["duplicate_review_decision"]
          id?: string
          match_kinds?: Database["public"]["Enums"]["duplicate_match_kind"][]
          primary_match_rank?: number
          result_contact_id?: string | null
          result_listing_id?: string | null
          result_opportunity_id?: string | null
          result_property_id?: string | null
          reviewed_by?: string
          selected_contact_id?: string | null
          selected_listing_id?: string | null
          selected_opportunity_id?: string | null
          selected_property_id?: string | null
          separation_reason_algorithm?: string | null
          separation_reason_auth_tag?: string | null
          separation_reason_ciphertext?: string | null
          separation_reason_key_version?: number | null
          separation_reason_nonce?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_reviews_result_contact_workspace_fkey"
            columns: ["workspace_id", "result_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "duplicate_reviews_result_listing_workspace_fkey"
            columns: ["workspace_id", "result_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "duplicate_reviews_result_opportunity_workspace_fkey"
            columns: ["workspace_id", "result_opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_contactable_opportunities"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_result_opportunity_workspace_fkey"
            columns: ["workspace_id", "result_opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_opportunity_detail"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_result_opportunity_workspace_fkey"
            columns: ["workspace_id", "result_opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_priority_call_queue"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_result_opportunity_workspace_fkey"
            columns: ["workspace_id", "result_opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_radar"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_result_opportunity_workspace_fkey"
            columns: ["workspace_id", "result_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "duplicate_reviews_result_property_workspace_fkey"
            columns: ["workspace_id", "result_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "duplicate_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_reviews_selected_contact_workspace_fkey"
            columns: ["workspace_id", "selected_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "duplicate_reviews_selected_listing_workspace_fkey"
            columns: ["workspace_id", "selected_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "duplicate_reviews_selected_opportunity_workspace_fkey"
            columns: ["workspace_id", "selected_opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_contactable_opportunities"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_selected_opportunity_workspace_fkey"
            columns: ["workspace_id", "selected_opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_opportunity_detail"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_selected_opportunity_workspace_fkey"
            columns: ["workspace_id", "selected_opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_priority_call_queue"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_selected_opportunity_workspace_fkey"
            columns: ["workspace_id", "selected_opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_radar"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "duplicate_reviews_selected_opportunity_workspace_fkey"
            columns: ["workspace_id", "selected_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "duplicate_reviews_selected_property_workspace_fkey"
            columns: ["workspace_id", "selected_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "duplicate_reviews_workspace_id_fkey"
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
      market_analyses: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          opportunity_id: string
          status: Database["public"]["Enums"]["market_analysis_status"]
          subject_area_sqm: number
          subject_property_id: string
          target_at: string
          transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          opportunity_id: string
          status?: Database["public"]["Enums"]["market_analysis_status"]
          subject_area_sqm: number
          subject_property_id: string
          target_at: string
          transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          opportunity_id?: string
          status?: Database["public"]["Enums"]["market_analysis_status"]
          subject_area_sqm?: number
          subject_property_id?: string
          target_at?: string
          transaction_type?: Database["public"]["Enums"]["listing_transaction_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_analyses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_contactable_opportunities"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_opportunity_detail"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_priority_call_queue"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_radar"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "market_analyses_property_workspace_fkey"
            columns: ["workspace_id", "subject_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "market_analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      market_comparables: {
        Row: {
          area_sqm: number
          asking_price: number
          created_at: string
          created_by: string
          currency: string
          id: string
          market_analysis_id: string
          neighborhood: string
          observed_on: string
          opportunity_id: string
          price_per_sqm: number | null
          transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
          workspace_id: string
        }
        Insert: {
          area_sqm: number
          asking_price: number
          created_at?: string
          created_by: string
          currency: string
          id?: string
          market_analysis_id: string
          neighborhood: string
          observed_on: string
          opportunity_id: string
          price_per_sqm?: number | null
          transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
          workspace_id: string
        }
        Update: {
          area_sqm?: number
          asking_price?: number
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          market_analysis_id?: string
          neighborhood?: string
          observed_on?: string
          opportunity_id?: string
          price_per_sqm?: number | null
          transaction_type?: Database["public"]["Enums"]["listing_transaction_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_comparables_analysis_context_fkey"
            columns: [
              "workspace_id",
              "market_analysis_id",
              "opportunity_id",
              "transaction_type",
              "currency",
            ]
            isOneToOne: false
            referencedRelation: "current_workspace_market_analysis_detail"
            referencedColumns: [
              "workspace_id",
              "market_analysis_id",
              "opportunity_id",
              "transaction_type",
              "currency",
            ]
          },
          {
            foreignKeyName: "market_comparables_analysis_context_fkey"
            columns: [
              "workspace_id",
              "market_analysis_id",
              "opportunity_id",
              "transaction_type",
              "currency",
            ]
            isOneToOne: false
            referencedRelation: "market_analyses"
            referencedColumns: [
              "workspace_id",
              "id",
              "opportunity_id",
              "transaction_type",
              "currency",
            ]
          },
          {
            foreignKeyName: "market_comparables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_comparables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          archived_at: string | null
          closed_at: string | null
          contact_id: string
          created_at: string
          created_by: string
          id: string
          next_action_at: string | null
          next_action_type:
            | Database["public"]["Enums"]["opportunity_next_action_type"]
            | null
          property_id: string
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          closed_at?: string | null
          contact_id: string
          created_at?: string
          created_by: string
          id?: string
          next_action_at?: string | null
          next_action_type?:
            | Database["public"]["Enums"]["opportunity_next_action_type"]
            | null
          property_id: string
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string
          id?: string
          next_action_at?: string | null
          next_action_type?:
            | Database["public"]["Enums"]["opportunity_next_action_type"]
            | null
          property_id?: string
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_contact_workspace_fkey"
            columns: ["workspace_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_property_workspace_fkey"
            columns: ["workspace_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_listings: {
        Row: {
          created_at: string
          created_by: string
          id: string
          listing_id: string
          opportunity_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          listing_id: string
          opportunity_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          listing_id?: string
          opportunity_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_listings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_listings_listing_workspace_fkey"
            columns: ["workspace_id", "listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunity_listings_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_contactable_opportunities"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_listings_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_opportunity_detail"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_listings_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_priority_call_queue"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_listings_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_radar"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_listings_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunity_listings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_stage_history: {
        Row: {
          created_at: string
          created_by: string
          id: string
          new_stage: Database["public"]["Enums"]["opportunity_stage"]
          opportunity_id: string
          previous_stage:
            | Database["public"]["Enums"]["opportunity_stage"]
            | null
          reason: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          new_stage: Database["public"]["Enums"]["opportunity_stage"]
          opportunity_id: string
          previous_stage?:
            | Database["public"]["Enums"]["opportunity_stage"]
            | null
          reason: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          new_stage?: Database["public"]["Enums"]["opportunity_stage"]
          opportunity_id?: string
          previous_stage?:
            | Database["public"]["Enums"]["opportunity_stage"]
            | null
          reason?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stage_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_contactable_opportunities"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_opportunity_detail"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_priority_call_queue"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_radar"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunity_stage_history_workspace_id_fkey"
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
      tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          due_at: string
          id: string
          opportunity_id: string
          source_appointment_id: string | null
          source_conversation_id: string | null
          source_market_analysis_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          due_at: string
          id?: string
          opportunity_id: string
          source_appointment_id?: string | null
          source_conversation_id?: string | null
          source_market_analysis_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          due_at?: string
          id?: string
          opportunity_id?: string
          source_appointment_id?: string | null
          source_conversation_id?: string | null
          source_market_analysis_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_appointment_opportunity_workspace_fkey"
            columns: ["workspace_id", "source_appointment_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["workspace_id", "id", "opportunity_id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_conversation_opportunity_workspace_fkey"
            columns: [
              "workspace_id",
              "source_conversation_id",
              "opportunity_id",
            ]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["workspace_id", "id", "opportunity_id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_market_analysis_opportunity_workspace_fkey"
            columns: [
              "workspace_id",
              "source_market_analysis_id",
              "opportunity_id",
            ]
            isOneToOne: false
            referencedRelation: "current_workspace_market_analysis_detail"
            referencedColumns: [
              "workspace_id",
              "market_analysis_id",
              "opportunity_id",
            ]
          },
          {
            foreignKeyName: "tasks_market_analysis_opportunity_workspace_fkey"
            columns: [
              "workspace_id",
              "source_market_analysis_id",
              "opportunity_id",
            ]
            isOneToOne: false
            referencedRelation: "market_analyses"
            referencedColumns: ["workspace_id", "id", "opportunity_id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
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
      current_workspace_calendar_items: {
        Row: {
          appointment_status:
            | Database["public"]["Enums"]["appointment_status"]
            | null
          city: string | null
          district: string | null
          ends_at: string | null
          event_at: string | null
          item_id: string | null
          item_type: string | null
          neighborhood: string | null
          opportunity_id: string | null
          property_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          task_type: Database["public"]["Enums"]["task_type"] | null
          workspace_id: string | null
        }
        Relationships: []
      }
      current_workspace_contactable_opportunities: {
        Row: {
          contact_id: string | null
          opportunity_id: string | null
          workspace_id: string | null
        }
        Insert: {
          contact_id?: string | null
          opportunity_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          contact_id?: string | null
          opportunity_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_contact_workspace_fkey"
            columns: ["workspace_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
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
      current_workspace_market_analysis_detail: {
        Row: {
          analysis_created_at: string | null
          analysis_status:
            | Database["public"]["Enums"]["market_analysis_status"]
            | null
          base_estimate: number | null
          comparable_area_sqm: number | null
          comparable_asking_price: number | null
          comparable_count: number | null
          comparable_created_at: string | null
          comparable_id: string | null
          comparable_neighborhood: string | null
          comparable_observed_on: string | null
          comparable_price_per_sqm: number | null
          currency: string | null
          market_analysis_id: string | null
          max_price_per_sqm: number | null
          median_price_per_sqm: number | null
          min_price_per_sqm: number | null
          opportunity_id: string | null
          subject_area_sqm: number | null
          suggested_price_high: number | null
          suggested_price_low: number | null
          target_at: string | null
          transaction_type:
            | Database["public"]["Enums"]["listing_transaction_type"]
            | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_contactable_opportunities"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_opportunity_detail"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_priority_call_queue"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "current_workspace_radar"
            referencedColumns: ["workspace_id", "opportunity_id"]
          },
          {
            foreignKeyName: "market_analyses_opportunity_workspace_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "market_analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      current_workspace_open_tasks: {
        Row: {
          city: string | null
          created_at: string | null
          district: string | null
          due_at: string | null
          is_current_next_action: boolean | null
          neighborhood: string | null
          opportunity_id: string | null
          property_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          task_id: string | null
          task_status: Database["public"]["Enums"]["task_status"] | null
          task_type: Database["public"]["Enums"]["task_type"] | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      current_workspace_opportunity_detail: {
        Row: {
          asking_price: number | null
          city: string | null
          closed_at: string | null
          communication_block_active: boolean | null
          created_at: string | null
          currency: string | null
          district: string | null
          external_listing_id: string | null
          gross_area_sqm: number | null
          last_seen_at: string | null
          listing_id: string | null
          listing_status: Database["public"]["Enums"]["listing_status"] | null
          living_room_count: number | null
          neighborhood: string | null
          net_area_sqm: number | null
          next_action_at: string | null
          next_action_type:
            | Database["public"]["Enums"]["opportunity_next_action_type"]
            | null
          opportunity_id: string | null
          platform: string | null
          property_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          room_count: number | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          timeline: Json | null
          transaction_type:
            | Database["public"]["Enums"]["listing_transaction_type"]
            | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      current_workspace_opportunity_pipeline: {
        Row: {
          opportunity_count: number | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          stage_order: number | null
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
      current_workspace_priority_call_queue: {
        Row: {
          asking_price: number | null
          city: string | null
          completed_profile_listing_groups: number | null
          conversation_age_points: number | null
          created_at: string | null
          currency: string | null
          district: string | null
          due_today_points: number | null
          external_listing_id: string | null
          gross_area_sqm: number | null
          has_recent_price_drop: boolean | null
          is_due_today: boolean | null
          last_conversation_at: string | null
          last_conversation_days: number | null
          listing_id: string | null
          living_room_count: number | null
          neighborhood: string | null
          net_area_sqm: number | null
          next_action_at: string | null
          next_action_type:
            | Database["public"]["Enums"]["opportunity_next_action_type"]
            | null
          opportunity_id: string | null
          overdue_days: number | null
          overdue_points: number | null
          platform: string | null
          price_drop_points: number | null
          priority_score: number | null
          profile_listing_points: number | null
          property_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          room_count: number | null
          score_version: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          stage_points: number | null
          transaction_type:
            | Database["public"]["Enums"]["listing_transaction_type"]
            | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_property_workspace_fkey"
            columns: ["workspace_id", "property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      current_workspace_radar: {
        Row: {
          asking_price: number | null
          city: string | null
          closed_at: string | null
          created_at: string | null
          currency: string | null
          district: string | null
          external_listing_id: string | null
          gross_area_sqm: number | null
          last_seen_at: string | null
          listing_id: string | null
          listing_status: Database["public"]["Enums"]["listing_status"] | null
          living_room_count: number | null
          neighborhood: string | null
          net_area_sqm: number | null
          next_action_at: string | null
          next_action_type:
            | Database["public"]["Enums"]["opportunity_next_action_type"]
            | null
          opportunity_id: string | null
          platform: string | null
          property_id: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          room_count: number | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          transaction_type:
            | Database["public"]["Enums"]["listing_transaction_type"]
            | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_market_comparable: {
        Args: {
          requested_area_sqm: number
          requested_asking_price: number
          requested_market_analysis_id: string
          requested_neighborhood: string
          requested_observed_on: string
        }
        Returns: {
          comparable_count: number
          comparable_id: string
          market_analysis_id: string
          opportunity_id: string
        }[]
      }
      bootstrap_workspace: {
        Args: { requested_name: string }
        Returns: {
          membership_role: Database["public"]["Enums"]["workspace_role"]
          workspace_id: string
          workspace_name: string
        }[]
      }
      complete_task: {
        Args: {
          requested_next_action_at?: string
          requested_next_action_type?: Database["public"]["Enums"]["opportunity_next_action_type"]
          requested_task_id: string
        }
        Returns: {
          completed_at: string
          next_action_at: string
          next_action_type: Database["public"]["Enums"]["opportunity_next_action_type"]
          opportunity_id: string
          replaced_current_action: boolean
          task_id: string
        }[]
      }
      create_appointment: {
        Args: {
          requested_ends_at: string
          requested_opportunity_id: string
          requested_starts_at: string
        }
        Returns: {
          appointment_id: string
          ends_at: string
          opportunity_id: string
          preparation_due_at: string
          preparation_task_id: string
          starts_at: string
        }[]
      }
      create_opportunity: {
        Args: {
          requested_contact_id: string
          requested_next_action_at: string
          requested_next_action_type: Database["public"]["Enums"]["opportunity_next_action_type"]
          requested_property_id: string
          requested_source_listing_id?: string
        }
        Returns: {
          closed_at: string
          next_action_at: string
          next_action_type: Database["public"]["Enums"]["opportunity_next_action_type"]
          opportunity_id: string
          stage: Database["public"]["Enums"]["opportunity_stage"]
        }[]
      }
      create_quick_fsbo: {
        Args: {
          requested_asking_price: number
          requested_canonical_url: string
          requested_city: string
          requested_display_name_algorithm: string
          requested_display_name_auth_tag: string
          requested_display_name_ciphertext: string
          requested_display_name_key_version: number
          requested_display_name_nonce: string
          requested_district: string
          requested_external_listing_id: string
          requested_gross_area_sqm: number
          requested_living_room_count: number
          requested_neighborhood: string
          requested_net_area_sqm: number
          requested_next_action_at: string
          requested_phone_algorithm: string
          requested_phone_auth_tag: string
          requested_phone_blind_index: string
          requested_phone_blind_index_key_version: number
          requested_phone_ciphertext: string
          requested_phone_key_version: number
          requested_phone_nonce: string
          requested_platform: string
          requested_property_type: Database["public"]["Enums"]["property_type"]
          requested_room_count: number
          requested_transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
        }
        Returns: {
          listing_id: string
          next_action_at: string
          opportunity_id: string
          stage: Database["public"]["Enums"]["opportunity_stage"]
        }[]
      }
      find_quick_fsbo_duplicates: {
        Args: {
          requested_asking_price: number
          requested_canonical_url: string
          requested_external_listing_id: string
          requested_gross_area_sqm: number
          requested_living_room_count: number
          requested_neighborhood: string
          requested_net_area_sqm: number
          requested_phone_blind_index: string
          requested_phone_blind_index_key_version: number
          requested_platform: string
          requested_room_count: number
          requested_transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
        }
        Returns: {
          asking_price: number
          candidate_key: string
          city: string
          contact_id: string
          currency: string
          district: string
          external_listing_id: string
          gross_area_sqm: number
          last_seen_at: string
          listing_id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          living_room_count: number
          match_kinds: Database["public"]["Enums"]["duplicate_match_kind"][]
          match_rank: number
          neighborhood: string
          net_area_sqm: number
          next_action_at: string
          opportunity_id: string
          opportunity_stage: Database["public"]["Enums"]["opportunity_stage"]
          platform: string
          property_id: string
          room_count: number
          transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
        }[]
      }
      lift_contact_communication_block: {
        Args: {
          requested_lift_reason_algorithm: string
          requested_lift_reason_auth_tag: string
          requested_lift_reason_ciphertext: string
          requested_lift_reason_key_version: number
          requested_lift_reason_nonce: string
          requested_opportunity_id: string
        }
        Returns: {
          communication_block_active: boolean
          communication_block_id: string
          origin_opportunity_id: string
          reopened_opportunity_count: number
          reopened_task_count: number
        }[]
      }
      mark_contact_do_not_call: {
        Args: {
          requested_opportunity_id: string
          requested_reason_algorithm: string
          requested_reason_auth_tag: string
          requested_reason_ciphertext: string
          requested_reason_key_version: number
          requested_reason_nonce: string
        }
        Returns: {
          affected_opportunity_count: number
          cancelled_task_count: number
          communication_block_active: boolean
          communication_block_id: string
          origin_opportunity_id: string
        }[]
      }
      record_conversation: {
        Args: {
          requested_channel: Database["public"]["Enums"]["conversation_channel"]
          requested_follow_up_at?: string
          requested_follow_up_purpose_algorithm?: string
          requested_follow_up_purpose_auth_tag?: string
          requested_follow_up_purpose_ciphertext?: string
          requested_follow_up_purpose_key_version?: number
          requested_follow_up_purpose_nonce?: string
          requested_note_algorithm?: string
          requested_note_auth_tag?: string
          requested_note_ciphertext?: string
          requested_note_key_version?: number
          requested_note_nonce?: string
          requested_occurred_at: string
          requested_opportunity_id: string
          requested_requires_follow_up: boolean
          requested_result: Database["public"]["Enums"]["conversation_result"]
        }
        Returns: {
          conversation_id: string
          follow_up_task_id: string
          next_action_at: string
          next_action_type: Database["public"]["Enums"]["opportunity_next_action_type"]
          occurred_at: string
          opportunity_id: string
          requires_follow_up: boolean
        }[]
      }
      request_market_analysis: {
        Args: {
          requested_currency: string
          requested_opportunity_id: string
          requested_target_at: string
          requested_transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
        }
        Returns: {
          advisor_review_task_id: string
          collect_comparables_task_id: string
          market_analysis_id: string
          opportunity_id: string
          prepare_price_summary_task_id: string
          subject_area_sqm: number
          target_at: string
        }[]
      }
      reschedule_task: {
        Args: { requested_due_at: string; requested_task_id: string }
        Returns: {
          due_at: string
          opportunity_id: string
          task_id: string
          updated_current_action: boolean
        }[]
      }
      resolve_quick_fsbo_duplicate: {
        Args: {
          requested_asking_price: number
          requested_candidate_key?: string
          requested_canonical_url: string
          requested_city: string
          requested_display_name_algorithm: string
          requested_display_name_auth_tag: string
          requested_display_name_ciphertext: string
          requested_display_name_key_version: number
          requested_display_name_nonce: string
          requested_district: string
          requested_duplicate_decision?: Database["public"]["Enums"]["duplicate_review_decision"]
          requested_external_listing_id: string
          requested_gross_area_sqm: number
          requested_living_room_count: number
          requested_neighborhood: string
          requested_net_area_sqm: number
          requested_next_action_at: string
          requested_phone_algorithm: string
          requested_phone_auth_tag: string
          requested_phone_blind_index: string
          requested_phone_blind_index_key_version: number
          requested_phone_ciphertext: string
          requested_phone_key_version: number
          requested_phone_nonce: string
          requested_platform: string
          requested_property_type: Database["public"]["Enums"]["property_type"]
          requested_room_count: number
          requested_separation_reason_algorithm?: string
          requested_separation_reason_auth_tag?: string
          requested_separation_reason_ciphertext?: string
          requested_separation_reason_key_version?: number
          requested_separation_reason_nonce?: string
          requested_transaction_type: Database["public"]["Enums"]["listing_transaction_type"]
        }
        Returns: {
          duplicate_review_id: string
          listing_id: string
          next_action_at: string
          opportunity_id: string
          outcome: Database["public"]["Enums"]["quick_fsbo_resolution_outcome"]
          stage: Database["public"]["Enums"]["opportunity_stage"]
        }[]
      }
      reveal_opportunity_phone: {
        Args: { requested_opportunity_id: string }
        Returns: {
          encryption_algorithm: string
          encryption_key_version: number
          opportunity_id: string
          value_auth_tag: string
          value_ciphertext: string
          value_nonce: string
        }[]
      }
      transition_opportunity_stage: {
        Args: {
          requested_next_action_at?: string
          requested_next_action_type?: Database["public"]["Enums"]["opportunity_next_action_type"]
          requested_opportunity_id: string
          requested_reason: string
          requested_stage: Database["public"]["Enums"]["opportunity_stage"]
        }
        Returns: {
          closed_at: string
          next_action_at: string
          next_action_type: Database["public"]["Enums"]["opportunity_next_action_type"]
          opportunity_id: string
          stage: Database["public"]["Enums"]["opportunity_stage"]
        }[]
      }
    }
    Enums: {
      appointment_status: "scheduled" | "completed" | "cancelled"
      contact_method_type: "phone" | "email"
      conversation_channel: "phone" | "in_person" | "video" | "email" | "other"
      conversation_result:
        | "reached"
        | "unreachable"
        | "interested"
        | "not_interested"
        | "wrong_number"
        | "other"
      duplicate_match_kind:
        | "platform_listing"
        | "canonical_url"
        | "phone"
        | "property_similarity"
        | "closed_similar_listing"
      duplicate_review_decision:
        | "use_existing"
        | "link_existing_property"
        | "keep_separate"
      listing_status: "active" | "inactive" | "closed"
      listing_transaction_type: "sale" | "rent"
      market_analysis_status: "draft" | "finalized" | "cancelled"
      opportunity_next_action_type:
        | "call"
        | "verify"
        | "follow_up"
        | "prepare_analysis"
        | "prepare_appointment"
        | "request_authorization"
        | "other"
      opportunity_stage:
        | "new"
        | "verifying"
        | "ready_to_call"
        | "contacted"
        | "follow_up"
        | "analysis_preparing"
        | "appointment"
        | "authorization_pending"
        | "converted"
        | "lost"
        | "do_not_call"
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
      quick_fsbo_resolution_outcome:
        | "created_new"
        | "used_existing"
        | "linked_existing_property"
        | "created_separate"
      task_status: "open" | "completed" | "cancelled"
      task_type:
        | "conversation_follow_up"
        | "appointment_preparation"
        | "analysis_collect_comparables"
        | "analysis_prepare_price_summary"
        | "analysis_advisor_review"
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
      appointment_status: ["scheduled", "completed", "cancelled"],
      contact_method_type: ["phone", "email"],
      conversation_channel: ["phone", "in_person", "video", "email", "other"],
      conversation_result: [
        "reached",
        "unreachable",
        "interested",
        "not_interested",
        "wrong_number",
        "other",
      ],
      duplicate_match_kind: [
        "platform_listing",
        "canonical_url",
        "phone",
        "property_similarity",
        "closed_similar_listing",
      ],
      duplicate_review_decision: [
        "use_existing",
        "link_existing_property",
        "keep_separate",
      ],
      listing_status: ["active", "inactive", "closed"],
      listing_transaction_type: ["sale", "rent"],
      market_analysis_status: ["draft", "finalized", "cancelled"],
      opportunity_next_action_type: [
        "call",
        "verify",
        "follow_up",
        "prepare_analysis",
        "prepare_appointment",
        "request_authorization",
        "other",
      ],
      opportunity_stage: [
        "new",
        "verifying",
        "ready_to_call",
        "contacted",
        "follow_up",
        "analysis_preparing",
        "appointment",
        "authorization_pending",
        "converted",
        "lost",
        "do_not_call",
      ],
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
      quick_fsbo_resolution_outcome: [
        "created_new",
        "used_existing",
        "linked_existing_property",
        "created_separate",
      ],
      task_status: ["open", "completed", "cancelled"],
      task_type: [
        "conversation_follow_up",
        "appointment_preparation",
        "analysis_collect_comparables",
        "analysis_prepare_price_summary",
        "analysis_advisor_review",
      ],
      workspace_role: ["owner", "advisor", "viewer"],
    },
  },
} as const
