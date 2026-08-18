-- 0007_add_reviews_target_fk.sql
-- Add referential integrity for reviews.target_id based on target_type
-- Since target_type can be 'property', 'host', or 'guest', we enforce via a trigger
-- that checks the target_id exists in the appropriate table.

begin;

-- Create a function to validate target_id based on target_type
create or replace function public.validate_review_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Determine which table to check based on target_type
  if new.target_type = 'property' then
    if not exists (
      select 1 from public.properties p where p.id = new.target_id
    ) then
      raise exception 'Property with id % not found', new.target_id
        using errcode = '23503'; -- foreign_key_violation
    end if;
  elsif new.target_type in ('host', 'guest') then
    if not exists (
      select 1 from public.profiles p
      where p.id = new.target_id
        and p.role = new.target_type
    ) then
      raise exception '% with id % not found or not a %', new.target_type, new.target_id, new.target_type
        using errcode = '23503';
    end if;
  else
    raise exception 'Invalid target_type: %', new.target_type
      using errcode = '23503';
  end if;

  return new;
end;
$$;

-- Add the trigger to validate target_id on insert/update
drop trigger if exists review_target_validation on public.reviews;
create trigger review_target_validation
before insert or update on public.reviews
for each row execute function public.validate_review_target();

-- Add an index on target_id for faster lookups
create index if not exists reviews_target_id_idx on public.reviews(target_id);

commit;