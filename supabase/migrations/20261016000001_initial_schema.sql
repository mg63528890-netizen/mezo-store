-- ====================================================================
-- Mezo Store - Migration 01: Initial Schema, Tables, Indexes, Triggers
-- ====================================================================

-- Enable pgcrypto for hashing and UUID generation
create extension if not exists "pgcrypto" with schema extensions;

-- Set search_path
set search_path = public, extensions;

-- 1. ACCESS CODES
create table if not exists public.access_codes (
    id uuid primary key default gen_random_uuid(),
    label text,
    code_hash text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

-- 2. REGISTERED DEVICES (App installs)
create table if not exists public.registered_devices (
    id uuid primary key default gen_random_uuid(),
    access_code_id uuid references public.access_codes(id) on delete cascade,
    token_hash text not null unique,
    device_name text,
    model text,
    os_version text,
    is_logged_in boolean not null default true,
    first_login_at timestamptz not null default now(),
    last_login_at timestamptz not null default now(),
    last_logout_at timestamptz,
    last_seen_at timestamptz not null default now()
);

create index if not exists idx_registered_devices_token on public.registered_devices(token_hash);

-- 3. DEVICE STATS (Single row for Realtime subscription)
create table if not exists public.device_stats (
    id int primary key default 1 check (id = 1),
    logged_in_count int not null default 0
);

-- Seed initial row if missing
insert into public.device_stats (id, logged_in_count)
values (1, 0)
on conflict (id) do nothing;

-- 4. AUTH ATTEMPTS (For lockout protection)
create table if not exists public.auth_attempts (
    id uuid primary key default gen_random_uuid(),
    device_hint text,
    ip text,
    success boolean not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_auth_attempts_created on public.auth_attempts(created_at desc);

-- 5. DISCOUNT CODES (Managed externally)
create table if not exists public.discount_codes (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    type text not null check (type in ('percent', 'fixed')),
    value numeric(12,2) not null check (value > 0),
    is_active boolean not null default true,
    starts_at timestamptz,
    expires_at timestamptz,
    max_uses int,
    used_count int not null default 0
);

create index if not exists idx_discount_codes_code on public.discount_codes(lower(trim(code)));

-- 6. INVOICE COUNTERS (Daily sequence generation)
create table if not exists public.invoice_counters (
    day date not null,
    kind text not null check (kind in ('sale', 'purchase')),
    last_n int not null default 0,
    primary key (day, kind)
);

-- 7. INVOICES
create table if not exists public.invoices (
    id uuid primary key default gen_random_uuid(),
    number text not null unique,
    idempotency_key uuid not null unique,
    kind text not null check (kind in ('sale', 'purchase')),
    -- Device details
    device_type text not null,
    battery_pct int not null check (battery_pct >= 0 and battery_pct <= 100),
    storage_gb int not null check (storage_gb > 0),
    device_number text not null,
    condition_notes text,
    is_new_device boolean not null default false,
    tax_period text not null,
    -- Parties
    buyer_name text not null,
    seller_name text not null,
    party_phone text,
    -- Financials
    price numeric(12,2) not null check (price > 0),
    discount_code_id uuid references public.discount_codes(id),
    discount_code text,
    discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
    total numeric(12,2) not null check (total = price - discount_amount and total >= 0),
    -- Warranty (sales only)
    warranty_unit text check (warranty_unit in ('none', 'days', 'months')),
    warranty_value int check (warranty_value >= 0),
    warranty_ends_at timestamptz,
    -- Lifecycle
    editable_until timestamptz not null,
    status text not null default 'active' check (status in ('active', 'cancelled', 'deleted')),
    cancelled_at timestamptz,
    deleted_at timestamptz,
    created_by_device uuid references public.registered_devices(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Check constraints
    constraint chk_purchases_no_discount_or_warranty check (
        kind != 'purchase' or (
            discount_code_id is null and
            discount_code is null and
            discount_amount = 0 and
            warranty_unit is null and
            warranty_value is null and
            warranty_ends_at is null
        )
    )
);

create index if not exists idx_invoices_kind_status_created on public.invoices(kind, status, created_at desc);
create index if not exists idx_invoices_number on public.invoices(number);
create index if not exists idx_invoices_device_number on public.invoices(device_number);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);

-- 8. INVOICE AUDIT
create table if not exists public.invoice_audit (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references public.invoices(id) on delete cascade,
    action text not null check (action in ('created', 'edited', 'cancelled', 'deleted')),
    diff jsonb,
    device_id uuid references public.registered_devices(id),
    created_at timestamptz not null default now()
);

create index if not exists idx_invoice_audit_invoice_id on public.invoice_audit(invoice_id);

-- 9. DATA VERSION (Single row for Realtime cache invalidation)
create table if not exists public.data_version (
    id int primary key default 1 check (id = 1),
    version bigint not null default 1
);

insert into public.data_version (id, version)
values (1, 1)
on conflict (id) do nothing;

-- ====================================================================
-- TRIGGERS
-- ====================================================================

-- Trigger for device_stats.logged_in_count
create or replace function public.fn_refresh_device_stats()
returns trigger
language plpgsql
security definer
as $$
begin
    update public.device_stats
    set logged_in_count = (
        select count(*) from public.registered_devices where is_logged_in = true
    )
    where id = 1;
    return null;
end;
$$;

drop trigger if exists trg_device_stats_refresh on public.registered_devices;
create trigger trg_device_stats_refresh
after insert or update or delete on public.registered_devices
for each statement
execute function public.fn_refresh_device_stats();

-- Trigger for data_version.version on invoices changes
create or replace function public.fn_bump_data_version()
returns trigger
language plpgsql
security definer
as $$
begin
    update public.data_version
    set version = version + 1
    where id = 1;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_invoices_bump_version on public.invoices;
create trigger trg_invoices_bump_version
after insert or update or delete on public.invoices
for each statement
execute function public.fn_bump_data_version();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) & PRIVILEGES (§4.4)
-- ====================================================================

alter table public.access_codes enable row level security;
alter table public.registered_devices enable row level security;
alter table public.device_stats enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.discount_codes enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_audit enable row level security;
alter table public.data_version enable row level security;

-- Revoke direct permissions from public, anon, and authenticated
revoke all on public.access_codes from anon, authenticated;
revoke all on public.registered_devices from anon, authenticated;
revoke all on public.auth_attempts from anon, authenticated;
revoke all on public.discount_codes from anon, authenticated;
revoke all on public.invoice_counters from anon, authenticated;
revoke all on public.invoices from anon, authenticated;
revoke all on public.invoice_audit from anon, authenticated;

-- Allow authenticated SELECT on device_stats and data_version for Realtime subscriptions
grant select on public.device_stats to authenticated;
grant select on public.data_version to authenticated;

drop policy if exists "Authenticated can select device_stats" on public.device_stats;
create policy "Authenticated can select device_stats"
on public.device_stats for select
to authenticated
using (true);

drop policy if exists "Authenticated can select data_version" on public.data_version;
create policy "Authenticated can select data_version"
on public.data_version for select
to authenticated
using (true);

-- Enable Realtime publication for device_stats and data_version only (§2.3 step 6)
do $$
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
end
$$;

alter publication supabase_realtime add table public.device_stats;
alter publication supabase_realtime add table public.data_version;
