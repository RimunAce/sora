// Sora Service Worker v3.0.0
// Enhanced offline support, image optimization, and performance optimization

const CACHE_VERSION = 'v5';
const CACHE_NAME = `sora-static-cache-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `sora-image-cache-${CACHE_VERSION}`;
const API_CACHE_NAME = `sora-api-cache-${CACHE_VERSION}`;

// Static assets to precache
const STATIC_ASSETS = [
    '/',
    '/dashboard',
    '/offline',
    '/offline.html',
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

// Image file extensions to cache with image strategy
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif'];

// Cache size limits
const IMAGE_CACHE_LIMIT = 100;
const API_CACHE_LIMIT = 50;
const STATIC_CACHE_LIMIT = 50;

// Cache expiry (24 hours for API, 7 days for images)
const API_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const IMAGE_CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker v3.0.0...');
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME)
                .then((cache) => {
                    console.log('[SW] Caching static assets');
                    return cache.addAll(STATIC_ASSETS);
                }),
            caches.open(IMAGE_CACHE_NAME)
                .then((cache) => {
                    console.log('[SW] Preparing image cache');
                    // Pre-cache banner image
                    return cache.add('/assets/images/banner.png').catch(() => {
                        console.log('[SW] Failed to pre-cache banner image');
                    });
                })
        ])
        .then(() => {
            console.log('[SW] Installation complete, skipping waiting');
            return self.skipWaiting();
        })
        .catch((error) => {
            console.error('[SW] Failed during installation:', error);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker v3.0.0...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                const legacyCaches = cacheNames.filter((name) => {
                    // Delete old cache versions
                    if (name.startsWith('sora-cache-') && name !== CACHE_NAME) return true;
                    if (name.startsWith('sora-dynamic-') && name !== API_CACHE_NAME) return true;
                    if (name.startsWith('sora-image-') && name !== IMAGE_CACHE_NAME) return true;
                    return false;
                });
                
                console.log('[SW] Removing old caches:', legacyCaches);
                return Promise.all(
                    legacyCaches.map((name) => {
                        console.log('[SW] Deleting cache:', name);
                        return caches.delete(name);
                    })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete, claiming clients');
                return self.clients.claim();
            })
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

    // Handle Font Awesome CDN resources with cache-first strategy
    if (url.origin === 'https://cdnjs.cloudflare.com' && url.pathname.includes('font-awesome')) {
        event.respondWith(cacheFirstCDN(request));
        return;
    }

    // Skip other external requests
    if (url.origin !== self.location.origin) {
        return;
    }

    // Handle API requests with stale-while-revalidate strategy
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(staleWhileRevalidate(request, API_CACHE_NAME, API_CACHE_LIMIT, API_CACHE_EXPIRY_MS));
        return;
    }

    // Handle image requests with cache-first strategy
    if (IMAGE_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
        event.respondWith(cacheFirstWithExpiry(request, IMAGE_CACHE_NAME, IMAGE_CACHE_LIMIT, IMAGE_CACHE_EXPIRY_MS));
        return;
    }

    // Handle static assets with cache-first strategy
    event.respondWith(cacheFirstWithExpiry(request, CACHE_NAME, STATIC_CACHE_LIMIT, null));
});

// Cache-first strategy with expiry for static assets and images
async function cacheFirstWithExpiry(request, cacheName, sizeLimit, expiryMs) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            // Check if cache is expired
            const cachedTime = getCacheTimestamp(cachedResponse);
            if (cachedTime && expiryMs) {
                const isExpired = (Date.now() - cachedTime) > expiryMs;
                if (!isExpired) {
                    // Return cached response, fetch fresh in background
                    fetchAndCache(request, cacheName).catch(() => { });
                    return cachedResponse;
                }
            } else {
                // No expiry or timestamp, return cached
                fetchAndCache(request, cacheName).catch(() => { });
                return cachedResponse;
            }
        }

        // Not in cache or expired, fetch from network
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            await cache.put(request, networkResponse.clone());
            await trimCache(cacheName, sizeLimit);
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Cache-first failed:', error);
        return createOfflineFallback(request);
    }
}

// Get timestamp from cached response
function getCacheTimestamp(response) {
    const cachedTime = response.headers.get('x-cache-timestamp');
    return cachedTime ? parseInt(cachedTime, 10) : null;
}

// Stale-while-revalidate strategy for API requests
async function staleWhileRevalidate(request, cacheName, sizeLimit, expiryMs) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Always fetch from network in background
    const fetchPromise = fetch(request)
        .then(async (networkResponse) => {
            if (networkResponse.ok) {
                // Add timestamp header
                const responseClone = networkResponse.clone();
                const headers = new Headers(networkResponse.headers);
                headers.set('x-cache-timestamp', Date.now().toString());
                
                const newResponse = new Response(await responseClone.blob(), {
                    status: networkResponse.status,
                    statusText: networkResponse.statusText,
                    headers
                });
                
                await cache.put(request, newResponse);
                await trimCache(cacheName, sizeLimit);
            }
            return networkResponse;
        })
        .catch((error) => {
            console.log('[SW] Background fetch failed:', error);
        });

    // Return cached response if available and not expired
    if (cachedResponse) {
        const cachedTime = getCacheTimestamp(cachedResponse);
        if (cachedTime && expiryMs) {
            const isExpired = (Date.now() - cachedTime) > expiryMs;
            if (!isExpired) {
                return cachedResponse;
            }
        } else {
            return cachedResponse;
        }
    }

    // Wait for network response
    const networkResponse = await fetchPromise;
    if (networkResponse) {
        return networkResponse;
    }

    // Return offline error
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Fetch and cache a request (generic)
async function fetchAndCache(request, cacheName = CACHE_NAME) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            const headers = new Headers(networkResponse.headers);
            headers.set('x-cache-timestamp', Date.now().toString());
            
            const newResponse = new Response(await networkResponse.clone().blob(), {
                status: networkResponse.status,
                statusText: networkResponse.statusText,
                headers
            });
            
            await cache.put(request, newResponse);
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] fetchAndCache failed:', error);
        throw error;
    }
}

// Cache-first strategy for CDN resources (Font Awesome, etc.)
async function cacheFirstCDN(request) {
    const url = new URL(request.url);
    const isWebfont = url.pathname.match(/\.(woff2?|ttf|eot|otf)$/i);

    try {
        // For webfont files, prefer network to avoid corrupted cached fonts
        if (isWebfont) {
            try {
                const networkResponse = await fetch(request, { mode: 'cors' });

                // Validate the response before caching
                if (networkResponse.ok && networkResponse.headers.get('content-type')) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, networkResponse.clone());
                    return networkResponse;
                }
            } catch (networkError) {
                // Network failed, try cache as fallback
                console.log('[SW] Font network failed, trying cache:', request.url);
            }

            // Fallback to cache for fonts if network fails
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }

            // Return empty response if both fail
            return new Response('', { status: 503, statusText: 'Font unavailable' });
        }

        // For CSS and other non-font files, use cache-first
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            // Return cached response immediately, fetch fresh in background
            fetch(request, { mode: 'cors' })
                .then(response => {
                    if (response.ok) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, response);
                        });
                    }
                })
                .catch(() => { });
            return cachedResponse;
        }

        // Not in cache, fetch from network with CORS mode
        const networkResponse = await fetch(request, { mode: 'cors' });

        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.error('[SW] CDN cache-first failed:', error);
        // Return nothing if CDN fails and not cached
        return new Response('', { status: 503 });
    }
}

// Create offline fallback response
async function createOfflineFallback(request) {
    const url = new URL(request.url);

    // For HTML pages, try to serve the offline page from cache
    if (request.headers.get('Accept')?.includes('text/html')) {
        // Try to get the offline page from cache first
        const cachedOffline = await caches.match('/offline.html');
        if (cachedOffline) {
            return cachedOffline;
        }

        // Fallback to inline HTML if cached offline page not available
        return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="theme-color" content="#6366f1">
        <title>Sora - Offline</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
            text-align: center;
          }
          .offline-container { max-width: 500px; animation: fadeIn 0.5s ease; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .offline-icon { font-size: clamp(4rem, 15vw, 6rem); margin-bottom: 1.5rem; }
          h1 { font-size: clamp(1.5rem, 5vw, 2.5rem); margin-bottom: 1rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
          p { color: #94a3b8; line-height: 1.6; margin-bottom: 2rem; }
          .retry-btn { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; padding: 1rem 2.5rem; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
          .retry-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(99, 102, 241, 0.4); }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <div class="offline-icon">📡</div>
          <h1>You're Offline</h1>
          <p>It looks like you've lost your internet connection. Your favorited games and settings are still available locally.</p>
          <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
        </div>
      </body>
      </html>
    `, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // For API requests, return JSON error
    if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'You are currently offline. Some features may not work.',
            cached: true,
            timestamp: new Date().toISOString()
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
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

// Cache size management - remove oldest entries
async function trimCache(cacheName, maxItems) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        if (keys.length > maxItems) {
            // Sort by timestamp (oldest first) and delete oldest
            const keysWithTime = await Promise.all(
                keys.map(async (key) => {
                    const response = await cache.match(key);
                    const timestamp = getCacheTimestamp(response) || 0;
                    return { key, timestamp };
                })
            );
            
            keysWithTime.sort((a, b) => a.timestamp - b.timestamp);
            
            // Delete oldest entries
            const toDelete = keysWithTime.slice(0, keysWithTime.length - maxItems);
            await Promise.all(
                toDelete.map(item => cache.delete(item.key))
            );
            console.log(`[SW] Trimmed ${cacheName} from ${keys.length} to ${maxItems} items`);
        }
    } catch (error) {
        console.error('[SW] trimCache failed:', error);
    }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => caches.delete(name))
            );
        }).then(() => {
            console.log('[SW] All caches cleared');
        });
    }

    if (event.data.type === 'CACHE_URLS') {
        const { urls } = event.data;
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => cache.addAll(urls))
                .then(() => {
                    console.log('[SW] URLs cached successfully');
                })
        );
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
