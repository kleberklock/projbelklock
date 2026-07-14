const CACHE_NAME = "conectajoias-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./excel-handler.js",
  "./marketing-data.js",
  "./assets/logo.svg",
  "./manifest.json",
  "./login.js",
  "./manager.html",
  "./manager.js",
  "./onboarding.html",
  "./onboarding.js",
  "./pagamento.html",
  "./pagamento.js",
  "./saasadmin.html",
  "./saasadmin.js",
  "./superadmin.html",
  "./superadmin.js",
  "./superadmin-vendas.js",
  "./termo_assinatura.html",
  "./termo_assinatura.js",
  "./apresentacao.html"
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
            console.log("Removendo cache antigo do Service Worker:", key);
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

  // Estratégia: Network-First (Rede Primeiro) para garantir atualizações estáticas locais imediatas,
  // com fallback automático para o Cache offline se não houver conexão.
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback para cache quando estiver offline
        return caches.match(e.request);
      })
  );
});
