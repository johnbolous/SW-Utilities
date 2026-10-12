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
    PostgrestVersion: "14.5"
  }
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
      alerts: {
        Row: {
          created_at: string
          id: string
          inverter_id: string | null
          is_resolved: boolean
          message: string
          meter_id: string | null
          reading_ref_id: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          type: Database["public"]["Enums"]["alert_type"]
          water_meter_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inverter_id?: string | null
          is_resolved?: boolean
          message: string
          meter_id?: string | null
          reading_ref_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          type: Database["public"]["Enums"]["alert_type"]
          water_meter_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inverter_id?: string | null
          is_resolved?: boolean
          message?: string
          meter_id?: string | null
          reading_ref_id?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          type?: Database["public"]["Enums"]["alert_type"]
          water_meter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "solar_inverters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_water_meter_id_fkey"
            columns: ["water_meter_id"]
            isOneToOne: false
            referencedRelation: "water_meters"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          code: string
          excel_color_hex: string | null
          excel_label: string | null
          excel_sheet_hint: string | null
          has_floors: boolean
          has_meters: boolean
          id: string
          is_active: boolean
          name_ar: string | null
          name_en: string
          sort_order: number
          technology_park_id: string | null
        }
        Insert: {
          code: string
          excel_color_hex?: string | null
          excel_label?: string | null
          excel_sheet_hint?: string | null
          has_floors?: boolean
          has_meters?: boolean
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          sort_order?: number
          technology_park_id?: string | null
        }
        Update: {
          code?: string
          excel_color_hex?: string | null
          excel_label?: string | null
          excel_sheet_hint?: string | null
          has_floors?: boolean
          has_meters?: boolean
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          sort_order?: number
          technology_park_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_technology_park_id_fkey"
            columns: ["technology_park_id"]
            isOneToOne: false
            referencedRelation: "technology_parks"
            referencedColumns: ["id"]
          },
        ]
      }
      electric_readings: {
        Row: {
          consumption: number | null
          created_at: string
          current_value: number
          id: string
          is_lower_confirmed: boolean
          meter_id: string
          notes: string | null
          previous_value: number
          reading_date: string
          reading_frequency: Database["public"]["Enums"]["reading_frequency"]
          reading_month: number | null
          technician_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          consumption?: number | null
          created_at?: string
          current_value: number
          id?: string
          is_lower_confirmed?: boolean
          meter_id: string
          notes?: string | null
          previous_value: number
          reading_date: string
          reading_frequency: Database["public"]["Enums"]["reading_frequency"]
          reading_month?: number | null
          technician_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          consumption?: number | null
          created_at?: string
          current_value?: number
          id?: string
          is_lower_confirmed?: boolean
          meter_id?: string
          notes?: string | null
          previous_value?: number
          reading_date?: string
          reading_frequency?: Database["public"]["Enums"]["reading_frequency"]
          reading_month?: number | null
          technician_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "electric_readings_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electric_readings_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electric_readings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          building_id: string
          code: string
          has_rooms: boolean
          id: string
          name_ar: string | null
          name_en: string
          sort_order: number
        }
        Insert: {
          building_id: string
          code: string
          has_rooms?: boolean
          id?: string
          name_ar?: string | null
          name_en: string
          sort_order?: number
        }
        Update: {
          building_id?: string
          code?: string
          has_rooms?: boolean
          id?: string
          name_ar?: string | null
          name_en?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "floors_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_readings: {
        Row: {
          consumption: number | null
          created_at: string
          current_value: number
          id: string
          is_lower_confirmed: boolean
          kiosk_id: string
          notes: string | null
          previous_value: number
          reading_date: string
          reading_month: number | null
          technician_id: string
        }
        Insert: {
          consumption?: number | null
          created_at?: string
          current_value: number
          id?: string
          is_lower_confirmed?: boolean
          kiosk_id: string
          notes?: string | null
          previous_value: number
          reading_date: string
          reading_month?: number | null
          technician_id: string
        }
        Update: {
          consumption?: number | null
          created_at?: string
          current_value?: number
          id?: string
          is_lower_confirmed?: boolean
          kiosk_id?: string
          notes?: string | null
          previous_value?: number
          reading_date?: string
          reading_month?: number | null
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_readings_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_readings_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosks: {
        Row: {
          building_id: string | null
          excel_column: string | null
          excel_sheet: string | null
          id: string
          is_active: boolean
          meter_code: string
          name: string
          sort_order: number
        }
        Insert: {
          building_id?: string | null
          excel_column?: string | null
          excel_sheet?: string | null
          id?: string
          is_active?: boolean
          meter_code: string
          name: string
          sort_order?: number
        }
        Update: {
          building_id?: string | null
          excel_column?: string | null
          excel_sheet?: string | null
          id?: string
          is_active?: boolean
          meter_code?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "kiosks_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      meters: {
        Row: {
          building_id: string
          category: Database["public"]["Enums"]["meter_category"]
          created_at: string
          excel_column: string | null
          excel_sheet: string | null
          floor_id: string | null
          id: string
          is_active: boolean
          label_ar: string | null
          label_en: string
          meter_code: string
          monthly_reading_day: number | null
          reading_frequency: Database["public"]["Enums"]["reading_frequency"]
          room_code: string | null
          room_id: string | null
          sort_order: number
          tenant_name: string | null
        }
        Insert: {
          building_id: string
          category: Database["public"]["Enums"]["meter_category"]
          created_at?: string
          excel_column?: string | null
          excel_sheet?: string | null
          floor_id?: string | null
          id?: string
          is_active?: boolean
          label_ar?: string | null
          label_en: string
          meter_code: string
          monthly_reading_day?: number | null
          reading_frequency?: Database["public"]["Enums"]["reading_frequency"]
          room_code?: string | null
          room_id?: string | null
          sort_order?: number
          tenant_name?: string | null
        }
        Update: {
          building_id?: string
          category?: Database["public"]["Enums"]["meter_category"]
          created_at?: string
          excel_column?: string | null
          excel_sheet?: string | null
          floor_id?: string | null
          id?: string
          is_active?: boolean
          label_ar?: string | null
          label_en?: string
          meter_code?: string
          monthly_reading_day?: number | null
          reading_frequency?: Database["public"]["Enums"]["reading_frequency"]
          room_code?: string | null
          room_id?: string | null
          sort_order?: number
          tenant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meters_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meters_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meters_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          captured_at: string
          captured_by: string
          file_name: string
          id: string
          inverter_id: string | null
          kiosk_id: string | null
          meter_id: string | null
          quality_notes: string | null
          quality_warning: boolean
          reading_date: string
          reading_entity_type: Database["public"]["Enums"]["reading_entity_type"]
          replaced_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["photo_status"]
          storage_path: string
          version: number
          water_meter_id: string | null
        }
        Insert: {
          captured_at?: string
          captured_by: string
          file_name: string
          id?: string
          inverter_id?: string | null
          kiosk_id?: string | null
          meter_id?: string | null
          quality_notes?: string | null
          quality_warning?: boolean
          reading_date: string
          reading_entity_type: Database["public"]["Enums"]["reading_entity_type"]
          replaced_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path: string
          version?: number
          water_meter_id?: string | null
        }
        Update: {
          captured_at?: string
          captured_by?: string
          file_name?: string
          id?: string
          inverter_id?: string | null
          kiosk_id?: string | null
          meter_id?: string | null
          quality_notes?: string | null
          quality_warning?: boolean
          reading_date?: string
          reading_entity_type?: Database["public"]["Enums"]["reading_entity_type"]
          replaced_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path?: string
          version?: number
          water_meter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "solar_inverters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_water_meter_id_fkey"
            columns: ["water_meter_id"]
            isOneToOne: false
            referencedRelation: "water_meters"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          building_id: string
          created_at: string | null
          floor_id: string
          id: string
          is_active: boolean
          name_ar: string | null
          name_en: string
          sort_order: number
        }
        Insert: {
          building_id: string
          created_at?: string | null
          floor_id: string
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en: string
          sort_order?: number
        }
        Update: {
          building_id?: string
          created_at?: string | null
          floor_id?: string
          id?: string
          is_active?: boolean
          name_ar?: string | null
          name_en?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          last_seen_at: string
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_inverters: {
        Row: {
          building_id: string
          excel_column: string | null
          excel_sheet: string | null
          id: string
          inverter_no: number
          is_active: boolean
          label_en: string
          meter_code: string
        }
        Insert: {
          building_id: string
          excel_column?: string | null
          excel_sheet?: string | null
          id?: string
          inverter_no: number
          is_active?: boolean
          label_en: string
          meter_code: string
        }
        Update: {
          building_id?: string
          excel_column?: string | null
          excel_sheet?: string | null
          id?: string
          inverter_no?: number
          is_active?: boolean
          label_en?: string
          meter_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_inverters_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_production: {
        Row: {
          created_at: string
          id: string
          inverter_id: string
          notes: string | null
          production_date: string
          technician_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          inverter_id: string
          notes?: string | null
          production_date: string
          technician_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          inverter_id?: string
          notes?: string | null
          production_date?: string
          technician_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "solar_production_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "solar_inverters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_production_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      technology_parks: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_park_access: {
        Row: {
          created_at: string
          id: string
          park_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          park_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          park_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_park_access_park_id_fkey"
            columns: ["park_id"]
            isOneToOne: false
            referencedRelation: "technology_parks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_park_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          all_parks_access: boolean
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          language: string
          last_login_at: string | null
          must_change_password: boolean
          password_hash: string
          role: Database["public"]["Enums"]["user_role"]
          theme: string
          username: string
        }
        Insert: {
          all_parks_access?: boolean
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          language?: string
          last_login_at?: string | null
          must_change_password?: boolean
          password_hash: string
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string
          username: string
        }
        Update: {
          all_parks_access?: boolean
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          language?: string
          last_login_at?: string | null
          must_change_password?: boolean
          password_hash?: string
          role?: Database["public"]["Enums"]["user_role"]
          theme?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      water_meters: {
        Row: {
          building_id: string | null
          excel_column: string | null
          excel_sheet: string | null
          id: string
          is_active: boolean
          label_ar: string | null
          label_en: string
          meter_code: string
          monthly_reading_day: number | null
          reading_frequency: Database["public"]["Enums"]["reading_frequency"]
          type: Database["public"]["Enums"]["water_meter_type"]
        }
        Insert: {
          building_id?: string | null
          excel_column?: string | null
          excel_sheet?: string | null
          id?: string
          is_active?: boolean
          label_ar?: string | null
          label_en: string
          meter_code: string
          monthly_reading_day?: number | null
          reading_frequency?: Database["public"]["Enums"]["reading_frequency"]
          type: Database["public"]["Enums"]["water_meter_type"]
        }
        Update: {
          building_id?: string | null
          excel_column?: string | null
          excel_sheet?: string | null
          id?: string
          is_active?: boolean
          label_ar?: string | null
          label_en?: string
          meter_code?: string
          monthly_reading_day?: number | null
          reading_frequency?: Database["public"]["Enums"]["reading_frequency"]
          type?: Database["public"]["Enums"]["water_meter_type"]
        }
        Relationships: [
          {
            foreignKeyName: "water_meters_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      water_readings: {
        Row: {
          consumption: number | null
          created_at: string
          current_value: number
          id: string
          is_lower_confirmed: boolean
          notes: string | null
          previous_value: number
          reading_date: string
          reading_frequency: Database["public"]["Enums"]["reading_frequency"]
          reading_month: number | null
          technician_id: string
          water_meter_id: string
        }
        Insert: {
          consumption?: number | null
          created_at?: string
          current_value: number
          id?: string
          is_lower_confirmed?: boolean
          notes?: string | null
          previous_value: number
          reading_date: string
          reading_frequency: Database["public"]["Enums"]["reading_frequency"]
          reading_month?: number | null
          technician_id: string
          water_meter_id: string
        }
        Update: {
          consumption?: number | null
          created_at?: string
          current_value?: number
          id?: string
          is_lower_confirmed?: boolean
          notes?: string | null
          previous_value?: number
          reading_date?: string
          reading_frequency?: Database["public"]["Enums"]["reading_frequency"]
          reading_month?: number | null
          technician_id?: string
          water_meter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_readings_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_readings_water_meter_id_fkey"
            columns: ["water_meter_id"]
            isOneToOne: false
            referencedRelation: "water_meters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      latest_visible_photos: {
        Row: {
          captured_at: string | null
          captured_by: string | null
          file_name: string | null
          id: string | null
          inverter_id: string | null
          kiosk_id: string | null
          meter_id: string | null
          quality_notes: string | null
          quality_warning: boolean | null
          reading_date: string | null
          reading_entity_type:
            | Database["public"]["Enums"]["reading_entity_type"]
            | null
          replaced_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["photo_status"] | null
          storage_path: string | null
          version: number | null
          water_meter_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_inverter_id_fkey"
            columns: ["inverter_id"]
            isOneToOne: false
            referencedRelation: "solar_inverters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_water_meter_id_fkey"
            columns: ["water_meter_id"]
            isOneToOne: false
            referencedRelation: "water_meters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_monthly_reveal_day: { Args: { p_date?: string }; Returns: boolean }
      is_reading_open_today: {
        Args: {
          p_date?: string
          p_frequency: Database["public"]["Enums"]["reading_frequency"]
          p_monthly_day: number
        }
        Returns: boolean
      }
      purge_expired_sessions: { Args: never; Returns: undefined }
      update_reading_with_reason: {
        Args: {
          p_id: string
          p_patch: Json
          p_reason: string
          p_table: string
          p_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      alert_severity: "warning" | "critical"
      alert_type:
        | "LOW_READING"
        | "HIGH_CONSUMPTION"
        | "ZERO_SOLAR"
        | "MISSING_READING"
      meter_category: "LOW" | "MEDIUM"
      photo_status: "pending" | "approved" | "rejected"
      reading_entity_type: "LOW" | "MEDIUM" | "SOLAR" | "WATER" | "KIOSK"
      reading_frequency: "DAILY" | "MONTHLY"
      user_role: "admin" | "engineer" | "technician"
      water_meter_type: "DRINKING" | "IRRIGATION" | "FACTORY"
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
      alert_severity: ["warning", "critical"],
      alert_type: [
        "LOW_READING",
        "HIGH_CONSUMPTION",
        "ZERO_SOLAR",
        "MISSING_READING",
      ],
      meter_category: ["LOW", "MEDIUM"],
      photo_status: ["pending", "approved", "rejected"],
      reading_entity_type: ["LOW", "MEDIUM", "SOLAR", "WATER", "KIOSK"],
      reading_frequency: ["DAILY", "MONTHLY"],
      user_role: ["admin", "engineer", "technician"],
      water_meter_type: ["DRINKING", "IRRIGATION", "FACTORY"],
    },
  },
} as const
