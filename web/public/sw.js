/**
 * Service Worker for Ferias Chile PWA.
 *
 * Strategy:
 *  - App shell (HTML, JS, CSS) → Cache-first, updated in background.
 *  - Data files (ferias.json, stats.json) → Cache-first, refreshed on activate.
 *  - Map tiles → Cache-first with expiry (stale-while-revalidate).
 *  - Fonts → Cache-first, long-lived.
 */

const CACHE_VERSION = 'ferias-v1';
const DATA_CACHE   = 'ferias-data-v1';
const TILE_CACHE   = 'ferias-tiles-v1';
const FONT_CACHE   = 'ferias-fonts-v1';
const MAX_TILES    = 500;       // keep tile cache bounded

// App shell — precached on install
const PRECACHE_URLS = [
  '/ferias-chile/',
  '/ferias-chile/index.html',
  '/ferias-chile/data/ferias.json',
  '/ferias-chile/data/stats.json',
];

// ---- INSTALL ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately (don't wait for old tabs to close)
  self.skipWaiting();
});

// ---- ACTIVATE ----
self.addEventListener('activate', (event) => {
  // Clean old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_VERSION, DATA_CACHE, TILE_CACHE, FONT_CACHE].includes(key))
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ---- FETCH ----
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Map tiles → stale-while-revalidate with bounded cache
  if (isTileRequest(url)) {
    event.respondWith(tileStrategy(event.request));
    return;
  }

  // Google Fonts → cache-first, long-lived
  if (isFontRequest(url)) {
    event.respondWith(fontStrategy(event.request));
    return;
  }

  // Data files → cache-first
  if (isDataRequest(url)) {
    event.respondWith(cacheFirst(event.request, DATA_CACHE));
    return;
  }

  // App shell → cache-first with network fallback
  event.respondWith(cacheFirst(event.request, CACHE_VERSION));
});


// ---- Strategies ----

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/ferias-chile/index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function tileStrategy(request) {
  // Try cache first
  const cached = await caches.match(request);
  if (cached) {
    // Revalidate in background
    fetchAndCache(request, TILE_CACHE);
    return cached;
  }

  // Network fetch
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(TILE_CACHE);
      cache.put(request, response.clone());
      trimCache(TILE_CACHE, MAX_TILES);
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

async function fontStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(FONT_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
  } catch { /* silent */ }
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    // Remove oldest entries (FIFO)
    const excess = keys.length - max;
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// ---- Matchers ----

function isTileRequest(url) {
  return (
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('openfreemap.org') ||
    url.hostname.includes('stadiamaps.com') ||
    // MapLibre glyph requests
    url.hostname.includes('demotiles.maplibre.org')
  );
}

function isFontRequest(url) {
  return (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );
}

function isDataRequest(url) {
  return (
    url.pathname.includes('/data/ferias.json') ||
    url.pathname.includes('/data/stats.json')
  );
}
