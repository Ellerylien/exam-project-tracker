// LINE Webhook 接收端（暫時版：用來「撈出群組 ID」）
//
// 這支程式的唯一任務：當 bot 收到任何 LINE 事件（有人在群組裡講話、
// 把 bot 加進群組等），就把事件來源印到 Vercel 的 Function Logs。
// 我們要的是 source.groupId —— 把它填進 Supabase 的 line_groups 表。
//
// ⚠️ 這是「臨時診斷版」，還沒有做簽章驗證、也還不會發任何通知。
//    用途：撈群組 ID，以及撈每位成員的「名字 = userId」對應（做法 B 用）。

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// 用 groupId + userId 向 LINE 查這個人的顯示名稱
async function getMemberName(groupId, userId) {
  try {
    const r = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`,
      { headers: { Authorization: `Bearer ${LINE_TOKEN}` } }
    );
    if (!r.ok) return '(查不到名字)';
    const data = await r.json();
    return data.displayName ?? '(無名字)';
  } catch {
    return '(查詢失敗)';
  }
}

export default async function handler(req, res) {
  // LINE 後台按「Verify」會送 POST；瀏覽器直接開網址是 GET。
  if (req.method === 'GET') {
    return res.status(200).send('LINE webhook is alive.');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Vercel 會自動把 JSON body 解析成物件
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const events = body?.events ?? [];

    if (events.length === 0) {
      // LINE 後台的 Verify 會送一個空 events 的請求，回 200 讓它通過
      console.log('[line-webhook] 收到驗證或空事件請求');
    }

    for (const event of events) {
      const src = event.source ?? {};
      console.log('====== LINE 事件 ======');
      console.log('事件類型 type :', event.type);
      console.log('來源類型 source.type :', src.type); // user / group / room
      console.log('★ groupId :', src.groupId ?? '(非群組)');
      console.log('  roomId  :', src.roomId ?? '(非多人聊天室)');
      console.log('  userId  :', src.userId ?? '(無)');
      if (src.groupId && src.userId) {
        const name = await getMemberName(src.groupId, src.userId);
        console.log(`★ 對應關係 :「${name}」= ${src.userId}`);
      }
      if (event.message?.text) {
        console.log('訊息內容 :', event.message.text);
      }
      console.log('=======================');
    }

    // 一定要回 200，否則 LINE 會判定 webhook 失敗
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[line-webhook] 解析失敗：', err);
    // 即使出錯也回 200，避免 LINE 後台一直報錯
    return res.status(200).json({ ok: false });
  }
}
