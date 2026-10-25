-- Helpdesk Survivors 3D: its own leaderboard, cloud saves and profiles, in the same
-- Supabase project as the 2D game and with the same player accounts (2026-10-25).
-- Run once in Supabase: SQL Editor -> New query -> paste all of this -> Run. Safe to run
-- again. Needs the 2D game's files run first (they are, on the live project): this uses
-- its `players` table for names, and leaves every 2D table and function as it is.
--
-- What it does:
--   1. `scores_3d`: the 3D leaderboard. The same columns and checks as the 2D `scores`
--      after all its fixes (HelpDeskSurvivor supabase/001-010): only accounts can post,
--      the name comes from `players`, impossible scores and unknown maps are refused,
--      `score` = round(csat * mult) is worked out here, Hardcore may go up to x6, at most
--      30 scores a minute in all and 5 a minute per player.
--   2. Renaming a player renames their 3D scores too (the 2D trigger does the same for
--      `scores`; this adds a second one beside it).
--   3. `saves_3d`: one private cloud save per account for the 3D game. The 3D save has a
--      different shape, so it can't share the 2D `saves` row.
--   4. `player_profile_3d(name)`: the public profile for a name, from 3D scores and the
--      3D save. Never an email address; banned players have no profile.

-- 1: scores.
create table if not exists public.scores_3d (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null,
  name text not null check (char_length(name) between 1 and 16),
  map text not null check (map in ('office', 'server', 'callcenter', 'garage', 'merger')),
  character text not null check (char_length(character) between 1 and 40),
  seconds int not null check (seconds between 0 and 3600),
  csat int not null check (csat >= 0),
  won boolean not null default false,
  mods text not null default '' check (char_length(mods) <= 120 and mods ~ '^[A-Za-z,]*$'),
  mult numeric(4, 2) not null default 1,
  score bigint generated always as (round(csat * mult)::bigint) stored,
  version text check (char_length(version) <= 20),
  created_at timestamptz not null default now(),
  constraint scores_3d_csat_plausible check (csat <= seconds * 10000),
  constraint scores_3d_won_after_shift check (not won or seconds >= 1200),
  constraint scores_3d_mult_range check (mult between 0.5 and 3 or (mult <= 6 and mods ~ '(^|,)hardcore(,|$)'))
);
create index if not exists scores_3d_map_score on public.scores_3d (map, score desc);
create index if not exists scores_3d_created_at on public.scores_3d (created_at);
create index if not exists scores_3d_user_id on public.scores_3d (user_id);
alter table public.scores_3d enable row level security;
revoke all on table public.scores_3d from anon, authenticated;
grant select on table public.scores_3d to anon, authenticated;
grant insert (map, character, seconds, csat, won, version, mods, mult) on table public.scores_3d to authenticated;
drop policy if exists "anyone can read" on public.scores_3d;
create policy "anyone can read" on public.scores_3d for select using (true);
drop policy if exists "players can add" on public.scores_3d;
create policy "players can add" on public.scores_3d for insert to authenticated with check (true);

-- Stamps the poster's account and name, and holds back floods.
create or replace function public.scores_3d_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.players;
begin
  select * into p from public.players where user_id = auth.uid();
  if not found then raise exception 'Pick a leaderboard name first.'; end if;
  if p.banned then raise exception 'This account can''t post scores.'; end if;
  if (select count(*) from public.scores_3d where created_at > now() - interval '1 minute') >= 30
    or (select count(*) from public.scores_3d
        where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Too many scores right now. Try again in a minute.';
  end if;
  new.user_id := auth.uid();
  new.name := p.name;
  new.created_at := now();
  return new;
end $$;
revoke all on function public.scores_3d_stamp() from public, anon, authenticated;
drop trigger if exists scores_3d_stamp on public.scores_3d;
create trigger scores_3d_stamp before insert on public.scores_3d
  for each row execute function public.scores_3d_stamp();

-- 2: a rename renames the player's 3D scores too.
create or replace function public.players_rename_scores_3d() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    begin
      update public.scores_3d set name = new.name where user_id = new.user_id;
    exception when check_violation then
      null; -- an old score that today's checks refuse: leave the scores as they were
    end;
  end if;
  return new;
end $$;
revoke all on function public.players_rename_scores_3d() from public, anon, authenticated;
drop trigger if exists players_rename_scores_3d on public.players;
create trigger players_rename_scores_3d after update of name on public.players
  for each row execute function public.players_rename_scores_3d();

-- 3: cloud saves (64 KB max; a 3D save is about 2 KB).
create table if not exists public.saves_3d (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null check (pg_column_size(data) < 65536),
  updated_at timestamptz not null default now()
);
alter table public.saves_3d enable row level security;
revoke all on table public.saves_3d from anon, authenticated;
grant select on table public.saves_3d to authenticated;
grant insert (data), update (data) on table public.saves_3d to authenticated;
drop policy if exists "own save" on public.saves_3d;
create policy "own save" on public.saves_3d for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.saves_3d_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists saves_3d_touch on public.saves_3d;
create trigger saves_3d_touch before insert or update on public.saves_3d
  for each row execute function public.saves_3d_touch();

-- 4: public profiles.
create or replace function public.player_profile_3d(p_name text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', p.name,
    'since', p.created_at,
    'posted', (select count(*) from public.scores_3d s where s.user_id = p.user_id),
    'wins', (select count(*) from public.scores_3d s where s.user_id = p.user_id and s.won),
    'favourite', (
      select s.character from public.scores_3d s where s.user_id = p.user_id
      group by s.character order by count(*) desc, max(s.created_at) desc limit 1),
    'best', coalesce((
      select jsonb_agg(jsonb_build_object('map', s.map, 'csat', max_csat, 'score', max_score, 'clean', max_clean, 'seconds', max_seconds, 'won', any_won) order by s.map)
      from (select map, max(csat) max_csat, max(score) max_score, max(csat) filter (where mods = '') max_clean,
                   max(seconds) max_seconds, bool_or(won) any_won
            from public.scores_3d where user_id = p.user_id group by map) s), '[]'::jsonb),
    'shifts', (
      select case when jsonb_typeof(sv.data->'shifts') = 'number' then (sv.data->>'shifts')::numeric::int end
      from public.saves_3d sv where sv.user_id = p.user_id),
    'achievements', coalesce((
      select jsonb_agg(k) from public.saves_3d sv,
        jsonb_object_keys(case when jsonb_typeof(sv.data->'achievements') = 'object' then sv.data->'achievements' else '{}' end) k
      where sv.user_id = p.user_id), '[]'::jsonb)
  )
  from public.players p
  where lower(p.name) = lower(p_name) and not p.banned
$$;
revoke all on function public.player_profile_3d(text) from public;
grant execute on function public.player_profile_3d(text) to anon, authenticated;
