// The 3D view of the simulation: scene, lights, shadows, camera, and the models that
// mirror sim state each frame. It only reads the simulation, never changes it.

import * as THREE from 'three';
import { CameraRig } from './cameraRig.js';
import { FloorView } from './floor.js';
import { createTechModel, blobShadowGeometry, outlineMaterial, px } from './models.js';
import { EnemyView } from './enemies.js';
import { WeaponView } from './weapons.js';
import { PickupView } from './pickups.js';
import { FxView } from './fx.js';
import { ZoneView } from './zones.js';
import { FOOT } from '../sim/player.js';

const BACKGROUND = '#1a1c2c'; // the original's near-black navy
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

    this.tech = createTechModel();
    this.scene.add(this.tech.root);
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
    this.pickups = new PickupView(this.scene);
    this.fx = new FxView(this.scene);
    this.zones = new ZoneView(this.scene);
    this.techYaw = 0;
    this.walkPhase = 0;

    this.size = { w: 0, h: 0 };
    this.applyQuality({ shadows: true, resolution: 'high' });
    this.resetCamera();
  }

  // { shadows: bool, outlines: bool, resolution: 'low' | 'medium' | 'high' }
  applyQuality({ shadows, outlines = true, resolution }) {
    outlineMaterial.visible = outlines; // outlines redraw every person, so they're optional
    const r = this.renderer;
    r.setPixelRatio((RESOLUTIONS[resolution] ?? RESOLUTIONS.high)());
    r.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
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
    const p = this.sim.player;
    // Everything is drawn at its feet, which is where the simulation collides with furniture.
    const x = px(lerp(p.px, p.x, alpha));
    const z = px(lerp(p.py, p.y, alpha) + FOOT);
    this.updateTech(x, z, dt);
    this.rig.update(x, z, dt);
    this.sim.setView(this.rig.footprint.corners); // the spawner needs to know what's on screen
    this.floor.update(this.rig.footprint, this.rig.x, this.rig.z);
    this.enemies.update(this.sim, alpha, this.rig.footprint);
    this.weapons.update(this.sim, alpha, dt, x, z);
    this.pickups.update(this.sim, alpha, this.rig.footprint);
    this.fx.update(dt, this.sim.frozen);
    this.zones.update(this.sim);

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
    // Turn smoothly toward the facing direction, the short way round.
    let d = p.facing - this.techYaw;
    d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
    this.techYaw += d * Math.min(1, TURN_RATE * dt);
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
