// Guinea Pig Trench — Service Worker for PWA
// Enables offline functionality, instant loading, and network resilience
// Caches: index.html, game-shell.js, CSS, SVG files, and core assets

const CACHE_NAME = 'gpt-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/guineapigtrench.html',
  '/js/game-shell.js',
  '/js/router.js',
  '/js/music.js',
  '/js/constants.js',
  '/js/config.js',
  '/js/app.js',
  '/css/style.css',
  '/css/xeno_brutalist_kore.css',
  '/css/SOVEREIGN_KORE.css',
  '/assets/sluice-gate.svg',
  '/assets/favicon.ico',
  '/assets/sluice-gate-32.png',
  '/assets/sluice-gate-192.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete, skipping waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[ServiceWorker] Cache addAll failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating version:', CACHE_NAME);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name.startsWith('gpt-'))
            .map((name) => {
              console.log('[ServiceWorker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activation complete, claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Skip non-GET requests (POST, etc.)
  if (request.method !== 'GET') {
    return;
  }
  
  // Strategy: Cache First, then Network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[ServiceWorker] Serving from cache:', request.url);
          
          // Update cache in background (stale-while-revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {
              // Network failed, but we have cache - that's fine
            });
          
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        console.log('[ServiceWorker] Fetching from network:', request.url);
        return fetch(request)
          .then((networkResponse) => {
            // Don't cache error responses or non-success status codes
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Clone the response (streams can only be consumed once)
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch((err) => {
            console.warn('[ServiceWorker] Fetch failed:', err);
            
            // Offline fallback for HTML pages
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            // Return offline placeholder for other resources
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_ASSETS':
      // Dynamically cache additional assets (e.g., game files, music)
      caches.open(CACHE_NAME)
        .then((cache) => {
          return cache.addAll(payload.urls);
        })
        .then(() => {
          event.ports[0]?.postMessage({ success: true });
        })
        .catch((err) => {
          event.ports[0]?.postMessage({ success: false, error: err.message });
        });
      break;
      
    case 'CLEAR_CACHE':
      caches.keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .then(() => {
          event.ports[0]?.postMessage({ success: true });
        });
      break;
      
    case 'GET_CACHE_STATUS':
      caches.keys()
        .then((names) => {
          return Promise.all(
            names.map((name) => {
              return caches.open(name)
                .then((cache) => cache.keys())
                .then((requests) => ({ name, count: requests.length }));
            })
          );
        })
        .then((status) => {
          event.ports[0]?.postMessage({ type: 'CACHE_STATUS', payload: status });
        });
      break;
      
    default:
      console.warn('[ServiceWorker] Unknown message type:', type);
  }
});

console.log('[ServiceWorker] Script loaded');
