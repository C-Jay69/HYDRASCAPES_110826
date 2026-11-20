-- HYDRASCAPES v5
-- 0011_rate_limits.sql
--
-- Durable fixed-window rate limiting (spec §21).
--
-- A counter in process memory is useless on serverless infrastructure: each
-- instance would keep its own count, so limits would be trivially bypassed by
-- concurrency. The counter therefore lives in Postgres, where the
-- (key, window) primary key makes increments atomic across instances.
--
-- The table is not readable or writable by API roles at all; only the
-- SECURITY DEFINER function below touches it.

begin;

create table if not exists public.rate_limit_counters (
  rl_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (rl_key, window_start)
);

alter table public.rate_limit_counters enable row level security;
alter table public.rate_limit_counters force row level security;

revoke all on public.rate_limit_counters from anon, authenticated;

comment on table public.rate_limit_counters is
  'Fixed-window counters for rate limiting. Written only via '
  'public.consume_rate_limit(); never granted to API roles.';

create or replace function public.consume_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_key is null or length(p_key) = 0 or p_window_seconds <= 0 or p_max <= 0 then
    return query select false, 0, now();
    return;
  end if;

  -- Floor the clock to the window boundary so every caller agrees on which
  -- bucket "now" belongs to.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters as counter (rl_key, window_start, hits)
  values (p_key, v_window_start, 1)
  on conflict (rl_key, window_start)
  do update set hits = counter.hits + 1
  returning counter.hits into v_hits;

  -- Opportunistic cleanup: keep the table from growing without bound without
  -- needing a cron job for it.
  if random() < 0.01 then
    delete from public.rate_limit_counters
    where window_start < now() - interval '1 day';
  end if;

  return query
    select v_hits <= p_max,
           greatest(p_max - v_hits, 0),
           v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to authenticated, service_role;

commit;
