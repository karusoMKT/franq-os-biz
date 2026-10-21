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
  public: {
    Tables: {
      accounts_payable: {
        Row: {
          amount: number
          category: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          due_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          status: string | null
          supplier_name: string
          unit_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          status?: string | null
          supplier_name: string
          unit_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          status?: string | null
          supplier_name?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "accounts_payable_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          profile_id: string | null
          record_id: string | null
          table_name: string
          unit_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          profile_id?: string | null
          record_id?: string | null
          table_name: string
          unit_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          profile_id?: string | null
          record_id?: string | null
          table_name?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "audit_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          audit_date: string | null
          auditor_id: string | null
          auditor_name: string | null
          categories: Json | null
          created_at: string | null
          id: string
          notes: string | null
          score: number
          unit_id: string | null
        }
        Insert: {
          audit_date?: string | null
          auditor_id?: string | null
          auditor_name?: string | null
          categories?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
          score: number
          unit_id?: string | null
        }
        Update: {
          audit_date?: string | null
          auditor_id?: string | null
          auditor_name?: string | null
          categories?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
          score?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audits_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "audits_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_executions: {
        Row: {
          answers_data: Json | null
          checked_items: Json
          checklist_id: string
          completed_at: string | null
          created_at: string
          execution_date: string
          id: string
          notes: string | null
          score: number | null
          status: string
          unit_id: string
          user_id: string | null
        }
        Insert: {
          answers_data?: Json | null
          checked_items?: Json
          checklist_id: string
          completed_at?: string | null
          created_at?: string
          execution_date?: string
          id?: string
          notes?: string | null
          score?: number | null
          status?: string
          unit_id: string
          user_id?: string | null
        }
        Update: {
          answers_data?: Json | null
          checked_items?: Json
          checklist_id?: string
          completed_at?: string | null
          created_at?: string
          execution_date?: string
          id?: string
          notes?: string | null
          score?: number | null
          status?: string
          unit_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_executions_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "checklist_executions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          id: string
          question: string
          required: boolean
          response_type: string | null
        }
        Insert: {
          checklist_id: string
          created_at?: string
          id?: string
          question: string
          required?: boolean
          response_type?: string | null
        }
        Update: {
          checklist_id?: string
          created_at?: string
          id?: string
          question?: string
          required?: boolean
          response_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          id: string
          items: Json
          segment: string
          title: string
        }
        Insert: {
          id?: string
          items: Json
          segment: string
          title: string
        }
        Update: {
          id?: string
          items?: Json
          segment?: string
          title?: string
        }
        Relationships: []
      }
      checklists: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_critical: boolean
          items: Json | null
          title: string
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_critical?: boolean
          items?: Json | null
          title: string
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_critical?: boolean
          items?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          efi_charges: Json
          id: string
          name: string
          plan: string
          segment: string
          subscription_status: string
          trial_ends_at: string
        }
        Insert: {
          created_at?: string
          efi_charges?: Json
          id?: string
          name: string
          plan?: string
          segment: string
          subscription_status?: string
          trial_ends_at?: string
        }
        Update: {
          created_at?: string
          efi_charges?: Json
          id?: string
          name?: string
          plan?: string
          segment?: string
          subscription_status?: string
          trial_ends_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          unit_id: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          unit_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["financial_type"]
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          type: Database["public"]["Enums"]["financial_type"]
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["financial_type"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          company_id: string
          created_at: string
          id: string
          margin_goal: number
          profit_goal: number
          revenue_goal: number
          unit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          margin_goal?: number
          profit_goal?: number
          revenue_goal?: number
          unit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          margin_goal?: number
          profit_goal?: number
          revenue_goal?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "goals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          profile_id: string | null
          title: string
          unit_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          profile_id?: string | null
          title: string
          unit_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          profile_id?: string | null
          title?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "notifications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrences: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          reported_by: string | null
          resolved_at: string | null
          routine_type: string | null
          severity: string | null
          status: string | null
          title: string
          unit_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          reported_by?: string | null
          resolved_at?: string | null
          routine_type?: string | null
          severity?: string | null
          status?: string | null
          title: string
          unit_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          reported_by?: string | null
          resolved_at?: string | null
          routine_type?: string | null
          severity?: string | null
          status?: string | null
          title?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "occurrences_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_scores: {
        Row: {
          id: string
          last_calculated_at: string
          score: number
          status: Database["public"]["Enums"]["unit_status"]
          unit_id: string
        }
        Insert: {
          id?: string
          last_calculated_at?: string
          score?: number
          status?: Database["public"]["Enums"]["unit_status"]
          unit_id: string
        }
        Update: {
          id?: string
          last_calculated_at?: string
          score?: number
          status?: Database["public"]["Enums"]["unit_status"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_scores_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "operational_scores_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      pop_templates: {
        Row: {
          content: string
          id: string
          segment: string
          title: string
        }
        Insert: {
          content: string
          id?: string
          segment: string
          title: string
        }
        Update: {
          content?: string
          id?: string
          segment?: string
          title?: string
        }
        Relationships: []
      }
      pops: {
        Row: {
          category: string | null
          company_id: string
          content: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_url: string | null
          id: string
          title: string
        }
        Insert: {
          category?: string | null
          company_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          title: string
        }
        Update: {
          category?: string | null
          company_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pops_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          role: Database["public"]["Enums"]["app_role"]
          subscription_status: string
          trial_ends_at: string
          unit_id: string | null
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          subscription_status?: string
          trial_ends_at?: string
          unit_id?: string | null
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          subscription_status?: string
          trial_ends_at?: string
          unit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string | null
          due_day: number
          id: string
          unit_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          description?: string | null
          due_day: number
          id?: string
          unit_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string | null
          due_day?: number
          id?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "recurring_expenses_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      revenues: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          unit_id: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          unit_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenues_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenues_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "revenues_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          unit_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          unit_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "tasks_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          date: string | null
          description: string | null
          id: string
          period_end: string | null
          period_start: string | null
          period_type: string | null
          type: string
          unit_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          type: string
          unit_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          period_type?: string | null
          type?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_targets: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          margin_target: number | null
          profit_target: number | null
          revenue_target: number | null
          ticket_average_target: number | null
          unit_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          margin_target?: number | null
          profit_target?: number | null
          revenue_target?: number | null
          ticket_average_target?: number | null
          unit_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          margin_target?: number | null
          profit_target?: number | null
          revenue_target?: number | null
          ticket_average_target?: number | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_targets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_financial_summary"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "unit_targets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          freezer_count: number | null
          health_score: number | null
          id: string
          invite_code: string
          latitude: number | null
          longitude: number | null
          measurement_schedules: string[]
          name: string
          pdv_count: number | null
          score: number | null
          state: string | null
          status: Database["public"]["Enums"]["unit_status"]
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          freezer_count?: number | null
          health_score?: number | null
          id?: string
          invite_code: string
          latitude?: number | null
          longitude?: number | null
          measurement_schedules?: string[]
          name: string
          pdv_count?: number | null
          score?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status"]
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          freezer_count?: number | null
          health_score?: number | null
          id?: string
          invite_code?: string
          latitude?: number | null
          longitude?: number | null
          measurement_schedules?: string[]
          name?: string
          pdv_count?: number | null
          score?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["unit_status"]
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      unit_financial_summary: {
        Row: {
          company_id: string | null
          gross_profit: number | null
          margin_percent: number | null
          net_profit: number | null
          operational_costs: number | null
          production_costs: number | null
          total_revenue: number | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      confirm_company_efi_charge: {
        Args: { p_txid: string }
        Returns: undefined
      }
      current_company_id: { Args: never; Returns: string }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_unit_id: { Args: never; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      get_pdv_notification_recipients: {
        Args: { _unit_id: string }
        Returns: {
          company_id: string
          profile_id: string
        }[]
      }
      get_unit_manager_recipients: {
        Args: { _unit_id: string }
        Returns: {
          company_id: string
          profile_id: string
        }[]
      }
      handle_onboarding:
        | {
            Args: {
              p_city: string
              p_company_name: string
              p_segment: string
              p_state: string
              p_unit_name: string
            }
            Returns: Json
          }
        | {
            Args: { p_company_name: string; p_segment: string; p_units: Json }
            Returns: Json
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_code_valid: { Args: { _code: string }; Returns: boolean }
      recalculate_operational_score: {
        Args: { _unit_id: string }
        Returns: number
      }
      redeem_invite_code: {
        Args: { _code: string; _name?: string }
        Returns: Json
      }
      register_company_efi_charge: {
        Args: { p_company_id: string; p_txid: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "employee"
      financial_type: "income" | "expense"
      unit_status: "green" | "yellow" | "red"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "manager", "employee"],
      financial_type: ["income", "expense"],
      unit_status: ["green", "yellow", "red"],
    },
  },
} as const
