# Supabase: the 3D game's online parts

The 3D game uses the same Supabase project as the 2D game (HelpDeskSurvivor, whose
`supabase/` folder set it up), with the same player accounts and names, but keeps its own
leaderboard, cloud saves and profiles. Settings are in `data/leaderboard.js`.

| File | What it does |
| --- | --- |
| `001_3d.sql` | `scores_3d` (the 3D leaderboard, with every check the 2D `scores` has), `saves_3d` (one private cloud save per account), `player_profile_3d()` (public profiles), and a trigger so a rename renames 3D scores too. Leaves every 2D table and function as it is. |

To run one: Supabase, SQL Editor, New query, paste the whole file, Run. It's safe to run
again.

## Setting it up (once, about 5 minutes)

1. **SQL Editor:** run `001_3d.sql`.
2. **Authentication, URL Configuration, Redirect URLs:** add
   `https://3d.michaelsturrup.com/**` (and, for the old address while it still redirects,
   `https://sturrupmichael-web.github.io/HelpDeskSurvivors3D/**`). Without it, Supabase
   sends players who sign in with Google back to the Site URL, which is the 2D game.
3. Nothing else: guest sign-ins, manual linking and the Google provider are already on for
   the 2D game, and the 3D game uses them as they are. Google's own console needs no
   change, because Google always hands back to Supabase first.

## How accounts work between the two games

- Each game keeps its own sign-in in the browser, because they live at different
  addresses. A guest in one game is a different guest in the other.
- Signing in with Google in the 3D game reaches the same account as in the 2D game, with
  the same leaderboard name. A 3D guest who signs in to a Google account that already has
  a name switches to that account (like a second device in the 2D game).
- Names are shared: a name claimed in either game is taken in both. Banning a player in
  `players` stops them posting in both.
- Progress is not shared: the 3D save is in `saves_3d`, the 2D save stays in `saves`.

## Testing the SQL without the live project

`local-test/` runs the file on a plain Postgres with Supabase's roles and `auth.uid()`
faked (`fake-supabase.sql`), after the 2D game's files, then tries what a player could do
(`check.sql`: post, post with impossible values, post as someone else, read other saves,
rename, get banned). Each step says whether it should work or fail.

```sh
createdb t
psql -d t -f local-test/fake-supabase.sql
for f in ../reference/supabase/0*.sql; do psql -d t -f $f; done  # the 2D game's files
psql -d t -f 001_3d.sql
psql -d t -f local-test/check.sql
```
