// Makes the home-screen icons and the link preview picture in icons/ from the game itself:
// the Tier 1 Tech's model, rendered on the game's navy, and a shot of a busy shift.
// Run `node icons/make.mjs` after changing the tech's look (the PNGs are kept in git).

import { writeFileSync } from 'node:fs';
import { withPage } from '../tests/harness.mjs';

const OUT = new URL('.', import.meta.url).pathname;
const save = (name, dataUrl) => writeFileSync(OUT + name, Buffer.from(dataUrl.split(',')[1], 'base64'));

await withPage('dev.html', async (page) => {
  // `fill` is how much of the icon the tech takes up: maskable icons get cropped to a circle,
  // so they keep the tech inside the middle 80%.
  const icon = (size, fill) =>
    page.evaluate(async ({ size, fill }) => {
      const THREE = await import('three');
      const { createTechModel } = await import('./src/render/models.js');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.setClearColor('#1a1c2c');
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#e4ecff', '#4a4550', 2.2));
      const sun = new THREE.DirectionalLight('#fff1dc', 2.4);
      sun.position.set(-2, 4, 5);
      scene.add(sun);
      // A floor tile under the tech, in the office carpet's blue.
      const tile = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#3b5dc9' }));
      scene.add(tile);
      const model = createTechModel('tier1');
      model.root.rotation.y = 0.4;
      model.armR.rotation.x = -0.25;
      scene.add(model.root);
      // Head and shoulders fill `fill` of the frame.
      const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
      const d = 4.4 / fill;
      camera.position.set(0.25 * d, 0.95 + 0.3 * d, d);
      camera.lookAt(0, 0.95, 0);
      r.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      r.dispose();
      return url;
    }, { size, fill });
  save('icon-512.png', await icon(512, 1));
  save('icon-192.png', await icon(192, 1));
  save('icon-180.png', await icon(180, 1));
  save('icon-maskable-512.png', await icon(512, 0.72));
  // The link preview, 1200 x 630: Clock In (skipping training), then a crowd and every tool.
  await page.setViewportSize({ width: 1200, height: 630 });
  for (let i = 0; i < 8 && (await page.evaluate(() => sim.menu)); i++) {
    await page.keyboard.press((await page.$('[data-act="skip"]')) ? 'Escape' : 'Enter');
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => (sim.player.god = true));
  for (const key of ['Digit0', 'Digit7', 'Digit7', 'Digit2', 'KeyU']) await page.keyboard.press(key);
  await page.waitForFunction(() => !sim.chest && !sim.choices, null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(12000);
  save('preview.png', `data:image/png;base64,${(await page.screenshot()).toString('base64')}`);
});
console.log('icons/: written');
