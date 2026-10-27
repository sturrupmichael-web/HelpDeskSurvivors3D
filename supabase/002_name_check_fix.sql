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
-- every name since. This puts back the same check with every character written as
-- chr(<code point>): plain ASCII with no escapes, so nothing can be lost or changed in a paste
-- (or decoded by a chat app on the way).

alter table public.players drop constraint if exists players_name_clean;
alter table public.players add constraint players_name_clean check (name = btrim(name) and strpos(name, chr(32)||chr(32)) = 0 and name !~ ('['||chr(1)||'-'||chr(31)||chr(127)||'-'||chr(159)||chr(173)||chr(847)||chr(1564)||chr(4447)||chr(4448)||chr(6068)||chr(6069)||chr(6158)||chr(8203)||'-'||chr(8207)||chr(8232)||'-'||chr(8239)||chr(8287)||'-'||chr(8303)||chr(12644)||chr(65024)||'-'||chr(65039)||chr(65279)||chr(65440)||']')) not valid;

-- Check: this should say "ok" (a plain name passes, one with a zero-width space doesn't).
select case
  when 'MikeTest' !~ '[\u200b-\u200f]' and not (E'Mike\u200bTest' !~ '[\u200b-\u200f]') then 'ok'
  else 'not ok' end as name_check;
