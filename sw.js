// Service worker, like the original's: lets the installed game start and play offline, and
// start fast on a weak signal. The game is one page, so there's little to keep:
//   - Icons rarely change: they come straight from the cache, fetched only when missing.
//   - Everything else (the page, the manifest) is network-first, so updates reach players
//     as soon as they're online, but falls back to the cached copy if the network hasn't
//     answered within NETWORK_WAIT (or is down).
// The online leaderboard (another site) is never cached.

const PAGES = 'hds3d-pages';
const ASSETS = 'hds3d-assets';
const NETWORK_WAIT = 3000; // ms
const CORE = ['./', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(PAGES).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(url.pathname.includes('/icons/') ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  net.catch(() => {}); // a late failure after a cache answer is fine
  const slow = new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT, null));
  try {
    const res = await Promise.race([net, slow]);
    if (res) return res;
  } catch {
    // Offline: fall through to the cache.
  }
  const hit = (await cache.match(req, { ignoreSearch: true })) ?? (req.mode === 'navigate' ? await cache.match('./') : null);
  if (hit) return hit;
  return net.catch(() => Response.error()); // nothing cached: keep waiting for the network
}
