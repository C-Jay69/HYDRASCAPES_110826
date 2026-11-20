-- HYDRASCAPES v5
-- 0013_booking_holds.sql
--
-- Phase 3: make unpaid holds real.
--
-- The original exclusion constraint only covered reserved/confirmed/etc., so
-- any number of `pending_payment` bookings could overlap the same dates and
-- the double-booking guarantee only applied once someone paid. Phase 3's
-- acceptance criterion is that ten simultaneous attempts at identical dates
-- produce exactly one reservation, which requires unpaid holds to participate
-- in the constraint.
--
-- Holds must therefore expire, or an abandoned checkout would block dates
-- forever. `expire_stale_pending_bookings()` releases them; it is called
-- opportunistically by the booking API and can be scheduled later.
--
-- NOTE: existing overlapping pending_payment rows (there should be none in a
-- fresh database) would make the new constraint fail to validate.

begin;

alter table public.bookings
  drop constraint if exists no_double_booking;

alter table public.bookings
  add constraint no_double_booking
  exclude using gist (
    property_id with =,
    daterange(checkin, checkout, '[)') with &&
  )
  where (
    status in (
      'pending_payment',
      'reserved',
      'confirmed',
      'checked_in',
      'checked_out',
      'completed'
    )
  );

comment on constraint no_double_booking on public.bookings is
  'Live bookings, including unpaid holds, may never overlap for a property. '
  'The database is the final authority against double booking.';

create or replace function public.expire_stale_pending_bookings(
  p_minutes integer default 15
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired integer;
begin
  with expired as (
    update public.bookings
    set
      status = 'cancelled',
      cancelled_at = now(),
      refund_amount_minor = 0
    where
      status = 'pending_payment'
      and created_at < now() - make_interval(mins => greatest(p_minutes, 1))
    returning 1
  )
  select count(*) into v_expired from expired;

  return v_expired;
end;
$$;

revoke all on function public.expire_stale_pending_bookings(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_pending_bookings(integer) to service_role;

comment on function public.expire_stale_pending_bookings(integer) is
  'Cancels unpaid bookings older than the hold window so abandoned checkouts '
  'stop blocking dates. Service-role only.';

commit;
