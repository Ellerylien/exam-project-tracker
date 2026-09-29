// 正式推播程式：由 Supabase 資料庫 Webhook 觸發 → 發 LINE 通知 + 手機／瀏覽器推播
//
// 觸發來源（在 Supabase 後台設定 Database Webhooks 指向這支程式）：
//   1) comments 表 INSERT  → 有人留言/回覆
//   2) projects 表 UPDATE  → 案件進度狀態改變
//
// 兩條管道各自獨立，一邊失敗不影響另一邊：
//   LINE 群組 —— 額度有限（輕用量每月 200 則、群組依人數計則數），只推
//                「需修改 / 確認無誤」與留言時勾了「同步通知 LINE」的留言。
//                找出該案件的業務+業助 → 在 line_groups 查對應群組 → 推 LINE。
//   手機推播 —— 免費無上限，所有留言與進度變更都推給該案的業務、業助、製作人員
//                （留言不推給留言者本人），裝置訂閱存在 push_subscriptions。

import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // 與 Supabase webhook 自訂標頭比對，防止外人亂打
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

const pushEnabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushEnabled) {
  // subject 是推播服務（Google／Apple）遇到問題時的聯絡方式，用網站網址即可
  webpush.setVapidDetails('https://exam-project-tracker.vercel.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// 進度變成這些階段時才推 LINE（手機推播則是任何進度變更都推）
const LINE_STATUS_MESSAGES = {
  '修改題目': '考題需要修改',
  '製作錄音稿與學生卷': '老師閱卷 OK，請進行製作錄音稿與學生卷',
};

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
    let lineMessage = null; // null = 這次不推 LINE
    let push = null;        // null = 這次不送手機推播

    if (table === 'comments' && type === 'INSERT') {
      // 留言：payload 只有 project_id，要回頭查專案拿到業務/業助/名稱
      project = await fetchProject(record.project_id);
      if (!project) return res.status(200).json({ ok: true, skip: 'project not found' });
      const replyTag = record.parent_id ? '（回覆）' : '';
      if (record.notify_line) {
        lineMessage = `💬 ${project.name}\n${record.author} 留言${replyTag}：\n${truncate(record.content, 200)}`;
      }
      push = {
        title: `💬 ${project.name}`,
        body: `${record.author}${replyTag}：${truncate(record.content, 120)}`,
        exclude: record.author,
      };
    } else if (table === 'projects' && type === 'UPDATE') {
      // 進度變更：只在狀態「真的改變」時才通知（改其他欄位、清未讀等不算）
      if (!old_record || old_record.status === record.status) {
        return res.status(200).json({ ok: true, skip: 'status unchanged' });
      }
      project = record;
      const note = LINE_STATUS_MESSAGES[record.status];
      if (note) lineMessage = `📌 ${project.name}\n${note}`;
      push = {
        title: `📌 ${project.name}`,
        body: `${old_record.status} → ${record.status}${note ? `：${note}` : ''}`,
      };
    } else {
      return res.status(200).json({ ok: true, skip: 'event ignored' });
    }

    const [line, webPush] = await Promise.allSettled([
      lineMessage ? notifyLine(project, lineMessage) : 'skip',
      push ? notifyPush(project, push) : 'skip',
    ]);
    for (const r of [line, webPush]) {
      if (r.status === 'rejected') console.error('[notify] 發生錯誤：', r.reason);
    }
    const describe = (r) => (r.status === 'fulfilled' ? r.value : String(r.reason));
    return res.status(200).json({
      ok: line.status === 'fulfilled' && webPush.status === 'fulfilled',
      line: describe(line),
      push: describe(webPush),
    });
  } catch (err) {
    console.error('[notify] 發生錯誤：', err);
    // 回 200 避免 Supabase 端一直重試；錯誤細節看 Vercel Logs
    return res.status(200).json({ ok: false, error: String(err) });
  }
}

// ── LINE 群組 ─────────────────────────────────────────

async function notifyLine(project, message) {
  const groupId = await fetchGroupId(project.sales_rep, project.sales_assistant);
  if (!groupId) {
    console.warn(`[notify] 找不到對應群組：${project.sales_rep} × ${project.sales_assistant}`);
    return 'skip: no matching line group';
  }
  await pushToLine(groupId, message);
  return 'sent';
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

async function pushToLine(to, text) {
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  // 丟出錯誤讓 handler 回 { ok: false }，Supabase 的 net._http_response 才看得出推播失敗
  // （例：429 = LINE 官方帳號本月訊息額度用完）
  if (!r.ok) {
    throw new Error(`LINE 推播失敗：${r.status} ${await r.text()}`);
  }
}

// ── 手機／瀏覽器推播 ─────────────────────────────────

async function notifyPush(project, { title, body, exclude }) {
  if (!pushEnabled) return 'skip: push not configured';
  const names = [...new Set([project.sales_rep, project.sales_assistant, project.production_staff])]
    .filter(name => name && name !== exclude);
  if (names.length === 0) return 'skip: no recipients';

  const subs = await fetchSubscriptions(names);
  if (subs.length === 0) return 'skip: no subscribed devices';

  // 點通知時由 service worker（public/sw.js）開啟 url，App 讀 ?project= 直接打開該案件
  const payload = JSON.stringify({ title, body, url: `/?project=${project.id}`, projectId: project.id });
  // urgency high：Android 休眠省電時一般優先權的推播會延後送達，工作通知要即時
  const options = { TTL: 24 * 60 * 60, urgency: 'high' };
  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options))
  );

  let sent = 0;
  const failures = [];
  await Promise.all(results.map(async (r, i) => {
    if (r.status === 'fulfilled') { sent++; return; }
    // 404 / 410 = 使用者關了通知或解除安裝，訂閱已失效，順手清掉
    if (r.reason?.statusCode === 404 || r.reason?.statusCode === 410) {
      await deleteSubscription(subs[i].endpoint);
      return;
    }
    failures.push(`${subs[i].user_name}: ${r.reason?.statusCode ?? ''} ${r.reason?.body ?? r.reason}`);
  }));
  if (failures.length) throw new Error(`手機推播部分失敗（成功 ${sent}/${subs.length}）：${failures.join('；')}`);
  return `sent ${sent}/${subs.length}`;
}

async function fetchSubscriptions(names) {
  const list = names.map(n => `"${n.replace(/"/g, '\\"')}"`).join(',');
  const url = `${SUPABASE_URL}/rest/v1/push_subscriptions?user_name=in.(${encodeURIComponent(list)})&select=endpoint,user_name,p256dh,auth`;
  const r = await fetch(url, { headers: sbHeaders() });
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function deleteSubscription(endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: sbHeaders(),
  });
}

// ── 共用 ─────────────────────────────────────────────

async function fetchProject(id) {
  const url = `${SUPABASE_URL}/rest/v1/projects?id=eq.${id}&select=id,name,sales_rep,sales_assistant,production_staff,status`;
  const r = await fetch(url, { headers: sbHeaders() });
  const data = await r.json();
  return Array.isArray(data) ? data[0] : null;
}

function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
