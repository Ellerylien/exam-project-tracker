// Service worker：接收手機／瀏覽器推播（Web Push），網頁關著也能跳通知。
// 推播內容由 api/notify.js 送出：{ title, body, url, projectId }

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  // iOS 規定每則推播都要顯示通知，否則會被收回推播權限，所以一律 showNotification
  event.waitUntil(
    self.registration.showNotification(data.title || '考題專案系統', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data: { url: data.url || '/', projectId: data.projectId ?? null },
    })
  );
});

// 點通知：網站已經開著就切過去並直接打開該案件，沒開就開新視窗（App 會讀 ?project=）
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, projectId } = event.notification.data || {};
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if (projectId) existing.postMessage({ type: 'open-project', projectId });
      return;
    }
    await self.clients.openWindow(url || '/');
  })());
});
