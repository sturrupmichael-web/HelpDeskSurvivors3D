// Online leaderboard, accounts and cloud saves (Supabase). The same project and the same
// player accounts as the 2D game (HelpDeskSurvivor data/leaderboard.js), with the 3D
// game's own tables (supabase/001_3d.sql). The publishable key is meant to be public:
// row level security decides what anyone can read or write.
export const LEADERBOARD = {
  url: 'https://abeqdmurddrkrqbnfylb.supabase.co',
  key: 'sb_publishable_8WUpbX-clRvdKgset72mkQ_C_NFL5E8',
  table: 'scores_3d',
  saves: 'saves_3d',
  profile: 'player_profile_3d',
  top: 10, // rows shown per map
  timeout: 8000, // ms before a request counts as failed
  nameMax: 16,
};
