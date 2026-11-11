// Makes the app work offline. Change CACHE's version number when you want every device to refresh its saved copy.
const CACHE = 'vellum-v14';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'css/styles.css','.gitignore/firebase-config.js',
  'js/state.js', 'js/storage.js', 'js/viewer.js', 'js/tools.js', 'js/export.js', 'js/forms.js', 'js/fonts.js', 'js/security.js', 'js/designer.js', 'js/nav.js', 'js/history.js', 'js/templates.js', 'js/backup.js', 'js/sigpad.js', 'js/signprep.js', 'js/cloud.js', 'js/home.js', 'js/firebase-config.js', 'js/signer.js', 'sign.html', 'css/sigpad.css', 'css/signer.css', 'js/images.js', 'js/pages.js', 'js/textstyle.js', 'js/settings.js', 'js/gestures.js', 'js/app.js',
  'icons/icon-192.png', 'icons/logo.png', 'icons/icon-512.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.11.1/dist/pdf-lib.min.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'];

self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(CORE);
  await Promise.all(LIBS.map(u => c.add(u).catch(() => {})));
  self.skipWaiting();
})()));

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const own = new URL(e.request.url).origin === location.origin;
  if (!own && !LIBS.includes(e.request.url)) return; // let Firebase and other outside traffic go straight through
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (own) { // your own files: use the newest when online, saved copy when offline
      try { const r = await fetch(e.request); c.put(e.request, r.clone()); return r; }
      catch { return (await c.match(e.request)) || (await c.match('index.html')); }
    }
    return (await c.match(e.request)) || fetch(e.request); // libraries: saved copy first
  })());
});
