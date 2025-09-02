// Sehr minimalistischer SW für spätere PWA-Erweiterung (aktuell: passthrough).
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', () => {}); // kein aggressives Caching in v0.2
