-- ====================================================================
-- Mezo Store - Migration 03: Seed Access Code Hash (Principle 3)
-- ====================================================================

set search_path = public, extensions;

-- Insert single management access code using bcrypt hash only
insert into public.access_codes (label, code_hash, is_active)
values ('Management Access', '$2a$10$qBDyF5IDsO1A.3El6VSHKebdTbCuFybTfr3pCgTNSnDk8vb/rJ5Bq', true)
on conflict do nothing;
