/* Tiny Tavern PWA service worker(最小版:僅供安裝性,不做離線快取,確保永遠拿最新版) */
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
