// Draws the bosses and what they are about to do. Bosses are few, so each is a real model
// with moving parts (models.js), posed from the simulation's state every frame: walk cycles,
// the Executive's pointing and phone poses, the Major Incident's glaring LCD, blinking LEDs
// and spinning siren. Under them: a red glow in their second phase, and the floor
// telegraphs the original drew in each boss's drawUnder (the Incident's ring with its safe
// gap in green and its spiral arms, the Executive's charge lane and slide-deck cone).
// Telegraphs are drawn over everything (no depth test), like the original drew them over
// the horde, so a crowd never hides them.

import * as THREE from 'three';
import { createExecutiveModel, createIncidentModel, blobShadowGeometry, BOSS_SCALE, px } from './models.js';
import { FOOT } from '../sim/player.js';
import * as INC from '../sim/behaviors/incidentBoss.js';
import * as EXE from '../sim/behaviors/executiveBoss.js';

const BUILDERS = { executive: createExecutiveModel, incident: createIncidentModel };
const RED = '#b13e53';
const GREEN = '#38b764';
const EDGE = '#ffcd75';
const TURN_RATE = 8;
const EDGE_W = 0.09; // telegraph border width, scene units

const lerp = (a, b, t) => a + (b - a) * t;
const colors = new Map(); // CSS color -> THREE.Color, made once per color
const color = (css) => {
  let c = colors.get(css);
  if (!c) colors.set(css, (c = new THREE.Color(css)));
  return c;
};
const floorZ = (y) => px(y + FOOT); // attacks are aimed at the tech's center; draw at their feet

// Border strength for a telegraph that blinks in its last moments, as in the original.
const blink = (time, on = 0.9, off = 0.5) => ((time * 10) & 1 ? on : off);

function overlayMaterial() {
  return new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
}

// Telegraph shapes, all flat on the floor and pointing along +X, so rotation.y = -angle
// turns them to a simulation angle (x right, y down the screen).
const LANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
const sectors = new Map(); // angle -> unit-radius wedge centered on +X
const arcs = new Map(); // `${inner}/${angle}` -> unit ring missing a centered gap of 2PI - angle
function sector(angle) {
  let g = sectors.get(angle);
  if (!g) sectors.set(angle, (g = new THREE.CircleGeometry(1, 32, -angle / 2, angle).rotateX(-Math.PI / 2)));
  return g;
}
function arc(inner, angle) {
  const key = inner + '/' + angle;
  let g = arcs.get(key);
  if (!g) arcs.set(key, (g = new THREE.RingGeometry(inner, 1, 48, 1, -angle / 2, angle).rotateX(-Math.PI / 2)));
  return g;
}

// A pool of overlay meshes, handed out each frame and hidden when not used.
class Overlays {
  constructor(scene, n) {
    this.meshes = [];
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(LANE, overlayMaterial());
      mesh.renderOrder = 5;
      mesh.frustumCulled = false;
      mesh.visible = false;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.used = 0;
  }

  begin() {
    this.used = 0;
  }

  end() {
    for (let i = this.used; i < this.meshes.length; i++) this.meshes[i].visible = false;
  }

  // A shape at (x, z) scene units, turned to simulation angle `a`, scaled (sx, sz).
  add(geo, css, opacity, x, z, a, sx, sz = sx) {
    const mesh = this.meshes[this.used++];
    if (!mesh) return null;
    mesh.geometry = geo;
    mesh.material.color.copy(color(css));
    mesh.material.opacity = opacity;
    mesh.position.set(x, 0.03, z);
    mesh.rotation.set(0, -a, 0);
    mesh.scale.set(sx, 1, sz);
    mesh.visible = true;
    return mesh;
  }

  // A filled lane `len` long and `w` wide from (x, z) at angle `a`, with a bright border.
  lane(x, z, a, len, w, css, fill, edge) {
    this.add(LANE, css, fill, x, z, a, len, w);
    const nx = -Math.sin(a) * (w / 2);
    const nz = Math.cos(a) * (w / 2);
    this.add(LANE, EDGE, edge, x + nx, z + nz, a, len, EDGE_W);
    this.add(LANE, EDGE, edge, x - nx, z - nz, a, len, EDGE_W);
  }

  // A filled wedge of radius r and opening `spread`, with a bright rim and sides.
  wedge(x, z, a, r, spread, css, fill, edge) {
    this.add(sector(spread), css, fill, x, z, a, r);
    this.add(arc(1 - EDGE_W / r, spread), EDGE, edge, x, z, a, r);
    this.add(LANE, EDGE, edge, x, z, a - spread / 2, r, EDGE_W);
    this.add(LANE, EDGE, edge, x, z, a + spread / 2, r, EDGE_W);
  }
}

export class BossView {
  constructor(scene) {
    this.scene = scene;
    this.models = {}; // sprite id -> models made so far (more than one if a playtest calls two)
    this.used = {}; // sprite id -> models in use this frame
    this.overlays = new Overlays(scene, 40);
    const disc = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
    this.shadowGeo = blobShadowGeometry(1);
    this.shadowMat = new THREE.MeshBasicMaterial({ color: '#0a0c18', transparent: true, opacity: 0.35, depthWrite: false });
    this.glowGeo = disc;
    this.glowMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, depthWrite: false });
  }

  model(id, n) {
    const list = (this.models[id] ??= []);
    if (!list[n]) {
      const m = BUILDERS[id]();
      m.root.scale.setScalar(BOSS_SCALE[id]);
      m.shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      m.shadow.renderOrder = -1;
      m.glow = new THREE.Mesh(this.glowGeo, this.glowMat);
      m.glow.renderOrder = -1;
      m.yaw = 0;
      this.scene.add(m.root, m.shadow, m.glow);
      list[n] = m;
    }
    return list[n];
  }

  update(sim, alpha, dt) {
    const used = this.used;
    for (const id in BUILDERS) used[id] = 0;
    this.overlays.begin();
    const pool = sim.enemies;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.items[i];
      if (e.dead || !e.def.boss || !BUILDERS[e.def.sprite]) continue;
      const id = e.def.sprite;
      const m = this.model(id, used[id]++);
      const x = px(lerp(e.px, e.x, alpha));
      const z = px(lerp(e.py, e.y, alpha) + e.foot);
      m.root.visible = m.shadow.visible = true;
      m.root.position.set(x, 0, z);
      // Turn toward where it's going, or where it's aiming.
      let want = e.facing;
      if (id === 'executive' && e.ai.state !== EXE.WALK && e.ai.state !== EXE.POSE) want = Math.atan2(e.ai.aimX, e.ai.aimY);
      let d = want - m.yaw;
      d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
      m.yaw += d * Math.min(1, TURN_RATE * dt);
      m.root.rotation.y = m.yaw;
      const f = e.flash > 0 ? 0.35 : 0; // bosses are hit constantly: a soft blink keeps them readable
      m.material.emissive.setRGB(f, f, f);
      const r = px(e.r) * 1.25;
      m.shadow.position.set(x, 0.012, z);
      m.shadow.scale.set(r, 1, r);
      m.glow.visible = e.angry;
      if (e.angry) {
        m.glow.position.set(x, 0.016, z);
        m.glow.scale.set(r * 1.5, 1, r * 1.5);
        this.glowMat.opacity = 0.28 + 0.14 * Math.sin(sim.time * 8);
      }
      if (id === 'executive') this.poseExecutive(m, e);
      else this.poseIncident(m, e, sim.time);
      if (!sim.over) {
        if (id === 'executive') this.executiveTelegraphs(e, sim.time);
        else this.incidentTelegraphs(e, sim.time);
      }
    }
    for (const id in this.models) {
      const list = this.models[id];
      for (let n = used[id]; n < list.length; n++) list[n].root.visible = list[n].shadow.visible = list[n].glow.visible = false;
    }
    this.overlays.end();
  }

  poseExecutive(m, e) {
    const charging = e.ai.state === EXE.CHARGING;
    const t = e.animT * (charging ? 9 : 6);
    const swing = Math.sin(t) * (charging ? 0.9 : 0.5);
    m.legL.rotation.x = swing;
    m.legR.rotation.x = -swing;
    m.body.position.y = Math.abs(Math.cos(t)) * 0.05;
    m.body.rotation.x = charging ? 0.25 : 0; // leaning into the sprint
    const pose = e.pose === EXE.POINT ? 1 : e.pose === EXE.PHONE ? 2 : 0;
    for (let k = 0; k < 3; k++) m.arms[k].visible = k === pose;
    m.arms[0].rotation.x = swing * 0.8;
    const shout = e.anim === 'attack';
    m.mouths[0].visible = !shout;
    m.mouths[1].visible = shout;
  }

  poseIncident(m, e, time) {
    const attack = e.ai.state !== INC.WALK;
    const frame = Math.floor(e.animT * 4) & 1;
    m.eyes.material.color.copy(color(attack ? EDGE : RED));
    for (let k = 0; k < m.leds.length; k++) m.leds[k].material.color.copy(color(attack || (k + frame) % 2 ? EDGE : RED));
    m.siren.material.color.copy(color(attack || frame ? RED : EDGE));
    m.beacon.rotation.y = time * (attack ? 14 : 4);
    // It rattles on its cart while it rings, and hops a little as it rolls.
    const ringing = e.ai.state === INC.RINGING || e.ai.state === INC.SPIRAL_TELL;
    m.body.position.x = ringing ? Math.sin(time * 60) * 0.04 : 0;
    m.body.position.y = ringing ? Math.abs(Math.sin(time * 30)) * 0.06 : Math.abs(Math.sin(e.animT * 6)) * 0.03;
  }

  // The ring's red edge with the way out in green, or the spiral's arms turning.
  incidentTelegraphs(e, time) {
    const o = this.overlays;
    const p = e.params;
    const x = px(e.x);
    const z = floorZ(e.y + INC.MOUTH_Y);
    if (e.ai.state === INC.RINGING) {
      const half = (p.ringGap * Math.PI) / p.ringBullets;
      const a = e.ai.gapAngle;
      const edge = blink(time, 0.9, 0.6);
      o.add(sector(half * 2), GREEN, 0.22, x, z, a, px(160));
      o.add(arc(0.86, Math.PI * 2 - half * 2), RED, edge, x, z, a + Math.PI, px(48));
      o.add(arc(0.86, half * 2), GREEN, 0.9, x, z, a, px(48));
    } else if (e.ai.state === INC.SPIRAL_TELL) {
      const sp = p.phase2.spiral;
      const k = 1 - e.ai.stateT / sp.telegraph;
      for (let i = 0; i < sp.arms; i++) {
        const a = e.ai.spiralA + (i / sp.arms) * Math.PI * 2 - sp.turn * 0.4 * (1 - k);
        o.lane(x, z, a, px(170), px(10), RED, 0.2 + 0.3 * k, blink(time));
      }
    }
  }

  // The charge lane from its feet, or the cone it is about to throw slide decks into.
  executiveTelegraphs(e, time) {
    const o = this.overlays;
    const p = e.params;
    const a = Math.atan2(e.ai.aimY, e.ai.aimX);
    if (e.ai.state === EXE.CHARGE_TELL) {
      const k = 1 - e.ai.stateT / p.charge.telegraph;
      o.lane(px(e.x), floorZ(e.y), a, px(p.charge.speed * p.charge.time), px(e.r * 2), RED, 0.22 + 0.25 * k, blink(time));
    } else if (e.ai.state === EXE.CONE_TELL) {
      const k = 1 - e.ai.stateT / p.cone.telegraph;
      o.wedge(px(e.x), floorZ(e.y + EXE.HAND_Y), a, px(170), p.cone.spread, RED, 0.2 + 0.25 * k, blink(time));
    }
  }
}
