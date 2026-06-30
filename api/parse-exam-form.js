// 讀取段考申請表（.doc / .docx），用規則 (regex) 擷取欄位後回傳，前端自動帶入新增專案表單。
// 完全在伺服器端跑、不呼叫任何外部 AI 服務，零成本、不需要 API key。
//
// 流程：
//   1) 前端把檔案讀成 base64，POST { filename, dataBase64 } 進來
//   2) word-extractor 解出純文字（同時支援舊版 .doc 與 .docx）
//   3) 依公司「學校段考製作申請表」固定的欄位標籤，用 regex 抓值
//   4) 審稿截止日的民國/西元換算與「往回推 10 天」都在這裡用 JS 算
//
// 這套表單格式固定，能穩定帶入七、八成欄位；抓不到的欄位前端留白，由使用者手動補。

/* global Buffer */
import WordExtractor from 'word-extractor';

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB，段考申請表遠小於此

function sendJson(res, status, body) {
  res.status(status).json(body);
}

// 整理擷取出的文字：word-extractor 會用換行分隔表格列（label：value 結構良好），
// 只要把每列內多餘的空白／tab 收斂成單一空白即可，保留「SC 5/18~20」這類值裡的空白。
export function normalizeText(raw) {
  return (raw || '')
    .split(String.fromCharCode(0x3000)).join(' ') // 全形空白 → 半形
    .replace(/[ \t]+/g, ' ')           // 連續空白／tab → 單一空白
    .replace(/[ \t]*\n[ \t]*/g, '\n')  // 去掉換行前後的空白
    .replace(/\n{3,}/g, '\n\n')        // 連續空行收斂
    .trim();
}

// 把年份字串轉成西元。4 碼以上視為西元並取前 4 碼（可吃掉 OCR 雜訊如「20264」→ 2026）；
// 2~3 碼視為民國年 +1911（115 → 2026）。
function toAdYear(yStr) {
  const digits = String(yStr).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length >= 4) return parseInt(digits.slice(0, 4), 10);
  return parseInt(digits, 10) + 1911;
}

// 從一段含中文日期的文字抓出西元 ISO 日期（YYYY-MM-DD），抓不到回 null。
export function parseChineseDate(seg) {
  if (!seg) return null;
  const yMatch = seg.match(/(\d{2,5})/);          // 日期開頭一定是年
  const mMatch = seg.match(/(\d{1,2})\s*月/);
  const dMatch = seg.match(/(\d{1,2})\s*日/);
  if (!yMatch || !mMatch || !dMatch) return null;
  const year = toAdYear(yMatch[1]);
  const month = parseInt(mMatch[1], 10);
  const day = parseInt(dMatch[1], 10);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 審稿截止日：有審題日就用審題日；否則用學校收件日往回推 10 天；都沒有就留空。
// 全程用 UTC 運算，避免本機時區把日期推移一天。
export function computeDeadline(reviewDate, receiptDate) {
  if (reviewDate) return { deadline: reviewDate, source: 'review' };
  if (receiptDate) {
    const m = receiptDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      d.setUTCDate(d.getUTCDate() - 10);
      return { deadline: d.toISOString().slice(0, 10), source: 'receipt-10' };
    }
  }
  return { deadline: '', source: 'none' };
}

// 依固定欄位標籤抓值。回傳的日期是「原始片段」，由呼叫端再丟給 parseChineseDate。
export function parseExamForm(text) {
  const pick = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };

  // 成品名稱：整列就是值（用 ^ 鎖定列首，避開「加錄：…1.成品名稱：」那種干擾）
  const name = pick(/^\s*成品名稱[：:]\s*(.+?)\s*$/m);

  // 審題日 / 學校收件日：抓標籤後到「；」「段考」或換行前的片段，再交給日期解析
  const reviewSeg = pick(/審題日[：:]\s*([^\n；;]*?)(?:[；;]|音檔|段考|$)/);
  const receiptSeg = pick(/學校收件日[：:]\s*([^\n]*?)(?:段考|[；;]|$)/);
  const review_date = parseChineseDate(reviewSeg);
  const school_receipt_date = parseChineseDate(receiptSeg);

  // 負責老師：抓到「學年/訂購雜誌」前，去掉結尾「老師」
  let teacher_name = pick(/負責老師[：:]\s*([^\n]*?)\s*(?:學年|訂購雜誌|$)/);
  teacher_name = teacher_name.replace(/\s*老師\s*$/, '').trim();

  // E-mail：抓出乾淨的 email
  const teacher_email = pick(/E-?mail[：:]\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);

  // 試卷範圍：抓到「試卷內容/成品名稱」前（可跨行），收斂空白；如備註／空白 → 留白
  let scope = pick(/試卷範圍[：:]([\s\S]*?)(?:試卷內容|成品名稱|$)/);
  scope = scope.replace(/\s+/g, ' ').trim();
  if (!scope || /^(如|見|詳|同|參)\s*備註/.test(scope) || /^(如|見)下$/.test(scope)) scope = '';

  // 備註欄（也涵蓋「錄音申請備註欄」）：抓到文末，但截斷後面無關的表單欄位
  let notes = '';
  const nm = text.match(/備註欄[：:]([\s\S]*)$/);
  if (nm) {
    // 只在「欄位標籤＋冒號」處截斷（學生卷：…），不要誤砍備註內文裡的「學生卷/老師卷」這種字
    notes = nm[1].split(/(?:學生卷|字體大小|試卷格式|班級卷|聽力題型|閱讀題型)[^\n：:]{0,6}[：:]/)[0];
    notes = notes.replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
  }

  return { name, review_date, school_receipt_date, teacher_name, teacher_email, scope, notes };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const dataBase64 = body?.dataBase64 ?? '';
    if (!dataBase64) return sendJson(res, 400, { ok: false, error: '沒有收到檔案內容' });

    const buffer = Buffer.from(dataBase64, 'base64');
    if (!buffer.length) return sendJson(res, 400, { ok: false, error: '檔案內容無法解碼' });
    if (buffer.length > MAX_FILE_BYTES) return sendJson(res, 413, { ok: false, error: '檔案太大' });

    // 1) 解出純文字
    let text = '';
    try {
      const extracted = await new WordExtractor().extract(buffer);
      text = normalizeText(extracted.getBody());
    } catch (e) {
      console.error('[parse-exam-form] extract failed', e);
      return sendJson(res, 422, { ok: false, error: '無法讀取這個檔案，請確認是 .doc 或 .docx 申請表' });
    }
    if (!text) return sendJson(res, 422, { ok: false, error: '檔案內讀不到文字' });

    // 2) 規則擷取欄位
    const fields = parseExamForm(text);

    // 3) 算審稿截止日
    const { deadline, source } = computeDeadline(fields.review_date, fields.school_receipt_date);

    return sendJson(res, 200, {
      ok: true,
      data: {
        name: fields.name || '',
        deadline,
        teacher_name: fields.teacher_name || '',
        teacher_email: fields.teacher_email || '',
        scope: fields.scope || '',
        notes: fields.notes || '',
      },
      meta: {
        deadline_source: source, // 'review' | 'receipt-10' | 'none'
        review_date: fields.review_date || null,
        school_receipt_date: fields.school_receipt_date || null,
      },
    });
  } catch (err) {
    console.error('[parse-exam-form] error', err);
    return sendJson(res, 500, { ok: false, error: '伺服器發生錯誤' });
  }
}
