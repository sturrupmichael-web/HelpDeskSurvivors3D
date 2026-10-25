// The online parts (M13) against a pretend Supabase (tests/fakeSupabase.mjs): the
// leaderboard, posting a shift as a new guest, profiles, the Account screen, cloud saves,
// and coming back from Google sign-in to an account that already has a name.

import { assert } from './harness.mjs';
import { FakeSupabase, token } from './fakeSupabase.mjs';

export const browser = true;

let fake;
// The browser logs a refused request (a taken name) as an error; the game handles it.
const errors = (page) => page.errors.filter((e) => !/status of 409/.test(e));

// Ends the current shift right away (a burnout), with whatever was played so far.
const burnOut = (page) =>
  page.evaluate(() => {
    while (sim.choices) sim.choose(sim.choices[0]);
    sim.chest = null;
    sim.player.warranty = 0;
    sim.player.hp = -1;
  });

const toTitle = async (page) => {
  await page.evaluate(() => document.querySelector('.menus .panel')?.focus());
  for (let i = 0; i < 4 && !(await page.$('.panel.title')); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  await page.waitForSelector('.panel.title', { timeout: 5000 });
};

export const tests = [
  ['the title has Leaderboard and Account, and B shows the board from the server', async (page) => {
    fake = new FakeSupabase();
    fake.addScore('Pam', { map: 'office', csat: 5000, seconds: 900, character: 'SysAdmin' });
    fake.addScore('Dwight', { map: 'office', csat: 3000, seconds: 1300, won: true, mods: 'casualFriday,hardcore', mult: 3 });
    fake.addScore('Kevin', { map: 'server', csat: 100, seconds: 60 });
    await fake.attach(page);
    await page.waitForSelector('.panel.title', { timeout: 10000 });
    assert(await page.$('.tile[data-act=board]'), 'no Leaderboard tile');
    assert((await page.textContent('.tile[data-act=account]')).includes('Not signed in'), 'Account tile');
    await page.keyboard.press('KeyB');
    await page.waitForSelector('.board-table');
    const names = await page.$$eval('.board-table tr[data-name]', (rows) => rows.map((r) => r.dataset.name));
    assert(names.join() === 'Dwight,Pam', `office board: ${names}`); // 3000 x3 beats 5000
    assert(await page.$('.board-table .hc-tag'), 'Hardcore rows are tagged');
    // Map 2 is the Server Room; H shows only Hardcore shifts (none there).
    await page.keyboard.press('Digit2');
    await page.waitForFunction(() => document.querySelector('.board-table tr[data-name]')?.dataset.name === 'Kevin');
    await page.keyboard.press('KeyH');
    await page.waitForFunction(() => /No scores/.test(document.querySelector('.board-body').textContent));
    await page.keyboard.press('KeyH');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.panel.title');
    assert(errors(page).length === 0, errors(page).join('\n'));
  }],
  ['a clean shift posts to the board as a new guest, with its policies and rank', async (page) => {
    await page.evaluate(() => (sim.meta.data.offeredTraining = true));
    // Clock In with the saved picks (a fresh save skips every step).
    for (let i = 0; i < 4 && !(await page.evaluate(() => !sim.menu)); i++) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    await page.waitForFunction(() => !sim.menu);
    await page.evaluate(() => (sim.score.csat = 4200));
    await burnOut(page);
    await page.waitForSelector('.summary .board-post input.board-name', { timeout: 5000 });
    assert(!(await page.$('.board-note')), 'a clean shift has no "helpers used" note');
    await page.fill('.board-post input', '  Michael​ ');
    await page.press('.board-post input', 'Enter');
    await page.waitForFunction(() => /Posted!/.test(document.querySelector('.board-post .board-msg').textContent), null, { timeout: 10000 });
    const msg = await page.textContent('.board-post .board-msg');
    const row = fake.scores.at(-1);
    assert(fake.signups === 1 && row.name === 'Michael', `posted as ${row.name}, ${fake.signups} sign-ups`);
    const over = await page.evaluate(() => sim.over);
    assert(row.map === over.map && row.csat === 4200 && row.seconds === Math.round(over.time) && row.won === false, JSON.stringify(row));
    assert(row.mods === [...over.policies, ...(over.reorg ? ['reorg'] : []), ...(over.hardcore ? ['hardcore'] : [])].join(',') && row.mult === over.policyMult, `mods ${row.mods} x${row.mult}`);
    const rank = fake.scores.filter((s) => s.map === row.map && s.score > row.score).length + 1;
    assert(msg.includes(`#${rank}`), `message: ${msg}`);
    // Posting again does nothing.
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    assert(fake.scores.filter((s) => s.name === 'Michael').length === 1, 'posted twice');
    assert(await page.evaluate(() => sim.meta.data.playerName === 'Michael'), 'name kept in the save');
  }],
  ['the progress backs up to the account a few seconds later', async (page) => {
    await page.waitForFunction(() => document.querySelector('.board-post') && true);
    const uid = fake.players.find((p) => p.name === 'Michael').user_id;
    for (let i = 0; i < 40 && !fake.saves.get(uid); i++) await page.waitForTimeout(250);
    const saved = fake.saves.get(uid)?.data;
    assert(saved && saved.shifts >= 1 && saved.playerName === 'Michael', `cloud save: ${JSON.stringify(saved)?.slice(0, 120)}`);
  }],
  ['a shift that used a playtest helper can\'t be posted', async (page) => {
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter'); // Next Shift
    await page.waitForFunction(() => !sim.over && !sim.menu);
    await page.keyboard.press('Digit5'); // god mode
    await page.keyboard.press('Digit5');
    await burnOut(page);
    await page.waitForSelector('.summary .board-note', { timeout: 5000 });
    assert(!(await page.$('.board-post')), 'post row shown');
  }],
  ['the board highlights your row, and a tap opens the profile; Account shows the guest', async (page) => {
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape'); // Title
    await page.waitForSelector('.panel.title');
    assert((await page.textContent('.tile[data-act=account]')).includes('Guest'), 'Account tile says Guest');
    const map = await page.evaluate(() => sim.meta.data.map);
    await page.keyboard.press('KeyB');
    await page.waitForSelector('.board-table tr.me');
    assert((await page.getAttribute('.board-table tr.me', 'data-name')) === 'Michael', 'my row');
    await page.click('.board-table tr.me');
    await page.waitForSelector('.profile .profile-best');
    const text = await page.textContent('.profile');
    assert(text.includes('Michael') && text.includes('Scores posted'), text.slice(0, 200));
    await page.keyboard.press('Escape');
    await page.waitForSelector('.board-table');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.panel.title');
    await page.keyboard.press('KeyU');
    await page.waitForSelector('.panel.account');
    const acc = await page.textContent('.panel.account');
    assert(acc.includes('Guest account') && acc.includes('Michael') && acc.includes('backed up'), acc.slice(0, 300));
    // Renaming to a taken name is refused; a free one renames the scores too.
    await page.fill('.name-row input', 'pam');
    await page.press('.name-row input', 'Enter');
    await page.waitForFunction(() => /already has that name/.test(document.querySelector('.panel.account .board-msg').textContent));
    await page.fill('.name-row input', 'Mike');
    await page.press('.name-row input', 'Enter');
    await page.waitForFunction(() => /Mike/.test(document.querySelector('.panel.account b')?.textContent ?? '') || /Mike/.test(document.querySelector('.panel.account').textContent));
    assert(fake.scores.some((s) => s.name === 'Mike' && s.map === map), 'scores renamed');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.panel.title');
    assert(errors(page).length === 0, errors(page).join('\n'));
  }],
  ['offline, the board says so instead of failing', async (page) => {
    fake.offline = true;
    await page.keyboard.press('KeyB');
    await page.waitForFunction(() => /Couldn't reach/.test(document.querySelector('.board-body')?.textContent ?? ''), null, { timeout: 15000 });
    fake.offline = false;
    // The browser logs each refused request; that's what this test is about.
    page.errors = page.errors.filter((e) => !/ERR_FAILED/.test(e));
    await page.keyboard.press('Escape');
    await page.waitForSelector('.panel.title');
  }],
  ['coming back from Google signs in to the account, with its name from the 2D game', async (page) => {
    // A player who claimed "Pam" in the 2D game signs in with the same Google account.
    const pam = fake.players.find((p) => p.name === 'Pam');
    const t = token(pam.user_id, { guest: false, email: 'pam@example.com' });
    const url = new URL(page.url());
    await page.goto('about:blank'); // a new load, not just a new #hash
    await page.goto(`${url.origin}${url.pathname}#${new URLSearchParams({ ...t, token_type: 'bearer' })}`);
    await page.waitForFunction(() => window.sim && !document.getElementById('boot'), null, { timeout: 15000 });
    const href = await page.evaluate(() => location.href);
    assert(!href.includes('access_token'), `tokens left in the address bar: ${href.slice(0, 120)}`);
    await page.waitForSelector('.toast');
    assert((await page.textContent('.toasts')).includes('SIGNED IN WITH GOOGLE'), 'sign-in toast');
    await page.waitForSelector('.panel.title');
    // This device had progress and the account had none: the account gets it.
    for (let i = 0; i < 40 && !fake.saves.get(pam.user_id); i++) await page.waitForTimeout(250);
    assert(fake.saves.get(pam.user_id), 'progress uploaded to the account');
    await page.keyboard.press('KeyU');
    await page.waitForSelector('.panel.account');
    const acc = await page.textContent('.panel.account');
    assert(acc.includes('pam@example.com') && acc.includes('Pam') && acc.includes('Sign out'), acc.slice(0, 300));
    assert(await page.evaluate(() => sim.meta.data.playerName === 'Pam'), 'the 2D name is used on the board');
    await toTitle(page);
    assert(errors(page).length === 0, errors(page).join('\n'));
  }],
];
