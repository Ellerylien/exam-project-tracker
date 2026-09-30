// 寄信範本：專案詳情的「寄信」按鈕，收件人／副本／主旨／內文依專案與成員資料
// （team_users 的 email / full_name / zh_name）帶入。
// 電腦上下載 .eml 草稿（X-Unsent），傳統版 Outlook 開啟後就是新郵件、保留字型與紅字；
// 手機開不了 Outlook 草稿，改用 mailto: 帶純文字。附件都要在郵件裡手動加。

export const MAIL_KINDS = [
  { key: 'review', label: '請閱卷' },
  { key: 'recording', label: '錄音稿' },
  { key: 'papers', label: '教師卷＆學生卷' },
];

const SIGN_OFF = '空中英語教室';
// 比照平常寄信的格式：內文思源宋體 Medium；標示處用思源宋體 SemiBold 加深紅（Office 標準色），不是粗體
const BODY_FONT = '思源宋體 Medium';
const BODY_SIZE = '14pt';
const EMPHASIS_FONT = '思源宋體 SemiBold';
const EMPHASIS_COLOR = '#C00000';

// 複姓只取常見的幾個，其餘一律取第一個字當姓
const COMPOUND_SURNAMES = ['歐陽', '司馬', '司徒', '諸葛', '上官', '張簡', '范姜'];
const CJK_NAME = /^\p{Script=Han}{2,5}$/u;

// 「梁力仁+余忠諺」這種多位老師的寫法 → ['梁力仁', '余忠諺']
function splitTeachers(teacherName) {
  return (teacherName || '')
    .split(/[+＋、,，/／&＆;；]|(?<=\p{Script=Han})\s+(?=\p{Script=Han})/u)
    .map(s => s.trim().replace(/老師$/, ''))
    .filter(Boolean);
}

// 楊舒如 → 楊老師；英文名或其他寫法就整個名字加「老師」
function teacherTitle(name) {
  if (!CJK_NAME.test(name)) return `${name}老師`;
  const compound = name.length >= 3 && COMPOUND_SURNAMES.find(s => name.startsWith(s));
  return `${compound || name[0]}老師`;
}

export function teacherSalutation(teacherName) {
  const titles = [...new Set(splitTeachers(teacherName).map(teacherTitle))];
  return `${titles.length ? titles.join('、') : '老師'}您好，`;
}

export function splitEmails(value) {
  return (value || '').split(/[\s,;，；、]+/).filter(s => s.includes('@'));
}

// 內文以段落表示：每段是字串與 { em } 的陣列，{ em } 是標示的紅字，空陣列是空行
const em = (text) => ({ em: text });

// 回傳 { to, cc, subject, paragraphs, toLabel, ccLabel }；to 為空代表寄不出去。
// 成員還沒填 Email 就不帶入該位收件人／副本，其餘照常產生
export function buildMail(kind, project, members, senderName) {
  const find = (name) => members.find(m => m.name === (name || '').trim());
  const rep = find(project.sales_rep);
  const assistant = find(project.sales_assistant);
  const sender = find(senderName);
  const name = (project.name || '').trim();
  const emailOf = (person) => (person?.email ? [person.email] : []);

  const teacher = () => {
    const names = splitTeachers(project.teacher_name);
    return { emails: splitEmails(project.teacher_email), label: names.length ? names.map(n => `${n}老師`).join('、') : '老師' };
  };

  let to, toLabel, ccPeople, subject, paragraphs;

  if (kind === 'recording') {
    to = emailOf(assistant);
    toLabel = project.sales_assistant || '業助';
    ccPeople = [[rep, project.sales_rep]];
    subject = `${name} - 錄音稿`;
    paragraphs = [
      [`Dear ${project.sales_assistant || ''},`],
      [],
      ['附件是 ', em(name), ' 的錄音稿，請查收。'],
      [],
      ['Best regards,'],
      [sender?.full_name || senderName],
    ];
  } else {
    const t = teacher();
    to = t.emails;
    toLabel = t.label;
    ccPeople = [[rep, project.sales_rep], [assistant, project.sales_assistant]];
    const salutation = teacherSalutation(project.teacher_name);
    if (kind === 'review') {
      subject = `${name} - 請閱卷`;
      const contact = rep?.zh_name || project.sales_rep || '負責業務';
      paragraphs = [
        [salutation],
        [],
        ['附件是 ', em(name), ' 的教師卷。'],
        [],
        [`請老師看過後，如有問題或是可以錄音，請與${contact}專員聯絡，以利後續學生卷和錄音作業。謝謝您。`],
        [],
        ['Best regards,'],
        [SIGN_OFF],
      ];
    } else {
      subject = `${name} - 教師卷 & 學生卷`;
      paragraphs = [
        [salutation],
        [],
        ['附件是 ', em(name), ' 的 ', em('教師卷'), ' 與 ', em('學生卷'), ' ，請您查收。如有任何疑問，或是需要調整的部分，歡迎隨時回覆，儘快為您處理，謝謝您。'],
        [],
        ['Best regards,'],
        [SIGN_OFF],
      ];
    }
  }

  // 副本不重複收件人，也不副本給寄件人自己（例如業務自己出題時）
  const ccEntries = ccPeople.filter(([, n]) => n && n !== senderName);
  const cc = [...new Set(ccEntries.flatMap(([p]) => emailOf(p)))].filter(e => !to.includes(e));
  const ccLabel = ccEntries.map(([, n]) => n).join('、');

  return { to, cc, subject, paragraphs, toLabel, ccLabel };
}

export function plainBody(paragraphs) {
  return paragraphs.map(parts => parts.map(s => s.em ?? s).join('')).join('\n');
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Outlook 以 Word 解讀 HTML：font-family 管英數字、mso-fareast-font-family 管中文，兩個都要設。
// 樣式直接寫在每一段與每個 span 上（空行也要，行高才一致），單行間距、段落前後不留距離
const fontStyle = (font) => `font-family:"${font}",serif;mso-fareast-font-family:"${font}"`;
const PARAGRAPH_STYLE = `margin:0;line-height:normal;font-size:${BODY_SIZE};${fontStyle(BODY_FONT)}`;
const EMPHASIS_STYLE = `${fontStyle(EMPHASIS_FONT)};color:${EMPHASIS_COLOR}`;

export function htmlBody(paragraphs) {
  const renderPart = (s) => typeof s === 'string'
    ? escapeHtml(s)
    : `<span style='${EMPHASIS_STYLE}'>${escapeHtml(s.em)}</span>`;
  const lines = paragraphs.map(parts => `<p class="MsoNormal" style='${PARAGRAPH_STYLE}'>${parts.length ? parts.map(renderPart).join('') : '&nbsp;'}</p>`);
  return `<html><head><meta charset="utf-8"></head><body>\r\n${lines.join('\r\n')}\r\n</body></html>`;
}

function base64Utf8(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// 主旨含中文要用 RFC 2047 編碼；每段編碼字不超過 75 字元，所以原文每段控制在 45 bytes 內
function encodeHeader(text) {
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  const chunks = [];
  let chunk = '';
  for (const ch of text) {
    if (new TextEncoder().encode(chunk + ch).length > 45) { chunks.push(chunk); chunk = ''; }
    chunk += ch;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map(c => `=?UTF-8?B?${base64Utf8(c)}?=`).join('\r\n ');
}

// X-Unsent: 1 讓傳統版 Outlook 把檔案當成尚未寄出的新郵件開啟；不寫 From，寄件人用 Outlook 預設帳號
export function emlContent({ to, cc, subject, paragraphs }) {
  const headers = [
    'X-Unsent: 1',
    `To: ${to.join(', ')}`,
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  const body = base64Utf8(htmlBody(paragraphs)).replace(/.{76}/g, '$&\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${body}\r\n`;
}

export function downloadEml(mail) {
  const url = URL.createObjectURL(new Blob([emlContent(mail)], { type: 'message/rfc822' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${mail.subject.replace(/[\\/:*?"<>|]/g, '_')}.eml`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Outlook 的多位收件人以分號分隔（逗號在 Outlook 預設不認）
export function mailtoHref({ to, cc, subject, paragraphs }) {
  const addresses = (list) => list.map(a => encodeURIComponent(a).replace(/%40/g, '@')).join(';');
  const params = [];
  if (cc.length) params.push(`cc=${addresses(cc)}`);
  params.push(`subject=${encodeURIComponent(subject)}`);
  params.push(`body=${encodeURIComponent(plainBody(paragraphs).replace(/\n/g, '\r\n'))}`);
  return `mailto:${addresses(to)}?${params.join('&')}`;
}
