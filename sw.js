const CACHE_NAME = "belklock-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./excel-handler.js",
  "./marketing-data.js",
  "./assets/logo.svg",
  "./manifest.json"
];

// Instalação do Service Worker e caching inicial
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  
  // Requisições para APIs externas (como a nossa API na Azure ou CDNs) não devem ser servidas por cache estático
  if (url.origin !== self.location.origin || url.pathname.includes("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // Se a requisição de API falhar (sem internet), retornamos erro normal
        return new Response(JSON.stringify({ error: "Você está offline e esta ação exige conexão com a nuvem." }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    return;
  }

  // Para assets do próprio app, tenta buscar no cache primeiro. Se não achar, busca na rede.
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        // Guarda na cache os recursos novos requisitados na origem local
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
