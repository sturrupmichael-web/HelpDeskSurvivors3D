// The real page in headless Chromium: it starts without errors, draws, and the tech moves.

import { assert } from './harness.mjs';

export const browser = true;

export const tests = [
  ['starts without errors', async (page) => {
    await page.waitForTimeout(500);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['opens on the title, and Enter clocks in', async (page) => {
    await page.waitForSelector('.panel.title', { timeout: 10000 });
    assert(await page.evaluate(() => sim.menu && sim.frozen), 'the floor runs behind the title');
    assert(await page.evaluate(() => document.querySelector('.hud').hidden), 'the HUD shows on the title');
    // A fresh save has one tech and one map: straight to work.
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !sim.menu && document.querySelector('.menus').hidden);
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
    // The counter fills in after half a second of game frames, which a slow software
    // renderer can stretch well past half a second of wall time: wait for the text.
    const shown = await page
      .waitForFunction(() => /\d+ FPS/.test(document.querySelector('.fps:not([hidden])')?.textContent ?? ''), null, { timeout: 10000 })
      .then(() => true, () => false);
    const text = await page.evaluate(() => document.querySelector('.fps:not([hidden])')?.textContent ?? '');
    assert(shown, `counter shows "${text}"`);
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
  ['every tool in the toolbox draws without errors', async (page) => {
    await page.evaluate(() => {
      sim.newRun();
      sim.player.god = true;
      sim.player.xpNeed = Infinity; // no level-up cards to stop the clock
      sim.debugSpawn(150);
    });
    // Swap through the whole toolbox, a little game time each, noting what gets drawn.
    const seen = new Set();
    const tools = 21; // every tool that isn't an evolution
    for (let i = 0; i < tools; i++) {
      const id = await page.evaluate(() => sim.debugSwapWeapon()?.def.behavior);
      const t0 = await page.evaluate(() => sim.time);
      await page.waitForFunction((t) => sim.time > t + 0.6, t0, { timeout: 15000 });
      const drawn = await page.evaluate(() => {
        const v = view.tools;
        return v.batches.reduce((n, b) => n + b.mesh.count, 0) + v.propList.reduce((n, b) => n + b.mesh.count, 0) + v.tools.filter((t) => t.meshes.some((m) => m.visible)).length;
      });
      if (drawn > 0 && id) seen.add(id);
    }
    assert(page.errors.length === 0, page.errors.join('\n'));
    assert(seen.size >= 8, `only drew ${[...seen].join(', ')}`);
    await page.evaluate(() => sim.newRun());
  }],
  ['level-up cards appear and a key picks one', async (page) => {
    await page.evaluate(() => sim.debugLevelUp());
    await page.waitForSelector('.levelup-panel .card', { timeout: 10000 });
    const level = await page.evaluate(() => sim.player.level);
    await page.waitForTimeout(500); // taps are ignored for a moment
    const fpsOn = () => page.evaluate(() => !document.querySelector('.fps').hidden);
    const before = await fpsOn();
    await page.keyboard.press('KeyF'); // still works while the cards are up
    assert((await fpsOn()) !== before, 'F was swallowed by the cards');
    await page.keyboard.press('KeyF');
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => !sim.choices);
    await page.waitForFunction(() => document.querySelector('.screen').hidden);
    assert(level === 2, `level ${level}`);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['Esc puts the shift on hold and resumes it', async (page) => {
    await page.evaluate(() => {
      while (sim.choices) sim.choose(sim.choices[0]);
      sim.chest = null;
    });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.pause-panel', { timeout: 5000 });
    const t = await page.evaluate(() => sim.time);
    await page.waitForTimeout(300);
    assert((await page.evaluate(() => sim.time)) === t, 'the clock ran while paused');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !sim.paused && document.querySelector('.pause-panel').closest('.screen').hidden);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['burnout shows the summary and Next Shift starts over', async (page) => {
    await page.evaluate(() => {
      while (sim.choices) sim.choose(sim.choices[0]);
      sim.chest = null;
      sim.player.god = false;
      sim.player.warranty = 0; // a random card may have been Extended Warranty, which revives once
      sim.player.hp = -1;
    });
    await page.waitForSelector('.summary', { timeout: 5000 });
    const title = await page.textContent('.summary h1');
    assert(title === 'BURNOUT', `title ${title}`);
    await page.waitForTimeout(700); // a held key can't skip the summary
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !sim.over && sim.time < 2);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['B starts a boss fight with a boss bar, and K-ing the Executive down clocks you out', async (page) => {
    // The summary from the last test hides on the next frame; until then it takes the keys.
    await page.waitForFunction(() => [...document.querySelectorAll('.screen')].every((el) => el.hidden));
    await page.evaluate(() => {
      sim.player.god = true;
      sim.spawner.stopped = true;
    });
    await page.keyboard.press('KeyB');
    await page.waitForSelector('.hud-boss:not([hidden])', { timeout: 10000 });
    assert((await page.textContent('.boss-name')) === 'Major Incident', await page.textContent('.boss-name'));
    await page.waitForFunction(() => view.bosses.models.incident?.[0]?.root.visible, null, { timeout: 10000 });
    // Straight to the Executive, then close it.
    await page.evaluate(() => {
      sim.boss.dead = true;
      sim.time = 1150;
      sim.debugBoss();
    });
    await page.waitForFunction(() => document.querySelector('.boss-name').textContent.startsWith('The Executive'), null, { timeout: 10000 });
    for (let i = 0; i < 4; i++) await page.keyboard.press('KeyK');
    await page.waitForSelector('.summary', { timeout: 30000 });
    const title = await page.textContent('.summary h1');
    assert(title === 'CLOCKED OUT!', `title ${title}`);
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !sim.over && sim.time < 2 && document.querySelector('.hud-boss').hidden);
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['the summary goes to the shop, which spends Overtime Pay, and back through Clock In', async (page) => {
    await page.waitForFunction(() => [...document.querySelectorAll('.screen')].every((el) => el.hidden));
    await page.evaluate(() => {
      sim.player.god = false;
      sim.player.warranty = 0;
      sim.player.hp = -1;
    });
    await page.waitForSelector('.summary .paid', { timeout: 10000 });
    await page.waitForTimeout(700);
    await page.keyboard.press('KeyS');
    await page.waitForSelector('.shop-list', { timeout: 5000 });
    await page.keyboard.press('KeyG'); // playtest: +$1,000
    const pay = await page.evaluate(() => sim.meta.data.pay);
    await page.keyboard.press('Digit1'); // Ergonomic Chair
    await page.waitForFunction((p) => sim.meta.data.pay < p && sim.meta.level('chair') === 1, pay);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.panel.title', { timeout: 5000 });
    // With pay to hire someone, Clock In asks for a tech.
    await page.keyboard.press('Enter');
    await page.waitForSelector('.setup', { timeout: 5000 });
    await page.keyboard.press('Digit2'); // hire Desktop Support ($300)
    await page.waitForFunction(() => sim.meta.isUnlocked('desktop'));
    await page.keyboard.press('Enter'); // on to the map
    await page.keyboard.press('Enter'); // Clock In
    await page.waitForFunction(() => !sim.menu && sim.charId === 'desktop' && view.techId === 'desktop');
    assert((await page.evaluate(() => sim.player.maxHp)) === 100, 'the chair did not add sanity'); // 90 + 10
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['M mutes the sound and the HUD says so', async (page) => {
    await page.keyboard.press('KeyM');
    await page.waitForSelector('.hud .muted:not([hidden])', { timeout: 5000 });
    await page.keyboard.press('KeyM');
    await page.waitForSelector('.hud .muted[hidden]', { state: 'attached', timeout: 5000 });
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
  ['L unlocks the next map, and picking it on Clock In shows its floor', async (page) => {
    // The Executive test above won a shift in the Open Office, which opened the Server Room.
    await page.keyboard.press('KeyL');
    await page.waitForFunction(() => sim.meta.mapUnlocked('callcenter'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('.pause-panel', { timeout: 5000 });
    await page.keyboard.press('KeyQ');
    await page.keyboard.press('KeyQ'); // sure
    await page.waitForSelector('.panel.title', { timeout: 5000 });
    await page.keyboard.press('Enter');
    await page.waitForSelector('.setup', { timeout: 5000 });
    if (await page.$('.setup .card.char')) await page.keyboard.press('Enter'); // on to the map
    await page.waitForSelector('.setup .card.map', { timeout: 5000 });
    await page.keyboard.press('Digit3'); // Call Center
    await page.waitForFunction(() => sim.menu && sim.mapId === 'callcenter' && view.floor.style === 'callcenter', null, { timeout: 10000 });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !sim.menu && sim.mapId === 'callcenter' && sim.meta.data.map === 'callcenter');
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
  ['every map draws, and the Night Shift is lit by a flashlight', async (page) => {
    for (const map of ['server', 'garage', 'merger', 'office']) {
      await page.evaluate((m) => sim.newRun(sim.charId, m), map);
      await page.waitForFunction((m) => view.floor.style === m && view.floor.chunks.size > 0, map, { timeout: 10000 });
      const s = await page.evaluate(() => ({ calls: view.renderer.info.render.calls, light: view.flashlight.visible }));
      assert(s.calls > 3, `${map}: ${s.calls} draw calls`);
      assert(s.light === (map === 'garage'), `${map}: flashlight ${s.light}`);
    }
    assert(page.errors.length === 0, page.errors.join('\n'));
  }],
];
