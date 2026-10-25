// The tilted follow camera. A perspective camera with a narrow field of view looks down
// at the player at `tilt` degrees, far enough away to frame about as much floor as the
// original's view (viewHeight world px tall, at least 300 px wide on narrow portrait screens).
// It follows with the original's smoothing and shakes with its decay curve.

import * as THREE from 'three';
import { px } from './models.js';

export const CAMERA_DEFAULTS = {
  tilt: 55, // degrees below the horizon
  fov: 35, // vertical field of view, degrees
  viewHeight: 420, // world px of floor visible top to bottom (the original aims for ~480;
  // a little closer reads better in 3D, and the far edge shows more than this anyway)
  minViewWidth: 270, // ... but at least this much side to side (the original: 300)
  zoom: 1, // multiplies the distance (settings slider, for playtesting)
};

const LOOK_HEIGHT = 0.8; // aim at the tech's middle, not their feet

const ndc = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const v2 = new THREE.Vector2();

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(CAMERA_DEFAULTS.fov, 1, 0.5, 400);
    this.opts = { ...CAMERA_DEFAULTS };
    this.x = 0; // followed point, scene units
    this.z = 0;
    this.shakeAmount = 0; // world px, like the original
    this.shakeEnabled = true;
    this.distance = 40;
    // Visible floor in world px, for chunk culling and (later) the spawn ring.
    this.footprint = { x0: 0, y0: 0, x1: 0, y1: 0, radius: 0 };
  }

  setOptions(o) {
    Object.assign(this.opts, o);
    this.resize(this.camera.aspect);
  }

  resize(aspect) {
    const { fov, tilt, viewHeight, minViewWidth, zoom } = this.opts;
    const c = this.camera;
    c.fov = fov;
    c.aspect = aspect;
    c.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    // Floor seen top to bottom ~ 2 d tan(fov/2) / sin(tilt); side to side ~ 2 d tan(fov/2) aspect.
    const byHeight = (px(viewHeight) * Math.sin(THREE.MathUtils.degToRad(tilt))) / (2 * t);
    const byWidth = px(minViewWidth) / (2 * t * aspect);
    this.distance = Math.max(byHeight, byWidth) * zoom;
  }

  snap(x, z) {
    this.x = x;
    this.z = z;
  }

  shake(amount) {
    if (this.shakeEnabled) this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  // Follows (x, z) in scene units.
  update(x, z, dt) {
    const k = 1 - Math.exp(-12 * dt);
    this.x += (x - this.x) * k;
    this.z += (z - this.z) * k;
    let ox = 0;
    let oz = 0;
    if (this.shakeAmount > 0.05) {
      ox = px((Math.random() * 2 - 1) * this.shakeAmount);
      oz = px((Math.random() * 2 - 1) * this.shakeAmount);
      this.shakeAmount *= Math.exp(-10 * dt);
    } else this.shakeAmount = 0;
    const a = THREE.MathUtils.degToRad(this.opts.tilt);
    const tx = this.x + ox;
    const tz = this.z + oz;
    const c = this.camera;
    c.position.set(tx, LOOK_HEIGHT + Math.sin(a) * this.distance, tz + Math.cos(a) * this.distance);
    c.lookAt(tx, LOOK_HEIGHT, tz);
    c.updateMatrixWorld();
    this.updateFootprint();
  }

  // Where the screen corners land on the floor (world px). The far edge is wider than
  // the near one; this keeps the bounding box and the farthest corner from the target.
  updateFootprint() {
    const f = this.footprint;
    f.x0 = f.y0 = Infinity;
    f.x1 = f.y1 = -Infinity;
    f.radius = 0;
    for (const [nx, ny] of ndc) {
      ray.setFromCamera(v2.set(nx, ny), this.camera);
      // A corner above the horizon (very shallow tilts) is clamped to 120 units out.
      if (!ray.ray.intersectPlane(ground, hit)) hit.copy(ray.ray.direction).multiplyScalar(120).add(ray.ray.origin);
      const wx = hit.x * 16;
      const wy = hit.z * 16;
      f.x0 = Math.min(f.x0, wx);
      f.x1 = Math.max(f.x1, wx);
      f.y0 = Math.min(f.y0, wy);
      f.y1 = Math.max(f.y1, wy);
      f.radius = Math.max(f.radius, Math.hypot(wx - this.x * 16, wy - this.z * 16));
    }
  }
}
