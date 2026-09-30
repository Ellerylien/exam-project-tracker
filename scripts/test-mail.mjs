// 開發用：驗證寄信範本（src/mail.js）的收件人、稱謂、.eml 草稿與 mailto 連結。純邏輯，不連資料庫。
//
// 用法：node scripts/test-mail.mjs

import assert from 'node:assert/strict';
import { buildMail, plainBody, htmlBody, emlContent, mailtoHref, teacherSalutation, splitEmails } from '../src/mail.js';

let passed = 0;
const test = (label, fn) => { fn(); passed += 1; console.log(`✓ ${label}`); };

const members = [
  { name: 'Ellery', email: 'ellery@example.com', full_name: 'Ellery Lien' },
  { name: 'Deborah', email: 'deborah@example.com', full_name: 'Deborah Hsu', zh_name: '許文瑜' },
  { name: 'Lisa', email: 'lisa@example.com', full_name: 'Lisa Ho', zh_name: '何佳真' },
  { name: 'Richard', email: 'richard@example.com' },
  { name: 'Wanda' },
];
const project = {
  name: '南科實中115上高二第一次段考',
  teacher_name: '楊舒如',
  teacher_email: 'akitty721@gmail.com',
  sales_rep: 'Deborah',
  sales_assistant: 'Lisa',
};
const body = (kind, p = project, sender = 'Ellery') => plainBody(buildMail(kind, p, members, sender).paragraphs);

test('老師稱謂取姓氏，多位老師都列出', () => {
  assert.equal(teacherSalutation('楊舒如'), '楊老師您好，');
  assert.equal(teacherSalutation('梁力仁+余忠諺'), '梁老師、余老師您好，');
  assert.equal(teacherSalutation('楊舒如 王小明'), '楊老師、王老師您好，');
  assert.equal(teacherSalutation('歐陽美華'), '歐陽老師您好，');
  assert.equal(teacherSalutation('楊老師'), '楊老師您好，');
  assert.equal(teacherSalutation('Mary Chen'), 'Mary Chen老師您好，');
  assert.equal(teacherSalutation(''), '老師您好，');
});

test('老師 Email 可用分號、逗號或空白分隔多位', () => {
  assert.deepEqual(splitEmails('a@x.com; b@x.com，c@x.com'), ['a@x.com', 'b@x.com', 'c@x.com']);
  assert.deepEqual(splitEmails(''), []);
});

test('請閱卷：寄老師，副本業務與業助，內文帶業務中文名', () => {
  const m = buildMail('review', project, members, 'Ellery');
  assert.deepEqual(m.to, ['akitty721@gmail.com']);
  assert.deepEqual(m.cc, ['deborah@example.com', 'lisa@example.com']);
  assert.equal(m.subject, '南科實中115上高二第一次段考 - 請閱卷');
  assert.match(body('review'), /^楊老師您好，\n\n附件是 南科實中115上高二第一次段考 的教師卷。/);
  assert.match(body('review'), /請與許文瑜專員聯絡/);
  assert.match(body('review'), /Best regards,\n空中英語教室$/);
});

test('錄音稿：寄業助，副本業務，署名是寄件人英文全名', () => {
  const m = buildMail('recording', project, members, 'Ellery');
  assert.deepEqual(m.to, ['lisa@example.com']);
  assert.deepEqual(m.cc, ['deborah@example.com']);
  assert.equal(m.subject, '南科實中115上高二第一次段考 - 錄音稿');
  assert.match(body('recording'), /^Dear Lisa,\n\n附件是 南科實中115上高二第一次段考 的錄音稿，請查收。/);
  assert.match(body('recording'), /Best regards,\nEllery Lien$/);
});

test('教師卷＆學生卷：寄老師，副本業務與業助', () => {
  const m = buildMail('papers', project, members, 'Ellery');
  assert.deepEqual(m.to, ['akitty721@gmail.com']);
  assert.deepEqual(m.cc, ['deborah@example.com', 'lisa@example.com']);
  assert.equal(m.subject, '南科實中115上高二第一次段考 - 教師卷 & 學生卷');
  assert.match(body('papers'), /附件是 南科實中115上高二第一次段考 的 教師卷 與 學生卷 ，請您查收。/);
});

test('業務自己寄信時不副本給自己', () => {
  const m = buildMail('recording', { ...project, sales_rep: 'Richard', sales_assistant: 'Lisa' }, members, 'Richard');
  assert.deepEqual(m.cc, []);
  assert.equal(m.ccLabel, '');
});

test('沒填 Email 的人不帶入，沒有收件人就寄不出去', () => {
  const m = buildMail('recording', { ...project, sales_rep: 'Richard', sales_assistant: 'Wanda' }, members, 'Ellery');
  assert.deepEqual(m.to, []);
  assert.deepEqual(m.cc, ['richard@example.com']);
  const r = buildMail('review', { ...project, teacher_email: '', sales_rep: 'Richard' }, members, 'Ellery');
  assert.deepEqual(r.to, []);
  assert.deepEqual(r.cc, ['richard@example.com', 'lisa@example.com']);
  assert.match(plainBody(r.paragraphs), /請與Richard專員聯絡/);
});

test('HTML 內文：思源宋體 Medium，專案名稱、教師卷、學生卷是 SemiBold 深紅，特殊字元會跳脫', () => {
  const html = htmlBody(buildMail('papers', project, members, 'Ellery').paragraphs);
  const red = [...html.matchAll(/<span style='font-family:"思源宋體 SemiBold",serif;mso-fareast-font-family:"思源宋體 SemiBold";color:#C00000'>(.*?)<\/span>/g)].map(m => m[1]);
  assert.deepEqual(red, ['南科實中115上高二第一次段考', '教師卷', '學生卷']);
  assert.doesNotMatch(html, /<b>|font-weight/);
  const paragraphs = [...html.matchAll(/<p class="MsoNormal" style='([^']*)'>/g)].map(m => m[1]);
  assert.equal(paragraphs.length, 6);
  assert.ok(paragraphs.every(s => s === 'margin:0;line-height:normal;font-size:14pt;font-family:"思源宋體 Medium",serif;mso-fareast-font-family:"思源宋體 Medium"'));
  assert.match(html, /'>&nbsp;<\/p>/);
  assert.match(htmlBody(buildMail('review', { ...project, name: 'A&B <測驗>' }, members, 'Ellery').paragraphs), /A&amp;B &lt;測驗&gt;/);
});

test('.eml 草稿：X-Unsent、收件人、中文主旨編碼、內文可還原', () => {
  const eml = emlContent(buildMail('review', project, members, 'Ellery'));
  const [head, encodedBody] = eml.split('\r\n\r\n');
  assert.ok(head.startsWith('X-Unsent: 1\r\n'));
  assert.match(head, /^To: akitty721@gmail\.com$/m);
  assert.match(head, /^Cc: deborah@example\.com, lisa@example\.com$/m);
  const subject = head.match(/^Subject: ([\s\S]*?)\r\nMIME/m)[1]
    .split(/\r\n /)
    .map(w => Buffer.from(w.match(/^=\?UTF-8\?B\?(.*)\?=$/)[1], 'base64').toString('utf8'))
    .join('');
  assert.equal(subject, '南科實中115上高二第一次段考 - 請閱卷');
  // 每段編碼字不超過 RFC 2047 的 75 字元
  assert.ok(head.match(/=\?UTF-8\?B\?.*?\?=/g).every(w => w.length <= 75));
  assert.ok(encodedBody.split('\r\n').every(line => line.length <= 76));
  const html = Buffer.from(encodedBody.replace(/\r\n/g, ''), 'base64').toString('utf8');
  assert.match(html, /楊老師您好，/);
  assert.match(html, /請與許文瑜專員聯絡/);
});

test('mailto：分號分隔、中文與換行都編碼', () => {
  const href = mailtoHref(buildMail('review', project, members, 'Ellery'));
  assert.ok(href.startsWith('mailto:akitty721@gmail.com?cc=deborah@example.com;lisa@example.com&subject='));
  const decoded = decodeURIComponent(href.split('&body=')[1]);
  assert.ok(decoded.startsWith('楊老師您好，\r\n\r\n附件是'));
  assert.equal(decodeURIComponent(href.split('&subject=')[1].split('&')[0]), '南科實中115上高二第一次段考 - 請閱卷');
});

console.log(`\n全部 ${passed} 項通過`);
