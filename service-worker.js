// ═══════════════════════════════════════════
// MapaSala — Service Worker
// Estratégia: Cache First com fallback de rede
// ═══════════════════════════════════════════

const CACHE_NAME = 'mapasala-v2';

// Arquivos essenciais para funcionamento offline
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  // Fontes e libs externas (cache on first use)
];

// Recursos externos que também queremos cachear
const EXTERNAL = [
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Sora:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ─── INSTALL: pré-cacheia os assets locais ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cacheia locais garantidos
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] Alguns assets não puderam ser cacheados:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE: remove caches antigos ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Removendo cache antigo:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH: Cache First para locais, Network First para Firebase ───
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar requisições do Firebase (sempre precisam de rede)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebase.googleapis.com') ||
    url.hostname.includes('firebasejs') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; // deixa o browser resolver normalmente
  }

  // Para navegação (HTML) usa Network First para sempre ter versão atualizada
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Para todo o resto: Cache First com fallback de rede
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Só cacheia respostas válidas
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Fallback para ícone SVG se imagem não disponível
        if (event.request.destination === 'image') {
          return caches.match('./icons/icon.svg');
        }
      });
    })
  );
});

// ─── MENSAGENS (ex: forçar atualização) ───
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
