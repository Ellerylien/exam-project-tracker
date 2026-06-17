// 正式推播程式：由 Supabase 資料庫 Webhook 觸發 → 發 LINE 通知
//
// 觸發來源（在 Supabase 後台設定 Database Webhooks 指向這支程式）：
//   1) comments 表 INSERT  → 有人留言/回覆
//   2) projects 表 UPDATE  → 案件進度狀態改變（含「需修改 / 確認無誤」）
//
// 流程：判斷事件 → 找出該案件的業務+業助 → 在 line_groups 查對應群組 → 推 LINE。

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // 與 Supabase webhook 自訂標頭比對，防止外人亂打

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 來源驗證：Supabase webhook 會帶一個自訂標頭 x-webhook-secret
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    console.warn('[notify] 來源驗證失敗，已拒絕');
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { type, table, record, old_record } = body ?? {};

    let project = null;
    let message = null;

    if (table === 'comments' && type === 'INSERT') {
      // 留言：payload 只有 project_id，要回頭查專案拿到業務/業助/名稱
      project = await fetchProject(record.project_id);
      if (!project) return res.status(200).json({ ok: true, skip: 'project not found' });
      const replyTag = record.parent_id ? '（回覆）' : '';
      message = `💬 ${project.name}\n${record.author} 留言${replyTag}：\n${truncate(record.content, 200)}`;
    } else if (table === 'projects' && type === 'UPDATE') {
      // 進度變更：只在狀態「真的改變」且變成下列指定階段時，才發通知
      const STATUS_MESSAGES = {
        '修改題目': '考題需要修改',
        '製作錄音稿與學生卷': '老師閱卷 OK，請進行製作錄音稿與學生卷',
      };
      if (!old_record || old_record.status === record.status) {
        return res.status(200).json({ ok: true, skip: 'status unchanged' });
      }
      const note = STATUS_MESSAGES[record.status];
      if (!note) {
        // 其他階段（結案、出題中…）不發進度通知
        return res.status(200).json({ ok: true, skip: 'status not notified' });
      }
      project = record;
      message = `📌 ${project.name}\n${note}`;
    } else {
      return res.status(200).json({ ok: true, skip: 'event ignored' });
    }

    const groupId = await fetchGroupId(project.sales_rep, project.sales_assistant);
    if (!groupId) {
      console.warn(`[notify] 找不到對應群組：${project.sales_rep} × ${project.sales_assistant}`);
      return res.status(200).json({ ok: true, skip: 'no matching line group' });
    }

    await pushToLine(groupId, message);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[notify] 發生錯誤：', err);
    // 回 200 避免 Supabase 端一直重試；錯誤細節看 Vercel Logs
    return res.status(200).json({ ok: false, error: String(err) });
  }
}

// ── 工具函式 ─────────────────────────────────────────

async function fetchProject(id) {
  const url = `${SUPABASE_URL}/rest/v1/projects?id=eq.${id}&select=name,sales_rep,sales_assistant,status`;
  const r = await fetch(url, { headers: sbHeaders() });
  const data = await r.json();
  return Array.isArray(data) ? data[0] : null;
}

async function fetchGroupId(rep, assistant) {
  const url =
    `${SUPABASE_URL}/rest/v1/line_groups` +
    `?sales_rep=eq.${encodeURIComponent(rep)}` +
    `&sales_assistant=eq.${encodeURIComponent(assistant)}` +
    `&select=group_id`;
  const r = await fetch(url, { headers: sbHeaders() });
  const data = await r.json();
  return Array.isArray(data) && data[0] ? data[0].group_id : null;
}

function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

async function pushToLine(to, text) {
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  if (!r.ok) {
    console.error('[notify] LINE 推播失敗：', r.status, await r.text());
  }
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
