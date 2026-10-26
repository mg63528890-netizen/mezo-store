-- Seed discount code: MEZO!10 (10% discount)
insert into public.discount_codes (
    code,
    type,
    value,
    is_active,
    starts_at,
    expires_at,
    max_uses,
    used_count
) values (
    'MEZO!10',
    'percent',
    10.00,
    true,
    now(),
    null,
    null,
    0
)
on conflict (code) do update
set is_active = true,
    value = 10.00,
    type = 'percent',
    expires_at = null;
