export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type RoleType = 'MEMBER' | 'MANAGER' | 'ADMIN'
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type AdjustmentType = 'ADD_TIME' | 'SUBTRACT_TIME' | 'OVERRIDE'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          role: RoleType
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          role?: RoleType
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          role?: RoleType
          created_at?: string
          updated_at?: string
        }
      }
      time_sessions: {
        Row: {
          id: string
          user_id: string
          team_id: string
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          user_id: string
          team_id: string
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          created_by: string
        }
        Update: never
      }
      break_segments: {
        Row: {
          id: string
          time_session_id: string
          break_start_at: string
          break_end_at: string | null
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          time_session_id: string
          break_start_at?: string
          break_end_at?: string | null
          created_at?: string
          created_by: string
        }
        Update: never
      }
      notes: {
        Row: {
          id: string
          time_session_id: string
          content: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          time_session_id: string
          content: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          time_session_id?: string
          content?: string
          created_at?: string
          created_by?: string
        }
      }
      requests: {
        Row: {
          id: string
          user_id: string
          team_id: string
          time_session_id: string | null
          request_type: string
          description: string
          status: RequestStatus
          requested_data: Json | null
          created_at: string
          created_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          review_notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id: string
          time_session_id?: string | null
          request_type: string
          description: string
          status?: RequestStatus
          requested_data?: Json | null
          created_at?: string
          created_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string
          time_session_id?: string | null
          request_type?: string
          description?: string
          status?: RequestStatus
          requested_data?: Json | null
          created_at?: string
          created_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          review_notes?: string | null
        }
      }
      adjustments: {
        Row: {
          id: string
          request_id: string | null
          user_id: string
          team_id: string
          time_session_id: string | null
          adjustment_type: AdjustmentType
          minutes: number
          effective_date: string
          description: string | null
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          request_id?: string | null
          user_id: string
          team_id: string
          time_session_id?: string | null
          adjustment_type: AdjustmentType
          minutes: number
          effective_date: string
          description?: string | null
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          request_id?: string | null
          user_id?: string
          team_id?: string
          time_session_id?: string | null
          adjustment_type?: AdjustmentType
          minutes?: number
          effective_date?: string
          description?: string | null
          created_at?: string
          created_by?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_data: Json | null
          new_data: Json | null
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
          created_by: string
        }
        Update: never
      }
    }
  }
}

