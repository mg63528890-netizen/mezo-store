import { supabase } from './supabase';

export interface InvoiceItem {
  id: string;
  number: string;
  idempotency_key: string;
  kind: 'sale' | 'purchase';
  device_type: string;
  battery_pct: number;
  storage_gb: number;
  device_number: string;
  condition_notes?: string | null;
  is_new_device: boolean;
  tax_period: string;
  buyer_name: string;
  seller_name: string;
  party_phone?: string | null;
  price: number;
  discount_code_id?: string | null;
  discount_code?: string | null;
  discount_amount: number;
  total: number;
  warranty_unit?: 'none' | 'days' | 'months' | null;
  warranty_value?: number | null;
  warranty_ends_at?: string | null;
  editable_until: string;
  status: 'active' | 'cancelled' | 'deleted';
  cancelled_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  is_editable?: boolean;
}

export interface DashboardStats {
  today_sales: number;
  yesterday_sales: number;
  today_invoices_count: number;
  today_purchases: number;
  recent_invoices: {
    id: string;
    number: string;
    kind: 'sale' | 'purchase';
    device_type: string;
    total: number;
    is_new_device: boolean;
    created_at: string;
  }[];
  latest_invoices?: {
    id: string;
    number: string;
    kind: 'sale' | 'purchase';
    device_type: string;
    total: number;
    is_new_device: boolean;
    created_at: string;
  }[];
}

export interface InvoiceSeriesItem {
  label: string;
  full_label?: string;
  date?: string;
  value: number;
  is_future?: boolean;
  month_idx?: number;
}

export interface InvoiceListResponse {
  items: InvoiceItem[];
  summary: {
    count: number;
    total: number;
  };
}

export interface CreateInvoicePayload {
  idempotency_key: string;
  kind: 'sale' | 'purchase';
  device_type: string;
  battery_pct: number;
  storage_gb: number;
  device_number: string;
  condition_notes?: string | null;
  is_new_device: boolean;
  tax_period: string;
  buyer_name: string;
  seller_name: string;
  party_phone?: string | null;
  price: number;
  discount_code?: string | null;
  warranty_unit?: 'none' | 'days' | 'months';
  warranty_value?: number | null;
}

export const api = {
  async checkDevice(): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_device');
      if (error) {
        if (error.message?.includes('DEVICE_NOT_REGISTERED')) {
          return false;
        }
        // Network error -> keep session
        return true;
      }
      return data?.status === 'OK';
    } catch {
      return true;
    }
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const { data, error } = await supabase.rpc('dashboard_stats');
    if (error) throw error;
    if (data && !data.recent_invoices && data.latest_invoices) {
      data.recent_invoices = data.latest_invoices;
    }
    return data;
  },

  async getInvoiceSeries(
    kind: 'sale' | 'purchase',
    range: 'week' | 'month' | 'year'
  ): Promise<InvoiceSeriesItem[]> {
    const { data, error } = await supabase.rpc('invoice_series', {
      p_kind: kind,
      p_range: range,
    });
    if (error) throw error;
    return data || [];
  },

  async getTopSalesInvoices(
    range: 'week' | 'month' | 'year',
    limit: number = 3
  ): Promise<InvoiceItem[]> {
    const { data, error } = await supabase.rpc('top_sales_invoices', {
      p_range: range,
      p_limit: limit,
    });
    if (error) throw error;
    return data || [];
  },

  async listInvoices(params: {
    kind: 'sale' | 'purchase';
    from_date?: string | null;
    to_date?: string | null;
    search?: string | null;
    cursor?: string | null;
    limit?: number;
  }): Promise<InvoiceListResponse> {
    const { data, error } = await supabase.rpc('list_invoices', {
      p_kind: params.kind,
      p_from_date: params.from_date || null,
      p_to_date: params.to_date || null,
      p_search: params.search || null,
      p_cursor: params.cursor || null,
      p_limit: params.limit || 50,
    });
    if (error) throw error;
    return data || { items: [], summary: { count: 0, total: 0 } };
  },

  async getInvoice(id: string): Promise<{
    invoice: InvoiceItem;
    is_editable: boolean;
    remaining_seconds: number;
    audit: any[];
  }> {
    const { data, error } = await supabase.rpc('get_invoice', { p_id: id });
    if (error) throw error;
    return data;
  },

  async createInvoice(payload: CreateInvoicePayload): Promise<InvoiceItem> {
    const { data, error } = await supabase.rpc('create_invoice', { payload });
    if (error) throw error;
    return data;
  },

  async updateInvoice(id: string, payload: Partial<CreateInvoicePayload>): Promise<InvoiceItem> {
    const { data, error } = await supabase.rpc('update_invoice', {
      p_id: id,
      payload,
    });
    if (error) throw error;
    return data;
  },

  async cancelInvoice(id: string, reason?: string): Promise<InvoiceItem> {
    const { data, error } = await supabase.rpc('cancel_invoice', {
      p_id: id,
      p_reason: reason || null,
    });
    if (error) throw error;
    return data;
  },

  async deleteInvoice(id: string): Promise<InvoiceItem> {
    const { data, error } = await supabase.rpc('delete_invoice', { p_id: id });
    if (error) throw error;
    return data;
  },

  async validateDiscount(code: string, price: number) {
    const { data, error } = await supabase.rpc('validate_discount', {
      p_code: code,
      p_price: price,
    });
    if (error) throw error;
    return data;
  },

  async getLoggedInDevicesCount(): Promise<number> {
    const { data, error } = await supabase
      .from('device_stats')
      .select('logged_in_count')
      .eq('id', 1)
      .single();

    if (error) return 1;
    return data?.logged_in_count || 1;
  },
};
