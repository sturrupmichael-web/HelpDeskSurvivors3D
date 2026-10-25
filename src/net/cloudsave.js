// Keeps the save (src/sim/meta.js) in step with the player's cloud save in Supabase's
// `saves_3d` table (supabase/001_3d.sql; the 2D game's `saves` row is left alone).
// Ported from the original's src/game/cloudsave.js. Remembers what was last synced, so it can tell which side changed:
// only this device -> upload, only the cloud -> download, both -> ask the player.
// Uploads are guarded by the cloud copy's timestamp, so two devices can't silently
// overwrite each other.

import { account } from './account.js';
import { LEADERBOARD as LB } from '../../data/leaderboard.js';

const KEY = 'helpdesk-survivors-3d.sync.v1';

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveState(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: we'll just compare again next time.
  }
}

// JSON with sorted keys: the database doesn't keep key order.
const canon = (v) =>
  Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
  : JSON.stringify(v ?? null);

// Short fingerprint of a save, to spot changes. The format version is left out, so a save
// that was only upgraded on load (src/sim/meta.js) doesn't count as changed.
function fingerprint(data) {
  const { version, ...rest } = data ?? {};
  const str = canon(rest);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

// What the "which progress do you want to keep?" screen shows for each side.
export function saveSummary(d) {
  return {
    shifts: d.shifts ?? 0,
    wins: d.wins ?? 0,
    pay: d.pay ?? 0,
    characters: d.unlocked?.length ?? 1,
    achievements: Object.keys(d.achievements ?? {}).length,
  };
}

export class CloudSave {
  constructor(meta) {
    this.meta = meta;
    this.status = 'off'; // off | syncing | synced | offline | conflict
    this.syncedAt = 0;
    this.onConflict = null; // (local, cloud, choose(side)) => void, set by the screens
    this.onChange = null; // called after a download replaced the local save
    this.busy = null;
    this.timer = 0;
    meta.onSave = () => this.soon();
  }

  // Upload a few seconds after the last change, so a burst of saves is one request.
  soon() {
    if (!account.user) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(), 3000);
  }

  sync() {
    this.busy ??= this.run().finally(() => (this.busy = null));
    return this.busy;
  }

  async run() {
    const user = account.user;
    if (!user) return (this.status = 'off');
    this.status = 'syncing';
    const r = await account.rest(`${LB.saves}?select=data,updated_at`);
    if (!r.ok) return (this.status = 'offline');
    const cloud = r.body[0];
    const local = this.meta.data;
    const st = loadState();
    const same = st.user === user.id;
    if (!cloud) return this.upload(null);
    if (fingerprint(cloud.data) === fingerprint(local)) return this.done(cloud.updated_at);
    const localChanged = !same || fingerprint(local) !== st.hash;
    const cloudChanged = !same || cloud.updated_at !== st.at;
    // A device that has never played just takes the account's progress.
    if (!same && (local.shifts ?? 0) === 0) return this.download(cloud);
    if (localChanged && !cloudChanged) return this.upload(cloud.updated_at);
    if (cloudChanged && !localChanged) return this.download(cloud);
    this.status = 'conflict';
    if (this.onConflict) {
      this.onConflict(saveSummary(local), saveSummary(cloud.data), (side) =>
        side === 'cloud' ? this.download(cloud) : this.upload(cloud.updated_at),
      );
    }
    return this.status;
  }

  // Writes this device's save to the cloud. `prevAt` is the cloud copy we expect to
  // replace (null = no cloud save yet); if it changed meanwhile, start over.
  async upload(prevAt) {
    const body = JSON.stringify({ data: this.meta.data });
    const headers = { Prefer: 'return=representation' };
    const r = prevAt
      ? await account.rest(`${LB.saves}?user_id=eq.${account.user.id}&updated_at=eq.${encodeURIComponent(prevAt)}`, { method: 'PATCH', body, headers })
      : await account.rest(LB.saves, { method: 'POST', body, headers });
    if (r.ok && r.body?.[0]) return this.done(r.body[0].updated_at);
    if (r.ok || r.status === 409) return this.run(); // someone else saved first
    return (this.status = 'offline');
  }

  download(cloud) {
    this.meta.replace(cloud.data, true);
    this.onChange?.();
    return this.done(cloud.updated_at);
  }

  done(at) {
    saveState({ user: account.user.id, at, hash: fingerprint(this.meta.data) });
    this.syncedAt = Date.now();
    return (this.status = 'synced');
  }

  // After signing out: forget which account this device was synced with.
  reset() {
    clearTimeout(this.timer);
    saveState({});
    this.status = 'off';
  }
}
