-- HYDRASCAPES v5
-- 0003_safe_mutations.sql

begin;

-- ============================================================
-- SAFE PROFILE UPDATE
-- ============================================================

create or replace function public.update_my_profile(
  p_full_name text,
  p_avatar_path text,
  p_location_json jsonb,
  p_bio text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001';
  end if;

  if p_full_name is null
     or char_length(trim(p_full_name)) < 1
     or char_length(p_full_name) > 120 then
    raise exception 'INVALID_FULL_NAME'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set
    full_name = trim(p_full_name),
    avatar_path = p_avatar_path,
    location_json = coalesce(p_location_json, '{}'::jsonb),
    bio = p_bio,
    updated_at = now()
  where id = auth.uid()
  returning * into result;

  if result.id is null then
    raise exception 'PROFILE_NOT_FOUND'
      using errcode = 'P0001';
  end if;

  return result;
end;
$$;

revoke all
on function public.update_my_profile(text, text, jsonb, text)
from public;

grant execute
on function public.update_my_profile(text, text, jsonb, text)
to authenticated;

-- ============================================================
-- PREVENT CLIENT TABLE WRITES TO PROFILES
-- ============================================================

revoke insert, update, delete
on public.profiles
from anon, authenticated;

-- Existing SELECT remains governed by RLS.

-- ============================================================
-- HIGH-RISK TABLE PRIVILEGES
-- ============================================================

revoke insert, update, delete
on public.bookings
from anon, authenticated;

revoke insert, update, delete
on public.payouts
from anon, authenticated;

revoke insert, update, delete
on public.kyc_verifications
from anon, authenticated;

revoke insert, update, delete
on public.processed_webhook_events
from anon, authenticated;

revoke insert, update, delete
on public.audit_logs
from anon, authenticated;

revoke insert, update, delete
on public.platform_settings
from anon, authenticated;

revoke insert, update, delete
on public.pricing_signals
from anon, authenticated;

-- Keep only the intentionally exposed operations on lower-risk tables.
-- Explicit privileges are safer than relying on Supabase defaults.

commit;