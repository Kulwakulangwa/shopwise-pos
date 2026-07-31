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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          bank_name: string | null
          created_at: string
          current_balance: number
          id: string
          is_active: boolean
          name: string
          opening_balance: number
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
        }
        Update: {
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
        }
        Relationships: []
      }
      cash_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_by: string | null
          description: string | null
          direction: string
          id: string
          occurred_at: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          created_by?: string | null
          description?: string | null
          direction: string
          id?: string
          occurred_at?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_by?: string | null
          description?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      customer_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_by: string | null
          customer_id: string
          id: string
          invoice_id: string | null
          method: string
          note: string | null
          paid_at: string
          reference: string | null
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          invoice_id?: string | null
          method?: string
          note?: string | null
          paid_at?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          invoice_id?: string | null
          method?: string
          note?: string | null
          paid_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number
          current_balance: number
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          tin: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          tin?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          current_balance?: number
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          tin?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          spent_at: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          spent_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          spent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          goods_receipt_id: string
          id: string
          product_id: string | null
          quantity: number
          unit_cost: number
        }
        Insert: {
          goods_receipt_id: string
          id?: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number
        }
        Update: {
          goods_receipt_id?: string
          id?: string
          product_id?: string | null
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          id: string
          notes: string | null
          purchase_order_id: string | null
          receipt_number: string
          received_at: string
          received_by: string | null
          supplier_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number: string
          received_at?: string
          received_by?: string | null
          supplier_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number?: string
          received_at?: string
          received_by?: string | null
          supplier_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          received_at: string
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          received_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          cost_price: number
          discount: number
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          serials: string[]
          total: number
          unit_price: number
        }
        Insert: {
          cost_price?: number
          discount?: number
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          serials?: string[]
          total?: number
          unit_price?: number
        }
        Update: {
          cost_price?: number
          discount?: number
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          serials?: string[]
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          due_date: string | null
          id: string
          invoice_number: string
          is_credit_sale: boolean
          notes: string | null
          paid_amount: number
          payment_method: string | null
          sales_order_id: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          is_credit_sale?: boolean
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          sales_order_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          is_credit_sale?: boolean
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          sales_order_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          id: string
          is_active: boolean
          model: string | null
          name: string
          reorder_level: number
          selling_price: number
          sku: string
          tracks_serial: boolean
          unit: string
          updated_at: string
          warranty_months: number
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          model?: string | null
          name: string
          reorder_level?: number
          selling_price?: number
          sku: string
          tracks_serial?: boolean
          unit?: string
          updated_at?: string
          warranty_months?: number
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          model?: string | null
          name?: string
          reorder_level?: number
          selling_price?: number
          sku?: string
          tracks_serial?: boolean
          unit?: string
          updated_at?: string
          warranty_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          id: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          received_quantity: number
          total: number
          unit_cost: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          received_quantity?: number
          total?: number
          unit_cost?: number
        }
        Update: {
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          total?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          po_number: string
          purchase_request_id: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          tax: number
          total: number
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number: string
          purchase_request_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          purchase_request_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          estimated_cost: number
          id: string
          product_id: string | null
          purchase_request_id: string
          quantity: number
        }
        Insert: {
          estimated_cost?: number
          id?: string
          product_id?: string | null
          purchase_request_id: string
          quantity?: number
        }
        Update: {
          estimated_cost?: number
          id?: string
          product_id?: string | null
          purchase_request_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          request_number: string
          requested_by: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_number: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_number?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          discount: number
          id: string
          product_id: string | null
          quantity: number
          quotation_id: string
          total: number
          unit_price: number
        }
        Insert: {
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          quotation_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          id: string
          notes: string | null
          quote_number: string
          status: string
          subtotal: number
          tax: number
          total: number
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          quote_number: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          quote_number?: string
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string
          name: Database["public"]["Enums"]["app_role"]
          permissions: Json
        }
        Insert: {
          description?: string
          name: Database["public"]["Enums"]["app_role"]
          permissions?: Json
        }
        Update: {
          description?: string
          name?: Database["public"]["Enums"]["app_role"]
          permissions?: Json
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          discount: number
          id: string
          product_id: string | null
          quantity: number
          sales_order_id: string
          total: number
          unit_price: number
        }
        Insert: {
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          sales_order_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          discount?: number
          id?: string
          product_id?: string | null
          quantity?: number
          sales_order_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount: number
          id: string
          notes: string | null
          order_number: string
          quotation_id: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          order_number: string
          quotation_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          id?: string
          notes?: string | null
          order_number?: string
          quotation_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_return_items: {
        Row: {
          id: string
          product_id: string | null
          quantity: number
          sales_return_id: string
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          quantity?: number
          sales_return_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          product_id?: string | null
          quantity?: number
          sales_return_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_sales_return_id_fkey"
            columns: ["sales_return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          reason: string | null
          refund_amount: number
          restock: boolean
          return_number: string
          status: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          reason?: string | null
          refund_amount?: number
          restock?: boolean
          return_number: string
          status?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          reason?: string | null
          refund_amount?: number
          restock?: boolean
          return_number?: string
          status?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      serial_numbers: {
        Row: {
          created_at: string
          id: string
          invoice_id: string | null
          product_id: string
          serial: string
          status: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          product_id: string
          serial: string
          status?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          product_id?: string
          serial?: string
          status?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "serial_numbers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_numbers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          id: string
          product_id: string
          quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          note: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          note?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          paid_amount: number
          purchase_order_id: string | null
          status: string
          supplier_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_amount?: number
          purchase_order_id?: string | null
          status?: string
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_amount?: number
          purchase_order_id?: string | null
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_by: string | null
          id: string
          method: string
          paid_at: string
          reference: string | null
          supplier_id: string
          supplier_invoice_id: string | null
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          created_by?: string | null
          id?: string
          method?: string
          paid_at?: string
          reference?: string | null
          supplier_id: string
          supplier_invoice_id?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_by?: string | null
          id?: string
          method?: string
          paid_at?: string
          reference?: string | null
          supplier_id?: string
          supplier_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          balance: number
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          balance?: number
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          balance?: number
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
      warehouses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      warranties: {
        Row: {
          created_at: string
          customer_id: string | null
          end_date: string
          id: string
          invoice_id: string | null
          invoice_item_id: string | null
          product_id: string | null
          serial: string | null
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          end_date: string
          id?: string
          invoice_id?: string | null
          invoice_item_id?: string | null
          product_id?: string | null
          serial?: string | null
          start_date?: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          end_date?: string
          id?: string
          invoice_id?: string | null
          invoice_item_id?: string | null
          product_id?: string | null
          serial?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_claims: {
        Row: {
          claim_number: string
          created_at: string
          created_by: string | null
          id: string
          issue: string
          resolution: string | null
          resolved_at: string | null
          status: string
          warranty_id: string
        }
        Insert: {
          claim_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          warranty_id: string
        }
        Update: {
          claim_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          issue?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "manager" | "cashier" | "storekeeper"
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
      app_role: ["owner", "manager", "cashier", "storekeeper"],
    },
  },
} as const
