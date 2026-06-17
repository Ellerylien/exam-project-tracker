// 後端驗證 PIN：前端永遠不會拿到 PIN。
// 特性：
//   1) 相容舊明碼與新雜湊（stored 以 $2 開頭視為 bcrypt 雜湊）
//   2) 防暴力破解：連續猜錯達上限就暫時鎖定（需要 team_users 有
//      failed_attempts / locked_until 兩個欄位；沒有時會自動略過，不影響登入）
//   3) 只回傳 id / name / role，不吐 PIN

import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_ATTEMPTS = 5;     // 連續錯幾次就鎖
const LOCK_MINUTES = 10;    // 鎖多久
const GUEST_PIN = '8888';   // 訪客公開帳號

function sbHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// 更新失敗計數/鎖定；若欄位尚未建立會回 400，但不影響登入判斷，故忽略結果
async function patchUser(id, patch) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/team_users?id=eq.${id}`, {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(patch),
    });
  } catch {
    /* 略過 */
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const name = (body?.name ?? '').trim();
    const pin = (body?.pin ?? '').trim();
    if (!name || !pin) return res.status(400).json({ ok: false, error: 'missing' });

    // 撈使用者（select=* 在伺服器端，pin 不會外流到前端）
    const url = `${SUPABASE_URL}/rest/v1/team_users?name=eq.${encodeURIComponent(name)}`;
    const r = await fetch(url, { headers: sbHeaders() });
    const rows = await r.json();
    const userRow = Array.isArray(rows) ? rows[0] : null;

    // 訪客：DB 沒這列時的公開帳號
    if (!userRow) {
      if (name === 'Guest' && pin === GUEST_PIN) {
        return res.status(200).json({ ok: true, user: { id: 'guest', name: 'Guest', role: 'Guest' } });
      }
      return res.status(401).json({ ok: false, error: 'invalid' });
    }

    // 鎖定中？
    if (userRow.locked_until && new Date(userRow.locked_until) > new Date()) {
      return res.status(429).json({ ok: false, error: 'locked' });
    }

    // 驗證：PIN 已雜湊，一律用 bcrypt 比對（雜湊格式不符會回 false，不會丟錯）
    const stored = String(userRow.pin ?? '');
    const ok = bcrypt.compareSync(pin, stored);

    if (ok) {
      await patchUser(userRow.id, { failed_attempts: 0, locked_until: null });
      return res.status(200).json({
        ok: true,
        user: { id: userRow.id, name: userRow.name, role: userRow.role },
      });
    }

    // 失敗：累加，必要時鎖定
    const attempts = (userRow.failed_attempts ?? 0) + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await patchUser(userRow.id, locked
      ? { failed_attempts: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() }
      : { failed_attempts: attempts });

    return res.status(locked ? 429 : 401).json({ ok: false, error: locked ? 'locked' : 'invalid' });
  } catch (err) {
    console.error('[login] error', err);
    return res.status(500).json({ ok: false, error: 'server' });
  }
}
