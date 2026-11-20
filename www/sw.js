// Service worker: makes the web version installable and playable offline
// (iPhone "Add to Home Screen", Android "Install app"). Files are served from
// the cache instantly and refreshed in the background, so a new version is
// picked up on the next start. Online multiplayer still needs the Internet.
const CACHE = 'dynablast-v2';
const CORE = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon.png',
  './js/main.js', './js/config.js',
  './js/core/rng.js', './js/core/storage.js',
  './js/game/board.js', './js/game/maps.js', './js/game/powerups.js', './js/game/player.js', './js/game/bomb.js',
  './js/game/explosion.js', './js/game/monsters.js', './js/game/boss.js', './js/game/campaign.js', './js/game/game.js',
  './js/ai/danger.js', './js/ai/bot.js',
  './js/input/input.js', './js/session/controllers.js', './js/session/session.js',
  './js/net/peer.js', './js/net/relay.js', './js/net/snapshot.js',
  './js/render/sprites.js', './js/render/particles.js', './js/render/extras.js', './js/render/renderer.js',
  './js/audio/audio.js', './js/audio/music.js',
  './js/ui/ui.js', './js/ui/hud.js',
];
// third-party files worth keeping offline (pixel font, network library)
const EXTERNAL = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  if (!own && !EXTERNAL.test(req.url)) return; // e.g. the PeerJS signalling server
  const fresh = caches.open(CACHE).then((cache) => fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }));
  e.waitUntil(fresh.catch(() => {}));
  e.respondWith(caches.match(req, { ignoreSearch: own }).then((cached) => cached || fresh));
});
