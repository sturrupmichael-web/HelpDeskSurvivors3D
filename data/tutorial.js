// Copied unchanged from the original (HelpDeskSurvivor data/).
// Training shift (src/game/tutorial.js): the guided first shift offered to new players
// and always available from the title screen (T). Steps run in order; each one's `id`
// picks what it waits for. `text` can be a function of { device, tool }.

const MOVE = {
  keys: 'Move with <kbd>WASD</kbd> or the arrow keys.',
  touch: 'Put a finger anywhere on the screen and drag to move.',
  pad: 'Move with the left stick.',
};

export const TUTORIAL = {
  moveDistance: 220, // world px walked to finish the "move" step
  pizzaDistance: 70, // how far from you training pizza lands
  spawnPadding: 24, // training users appear this far past the screen's short edge
  fix: { enemy: 'pam', every: 1, maxAlive: 4, speedMult: 1 },
  rush: { mix: { pam: 12, quinn: 4 }, count: 16, speedMult: 0.9, timeout: 45 },
  levelUpTip:
    'Pick one card. A NEW tool fires on its own next to the ones you have. A tool you already have gets stronger. Passives boost all your tools.',
  steps: [
    {
      id: 'move',
      title: 'WELCOME TO THE HELP DESK',
      text: ({ device }) => `It's your first day. ${MOVE[device]}`,
    },
    {
      id: 'fix',
      title: 'USERS NEED HELP',
      text: ({ tool }) =>
        `Users with problems walk toward you. Your ${tool} fixes them on its own, so just stay near them. Each fixed user drops a Closed Ticket: walk over tickets to fill the blue bar at the top.`,
    },
    {
      id: 'rush',
      title: 'THE MORNING RUSH',
      text: 'Users who touch you drain your SANITY (the red bar, top left). Keep moving, let your tools work, and clear the floor.',
    },
    {
      id: 'pizza',
      title: 'FREE PIZZA',
      text: 'Someone left pizza in the break room. Pickups like pizza restore sanity. Go grab it.',
    },
    {
      id: 'wrapup',
      title: 'THAT IS THE JOB',
      seconds: 8,
      text: 'A real shift lasts 20 minutes and gets busier as it goes. Bosses show up, and The Executive arrives at the end. Survive to clock out.',
    },
  ],
};
