-- ====================================================================
-- Mezo Store - Migration 02: Functions, RPCs, Security Definer
-- ====================================================================

set search_path = public, extensions;

-- 1. DEVICE BINDING HELPER (§5.6)
create or replace function public.get_verified_device_id()
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_headers jsonb;
    v_raw_token text;
    v_token_hash text;
    v_device_id uuid;
begin
    -- Read x-device-token header
    begin
        v_headers := current_setting('request.headers', true)::jsonb;
    exception when others then
        v_headers := '{}'::jsonb;
    end;

    v_raw_token := v_headers->>'x-device-token';
    if v_raw_token is null or length(trim(v_raw_token)) = 0 then
        raise exception 'DEVICE_NOT_REGISTERED';
    end if;

    -- Hash token with sha-256
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    -- Verify active logged-in device
    select id into v_device_id
    from public.registered_devices
    where token_hash = v_token_hash and is_logged_in = true;

    if v_device_id is null then
        raise exception 'DEVICE_NOT_REGISTERED';
    end if;

    -- Update last seen timestamp
    update public.registered_devices
    set last_seen_at = now()
    where id = v_device_id;

    return v_device_id;
end;
$$;

-- 2. CHECK DEVICE RPC
create or replace function public.check_device()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
begin
    v_device_id := public.get_verified_device_id();
    return jsonb_build_object('status', 'OK', 'device_id', v_device_id);
end;
$$;

-- 3. VALIDATE DISCOUNT RPC (§9.1)
create or replace function public.validate_discount(p_code text, p_price numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_row public.discount_codes%rowtype;
    v_discount numeric(12,2);
    v_clean_code text;
begin
    v_device_id := public.get_verified_device_id();
    v_clean_code := lower(trim(coalesce(p_code, '')));

    if length(v_clean_code) = 0 then
        raise exception 'DISCOUNT_INVALID';
    end if;

    select * into v_row
    from public.discount_codes
    where lower(trim(code)) = v_clean_code;

    if not found or not v_row.is_active then
        raise exception 'DISCOUNT_INVALID';
    end if;

    if v_row.starts_at is not null and now() < v_row.starts_at then
        raise exception 'DISCOUNT_INVALID';
    end if;

    if v_row.expires_at is not null and now() > v_row.expires_at then
        raise exception 'DISCOUNT_EXPIRED';
    end if;

    if v_row.max_uses is not null and v_row.used_count >= v_row.max_uses then
        raise exception 'DISCOUNT_EXHAUSTED';
    end if;

    -- Compute discount
    if v_row.type = 'percent' then
        v_discount := round((p_price * v_row.value) / 100.0, 2);
    else
        v_discount := v_row.value;
    end if;

    -- Cap discount at price
    if v_discount > p_price then
        v_discount := p_price;
    end if;

    return jsonb_build_object(
        'id', v_row.id,
        'code', v_row.code,
        'type', v_row.type,
        'value', v_row.value,
        'discount_amount', v_discount,
        'total', p_price - v_discount
    );
end;
$$;

-- 4. CREATE INVOICE RPC (§4.2, §4.3, §8.2.1, §8.2.2)
create or replace function public.create_invoice(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_idempotency_key uuid;
    v_existing public.invoices%rowtype;
    v_kind text;
    v_device_type text;
    v_battery_pct int;
    v_storage_gb int;
    v_device_number text;
    v_condition_notes text;
    v_is_new_device boolean;
    v_tax_period text;
    v_buyer_name text;
    v_seller_name text;
    v_party_phone text;
    v_price numeric(12,2);
    v_discount_code text;
    v_discount_code_id uuid;
    v_discount_amount numeric(12,2) := 0;
    v_total numeric(12,2);
    v_warranty_unit text;
    v_warranty_value int;
    v_warranty_ends_at timestamptz;
    v_editable_until timestamptz;
    v_cairo_date date;
    v_date_prefix text;
    v_next_n int;
    v_invoice_number text;
    v_new_invoice public.invoices%rowtype;
begin
    -- 1. Validate device
    v_device_id := public.get_verified_device_id();

    -- 2. Check Idempotency Key
    v_idempotency_key := (payload->>'idempotency_key')::uuid;
    if v_idempotency_key is null then
        raise exception 'VALIDATION_FAILED: idempotency_key is required';
    end if;

    select * into v_existing
    from public.invoices
    where idempotency_key = v_idempotency_key;

    if found then
        return to_jsonb(v_existing);
    end if;

    -- 3. Parse and Validate Fields
    v_kind := payload->>'kind';
    if v_kind not in ('sale', 'purchase') then
        raise exception 'VALIDATION_FAILED: invalid kind';
    end if;

    v_device_type := trim(coalesce(payload->>'device_type', ''));
    if length(v_device_type) < 2 or length(v_device_type) > 60 then
        raise exception 'VALIDATION_FAILED: device_type length 2-60 required';
    end if;

    v_battery_pct := (payload->>'battery_pct')::int;
    if v_battery_pct is null or v_battery_pct < 0 or v_battery_pct > 100 then
        raise exception 'VALIDATION_FAILED: battery_pct must be 0-100';
    end if;

    v_storage_gb := (payload->>'storage_gb')::int;
    if v_storage_gb is null or v_storage_gb <= 0 then
        raise exception 'VALIDATION_FAILED: storage_gb must be positive';
    end if;

    v_device_number := trim(coalesce(payload->>'device_number', ''));
    if length(v_device_number) < 5 or length(v_device_number) > 20 then
        raise exception 'VALIDATION_FAILED: device_number length 5-20 required';
    end if;

    v_buyer_name := trim(coalesce(payload->>'buyer_name', ''));
    if length(v_buyer_name) < 2 or length(v_buyer_name) > 60 then
        raise exception 'VALIDATION_FAILED: buyer_name length 2-60 required';
    end if;

    v_seller_name := trim(coalesce(payload->>'seller_name', ''));
    if length(v_seller_name) < 2 or length(v_seller_name) > 60 then
        raise exception 'VALIDATION_FAILED: seller_name length 2-60 required';
    end if;

    v_tax_period := trim(coalesce(payload->>'tax_period', ''));
    if length(v_tax_period) = 0 then
        raise exception 'VALIDATION_FAILED: tax_period required';
    end if;

    v_price := (payload->>'price')::numeric(12,2);
    if v_price is null or v_price <= 0 then
        raise exception 'VALIDATION_FAILED: price must be positive';
    end if;

    v_condition_notes := payload->>'condition_notes';
    v_is_new_device := coalesce((payload->>'is_new_device')::boolean, false);
    v_party_phone := payload->>'party_phone';

    -- 4. Handle Kind-specific logic
    if v_kind = 'sale' then
        -- Discount logic
        v_discount_code := trim(coalesce(payload->>'discount_code', ''));
        if length(v_discount_code) > 0 then
            declare
                v_disc_res jsonb;
            begin
                v_disc_res := public.validate_discount(v_discount_code, v_price);
                v_discount_code_id := (v_disc_res->>'id')::uuid;
                v_discount_amount := (v_disc_res->>'discount_amount')::numeric(12,2);
                -- Increment used count
                update public.discount_codes
                set used_count = used_count + 1
                where id = v_discount_code_id;
            end;
        end if;

        -- Warranty logic
        v_warranty_unit := coalesce(payload->>'warranty_unit', 'none');
        if v_warranty_unit not in ('none', 'days', 'months') then
            v_warranty_unit := 'none';
        end if;

        if v_warranty_unit = 'none' then
            v_warranty_value := null;
            v_warranty_ends_at := null;
            v_editable_until := now() + interval '24 hours';
        elsif v_warranty_unit = 'days' then
            v_warranty_value := (payload->>'warranty_value')::int;
            v_warranty_ends_at := now() + (v_warranty_value || ' days')::interval;
            v_editable_until := greatest(v_warranty_ends_at, now() + interval '24 hours');
        elsif v_warranty_unit = 'months' then
            v_warranty_value := (payload->>'warranty_value')::int;
            v_warranty_ends_at := now() + (v_warranty_value || ' months')::interval;
            v_editable_until := greatest(v_warranty_ends_at, now() + interval '24 hours');
        end if;

    else
        -- Purchase
        v_discount_code_id := null;
        v_discount_code := null;
        v_discount_amount := 0;
        v_warranty_unit := null;
        v_warranty_value := null;
        v_warranty_ends_at := null;
        v_editable_until := now() + interval '3 days';
    end if;

    v_total := v_price - v_discount_amount;
    if v_total < 0 then
        v_total := 0;
    end if;

    -- 5. Generate Invoice Number (Cairo timezone)
    v_cairo_date := (now() at time zone 'Africa/Cairo')::date;
    v_date_prefix := to_char(v_cairo_date, 'YYMMDD');

    -- Row lock on invoice_counters
    insert into public.invoice_counters (day, kind, last_n)
    values (v_cairo_date, v_kind, 1)
    on conflict (day, kind)
    do update set last_n = public.invoice_counters.last_n + 1
    returning last_n into v_next_n;

    if v_kind = 'sale' then
        v_invoice_number := 'INV-' || v_date_prefix || '-' || lpad(v_next_n::text, 4, '0');
    else
        v_invoice_number := 'PUR-' || v_date_prefix || '-' || lpad(v_next_n::text, 4, '0');
    end if;

    -- 6. Insert Invoice
    insert into public.invoices (
        number,
        idempotency_key,
        kind,
        device_type,
        battery_pct,
        storage_gb,
        device_number,
        condition_notes,
        is_new_device,
        tax_period,
        buyer_name,
        seller_name,
        party_phone,
        price,
        discount_code_id,
        discount_code,
        discount_amount,
        total,
        warranty_unit,
        warranty_value,
        warranty_ends_at,
        editable_until,
        status,
        created_by_device,
        created_at,
        updated_at
    ) values (
        v_invoice_number,
        v_idempotency_key,
        v_kind,
        v_device_type,
        v_battery_pct,
        v_storage_gb,
        v_device_number,
        v_condition_notes,
        v_is_new_device,
        v_tax_period,
        v_buyer_name,
        v_seller_name,
        v_party_phone,
        v_price,
        v_discount_code_id,
        v_discount_code,
        v_discount_amount,
        v_total,
        v_warranty_unit,
        v_warranty_value,
        v_warranty_ends_at,
        v_editable_until,
        'active',
        v_device_id,
        now(),
        now()
    ) returning * into v_new_invoice;

    -- 7. Audit Log
    insert into public.invoice_audit (
        invoice_id,
        action,
        diff,
        device_id,
        created_at
    ) values (
        v_new_invoice.id,
        'created',
        to_jsonb(v_new_invoice),
        v_device_id,
        now()
    );

    return to_jsonb(v_new_invoice);
end;
$$;

-- 5. UPDATE INVOICE RPC (§4.2)
create or replace function public.update_invoice(p_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_existing public.invoices%rowtype;
    v_updated public.invoices%rowtype;
    v_new_price numeric(12,2);
    v_new_discount_code text;
    v_new_discount_code_id uuid;
    v_new_discount_amount numeric(12,2) := 0;
    v_new_total numeric(12,2);
    v_new_warranty_unit text;
    v_new_warranty_value int;
    v_new_warranty_ends_at timestamptz;
    v_new_editable_until timestamptz;
begin
    v_device_id := public.get_verified_device_id();

    select * into v_existing
    from public.invoices
    where id = p_id;

    if not found then
        raise exception 'INVOICE_NOT_FOUND';
    end if;

    if v_existing.status != 'active' or now() > v_existing.editable_until then
        raise exception 'INVOICE_LOCKED';
    end if;

    v_new_price := (payload->>'price')::numeric(12,2);
    if v_new_price is null or v_new_price <= 0 then
        raise exception 'VALIDATION_FAILED: price must be positive';
    end if;

    if v_existing.kind = 'sale' then
        v_new_discount_code := trim(coalesce(payload->>'discount_code', ''));
        if v_new_discount_code != coalesce(v_existing.discount_code, '') then
            -- Re-evaluate discount
            if length(v_new_discount_code) > 0 then
                declare
                    v_disc_res jsonb;
                begin
                    v_disc_res := public.validate_discount(v_new_discount_code, v_new_price);
                    v_new_discount_code_id := (v_disc_res->>'id')::uuid;
                    v_new_discount_amount := (v_disc_res->>'discount_amount')::numeric(12,2);
                    update public.discount_codes set used_count = used_count + 1 where id = v_new_discount_code_id;
                end;
            end if;
            if v_existing.discount_code_id is not null then
                update public.discount_codes set used_count = greatest(0, used_count - 1) where id = v_existing.discount_code_id;
            end if;
        else
            v_new_discount_code_id := v_existing.discount_code_id;
            v_new_discount_amount := v_existing.discount_amount;
        end if;

        -- Recompute warranty from original created_at!
        v_new_warranty_unit := coalesce(payload->>'warranty_unit', 'none');
        if v_new_warranty_unit = 'days' then
            v_new_warranty_value := (payload->>'warranty_value')::int;
            v_new_warranty_ends_at := v_existing.created_at + (v_new_warranty_value || ' days')::interval;
            v_new_editable_until := greatest(v_new_warranty_ends_at, v_existing.created_at + interval '24 hours');
        elsif v_new_warranty_unit = 'months' then
            v_new_warranty_value := (payload->>'warranty_value')::int;
            v_new_warranty_ends_at := v_existing.created_at + (v_new_warranty_value || ' months')::interval;
            v_new_editable_until := greatest(v_new_warranty_ends_at, v_existing.created_at + interval '24 hours');
        else
            v_new_warranty_unit := 'none';
            v_new_warranty_value := null;
            v_new_warranty_ends_at := null;
            v_new_editable_until := v_existing.created_at + interval '24 hours';
        end if;
    else
        v_new_editable_until := v_existing.editable_until;
    end if;

    v_new_total := v_new_price - v_new_discount_amount;
    if v_new_total < 0 then
        v_new_total := 0;
    end if;

    update public.invoices
    set device_type = trim(payload->>'device_type'),
        battery_pct = (payload->>'battery_pct')::int,
        storage_gb = (payload->>'storage_gb')::int,
        device_number = trim(payload->>'device_number'),
        condition_notes = payload->>'condition_notes',
        is_new_device = coalesce((payload->>'is_new_device')::boolean, false),
        tax_period = trim(payload->>'tax_period'),
        buyer_name = trim(payload->>'buyer_name'),
        seller_name = trim(payload->>'seller_name'),
        party_phone = payload->>'party_phone',
        price = v_new_price,
        discount_code_id = v_new_discount_code_id,
        discount_code = v_new_discount_code,
        discount_amount = v_new_discount_amount,
        total = v_new_total,
        warranty_unit = v_new_warranty_unit,
        warranty_value = v_new_warranty_value,
        warranty_ends_at = v_new_warranty_ends_at,
        editable_until = v_new_editable_until,
        updated_at = now()
    where id = p_id
    returning * into v_updated;

    insert into public.invoice_audit (
        invoice_id,
        action,
        diff,
        device_id,
        created_at
    ) values (
        p_id,
        'edited',
        jsonb_build_object('before', to_jsonb(v_existing), 'after', to_jsonb(v_updated)),
        v_device_id,
        now()
    );

    return to_jsonb(v_updated);
end;
$$;

-- 6. CANCEL INVOICE RPC (§4.2)
create or replace function public.cancel_invoice(p_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_row public.invoices%rowtype;
begin
    v_device_id := public.get_verified_device_id();

    select * into v_row
    from public.invoices
    where id = p_id;

    if not found then
        raise exception 'INVOICE_NOT_FOUND';
    end if;

    if v_row.kind != 'sale' or v_row.status != 'active' or now() > v_row.editable_until then
        raise exception 'INVOICE_LOCKED';
    end if;

    update public.invoices
    set status = 'cancelled',
        cancelled_at = now(),
        updated_at = now()
    where id = p_id
    returning * into v_row;

    -- Decrement discount code count
    if v_row.discount_code_id is not null then
        update public.discount_codes
        set used_count = greatest(0, used_count - 1)
        where id = v_row.discount_code_id;
    end if;

    insert into public.invoice_audit (
        invoice_id,
        action,
        diff,
        device_id,
        created_at
    ) values (
        p_id,
        'cancelled',
        jsonb_build_object('reason', p_reason),
        v_device_id,
        now()
    );

    return to_jsonb(v_row);
end;
$$;

-- 7. DELETE INVOICE RPC (§4.2)
create or replace function public.delete_invoice(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_row public.invoices%rowtype;
begin
    v_device_id := public.get_verified_device_id();

    select * into v_row
    from public.invoices
    where id = p_id;

    if not found then
        raise exception 'INVOICE_NOT_FOUND';
    end if;

    if v_row.kind != 'purchase' or v_row.status != 'active' or now() > v_row.editable_until then
        raise exception 'INVOICE_LOCKED';
    end if;

    update public.invoices
    set status = 'deleted',
        deleted_at = now(),
        updated_at = now()
    where id = p_id
    returning * into v_row;

    insert into public.invoice_audit (
        invoice_id,
        action,
        diff,
        device_id,
        created_at
    ) values (
        p_id,
        'deleted',
        jsonb_build_object('deleted_at', now()),
        v_device_id,
        now()
    );

    return to_jsonb(v_row);
end;
$$;

-- 8. GET INVOICE RPC
create or replace function public.get_invoice(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_row public.invoices%rowtype;
    v_audit jsonb;
    v_is_editable boolean;
    v_remaining_seconds int;
begin
    v_device_id := public.get_verified_device_id();

    select * into v_row
    from public.invoices
    where id = p_id and status != 'deleted';

    if not found then
        raise exception 'INVOICE_NOT_FOUND';
    end if;

    v_is_editable := (v_row.status = 'active' and now() <= v_row.editable_until);
    v_remaining_seconds := greatest(0, floor(extract(epoch from (v_row.editable_until - now())))::int);

    select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at asc), '[]'::jsonb)
    into v_audit
    from public.invoice_audit a
    where a.invoice_id = p_id;

    return jsonb_build_object(
        'invoice', to_jsonb(v_row),
        'is_editable', v_is_editable,
        'remaining_seconds', v_remaining_seconds,
        'audit', v_audit
    );
end;
$$;

-- 9. LIST INVOICES RPC (§4.2, §8.3)
create or replace function public.list_invoices(
    p_kind text,
    p_from_date text default null,
    p_to_date text default null,
    p_search text default null,
    p_cursor text default null,
    p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_from_ts timestamptz := null;
    v_to_ts timestamptz := null;
    v_clean_search text := null;
    v_items jsonb;
    v_total_count int := 0;
    v_total_sum numeric(12,2) := 0;
begin
    v_device_id := public.get_verified_device_id();

    if p_from_date is not null and length(trim(p_from_date)) > 0 then
        v_from_ts := (p_from_date || ' 00:00:00 Africa/Cairo')::timestamptz;
    end if;

    if p_to_date is not null and length(trim(p_to_date)) > 0 then
        v_to_ts := (p_to_date || ' 23:59:59.999 Africa/Cairo')::timestamptz;
    end if;

    if p_search is not null and length(trim(p_search)) > 0 then
        v_clean_search := '%' || lower(trim(p_search)) || '%';
    end if;

    -- Compute summary of active invoices in the filtered query
    select
        coalesce(count(*), 0),
        coalesce(sum(total), 0)
    into v_total_count, v_total_sum
    from public.invoices i
    where i.kind = p_kind
      and i.status = 'active'
      and (v_from_ts is null or i.created_at >= v_from_ts)
      and (v_to_ts is null or i.created_at <= v_to_ts)
      and (
        v_clean_search is null or
        lower(i.number) like v_clean_search or
        lower(i.device_type) like v_clean_search or
        lower(i.device_number) like v_clean_search or
        lower(i.buyer_name) like v_clean_search or
        lower(i.seller_name) like v_clean_search
      );

    -- Fetch items (active and cancelled; deleted are excluded)
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
    into v_items
    from (
        select i.*,
               (i.status = 'active' and now() <= i.editable_until) as is_editable
        from public.invoices i
        where i.kind = p_kind
          and i.status != 'deleted'
          and (v_from_ts is null or i.created_at >= v_from_ts)
          and (v_to_ts is null or i.created_at <= v_to_ts)
          and (
            v_clean_search is null or
            lower(i.number) like v_clean_search or
            lower(i.device_type) like v_clean_search or
            lower(i.device_number) like v_clean_search or
            lower(i.buyer_name) like v_clean_search or
            lower(i.seller_name) like v_clean_search
          )
        order by i.created_at desc
        limit least(coalesce(p_limit, 50), 100)
    ) t;

    return jsonb_build_object(
        'items', v_items,
        'summary', jsonb_build_object(
            'count', v_total_count,
            'total', v_total_sum
        )
    );
end;
$$;

-- 10. DASHBOARD STATS RPC (§4.2, §8.1)
create or replace function public.dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_cairo_today date;
    v_today_start timestamptz;
    v_today_end timestamptz;
    v_yesterday_start timestamptz;
    v_yesterday_end timestamptz;

    v_today_sales numeric(12,2) := 0;
    v_yesterday_sales numeric(12,2) := 0;
    v_today_invoices_count int := 0;
    v_today_purchases numeric(12,2) := 0;
    v_recent_invoices jsonb;
begin
    v_device_id := public.get_verified_device_id();

    v_cairo_today := (now() at time zone 'Africa/Cairo')::date;
    v_today_start := (v_cairo_today || ' 00:00:00 Africa/Cairo')::timestamptz;
    v_today_end := (v_cairo_today || ' 23:59:59.999 Africa/Cairo')::timestamptz;

    v_yesterday_start := ((v_cairo_today - 1) || ' 00:00:00 Africa/Cairo')::timestamptz;
    v_yesterday_end := ((v_cairo_today - 1) || ' 23:59:59.999 Africa/Cairo')::timestamptz;

    -- Today sales (active only)
    select coalesce(sum(total), 0) into v_today_sales
    from public.invoices
    where kind = 'sale' and status = 'active'
      and created_at >= v_today_start and created_at <= v_today_end;

    -- Yesterday sales (active only)
    select coalesce(sum(total), 0) into v_yesterday_sales
    from public.invoices
    where kind = 'sale' and status = 'active'
      and created_at >= v_yesterday_start and created_at <= v_yesterday_end;

    -- Today invoices count (sales + purchases, active only)
    select coalesce(count(*), 0) into v_today_invoices_count
    from public.invoices
    where status = 'active'
      and created_at >= v_today_start and created_at <= v_today_end;

    -- Today purchases (active only)
    select coalesce(sum(total), 0) into v_today_purchases
    from public.invoices
    where kind = 'purchase' and status = 'active'
      and created_at >= v_today_start and created_at <= v_today_end;

    -- Latest 4 invoices (sales and purchases mixed, active only, newest first)
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    into v_recent_invoices
    from (
        select id, number, kind, device_type, total, is_new_device, created_at
        from public.invoices
        where status = 'active'
        order by created_at desc
        limit 4
    ) r;

    return jsonb_build_object(
        'today_sales', v_today_sales,
        'yesterday_sales', v_yesterday_sales,
        'today_invoices_count', v_today_invoices_count,
        'today_purchases', v_today_purchases,
        'recent_invoices', v_recent_invoices
    );
end;
$$;

-- 11. INVOICE SERIES RPC (§4.2, §8.1, §8.4)
create or replace function public.invoice_series(p_kind text, p_range text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_cairo_today date;
    v_start_ts timestamptz;
    v_end_ts timestamptz;
    v_result jsonb := '[]'::jsonb;
begin
    v_device_id := public.get_verified_device_id();
    v_cairo_today := (now() at time zone 'Africa/Cairo')::date;

    if p_range = 'week' then
        -- Rolling last 7 days ending today (Cairo timezone)
        with days as (
            select (v_cairo_today - i) as day_date,
                   (v_cairo_today - i)::text as label,
                   ((v_cairo_today - i) || ' 00:00:00 Africa/Cairo')::timestamptz as start_ts,
                   ((v_cairo_today - i) || ' 23:59:59.999 Africa/Cairo')::timestamptz as end_ts
            from generate_series(6, 0, -1) as i
        )
        select coalesce(jsonb_agg(
            jsonb_build_object(
                'label', to_char(d.day_date, 'FMDD Month'),
                'date', d.day_date::text,
                'value', coalesce(sum(i.total), 0),
                'is_future', false
            ) order by d.day_date asc
        ), '[]'::jsonb)
        into v_result
        from days d
        left join public.invoices i
          on i.kind = p_kind
          and i.status = 'active'
          and i.created_at >= d.start_ts
          and i.created_at <= d.end_ts
        group by d.day_date;

    elsif p_range = 'month' then
        -- Every day of current calendar month (28-31 buckets)
        declare
            v_month_start date := date_trunc('month', v_cairo_today)::date;
            v_month_end date := (date_trunc('month', v_cairo_today) + interval '1 month - 1 day')::date;
        begin
            with m_days as (
                select d::date as day_date,
                       (d::date > v_cairo_today) as is_future,
                       (d::date || ' 00:00:00 Africa/Cairo')::timestamptz as start_ts,
                       (d::date || ' 23:59:59.999 Africa/Cairo')::timestamptz as end_ts
                from generate_series(v_month_start, v_month_end, '1 day'::interval) as d
            )
            select coalesce(jsonb_agg(
                jsonb_build_object(
                    'label', extract(day from d.day_date)::text,
                    'full_label', to_char(d.day_date, 'FMDD Month YYYY'),
                    'date', d.day_date::text,
                    'value', case when d.is_future then 0 else coalesce(sum(i.total), 0) end,
                    'is_future', d.is_future
                ) order by d.day_date asc
            ), '[]'::jsonb)
            into v_result
            from m_days d
            left join public.invoices i
              on i.kind = p_kind
              and i.status = 'active'
              and not d.is_future
              and i.created_at >= d.start_ts
              and i.created_at <= d.end_ts
            group by d.day_date, d.is_future;
        end;

    elsif p_range = 'year' then
        -- 12 calendar months of current year
        declare
            v_year_start date := date_trunc('year', v_cairo_today)::date;
        begin
            with y_months as (
                select (v_year_start + (m || ' month')::interval)::date as m_start,
                       (v_year_start + ((m + 1) || ' month')::interval - interval '1 second') as m_end,
                       m as m_idx
                from generate_series(0, 11) as m
            )
            select coalesce(jsonb_agg(
                jsonb_build_object(
                    'month_idx', y.m_idx,
                    'value', coalesce(sum(i.total), 0)
                ) order by y.m_idx asc
            ), '[]'::jsonb)
            into v_result
            from y_months y
            left join public.invoices i
              on i.kind = p_kind
              and i.status = 'active'
              and i.created_at >= (y.m_start || ' 00:00:00 Africa/Cairo')::timestamptz
              and i.created_at <= y.m_end
            group by y.m_idx;
        end;
    end if;

    return v_result;
end;
$$;

-- 12. TOP SALES INVOICES RPC (§4.2, §8.4)
create or replace function public.top_sales_invoices(p_range text, p_limit int default 3)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_device_id uuid;
    v_cairo_today date;
    v_start_ts timestamptz;
    v_end_ts timestamptz;
    v_res jsonb;
begin
    v_device_id := public.get_verified_device_id();
    v_cairo_today := (now() at time zone 'Africa/Cairo')::date;

    if p_range = 'week' then
        v_start_ts := ((v_cairo_today - 6) || ' 00:00:00 Africa/Cairo')::timestamptz;
        v_end_ts := (v_cairo_today || ' 23:59:59.999 Africa/Cairo')::timestamptz;
    elsif p_range = 'month' then
        v_start_ts := (date_trunc('month', v_cairo_today)::date || ' 00:00:00 Africa/Cairo')::timestamptz;
        v_end_ts := ((date_trunc('month', v_cairo_today) + interval '1 month - 1 day')::date || ' 23:59:59.999 Africa/Cairo')::timestamptz;
    elsif p_range = 'year' then
        v_start_ts := (date_trunc('year', v_cairo_today)::date || ' 00:00:00 Africa/Cairo')::timestamptz;
        v_end_ts := ((date_trunc('year', v_cairo_today) + interval '1 year - 1 day')::date || ' 23:59:59.999 Africa/Cairo')::timestamptz;
    end if;

    select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc), '[]'::jsonb)
    into v_res
    from (
        select id, number, device_type, total, is_new_device, created_at
        from public.invoices
        where kind = 'sale' and status = 'active'
          and created_at >= v_start_ts and created_at <= v_end_ts
        order by total desc
        limit least(coalesce(p_limit, 3), 10)
    ) t;

    return v_res;
end;
$$;

-- Grant execute privileges to authenticated for all RPCs
grant execute on function public.check_device() to authenticated;
grant execute on function public.validate_discount(text, numeric) to authenticated;
grant execute on function public.create_invoice(jsonb) to authenticated;
grant execute on function public.update_invoice(uuid, jsonb) to authenticated;
grant execute on function public.cancel_invoice(uuid, text) to authenticated;
grant execute on function public.delete_invoice(uuid) to authenticated;
grant execute on function public.get_invoice(uuid) to authenticated;
grant execute on function public.list_invoices(text, text, text, text, text, int) to authenticated;
grant execute on function public.dashboard_stats() to authenticated;
grant execute on function public.invoice_series(text, text) to authenticated;
grant execute on function public.top_sales_invoices(text, int) to authenticated;
