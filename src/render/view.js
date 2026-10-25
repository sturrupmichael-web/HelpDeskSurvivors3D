// The 3D view of the simulation: scene, lights, shadows, camera, and the models that
// mirror sim state each frame. It only reads the simulation, never changes it.

import * as THREE from 'three';
import { CameraRig } from './cameraRig.js';
import { FloorView } from './floor.js';
import { createTechModel, blobShadowGeometry, outlineMaterial, px } from './models.js';
import { EnemyView } from './enemies.js';
import { WeaponView } from './weapons.js';
import { ToolView } from './tools.js';
import { PickupView } from './pickups.js';
import { FxView } from './fx.js';
import { ZoneView } from './zones.js';
import { BossView } from './bosses.js';
import { HazardView } from './hazards.js';
import { FOOT } from '../sim/player.js';

const BACKGROUND = '#1a1c2c'; // the original's near-black navy

// Each map's light: the background (and fog) colour, the sky/floor fill and the sun.
// `dark` maps (Night Shift) put out the lights and give the tech a flashlight instead.
const LOOKS = {
  office: { bg: BACKGROUND, sky: '#e4ecff', ground: '#4a4550', hemi: 1.9, sun: '#fff1dc', sunI: 2.4 },
  server: { bg: '#11131f', sky: '#bcd4ff', ground: '#2a2f45', hemi: 1.5, sun: '#d8e6ff', sunI: 2.0 },
  callcenter: { bg: '#161a30', sky: '#e8eeff', ground: '#3a3f60', hemi: 1.9, sun: '#fff6e8', sunI: 2.3 },
  garage: { bg: '#07080d', sky: '#8090c0', ground: '#101018', hemi: 0.1, sun: '#8090c0', sunI: 0.08, dark: true },
  merger: { bg: BACKGROUND, sky: '#eef2ff', ground: '#4a4a5a', hemi: 2.0, sun: '#fff4e4', sunI: 2.5 },
};
const FLASHLIGHT = 9; // the flashlight's intensity at full radius
const SHADOW_SPAN = 30; // half-size of the sun's shadow box, scene units
const TURN_RATE = 14; // how fast the tech turns to face where they walk (1/s)

// Quality presets for the pixel ratio (the renderer's resolution).
export const RESOLUTIONS = {
  low: () => 1,
  medium: () => Math.min(1.5, devicePixelRatio || 1),
  high: () => Math.min(2, devicePixelRatio || 1),
};

const lerp = (a, b, t) => a + (b - a) * t;

const SCREEN_POINT = new THREE.Vector3();

export class View {
  // `antialias` can only be chosen when the renderer is created (main.js decides).
  constructor(canvas, sim, { antialias = true } = {}) {
    this.sim = sim;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance' });
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND);
    this.scene.fog = new THREE.Fog(BACKGROUND, 55, 110);
    this.rig = new CameraRig();

    // Soft office light: a sky/floor hemisphere fill plus one warm sun for shape and shadows.
    this.hemi = new THREE.HemisphereLight('#e4ecff', '#4a4550', 1.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 2.4);
    this.sunOffset = new THREE.Vector3(-14, 30, 12);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -SHADOW_SPAN;
    sc.right = sc.top = SHADOW_SPAN;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.floor = new FloorView(this.scene, sim.floor);
    // The Night Shift's flashlight: a light that follows the tech (data/maps.js twist `dark`).
    this.flashlight = new THREE.PointLight('#fff4d8', 0, 1, 0.6);
    this.flashlight.visible = false;
    this.scene.add(this.flashlight);
    this.mapId = null;
    this.quality = null;

    this.tech = null;
    this.techId = null;
    this.setTech(sim.charId);
    this.portraits = new Map(); // tech id -> image URL, for the menus
    this.fall = 0; // 0 standing .. 1 flat on the floor after a burnout
    // Blob shadow under the tech, shown when real shadows are off.
    this.blob = new THREE.Mesh(
      blobShadowGeometry(0.42),
      new THREE.MeshBasicMaterial({ color: '#0a0c18', transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.blob.position.y = 0.01;
    this.scene.add(this.blob);
    // Sanity bar on the floor just in front of the tech, like the original's bar under the
    // sprite. Drawn over everything, so the horde never hides it.
    this.sanity = new THREE.Group();
    const barBack = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.2), new THREE.MeshBasicMaterial({ color: BACKGROUND, depthWrite: false, depthTest: false }));
    this.sanityFill = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.1), new THREE.MeshBasicMaterial({ color: '#b13e53', depthWrite: false, depthTest: false }));
    this.sanityFill.geometry.translate(0.62, 0, 0); // grow from the left edge
    this.sanityFill.position.set(-0.62, 0, 0.001);
    barBack.renderOrder = 10;
    this.sanityFill.renderOrder = 11;
    this.sanity.add(barBack, this.sanityFill);
    this.sanity.rotation.x = -Math.PI / 2;
    this.scene.add(this.sanity);

    this.enemies = new EnemyView(this.scene, sim.enemies.capacity);
    this.weapons = new WeaponView(this.scene);
    this.tools = new ToolView(this.scene);
    this.pickups = new PickupView(this.scene);
    this.fx = new FxView(this.scene);
    this.zones = new ZoneView(this.scene);
    this.bosses = new BossView(this.scene);
    this.hazards = new HazardView(this.scene);
    this.techYaw = 0;
    this.walkPhase = 0;

    this.size = { w: 0, h: 0 };
    this.applyQuality({ shadows: true, resolution: 'high' });
    this.resetCamera();
  }

  // { shadows: bool, outlines: bool, resolution: 'low' | 'medium' | 'high', lod: bool }
  applyQuality({ shadows, outlines = true, resolution, lod = false }) {
    this.quality = { shadows, outlines, resolution, lod };
    this.enemies.lod = lod; // far users in low detail
    outlineMaterial.visible = outlines; // outlines redraw every person, so they're optional
    const r = this.renderer;
    r.setPixelRatio((RESOLUTIONS[resolution] ?? RESOLUTIONS.high)());
    r.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows && !this.look?.dark; // no sun to cast them in the dark
    const map = resolution === 'low' ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== map) {
      this.sun.shadow.mapSize.set(map, map);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.blob.visible = !shadows;
    // Materials compile differently with shadows on and off.
    this.scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    this.size.w = 0; // force a resize so the new pixel ratio takes effect
  }

  // Swaps the tech's model (a new shift with another tech).
  setTech(id) {
    if (this.tech) {
      this.scene.remove(this.tech.root);
      this.tech.root.traverse((o) => o.isMesh && o.material !== outlineMaterial && o.geometry.dispose());
      this.tech.material.dispose();
    }
    this.tech = createTechModel(id);
    this.techId = id;
    this.scene.add(this.tech.root);
  }

  // A picture of a tech for the menus (an image URL), rendered once and kept.
  portrait(id) {
    let url = this.portraits.get(id);
    if (url) return url;
    const size = 128;
    if (!this.portraitScene) {
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#e4ecff', '#4a4550', 2.2));
      const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
      sun.position.set(-2, 4, 5);
      scene.add(sun);
      const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
      camera.position.set(0.9, 1.5, 3.7);
      camera.lookAt(0, 0.86, 0);
      const target = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
      target.texture.colorSpace = THREE.SRGBColorSpace;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      this.portraitScene = { scene, camera, target, canvas, pixels: new Uint8Array(size * size * 4) };
    }
    const { scene, camera, target, canvas, pixels } = this.portraitScene;
    const model = createTechModel(id);
    model.root.rotation.y = 0.35;
    model.armR.rotation.x = -0.25; // show what they carry
    scene.add(model.root);
    const r = this.renderer;
    const clear = r.getClearAlpha();
    r.setClearAlpha(0);
    r.setRenderTarget(target);
    r.clear();
    r.render(scene, camera);
    r.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    r.setRenderTarget(null);
    r.setClearAlpha(clear);
    scene.remove(model.root);
    model.root.traverse((o) => o.isMesh && o.material !== outlineMaterial && o.geometry.dispose());
    model.material.dispose();
    // WebGL rows run bottom to top.
    const g = canvas.getContext('2d');
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    g.putImageData(img, 0, 0);
    url = canvas.toDataURL();
    this.portraits.set(id, url);
    return url;
  }

  // Lights the scene for the sim's map (LOOKS).
  setMapLook(id) {
    this.mapId = id;
    const look = (this.look = LOOKS[id] ?? LOOKS.office);
    this.scene.background.set(look.bg);
    this.scene.fog.color.set(look.bg);
    this.hemi.color.set(look.sky);
    this.hemi.groundColor.set(look.ground);
    this.hemi.intensity = look.hemi;
    this.sun.color.set(look.sun);
    this.sun.intensity = look.sunI;
    this.flashlight.visible = !!look.dark;
    if (this.quality) this.applyQuality(this.quality);
  }

  // The flashlight's reach this frame: the map's radius, wobbling a little, and shrunk
  // while the Night Janitor has the lights out (eased down, then back up over the last
  // second), as the original's darkness overlay.
  updateFlashlight(x, z) {
    const tw = this.sim.map.twist;
    const twist = this.sim.twist;
    const wobble = 1 - tw.flicker * (Math.sin(performance.now() / 70) * 0.5 + 0.5) * (Math.random() < 0.03 ? 3 : 1);
    const dim = twist.dimT > 0 ? 1 - (1 - twist.dimScale) * Math.min(1, twist.dimT) : 1;
    const r = px(tw.radius) * wobble * dim;
    this.flashlight.position.set(x, 2.6, z);
    this.flashlight.distance = r * 1.1;
    this.flashlight.intensity = FLASHLIGHT * (0.6 + 0.4 * dim);
  }

  setCamera(opts) {
    this.rig.setOptions(opts);
  }

  resetCamera() {
    const p = this.sim.player;
    this.rig.snap(px(p.x), px(p.y + FOOT));
  }

  // Where a floor point (world px, at knee height) is on the page, in CSS px. Sets
  // out.x and out.y; returns false if it's behind the camera.
  toScreen(wx, wy, out) {
    const v = SCREEN_POINT.set(px(wx), 0.4, px(wy + FOOT)).project(this.rig.camera);
    out.x = ((v.x + 1) / 2) * this.size.w;
    out.y = ((1 - v.y) / 2) * this.size.h;
    return v.z < 1;
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    if (w === this.size.w && h === this.size.h) return;
    this.size.w = w;
    this.size.h = h;
    this.renderer.setSize(w, h, false);
    this.rig.resize(w / h);
  }

  // `alpha`: how far between the last two ticks to draw (0..1).
  render(dt, alpha) {
    this.resize();
    if (this.sim.charId !== this.techId) this.setTech(this.sim.charId);
    const p = this.sim.player;
    // Everything is drawn at its feet, which is where the simulation collides with furniture.
    const x = px(lerp(p.px, p.x, alpha));
    const z = px(lerp(p.py, p.y, alpha) + FOOT);
    this.updateTech(x, z, dt);
    this.rig.update(x, z, dt);
    this.sim.setView(this.rig.footprint.corners); // the spawner needs to know what's on screen
    if (this.sim.mapId !== this.mapId) this.setMapLook(this.sim.mapId);
    if (this.look.dark) this.updateFlashlight(x, z);
    this.floor.update(this.rig.footprint, this.rig.x, this.rig.z, this.sim.time);
    this.enemies.update(this.sim, alpha, this.rig.footprint, x, z);
    this.weapons.update(this.sim, alpha, dt, x, z);
    this.tools.update(this.sim, alpha, dt, x, z);
    this.pickups.update(this.sim, alpha, this.rig.footprint);
    this.fx.update(dt, this.sim.frozen);
    this.zones.update(this.sim);
    this.bosses.update(this.sim, alpha, dt);
    this.hazards.update(this.sim, alpha);

    // The sun's shadow box follows the camera, snapped to its texel grid so edges don't crawl.
    const step = (SHADOW_SPAN * 2) / this.sun.shadow.mapSize.x;
    const sx = Math.round(this.rig.x / step) * step;
    const sz = Math.round(this.rig.z / step) * step;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunOffset.x, this.sunOffset.y, sz + this.sunOffset.z);

    this.renderer.render(this.scene, this.rig.camera);
  }

  updateTech(x, z, dt) {
    const p = this.sim.player;
    const t = this.tech;
    t.root.position.set(x, 0, z);
    // Turn smoothly toward the facing direction, the short way round. Between shifts
    // (title, Clock In) the tech turns slowly on the spot instead, showing off.
    let d = p.facing - this.techYaw;
    d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
    if (this.sim.menu) this.techYaw += dt * 0.6;
    else this.techYaw += d * Math.min(1, TURN_RATE * dt);
    t.root.rotation.y = this.techYaw;
    // Burned out: keel over toward the camera.
    this.fall = this.sim.over && !this.sim.over.won ? Math.min(1, this.fall + dt * 2.5) : 0;
    t.root.rotation.x = (this.fall * this.fall * Math.PI) / 2.1;
    // Hurt: a white flash. PTO and comebacks (no damage): a soft golden pulse.
    const e = t.material.emissive;
    if (p.flash > 0) e.setRGB(0.9, 0.9, 0.9);
    else if (p.invuln > 0 && !this.sim.frozen) e.setRGB(0.35, 0.25, 0.05).multiplyScalar(0.6 + 0.4 * Math.sin(performance.now() / 90));
    else e.setRGB(0, 0, 0);
    // Walk cycle: legs and arms swing in opposition, a small bob, and settle when standing.
    const speed = Math.hypot(p.vx, p.vy) / p.def.speed;
    if (p.moving) this.walkPhase += dt * 10 * Math.max(0.6, speed);
    const swing = p.moving ? Math.sin(this.walkPhase) * 0.65 : 0;
    const k = Math.min(1, dt * 18);
    t.legL.rotation.x = lerp(t.legL.rotation.x, swing, k);
    t.legR.rotation.x = lerp(t.legR.rotation.x, -swing, k);
    t.armL.rotation.x = lerp(t.armL.rotation.x, -swing * 0.8, k);
    t.armR.rotation.x = lerp(t.armR.rotation.x, swing * 0.8, k);
    t.body.position.y = p.moving ? Math.abs(Math.cos(this.walkPhase)) * 0.06 : lerp(t.body.position.y, 0, k);
    this.blob.position.x = x;
    this.blob.position.z = z;
    this.sanity.position.set(x, 0.03, z + 0.62);
    this.sanityFill.scale.x = Math.max(0.0001, p.hp / p.maxHp);
  }
}
