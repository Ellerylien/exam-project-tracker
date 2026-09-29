// 手機／瀏覽器推播（Web Push）的前端工具：註冊 service worker、訂閱、取消訂閱。
// 後端是 api/push-subscribe.js（存訂閱）與 api/notify.js（送推播），
// 收推播與點通知的處理在 public/sw.js。

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iPadOS 13 起 Safari 會偽裝成 Mac，要靠觸控點數分辨
export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// iPhone 只有「加入主畫面」後從圖示開啟（standalone）才支援推播
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(err => console.error('[push] service worker 註冊失敗', err));
}

async function getRegistration() {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function getSubscription() {
  const reg = await getRegistration();
  return reg.pushManager.getSubscription();
}

// VAPID 公鑰是 base64url 字串，pushManager.subscribe 要 Uint8Array
function base64UrlToUint8Array(value) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

// 把訂閱存到後端並綁定使用者名稱；test 為 true 時後端會再送一則測試通知
export async function saveSubscription(name, subscription, { test = false } = {}) {
  const r = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, subscription: subscription.toJSON(), test }),
  });
  if (!r.ok) throw new Error(`儲存訂閱失敗：${r.status}`);
}

// 回傳 'granted' | 'denied' | 'default'；granted 時已完成訂閱並送出測試通知
export async function subscribe(name) {
  // 必須是點擊當下的第一個 await，iPhone 才會跳出權限詢問
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;

  const { publicKey } = await (await fetch('/api/push-subscribe')).json();
  const reg = await getRegistration();
  const subscription = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) });
  await saveSubscription(name, subscription, { test: true });
  return permission;
}

export async function unsubscribe() {
  const subscription = await getSubscription();
  if (!subscription) return;
  await fetch('/api/push-subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe();
}
