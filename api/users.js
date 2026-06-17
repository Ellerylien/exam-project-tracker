// 回傳登入頭像清單：只給 id / name / role，絕不含 PIN。
// 用 service_role 讀取，所以即使之後 team_users 開了 RLS 也讀得到。

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  try {
    const url = `${SUPABASE_URL}/rest/v1/team_users?select=id,name,role`;
    const r = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const rows = await r.json();
    return res.status(200).json({ ok: true, users: Array.isArray(rows) ? rows : [] });
  } catch (err) {
    console.error('[users] error', err);
    return res.status(500).json({ ok: false, users: [] });
  }
}
