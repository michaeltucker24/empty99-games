-- Empty 99 Studios games: player accounts and saved progress.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
-- Every table has row-level security: a player can only ever read or write their own rows.

-- One row per player. No email or birth date is stored here (email lives in Supabase Auth).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z0-9_]{3,16}$'),
  age_confirmed boolean not null default false, -- player said they are 13 or older
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Saved progress, one row per player per game. `data` is the game's progress blob.
create table if not exists public.game_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game),
  constraint progress_size check (pg_column_size(data) < 64000)
);

alter table public.profiles enable row level security;
alter table public.game_progress enable row level security;

drop policy if exists "own profile: read" on public.profiles;
drop policy if exists "own profile: insert" on public.profiles;
drop policy if exists "own profile: update" on public.profiles;
create policy "own profile: read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "own progress: read" on public.game_progress;
drop policy if exists "own progress: insert" on public.game_progress;
drop policy if exists "own progress: update" on public.game_progress;
create policy "own progress: read" on public.game_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "own progress: insert" on public.game_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own progress: update" on public.game_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Keep updated_at honest.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists progress_touch on public.game_progress;
create trigger progress_touch before update on public.game_progress for each row execute function public.touch_updated_at();

-- "Delete my account": removes the auth user; profile and progress go with it (on delete cascade).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- The project does not auto-expose new tables, so grant the signed-in role exactly what it needs.
-- (Row-level security above still limits every query to the player's own rows.)
revoke all on public.profiles, public.game_progress from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.game_progress to authenticated;
