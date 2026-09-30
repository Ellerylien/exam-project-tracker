// 手機／瀏覽器推播（Web Push）的訂閱管理
//   GET    → { publicKey }：前端訂閱時要用的 VAPID 公鑰
//   POST   { name, subscription, test? } → 存下（或更新）這台裝置的訂閱，綁定使用者名稱；
//                                          test: true 時再送一則測試通知到這台裝置
//   DELETE { endpoint }           → 這台裝置關閉通知
// 訂閱資料存在 push_subscriptions（只有 service_role 讀寫得到）。

import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('https://exam-project-tracker.vercel.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function sbHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// 只接受 team_users 裡的正式成員（訪客不收推播），避免亂塞名字
async function isTeamMember(name) {
  const url = `${SUPABASE_URL}/rest/v1/team_users?name=eq.${encodeURIComponent(name)}&select=role`;
  const r = await fetch(url, { headers: sbHeaders() });
  const rows = await r.json();
  const role = Array.isArray(rows) && rows[0] ? String(rows[0].role || '').toLowerCase() : null;
  return role !== null && role !== 'guest';
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (!VAPID_PUBLIC_KEY) return res.status(503).json({ ok: false, error: 'not configured' });
      return res.status(200).json({ ok: true, publicKey: VAPID_PUBLIC_KEY });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (req.method === 'POST') {
      const name = (body?.name ?? '').trim();
      const sub = body?.subscription;
      const endpoint = sub?.endpoint;
      const p256dh = sub?.keys?.p256dh;
      const auth = sub?.keys?.auth;
      if (!name || typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !p256dh || !auth) {
        return res.status(400).json({ ok: false, error: 'invalid subscription' });
      }
      if (!(await isTeamMember(name))) return res.status(403).json({ ok: false, error: 'unknown user' });

      // endpoint 是主鍵：同一台裝置換人登入時，直接改綁新的名字
      const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({
          endpoint,
          user_name: name,
          p256dh,
          auth,
          user_agent: String(req.headers['user-agent'] ?? '').slice(0, 300),
          updated_at: new Date().toISOString(),
        }),
      });
      if (!r.ok) throw new Error(`儲存訂閱失敗：${r.status} ${await r.text()}`);

      // 測試通知：走跟正式通知一樣的推播服務，確認這台裝置真的收得到
      if (body.test) {
        try {
          await webpush.sendNotification({ endpoint, keys: { p256dh, auth } }, JSON.stringify({
            title: '🔔 測試通知',
            body: `${name}，這台裝置的通知已開啟。之後你負責的案件進度變更、或有人在留言裡 @ 你，都會通知你。`,
            url: '/',
          }), { TTL: 60, urgency: 'high' });
        } catch (err) {
          console.error('[push-subscribe] 測試通知失敗：', err.statusCode, err.body);
          return res.status(502).json({ ok: false, error: 'test push failed' });
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const endpoint = body?.endpoint;
      if (typeof endpoint !== 'string') return res.status(400).json({ ok: false, error: 'missing endpoint' });
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
        method: 'DELETE',
        headers: sbHeaders({ Prefer: 'return=minimal' }),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false });
  } catch (err) {
    console.error('[push-subscribe] error', err);
    return res.status(500).json({ ok: false, error: 'server' });
  }
}
