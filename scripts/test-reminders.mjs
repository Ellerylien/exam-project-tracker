// 開發用：驗證「待申請提醒」的推算規則（src/reminders.js）。純邏輯，不連資料庫。
//
// 用法：node scripts/test-reminders.mjs

import assert from 'node:assert/strict';
import { parseExamName, computeReminders, renameToSlot, currentSchoolYear } from '../src/reminders.js';

const TODAY = new Date('2026-09-17T10:00:00');
let passed = 0;
const test = (label, fn) => { fn(); passed += 1; console.log(`✓ ${label}`); };

const project = (name, deadline, extra = {}) => ({ id: name, name, deadline, sales_rep: 'Deborah', ...extra });
const only = (projects, overrides = []) => computeReminders(projects, overrides, TODAY);

test('學年度從 8 月起算', () => {
  assert.equal(currentSchoolYear(TODAY), 115);
  assert.equal(currentSchoolYear(new Date('2027-03-01')), 115);
  assert.equal(currentSchoolYear(new Date('2027-08-01')), 116);
});

test('辨識各種段考命名格式', () => {
  assert.deepEqual(parseExamName('慈濟中學115上國一第一次段考'),
    { seriesKey: '慈濟中學國一段考', schoolYear: 115, term: '上', examNo: 1 });
  assert.equal(parseExamName('瀛海中學115 上國一第一次段考').seriesKey, '瀛海中學國一段考');
  assert.equal(parseExamName('115學年度第一學期黎明中學國一英聽第一次段考').seriesKey, '黎明中學國一英聽段考');
  assert.equal(parseExamName('台南大學附中 115學年度第1學期二年級學術普高【英文閱讀】第一次期中考').examNo, 1);
  assert.equal(parseExamName('玉井工商115學年度第一學期第一次英聽段考 (初級)').seriesKey, '玉井工商英聽段考(初級)');
  assert.equal(parseExamName('明達中學115上國二第三次段考').examNo, 3);
});

test('開學考、單字比賽、沒有次數的測驗不推算', () => {
  assert.equal(parseExamName('南科實中115上八年級英語開學考'), null);
  assert.equal(parseExamName('南科實中 115學年上學期高二 開學考 英文聽力測驗'), null);
  assert.equal(parseExamName('台南慈濟高中115學年度英文單字比賽'), null);
  assert.equal(parseExamName('新化高工115學年第1學期英文聽力測驗'), null);
  assert.equal(only([project('南科實中115上八年級英語開學考', '2026-07-10')]).length, 0);
});

test('產生下一次名稱時保留原本寫法', () => {
  const next = { examNo: 2, term: '上' };
  assert.equal(renameToSlot('慈濟中學115上國一第一次段考', next), '慈濟中學115上國一第二次段考');
  assert.equal(renameToSlot('115學年度第一學期黎明中學國一英聽第一次段考', next), '115學年度第一學期黎明中學國一英聽第二次段考');
  assert.equal(renameToSlot('台南市立土城高中115學年度上學期 高三 第一次段考英文聽力試題', next), '台南市立土城高中115學年度上學期 高三 第二次段考英文聽力試題');
  assert.equal(renameToSlot('明達中學115上國二第三次段考', { examNo: 1, term: '下' }), '明達中學115下國二第一次段考');
  assert.equal(renameToSlot('台南大學附中 115學年度第1學期二年級第1次期中考', { examNo: 1, term: '下' }), '台南大學附中 115學年度第2學期二年級第1次期中考');
});

test('第一次 → 第二次，提醒不帶日期', () => {
  const [r] = only([project('慈濟中學115上國一第一次段考', '2026-09-07')]);
  assert.equal(r.name, '慈濟中學115上國一第二次段考');
  assert.equal(r.salesRep, 'Deborah');
  assert.equal('expectedDate' in r, false);
});

test('已申請的次數不再提醒，只提醒下一次', () => {
  const list = only([
    project('明達中學115上國二第一次段考', '2026-09-10'),
    project('明達中學115上國二第二次段考', '2026-10-26'),
    project('明達中學115上國二第三次段考', '2026-12-14'),
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, '明達中學115下國二第一次段考');
});

test('依上一次審稿日排序，手動新增的排最後', () => {
  const list = only([
    project('港明中學115上國一第一次段考', '2026-09-15'),
    project('慈濟中學115上國一第一次段考', '2026-09-07'),
  ], [{ id: 'm1', kind: 'manual', name: '台南高商115下一年級開學考', sales_rep: 'Deborah' }]);
  assert.deepEqual(list.map(r => r.name), ['慈濟中學115上國一第二次段考', '港明中學115上國一第二次段考', '台南高商115下一年級開學考']);
});

test('不跨學年：下學期第三次之後、以及上一學年的系列都不提醒', () => {
  assert.equal(only([project('慈濟中學115下國一第三次段考', '2027-06-01')]).length, 0);
  assert.equal(only([project('慈濟中學114下國一第一次段考', '2026-03-01')]).length, 0);
});

test('略過這一次 → 跳到再下一次', () => {
  const [r] = only([project('慈濟中學115上國一第一次段考', '2026-09-07')],
    [{ kind: 'skip', series_key: '慈濟中學國一段考', school_year: 115, term: '上', exam_no: 2 }]);
  assert.equal(r.name, '慈濟中學115上國一第三次段考');
});

test('本學期到此為止 → 跳到下學期第一次', () => {
  const [r] = only([project('慈濟中學115上國一第一次段考', '2026-09-07')],
    [{ kind: 'end_term', series_key: '慈濟中學國一段考', school_year: 115, term: '上', exam_no: 2 }]);
  assert.equal(r.name, '慈濟中學115下國一第一次段考');
});

test('整個系列停止提醒', () => {
  const list = only([project('慈濟中學115上國一第一次段考', '2026-09-07')],
    [{ kind: 'stop_series', series_key: '慈濟中學國一段考' }]);
  assert.equal(list.length, 0);
});

test('從提醒建立但名稱對不上（applied）→ 視為已申請', () => {
  const [r] = only([project('慈濟中學115上國一第一次段考', '2026-09-07')],
    [{ kind: 'applied', series_key: '慈濟中學國一段考', school_year: 115, term: '上', exam_no: 2 }]);
  assert.equal(r.name, '慈濟中學115上國一第三次段考');
});

test('手動提醒：建好同名案件後消失；與推算重複時保留手動那筆', () => {
  const manual = { id: 'm1', kind: 'manual', name: '家齊高中116學年度英文單字比賽', sales_rep: 'Deborah' };
  assert.equal(only([], [manual]).length, 1);
  assert.equal(only([project('家齊高中 116學年度英文單字比賽', '2027-07-20')], [manual]).length, 0);

  const dup = { id: 'm2', kind: 'manual', name: '慈濟中學115上國一第二次段考', sales_rep: 'Deborah' };
  const list = only([project('慈濟中學115上國一第一次段考', '2026-09-07')], [dup]);
  assert.equal(list.length, 1);
  assert.equal(list[0].type, 'manual');
});

test('系列歸屬最新一份案件的業務', () => {
  const [r] = only([
    project('慈濟中學115上國一第一次段考', '2026-09-07', { sales_rep: 'Deborah' }),
    project('慈濟中學115上國一第二次段考', '2026-10-22', { sales_rep: 'Mark' }),
  ]);
  assert.equal(r.salesRep, 'Mark');
});

test('閱卷老師：只考過一次 → 不確定是否固定，列出供沿用', () => {
  const [r] = only([project('慈濟中學115上國一第一次段考', '2026-09-07', { teacher_name: '寧凱婕', teacher_email: 'a@x.tw' })]);
  assert.equal(r.teacherFixed, false);
  assert.deepEqual(r.teachers, [{ teacher_name: '寧凱婕', teacher_email: 'a@x.tw', label: '115上第一次' }]);
});

test('閱卷老師：兩次以上都是同一位 → 固定，直接帶入', () => {
  const [r] = only([
    project('明達中學115上國二第一次段考', '2026-09-10', { teacher_name: '周依琳', teacher_email: 'old@x.tw' }),
    project('明達中學115上國二第二次段考', '2026-10-26', { teacher_name: '周依琳 老師', teacher_email: 'new@x.tw' }),
  ]);
  assert.equal(r.teacherFixed, true);
  assert.deepEqual(r.teachers, [{ teacher_name: '周依琳 老師', teacher_email: 'new@x.tw', label: '115上第二次' }]);
});

test('閱卷老師：歷次不同 → 不帶入，由新到舊列出每一位', () => {
  const [r] = only([
    project('德光中學115上高一第一次段考', '2026-09-11', { teacher_name: '黃秀梅', teacher_email: 'a@x.tw' }),
    project('德光中學115上高一第二次段考', '2026-10-26', { teacher_name: '陳秋雯', teacher_email: 'b@x.tw' }),
  ]);
  assert.equal(r.teacherFixed, false);
  assert.deepEqual(r.teachers.map(t => t.teacher_name), ['陳秋雯', '黃秀梅']);
});

test('閱卷老師：只看同一學年，上一學年的老師不算', () => {
  const [r] = only([
    project('慈濟中學114下國一第三次段考', '2026-06-01', { teacher_name: '去年老師' }),
    project('慈濟中學115上國一第一次段考', '2026-09-07', { teacher_name: '寧凱婕' }),
  ]);
  assert.deepEqual(r.teachers.map(t => t.teacher_name), ['寧凱婕']);
  assert.equal(r.teacherFixed, false);
});

console.log(`\n全部通過（${passed} 項）`);
