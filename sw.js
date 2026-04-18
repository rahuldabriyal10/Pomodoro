// sw.js - Basic Service Worker for PWA Installability
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // This allows the app to work normally while satisfying PWA requirements
  e.respondWith(fetch(e.request));
});