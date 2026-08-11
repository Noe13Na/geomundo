"use strict";

const VERSION = "geomundo-v20";
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;
const API_CACHE = `${VERSION}-api`;
const OFFLINE_URL = "./offline.html";

const APP_SHELL = [
  "./", "./index.html", "./styles.css?v=17", "./app.js?v=2", "./addons.js?v=12", "./manifest.webmanifest", OFFLINE_URL,
  "./assets/icons/icon.svg", "./assets/icons/icon-192.png", "./assets/icons/icon-512.png",
  "./assets/vendor/leaflet/leaflet.css", "./assets/vendor/leaflet/leaflet.js"
];

const LOCAL_DATA = ["./data/countries.json", "./data/states.json", "./data/world.geojson", "./data/glossary.json", "./data/knowledge.json", "./data/astronomy-events-2026.json", "./data/world-calendar.json", "./data/scale-comparisons.json", "./data/hydrography.json", "./data/relief.json"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    await staticCache.addAll(APP_SHELL);
    const dataCache = await caches.open(DATA_CACHE);
    await Promise.allSettled(LOCAL_DATA.map(url => dataCache.add(url)));
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const allowed = new Set([STATIC_CACHE, DATA_CACHE, API_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => !allowed.has(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function navigationNetworkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) || (await cache.match("./index.html")) || (await caches.match(OFFLINE_URL));
  }
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirst(request).catch(() => new Response("Recurso externo indisponível offline.", { status: 503 })));
    return;
  }

  const isData = url.pathname.includes("/data/");
  event.respondWith(cacheFirst(request, isData ? DATA_CACHE : STATIC_CACHE).catch(() => new Response("Recurso indisponível offline.", { status: 503 })));
});
