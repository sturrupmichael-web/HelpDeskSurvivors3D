\set ON_ERROR_STOP 0
\set QUIET 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'), ('00000000-0000-0000-0000-00000000000c');
-- a: Pam, b: Bob (banned later), c: no name
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into players (name) values ('Pam');
\echo 'expect ok: post'
insert into scores_3d (map, character, seconds, csat, won, version, mods, mult) values ('office', 'Tier 1 Tech', 600, 5000, false, 'dev', 'casualFriday', 1.5);
\echo 'expect ok: hardcore x4'
insert into scores_3d (map, character, seconds, csat, won, mods, mult) values ('garage', 'Tier 1 Tech', 1300, 9000, true, 'budgetCuts,hardcore', 4);
\echo 'expect FAIL: x4 without hardcore'
insert into scores_3d (map, character, seconds, csat, won, mods, mult) values ('garage', 'Tier 1 Tech', 1300, 9000, true, 'budgetCuts', 4);
\echo 'expect FAIL: unknown map'
insert into scores_3d (map, character, seconds, csat) values ('moon', 'x', 10, 10);
\echo 'expect FAIL: won before 20:00'
insert into scores_3d (map, character, seconds, csat, won) values ('office', 'x', 100, 10, true);
\echo 'expect FAIL: csat too high'
insert into scores_3d (map, character, seconds, csat) values ('office', 'x', 1, 20000);
\echo 'expect FAIL: set name/user_id/score'
insert into scores_3d (map, character, seconds, csat, name) values ('office', 'x', 10, 10, 'Hacker');
insert into scores_3d (map, character, seconds, csat, score) values ('office', 'x', 10, 10, 999);
\echo 'expect FAIL: update/delete'
update scores_3d set csat = 1;
delete from scores_3d;
\echo 'check: name stamped, score computed'
select name, user_id is not null as has_user, score from scores_3d order by id;
\echo 'expect FAIL: 2D table untouched by 3D post (count stays 0)'
select count(*) as scores_2d from scores;
-- per-player limit: 3 more = 5, the 6th fails
insert into scores_3d (map, character, seconds, csat) values ('office', 'x', 10, 1);
insert into scores_3d (map, character, seconds, csat) values ('office', 'x', 10, 1);
insert into scores_3d (map, character, seconds, csat) values ('office', 'x', 10, 1);
\echo 'expect FAIL: 6th in a minute'
insert into scores_3d (map, character, seconds, csat) values ('office', 'x', 10, 1);
-- saves
\echo 'expect ok: save'
insert into saves_3d (data) values ('{"shifts": 4, "achievements": {"firstShift": 1}}');
-- rename
update players set name = 'Pam2' where user_id = auth.uid();
\echo 'check: scores renamed to Pam2'
select distinct name from scores_3d;
-- c: no name
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\echo 'expect FAIL: no name'
insert into scores_3d (map, character, seconds, csat) values ('office', 'x', 10, 1);
\echo 'check: c sees no saves'
select count(*) from saves_3d;
\echo 'expect FAIL: c writes into a save for a'
insert into saves_3d (user_id, data) values ('00000000-0000-0000-0000-00000000000a', '{}');
reset role;
-- anon
set role anon;
\echo 'check: anon reads scores'
select count(*) from scores_3d;
\echo 'expect FAIL: anon posts'
insert into scores_3d (map, character, seconds, csat) values ('office', 'x', 10, 1);
\echo 'check: profile'
select player_profile_3d('pam2');
\echo 'expect FAIL: anon reads saves'
select * from saves_3d;
reset role;
-- banned
insert into players (user_id, name, banned) values ('00000000-0000-0000-0000-00000000000b', 'Bob', true);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\echo 'expect FAIL: banned'
insert into scores_3d (map, character, seconds, csat) values ('office', 'x', 10, 1);
reset role;
\echo 'check: no profile for banned'
select player_profile_3d('Bob') is null as none;
