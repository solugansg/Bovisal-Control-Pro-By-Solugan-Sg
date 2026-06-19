// BoviSal Control Pro by Solugan SG — Service Worker V 260619.12
const CACHE_NAME = 'bovisal-cache-v260619.12';

const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'style.css',
  'bovisal-app.js',
  'lucide.min.js',
  'bovisal-manifest.json',
  'BoviSal Control Pro - logo.png',
  'apple-touch-icon.png',
  'libs/xlsx-js-style.min.js',
  'libs/firebase-app-compat.js',
  'libs/firebase-auth-compat.js',
  'libs/firebase-firestore-compat.js',
  'fonts/inter-400.woff2',
  'fonts/inter-600.woff2',
  'fonts/inter-700.woff2'
];

self.addEventListener('install', event => {
  console.log('[BoviSal SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] No se pudo cachear: ${url}`, err))
        )
      )
    ).then(() => {
      console.log('[BoviSal SW] Instalación completa. App lista offline.');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => {
          console.log(`[SW] Eliminando caché viejo: ${n}`);
          return caches.delete(n);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('firebaseapp.com') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com') ||
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('identitytoolkit') ||
      event.request.url.includes('securetoken')) return;

  const url = new URL(event.request.url);
  const isNetworkFirst =
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('bovisal-app.js');

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() => {
          return caches.match(event.request, { ignoreSearch: true }).then(cached => {
            if (cached) return cached;
            if (event.request.mode === 'navigate' || event.request.destination === 'document') {
              return caches.match('index.html', { ignoreSearch: true });
            }
          });
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        }).catch(() => {
          if (event.request.destination === 'document') return caches.match('index.html', { ignoreSearch: true });
        });
      })
    );
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
