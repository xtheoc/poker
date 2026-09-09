-- The account, and the few facts the rest of the app needs about it.
--
-- Timezone is stored rather than inferred per request because a study streak
-- has to agree with the user's own sense of "today". A drill finished at 1am
-- should count for the night it felt like, not for the calendar day the server
-- happens to be in, and getting that wrong is the kind of small betrayal that
-- kills a daily habit.
--
-- Big blind size is here so the platform can talk about money the user actually
-- plays for and convert chips to big blinds when reporting what a leak cost.
-- It is not a bankroll tracker and is not trying to become one.

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  timezone          text not null default 'UTC',
  -- e.g. 0.02 for NL2, in the currency below.
  big_blind         numeric(10, 4) not null default 0.02,
  currency          text not null default 'USD',
  -- The PokerStars screen name, which is how the hero is identified in a hand
  -- history. Without it a parsed hand has no idea which seat is "you".
  pokerstars_alias  text,
  -- How long the daily session should take. Drives the queue cap, because a
  -- session that is always completable beats an honest backlog that is skipped.
  daily_minutes     smallint not null default 8 check (daily_minutes between 1 and 120),
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- A profile row exists from the moment of signup, so no page ever has to cope
-- with a signed-in user who has no profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
