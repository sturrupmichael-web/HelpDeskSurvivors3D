// The real page in headless Chromium: it starts without errors, draws, and the tech moves.

import { assert } from './harness.mjs';

export const browser = true;

export const tests = [
  ['starts without errors', async (page) => {
    await page.waitForTimeout(500);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['draws the scene', async (page) => {
    const info = await page.evaluate(() => view.renderer.info.render);
    assert(info.calls > 3 && info.triangles > 1000, `only ${info.calls} draw calls, ${info.triangles} triangles`);
  }],
  ['the tech walks with WASD', async (page) => {
    // Wait on game time, not wall time: a slow software renderer runs the game slower.
    const [x0, t0] = await page.evaluate(() => [sim.player.x, sim.time]);
    await page.keyboard.down('KeyD');
    await page.waitForFunction((t) => sim.time > t + 0.5, t0);
    await page.keyboard.up('KeyD');
    const x1 = await page.evaluate(() => sim.player.x);
    assert(x1 - x0 > 20, `moved only ${x1 - x0} px`);
  }],
  ['F toggles the FPS counter', async (page) => {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(700);
    const text = await page.evaluate(() => document.querySelector('.fps:not([hidden])')?.textContent ?? '');
    assert(/FPS/.test(text), `counter shows "${text}"`);
    await page.keyboard.press('KeyF');
  }],
  ['users are drawn instanced', async (page) => {
    await page.evaluate(() => {
      sim.player.god = true;
      sim.debugSpawn(200);
    });
    await page.waitForTimeout(400);
    const drawn = await page.evaluate(() => [...view.enemies.kinds.values()].reduce((n, m) => n + m.count, 0));
    assert(drawn > 0, 'no users drawn');
    await page.evaluate(() => {
      sim.debugClear();
      sim.player.god = false;
    });
  }],
  ['tools fire and their projectiles are drawn', async (page) => {
    await page.evaluate(() => {
      sim.player.god = true;
      while (sim.debugAddWeapon());
      sim.debugSpawn(100);
    });
    await page.waitForFunction(() => view.weapons.batches.some((m) => m.count > 0) && view.weapons.shields.count > 0, null, { timeout: 15000 });
    const t0 = await page.evaluate(() => sim.time);
    await page.waitForFunction((t) => sim.time > t + 1, t0);
    const kills = await page.evaluate(() => sim.kills);
    assert(kills > 0, 'nobody was closed');
    assert(page.errors.length === 0, page.errors.join('\n'));
    await page.evaluate(() => sim.newRun());
  }],
  ['level-up cards appear and a key picks one', async (page) => {
    await page.evaluate(() => sim.debugLevelUp());
    await page.waitForSelector('.levelup-panel .card', { timeout: 10000 });
    const level = await page.evaluate(() => sim.player.level);
    await page.waitForTimeout(500); // taps are ignored for a moment
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => !sim.choices);
    await page.waitForFunction(() => document.querySelector('.screen').hidden);
    assert(level === 2, `level ${level}`);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['quality settings apply', async (page) => {
    await page.click('.gear');
    await page.click('[data-toggle=shadows]');
    await page.click('[data-res=low]');
    const s = await page.evaluate(() => ({ shadows: view.renderer.shadowMap.enabled, ratio: view.renderer.getPixelRatio() }));
    assert(s.ratio === 1, `pixel ratio ${s.ratio}`);
    await page.click('[data-toggle=shadows]');
    await page.click('[data-act=close]');
    await page.waitForTimeout(200);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
];
