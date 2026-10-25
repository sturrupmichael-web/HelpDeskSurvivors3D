// Copied unchanged from the original (HelpDeskSurvivor data/).
// Text for the end-of-shift HR performance review (logic in src/game/review.js).
// {placeholders} are filled from the shift's stats.

// Checked top to bottom; the first match is the overall rating. `stars` is out of 5.
export const RATINGS = [
  { id: 'eotm', name: 'Employee of the Month', stars: 5, when: (s, r) => s.won && r.minHpFrac > 0.5 && !r.revived },
  { id: 'exceeds', name: 'Exceeds Expectations', stars: 4, when: (s) => s.won },
  { id: 'meets', name: 'Meets Expectations', stars: 3, when: (s) => s.time >= 900 },
  { id: 'needs', name: 'Needs Improvement', stars: 2, when: (s) => s.time >= 300 },
  { id: 'pip', name: 'Performance Improvement Plan', stars: 1, when: () => true },
];

// Who signs the review on each map.
export const MANAGERS = {
  office: 'Brenda, IT Manager',
  server: 'Gary, Head of Infrastructure',
  callcenter: 'Denise, Call Center Supervisor',
  garage: 'Rick, Facilities (covering nights)',
  merger: 'Chad, VP of Integration (your new manager, apparently)',
};

// Manager's comments. Each has a test, a priority (higher shows first) and lines to
// pick from. The review shows the top three that apply.
export const COMMENTS = [
  { when: (c) => c.won && c.revived, pri: 9, lines: ['Clocked out on time, with some help from the Union Rep. HR would like to keep that between us.'] },
  { when: (c) => c.won && !c.revived, pri: 8, lines: [
    "Clocked out on time and the Executive's laptop works. Nobody said thank you, and nobody will.",
    'Survived a full shift. We have taken this as proof the workload is fine.',
  ] },
  { when: (c) => !c.won && c.time < 60, pri: 10, lines: [
    'Left {time} into a 20-minute shift. We checked: the coffee machine was working.',
    'Burned out after {time}. Onboarding will be repeated in full.',
  ] },
  // Shift Policies (data/policies.js).
  { when: (c) => c.badCount >= 3, pri: 7, lines: [
    'Volunteered for {badCount} bad policies at once. HR has flagged this as a cry for help.',
    'Signed up to {badCount} bad policies. Nobody asked you to. Nobody ever asks you to.',
  ] },
  { when: (c) => c.won && c.has('budgetCuts'), pri: 7, lines: ['Survived Budget Cuts. Finance is thrilled and has cut the budget again.'] },
  { when: (c) => c.has('auditWeek') && c.time >= 300, pri: 6, lines: ['Worked through Audit Week. The auditors raised no findings, apart from you.'] },
  { when: (c) => c.won && c.has('changeFreeze'), pri: 6, lines: ['Respected the Change Freeze all shift. The Change Advisory Board has never been prouder.'] },
  { when: (c) => c.has('mondayMorning') && c.time >= 300, pri: 5, lines: ['Handled the whole weekend\'s queue before lunch. Please do not tell the other teams it is possible.'] },
  { when: (c) => c.has('vendorLockIn'), pri: 4, lines: ['Made it work with only the contracted tools. The vendor has asked to use you in a case study.'] },
  { when: (c) => c.perkCount >= 2, pri: 5, lines: ['Worked a shift with {perks}. Must be nice.'] },
  { when: (c) => c.has('workFromHome'), pri: 3, lines: ['Worked from home. Camera was off the entire time.'] },
  { when: (c) => c.has('casualFriday'), pri: 3, lines: ['Embraced Casual Friday. The users did too, at speed.'] },
  { when: (c) => c.revived && !c.won, pri: 7, lines: ['Came back from burnout once already this shift. The Union Rep has asked us to stop calling.'] },
  { when: (c) => c.kills >= 3000, pri: 6, lines: [
    'Closed {kills} tickets. We have raised your quota to {quota}.',
    'Closed {kills} tickets. Please slow down, the metrics dashboard is crashing.',
  ] },
  { when: (c) => c.kills < 150 && c.time >= 60, pri: 6, lines: ['Closed {kills} tickets. The queue would like a word.'] },
  { when: (c) => c.steve >= 15, pri: 5, lines: ['Shut down {steve} Shadow IT Steves. Steve has filed a grievance. Several, actually.'] },
  { when: (c) => c.pam >= 300, pri: 4, lines: ['Reset {pam} passwords. Every single one was "Password1".'] },
  { when: (c) => c.randy >= 100, pri: 4, lines: ['Muted {randy} Reply-All threads. The rest of the company thanks you, silently.'] },
  { when: (c) => c.vip >= 5, pri: 4, lines: ['Closed {vip} VIP tickets without a single escalation email. We have no idea how.'] },
  { when: (c) => c.pizzas >= 3, pri: 5, lines: [
    'Ate {pizzas} pizzas from the break room. At least one was labeled "DO NOT TOUCH".',
    'Consumed {pizzas} break room pizzas. Facilities is reviewing the fridge camera.',
  ] },
  { when: (c) => c.pizzas === 1 || c.pizzas === 2, pri: 2, lines: ['Took pizza from the break room. We are choosing to see this as team spirit.'] },
  { when: (c) => c.streak >= 150, pri: 5, lines: ['Hit a x{streak} streak. Please stop making the rest of the team look bad.'] },
  { when: (c) => c.evolved, pri: 5, lines: [
    'Upgraded {evolved} without a change request. Bold. Effective. Unapproved.',
    'Turned a regular tool into {evolved}. Procurement wants to know where the budget came from.',
  ] },
  { when: (c) => c.bossBeaten, pri: 6, lines: ['Personally dealt with {bossBeaten}. Nobody else volunteered.'] },
  { when: (c) => c.bossDodged, pri: 6, lines: ['Was seen avoiding {bossDodged}. We have booked a 1:1 to discuss.'] },
  { when: (c) => c.topShare >= 0.7 && c.toolCount >= 3, pri: 4, lines: ['Relies heavily on {topTool}. Please remember the toolbox has other things in it.'] },
  { when: (c) => c.toolCount >= 6 && c.topShare < 0.4, pri: 3, lines: ['Uses a very wide range of tools. Possibly too wide. IT Security has questions.'] },
  { when: (c) => c.close && c.time >= 300, pri: 4, lines: ['Got within an inch of burnout and kept going. HR is calling it "resilience" in the annual report.'] },
  { when: (c) => c.level >= 40, pri: 3, lines: ['Reached level {level}. Still not eligible for a raise this cycle.'] },
  { when: (c) => c.csat >= 100000, pri: 3, lines: ['Earned {csat} CSAT points. Survey responses mostly said "fine".'] },
  { when: (c) => c.topShare >= 0.5 && c.topShare < 0.7 && c.toolCount >= 2, pri: 2, lines: ['{topTool} did {topPct}% of the work. We would like to meet {topTool} about a promotion.'] },
  { when: (c) => c.streak >= 50 && c.streak < 150, pri: 1, lines: ['Best streak of x{streak}. Consistency is a core value here, or it was in the slide deck.'] },
  { when: (c) => c.time >= 120, pri: 1, lines: [
    'Closed about {perMin} tickets a minute. The target was {target}. We moved it while you were working.',
    'Averaged {perMin} tickets a minute. Please log your breaks, even the ones you did not take.',
  ] },
  // Always-true fallbacks so there are always three comments.
  { when: () => true, pri: 0, lines: [
    'Showed up. Logged in. That is more than some people.',
    'Regularly attends the shift.',
    'Keeps their desk tidy. Mostly cable ties.',
    'Has never once said "have you tried turning it off and on again" sarcastically. That we know of.',
  ] },
];

// Goal for next quarter, keyed by what to aim for next.
export const GOALS = {
  five: 'Make it to 5:00. Small steps.',
  boss: 'Close {boss} at 10:00 instead of running from it.',
  ten: 'Make it to 10:00 and meet the {bossName}.',
  fifteen: 'Make it to 15:00. The second half is where the overtime is.',
  twenty: 'Last until 20:00 and see the Executive off.',
  executive: 'Close the Executive before the board meeting. Just once.',
  clean: 'Clock out again without burning through half your sanity.',
  union: 'Clock out again without calling the Union Rep.',
  map: 'Try the same miracle on another map.',
};

// Short boss names for review sentences.
export const BOSS_NAMES = {
  incident: 'the Major Incident',
  ratsnest: "the Rat's Nest",
  caller: 'the Angry Caller',
  janitor: 'the Night Janitor',
  takeover: 'the Hostile Takeover',
  executive: 'the Executive',
};
