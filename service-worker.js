// Foxy Remote PWA — service worker dengan cache-busting otomatis.
//
// Masalah lama: tombol Check Update manual mengandalkan pengguna ingat refresh.
// Sekarang: tiap kali PWA dibuka, SW memeriksa versi terbaru dari server.
// Kalau manifest + semua aset sukses di-cache, versi lama diganti otomatis.

const APP_VERSION = "v3.1";
const CACHE_NAME = `foxy-remote-${APP_VERSION}`;

// -- ini daftar aset yang di-cache saat install (harus selalu up to date) --
const urlsToCache = [
  "./remote.html",
  "./manifest.json",
  "./css/main.css",
  "./css/roboto.css",
  "./css/font-awesome.css",
  "./socket.io/socket.io.js",
  "./js/socketclient.js",
  "./modules/MMM-Remote-Control/remote/remote.css",
  "./modules/MMM-Remote-Control/manifest.json",
  "./modules/MMM-Remote-Control/img/favicon.svg",
  "./modules/MMM-Remote-Control/img/icon-192.png",
  "./modules/MMM-Remote-Control/img/icon-512.png",
  "./modules/MMM-Remote-Control/remote/remote.mjs",
  "./modules/MMM-Remote-Control/remote/remote-menu-routing.mjs",
  "./modules/MMM-Remote-Control/remote/remote-menu-ui.mjs",
  "./modules/MMM-Remote-Control/remote/remote-menu.mjs",
  "./modules/MMM-Remote-Control/remote/remote-utils.mjs",
  "./modules/MMM-Remote-Control/remote/remote-socket.mjs",
  "./modules/MMM-Remote-Control/remote/remote-modules.mjs",
  "./modules/MMM-Remote-Control/remote/remote-config.mjs",
  "./modules/MMM-Remote-Control/remote/remote-render.mjs",
  "./modules/MMM-Remote-Control/remote/remote-auth.mjs",
  "./modules/MMM-Remote-Control/node_modules/marked/lib/marked.esm.js"
];

// Install SW baru dan klaim kontrol langsung (skipWaiting + clients.claim)
addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(urlsToCache.map(async (url) => {
      try {
        await cache.add(url);
      } catch (error) {
        console.warn(`Cache: skipping ${url}:`, error);
      }
    }));
    globalThis.skipWaiting();
  })());
});

// Strateginya NETWORK-FIRST untuk remote.html & manifest (selalu ambil versi terbaru),
// CACHE-FIRST untuk aset statis (CSS, JS, ikon — kontennya jarang berubah).
addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const noStoreFirst = url.pathname.endsWith("remote.html") ||
                       url.pathname.endsWith("manifest.json") ||
                       url.pathname.endsWith("custom_menu.json");

  event.respondWith((async () => {
    if (noStoreFirst) {
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Offline: gunakan yang ada di cache
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw error;
      }
    }

    const response = await caches.match(event.request);
    // Cache hit - return response
    if (response) {
      return response;
    }
    return fetch(event.request);
  })());
});

// Update service worker: hapus cache versi lama, ambil alih halaman terbuka
addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => {
      if (cacheName !== CACHE_NAME) {
        return caches.delete(cacheName);
      }
    }));
    return globalThis.clients.claim();
  })());
});
