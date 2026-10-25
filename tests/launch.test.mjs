// The built page as the live site serves it (at a host name that isn't localhost): the
// playtest helpers are off, the files the site needs are there, and far-away users are
// drawn in low detail when that setting is on.

import { assert } from './harness.mjs';

export const browser = true;
export const pages = ['//3d.test/index.html'];

// From the title, Enter through Clock In (skipping the training offer) to the floor.
async function clockIn(page) {
  await page.waitForSelector('.panel.title', { timeout: 10000 });
  for (let i = 0; i < 6 && (await page.evaluate(() => sim.menu)); i++) {
    await page.keyboard.press((await page.$('.panel.training')) ? 'Escape' : 'Enter');
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => !sim.menu && document.querySelector('.menus').hidden);
}

export const tests = [
  ['starts without errors', async (page) => {
    await page.waitForTimeout(500);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['the playtest keys do nothing on the live site', async (page) => {
    await page.waitForSelector('.panel.title', { timeout: 10000 });
    await page.keyboard.press('KeyG');
    await page.keyboard.press('KeyL');
    const pay = await page.evaluate(() => JSON.parse(localStorage.getItem('helpdesk-survivors-3d.save.v1') ?? '{}').pay ?? 0);
    assert(pay === 0, `G gave $${pay}`);
    await clockIn(page);
    await page.keyboard.press('Digit2');
    await page.keyboard.press('Digit5');
    await page.waitForTimeout(300);
    const [users, god, cheated] = await page.evaluate(() => [sim.enemies.count, sim.player.god, sim.cheated]);
    assert(users < 100 && !god && !cheated, `users ${users}, god ${god}, cheated ${cheated}`);
  }],
  ['Settings has no playtest helpers, and Esc still pauses', async (page) => {
    await page.keyboard.press('KeyO');
    await page.waitForSelector('.panel.settings:not([hidden])', { timeout: 5000 });
    const text = await page.evaluate(() => document.querySelector('.panel.settings').textContent);
    assert(!text.includes('Playtest') && text.includes('Simpler far-away users'), 'the Settings panel still lists the playtest helpers');
    await page.keyboard.press('KeyO');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.pause-panel', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !sim.paused);
  }],
  ['?debug turns the playtest helpers back on', async (page) => {
    await page.goto(page.url() + '?debug');
    await page.waitForFunction(() => window.sim && !document.getElementById('boot'), null, { timeout: 15000 });
    await page.keyboard.press('KeyG');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('helpdesk-survivors-3d.save.v1') ?? '{}').pay >= 1000, null, { timeout: 5000 });
  }],
  ['the site files are there: manifest, icons, service worker', async (page) => {
    const missing = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]').href;
      const manifest = await (await fetch(link)).json();
      const files = [...manifest.icons.map((i) => i.src), 'icons/icon-180.png', 'icons/preview.png', 'sw.js'];
      const bad = [];
      for (const f of files) if (!(await fetch(f)).ok) bad.push(f);
      return bad;
    });
    assert(missing.length === 0, `missing: ${missing.join(', ')}`);
  }],
  ['far-away users are drawn in low detail when that setting is on', async (page) => {
    await clockIn(page);
    const counts = await page.evaluate(async () => {
      const frames = async () => {
        const t = sim.time;
        while (sim.time < t + 0.2) await new Promise((r) => requestAnimationFrame(r));
      };
      const count = () => {
        let near = 0;
        let far = 0;
        for (const m of view.enemies.kinds.values()) {
          near += m.count;
          far += m.userData.far.count;
        }
        return { near, far };
      };
      sim.debugSpawn(300); // just off screen: far from the tech
      view.enemies.lod = false;
      await frames();
      const off = count();
      view.enemies.lod = true;
      await frames();
      return { off, on: count() };
    });
    assert(counts.off.far === 0 && counts.off.near > 0, `with the setting off: ${JSON.stringify(counts.off)}`);
    assert(counts.on.far > counts.on.near, `with the setting on: ${JSON.stringify(counts.on)}`);
  }],
];
