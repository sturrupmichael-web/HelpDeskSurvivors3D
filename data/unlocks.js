// Copied unchanged from the original (HelpDeskSurvivor data/).
// Map-win unlocks: winning a shift on a map (closing The Executive's ticket) adds these
// to the game. Tools and passives join the level-up cards, evolutions start happening in
// Change Approved chests, and characters can be hired in the Characters screen (they still
// cost Overtime Pay). Anything not listed here is there from the start.
// Players keep whatever their Knowledge Base shows they have already used or hired.

export const UNLOCKS = {
  server: {
    tools: ['replyAll', 'zipTies', 'passwordExpired', 'screenShare', 'rubberDuck'],
    characters: ['neteng', 'intern'],
  },
  callcenter: {
    passives: ['spareCharger', 'warranty', 'snackDrawer', 'luckyLanyard'],
    characters: ['manager'],
  },
  garage: {
    evolutions: ['confluence', 'passwordless', 'domainLockdown', 'remoteWipe', 'sabbatical', 'siem'],
    characters: ['cloud'],
  },
  // Job-title pack: the new tools join everyone's level-up cards after a Merger Day win
  // (the techs who start with them can always use them).
  merger: {
    tools: ['patchRollout', 'dedupe', 'fairwayDriver', 'terraform', 'assetTag'],
    characters: ['director'],
  },
};
