// Sora Service Worker v1.0.0
// Handles caching for offline support and performance optimization

const CACHE_NAME = 'sora-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/dashboard',
    '/assets/styles.css',
    '/assets/app.js',
    '/assets/dailies.js',
    '/assets/dailies.css',
    '/assets/logo.png',
    '/assets/favicon.ico',
    '/assets/images/banner.png',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-72x72.png',
    '/manifest.json'
];

const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[SW] Failed to cache assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Removing old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip external requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // Handle API requests with network-first strategy
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Handle static assets with cache-first strategy
    event.respondWith(cacheFirstStrategy(request));
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            // Return cached response immediately, but fetch fresh copy in background
            fetchAndCache(request).catch(() => { });
            return cachedResponse;
        }

        // Not in cache, fetch from network
        return await fetchAndCache(request);
    } catch (error) {
        console.error('[SW] Cache-first failed:', error);
        return createOfflineFallback(request);
    }
}

// Network-first strategy for API requests
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful API responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Return empty JSON for API failures
        return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Fetch and cache a request
async function fetchAndCache(request) {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, networkResponse.clone());
    }

    return networkResponse;
}

// Create offline fallback response
function createOfflineFallback(request) {
    const url = new URL(request.url);

    // For HTML pages, return a simple offline page
    if (request.headers.get('Accept')?.includes('text/html')) {
        return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sora - Offline</title>
        <style>
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
            padding: 20px;
          }
          .offline-container {
            max-width: 400px;
          }
          h1 {
            color: #6366f1;
            font-size: 2rem;
            margin-bottom: 1rem;
          }
          p {
            color: #94a3b8;
            line-height: 1.6;
          }
          .retry-btn {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            margin-top: 1rem;
          }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <h1>📡 You're Offline</h1>
          <p>It looks like you've lost your internet connection. Some features may not work until you're back online.</p>
          <button class="retry-btn" onclick="window.location.reload()">Retry Connection</button>
        </div>
      </body>
      </html>
    `, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // For other requests, return a 503
    return new Response('Service Unavailable', { status: 503 });
}

// Handle push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'Time to check your dailies!',
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/dashboard',
                gameId: data.gameId,
                serverName: data.serverName
            },
            actions: [
                { action: 'open', title: 'Open Sora' },
                { action: 'dismiss', title: 'Dismiss' }
            ],
            tag: data.tag || 'sora-notification',
            renotify: true
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Sora', options)
        );
    } catch (error) {
        console.error('[SW] Push notification error:', error);
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(urlToOpen);
                        return client.focus();
                    }
                }
                // Open new window if no existing window
                return clients.openWindow(urlToOpen);
            })
    );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[SW] Cache cleared');
        });
    }

    if (event.data.type === 'SCHEDULE_NOTIFICATION') {
        const { title, body, delay, gameId, serverName } = event.data;

        setTimeout(() => {
            self.registration.showNotification(title, {
                body,
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                vibrate: [100, 50, 100],
                data: { url: '/dashboard', gameId, serverName },
                tag: `sora-timer-${gameId}-${serverName}`,
                renotify: true
            });
        }, delay);
    }
});

console.log('[SW] Service worker loaded');
