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
    const x0 = await page.evaluate(() => sim.player.x);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(600);
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
