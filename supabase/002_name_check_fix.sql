-- Helpdesk Survivors 3D: fixes the leaderboard name check (2026-10-27).
-- Run once in Supabase: SQL Editor -> New query -> paste all of this -> Run. Safe to run
-- again. It touches only the `players_name_clean` check on `players`, which both games share.
--
-- Why: claiming a name failed for every new player, in both games, with "invalid regular
-- expression: invalid character range". The check from the 2D game's 010_security.sql
-- lists invisible characters to refuse. An early copy of that file had the characters
-- themselves rather than \u escapes, and pasting it into the SQL Editor dropped some, which
-- left a range like "x-" with its ends in the wrong order. Postgres only compiles the
-- pattern when a name is checked, so it was saved without complaint and has failed on
-- every name since. This puts back the same check written in plain ASCII (spaces
-- in patterns as \x20 too), so nothing can be lost or changed in the paste.

alter table public.players drop constraint if exists players_name_clean;
alter table public.players add constraint players_name_clean check (
  name = btrim(name)
  and name !~ '\x20\x20' -- two spaces in a row
  and name !~ '[\u0001-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u2028-\u202f\u205f-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0]'
) not valid;

-- Check: this should say "ok" (a plain name passes, one with a zero-width space doesn't).
select case
  when 'MikeTest' !~ '[\u200b-\u200f]' and not (E'Mike\u200bTest' !~ '[\u200b-\u200f]') then 'ok'
  else 'not ok' end as name_check;
