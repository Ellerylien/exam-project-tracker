// 回傳 LINE 官方帳號本月訊息額度：{ ok, limit, used }
// 只給管理者介面顯示用；token 留在伺服器端，前端拿不到。
// limit 為 null 代表方案沒有上限（LINE 回 type: 'none'）。

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  try {
    const headers = { Authorization: `Bearer ${LINE_TOKEN}` };
    const [quotaRes, usageRes] = await Promise.all([
      fetch('https://api.line.me/v2/bot/message/quota', { headers }),
      fetch('https://api.line.me/v2/bot/message/quota/consumption', { headers }),
    ]);
    if (!quotaRes.ok || !usageRes.ok) {
      console.error('[line-quota] LINE 回應錯誤：', quotaRes.status, usageRes.status);
      return res.status(502).json({ ok: false });
    }
    const quota = await quotaRes.json();
    const usage = await usageRes.json();
    return res.status(200).json({
      ok: true,
      limit: quota.type === 'limited' ? quota.value : null,
      used: usage.totalUsage,
    });
  } catch (err) {
    console.error('[line-quota] error', err);
    return res.status(500).json({ ok: false });
  }
}
