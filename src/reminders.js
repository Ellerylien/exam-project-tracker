// 待申請提醒：從已申請的案件往後推「下一次」該申請的段考。
//
// 推算結果不存資料庫，每次由案件即時算出，建立申請後提醒自然消失；
// 資料庫 reminder_overrides 只記業務做的例外（略過、學期到此為止、停止提醒、手動新增）。
//
// 規則（與業務確認過）：
//   - 系列 = 案件名稱去掉「學年／學期／第幾次」後剩下的部分，例如「慈濟中學國一段考」
//   - 第一次 → 第二次 → 第三次 → 下學期第一次 → … → 下學期第三次
//   - 不跨學年推算；每個系列只提醒下一次；不顯示預估日期
//   - 開學考、單字比賽等不推算，需要時手動新增

const TERM_RE = /(\d{3})\s*(?:學年度?)?\s*(上學期|下學期|第\s*[一二12]\s*學期|上|下)/;
const EXAM_NO_RE = /第\s*([一二三四1-4])\s*次/;
const CN_DIGITS = ['', '一', '二', '三', '四'];

const MAX_EXAMS_PER_TERM = 3;

const compact = (s) => (s || '').replace(/\s+/g, '');

// 台灣學年度從 8 月開始：2026-09 屬於 115 學年，2027-03 也還是 115 學年
export function currentSchoolYear(today = new Date()) {
  const year = today.getFullYear() - 1911;
  return today.getMonth() >= 7 ? year : year - 1;
}

// 解析段考名稱。無法辨識的名稱（開學考、單字比賽、沒有學期或次數的測驗…）回傳 null，不參與推算。
export function parseExamName(name) {
  if (!name || !/段考|期中考/.test(name)) return null;
  const termMatch = name.match(TERM_RE);
  const examMatch = name.match(EXAM_NO_RE);
  if (!termMatch || !examMatch) return null;

  return {
    seriesKey: compact(name.replace(TERM_RE, '').replace(EXAM_NO_RE, '')),
    schoolYear: Number(termMatch[1]),
    term: /上|一|1/.test(termMatch[2]) ? '上' : '下',
    examNo: /\d/.test(examMatch[1]) ? Number(examMatch[1]) : CN_DIGITS.indexOf(examMatch[1]),
  };
}

const slotOrder = (s) => s.schoolYear * 100 + (s.term === '下' ? 10 : 0) + s.examNo;

export const sameSlot = (a, b) =>
  !!a && !!b && a.seriesKey === b.seriesKey && a.schoolYear === b.schoolYear && a.term === b.term && a.examNo === b.examNo;

// 畫面用的簡短標示：「115上第一次」
export const slotLabel = (slot) => (slot ? `${slot.schoolYear}${slot.term}第${CN_DIGITS[slot.examNo]}次` : '');

export const examNoText = (n) => CN_DIGITS[n] ?? String(n);

// 用上一份案件的寫法產生下一次的名稱，只替換學期與次數，保留學校自己的命名習慣
export function renameToSlot(name, slot) {
  return name
    .replace(EXAM_NO_RE, (whole, digit) =>
      whole.replace(digit, /\d/.test(digit) ? String(slot.examNo) : CN_DIGITS[slot.examNo]))
    .replace(TERM_RE, (whole, _year, termText) =>
      slot.term === '下' ? whole.replace(termText, termText.replace('上', '下').replace('一', '二').replace('1', '2')) : whole);
}

// 下一格：同學期下一次 → 下學期第一次 → 沒有（不跨學年）。
// endsAt(term) 回傳該學期被標記「到此為止」的次數（該次起不考），沒標記為 Infinity。
function nextSlot(latest, endsAt) {
  const { schoolYear, term, examNo } = latest;
  if (examNo + 1 <= MAX_EXAMS_PER_TERM && examNo + 1 < endsAt(term)) {
    return { schoolYear, term, examNo: examNo + 1 };
  }
  if (term === '上' && 1 < endsAt('下')) {
    return { schoolYear, term: '下', examNo: 1 };
  }
  return null;
}

const teacherKey = (name) => compact(name).replace(/老師$/, '');

// 閱卷老師有兩種學校：每次都同一位、每次都不同人。
// 同學年至少考過兩次且都是同一位 → teacherFixed，建立申請時直接帶入；
// 只考過一次或歷次不同 → 不帶入（必填欄位空著，業務一定會注意到），改列出之前的老師供一鍵沿用。
function teacherHistory(entries) {
  const withTeacher = entries.filter(e => teacherKey(e.project.teacher_name));
  const teachers = [];
  for (const { slot, project } of [...withTeacher].reverse()) {
    if (teachers.some(t => teacherKey(t.teacher_name) === teacherKey(project.teacher_name))) continue;
    teachers.push({ teacher_name: project.teacher_name, teacher_email: project.teacher_email || '', label: slotLabel(slot) });
  }
  return { teachers, teacherFixed: withTeacher.length >= 2 && teachers.length === 1 };
}

// 算出所有業務的待申請提醒（呼叫端再依業務篩選）。
// projects 必須是完整清單，不可用搜尋過濾後的結果，否則會誤判「還沒申請」。
export function computeReminders(projects, overrides, today = new Date()) {
  const thisYear = currentSchoolYear(today);

  const series = new Map();
  for (const project of projects) {
    const slot = parseExamName(project.name);
    if (!slot) continue;
    if (!series.has(slot.seriesKey)) series.set(slot.seriesKey, []);
    series.get(slot.seriesKey).push({ slot, project });
  }

  const overridesOf = (key, ...kinds) => overrides.filter(o => o.series_key === key && kinds.includes(o.kind));
  const toSlot = (o) => ({ seriesKey: o.series_key, schoolYear: o.school_year, term: o.term, examNo: o.exam_no });

  const reminders = [];
  for (const [seriesKey, entries] of series) {
    if (overridesOf(seriesKey, 'stop_series').length) continue;

    entries.sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
    const latestEntry = entries[entries.length - 1];
    // 略過或已標記申請的格子，在推算時視同已經有案件
    const occupied = [...entries.map(e => e.slot), ...overridesOf(seriesKey, 'skip', 'applied').map(toSlot)];
    const latest = occupied.reduce((a, b) => (slotOrder(b) > slotOrder(a) ? b : a));

    const endsAt = (term) => Math.min(Infinity, ...overridesOf(seriesKey, 'end_term')
      .filter(o => o.school_year === latest.schoolYear && o.term === term)
      .map(o => o.exam_no));

    const next = nextSlot(latest, endsAt);
    if (!next || next.schoolYear < thisYear) continue;

    const slot = { seriesKey, ...next };
    reminders.push({
      id: `auto:${seriesKey}:${next.schoolYear}${next.term}${next.examNo}`,
      type: 'auto',
      slot,
      name: renameToSlot(latestEntry.project.name, slot),
      basedOn: latestEntry.project,
      basedOnSlot: latestEntry.slot,
      salesRep: latestEntry.project.sales_rep,
      ...teacherHistory(entries.filter(e => e.slot.schoolYear === next.schoolYear)),
    });
  }

  // 手動提醒：已有同名或同一格的案件就視為完成；若與推算重複，保留手動那筆
  const projectNames = new Set(projects.map(p => compact(p.name)));
  const projectSlots = projects.map(p => parseExamName(p.name)).filter(Boolean);
  for (const o of overrides) {
    if (o.kind !== 'manual') continue;
    const slot = parseExamName(o.name);
    if (projectNames.has(compact(o.name)) || projectSlots.some(s => sameSlot(s, slot))) continue;

    const duplicate = reminders.findIndex(r => sameSlot(r.slot, slot));
    if (duplicate !== -1) reminders.splice(duplicate, 1);
    reminders.push({
      id: `manual:${o.id}`,
      type: 'manual',
      slot,
      name: o.name,
      override: o,
      salesRep: o.sales_rep,
      teachers: [],
      teacherFixed: false,
    });
  }

  // 推算的依上一次審稿日排序（先考的學校先該申請），手動新增的排在最後
  return reminders.sort((a, b) =>
    (a.type === b.type ? 0 : a.type === 'auto' ? -1 : 1) ||
    (a.basedOn?.deadline || '9999').localeCompare(b.basedOn?.deadline || '9999') ||
    a.name.localeCompare(b.name, 'zh-Hant'));
}
