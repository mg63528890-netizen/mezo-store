-- Migration: Fix dashboard_stats keys and remove overloaded list_invoices
-- 1. Remove obsolete overloaded list_invoices with p_cursor timestamptz that caused HTTP 300 Multiple Choices
ALTER FUNCTION IF EXISTS public.list_invoices(text, text, text, text, timestamp with time zone, integer) RENAME TO list_invoices_deprecated;

-- 2. Remove obsolete overloaded top_sales_invoices
ALTER FUNCTION IF EXISTS public.top_sales_invoices(text, text, integer) RENAME TO top_sales_invoices_deprecated;

-- 3. Ensure dashboard_stats returns both recent_invoices and latest_invoices for complete compatibility
CREATE OR REPLACE FUNCTION public.dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_device_id UUID;
    v_cairo_today DATE;
    v_today_start TIMESTAMPTZ;
    v_today_end TIMESTAMPTZ;
    v_yesterday_start TIMESTAMPTZ;
    v_yesterday_end TIMESTAMPTZ;

    v_today_sales NUMERIC(12,2) := 0;
    v_yesterday_sales NUMERIC(12,2) := 0;
    v_today_invoices_count INT := 0;
    v_today_purchases NUMERIC(12,2) := 0;
    v_recent_invoices JSONB;
BEGIN
    PERFORM public.fn_verify_caller_device();

    v_cairo_today := (now() AT TIME ZONE 'Africa/Cairo')::date;
    v_today_start := (v_cairo_today || ' 00:00:00 Africa/Cairo')::TIMESTAMPTZ;
    v_today_end := (v_cairo_today || ' 23:59:59.999 Africa/Cairo')::TIMESTAMPTZ;

    v_yesterday_start := ((v_cairo_today - 1) || ' 00:00:00 Africa/Cairo')::TIMESTAMPTZ;
    v_yesterday_end := ((v_cairo_today - 1) || ' 23:59:59.999 Africa/Cairo')::TIMESTAMPTZ;

    -- Today sales (active only)
    SELECT coalesce(sum(total), 0) INTO v_today_sales
    FROM public.invoices
    WHERE kind = 'sale' AND status = 'active'
      AND created_at >= v_today_start AND created_at <= v_today_end;

    -- Yesterday sales (active only)
    SELECT coalesce(sum(total), 0) INTO v_yesterday_sales
    FROM public.invoices
    WHERE kind = 'sale' AND status = 'active'
      AND created_at >= v_yesterday_start AND created_at <= v_yesterday_end;

    -- Today invoices count (sales + purchases, active only)
    SELECT coalesce(count(*), 0)::INT INTO v_today_invoices_count
    FROM public.invoices
    WHERE status = 'active'
      AND created_at >= v_today_start AND created_at <= v_today_end;

    -- Today purchases (active only)
    SELECT coalesce(sum(total), 0) INTO v_today_purchases
    FROM public.invoices
    WHERE kind = 'purchase' AND status = 'active'
      AND created_at >= v_today_start AND created_at <= v_today_end;

    -- Latest 4 invoices (sales and purchases mixed, active only, newest first)
    SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC), '[]'::JSONB)
    INTO v_recent_invoices
    FROM (
        SELECT id, number, kind, device_type, total, is_new_device, created_at
        FROM public.invoices
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT 4
    ) r;

    RETURN jsonb_build_object(
        'today_sales', v_today_sales,
        'yesterday_sales', v_yesterday_sales,
        'today_invoices_count', v_today_invoices_count,
        'today_purchases', v_today_purchases,
        'recent_invoices', v_recent_invoices,
        'latest_invoices', v_recent_invoices
    );
END;
$$;
