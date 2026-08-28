const CHECKED = new Set(['☒', '☑', '■', '●', '✓']);

function isChecked(mark) {
  return CHECKED.has((mark || '').trim());
}

function clean(value) {
  return (value || '').replace(/[ \t]+/g, ' ').trim();
}

function pick(text, re, group = 1) {
  const match = text.match(re);
  return match ? clean(match[group]) : '';
}

function parseIsoLikeDate(value) {
  const match = (value || '').match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function sliceSection(text, startLabel, endLabels = []) {
  const start = text.indexOf(startLabel);
  if (start < 0) return '';
  const candidates = endLabels
    .map((label) => text.indexOf(label, start + startLabel.length))
    .filter((index) => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : text.length;
  return text.slice(start, end).trim();
}

function extractNotes(section) {
  if (!section) return '';
  const index = section.lastIndexOf('備註');
  if (index < 0) return '';
  return section
    .slice(index + 2)
    .split('\n')
    .map(clean)
    .filter(Boolean)
    .join('；');
}

function parseRange(text, notes) {
  const block = sliceSection(text, '段考範圍', ['此測卷難易度']);
  const match = block.match(/(?:^|\n)(\d{1,2})月\s+([\s\S]*?)(?=\n_____月|$)/);
  if (!match) return { summary: '', months: [] };

  const month = Number(match[1]);
  const selection = match[2];
  const allMark = selection.match(/All\s*([☐☒☑■●✓])/i)?.[1];
  const lessons = [...selection.matchAll(/L(\d{1,2})\s*([☐☒☑■●✓])/gi)]
    .filter((item) => isChecked(item[2]))
    .map((item) => Number(item[1]));
  const week = notes.match(new RegExp(`${month}月\\s*(W\\d+(?:\\s*[+、,~～-]\\s*W?\\d+)*)`, 'i'))?.[1] || '';

  let selectionSummary = '';
  if (isChecked(allMark)) selectionSummary = 'All';
  else if (lessons.length) selectionSummary = lessons.map((lesson) => `L${lesson}`).join('、');
  else if (week) selectionSummary = week.replace(/\s+/g, '');

  return {
    summary: `${month}月${selectionSummary ? ` ${selectionSummary}` : ''}`,
    months: [{ month, all: isChecked(allMark), lessons, note: week }],
  };
}

function parseDifficulty(text) {
  const match = text.match(/此測卷難易度[\s\S]{0,120}?L\s*([☐☒☑■●✓])\s+M\s*([☐☒☑■●✓])\s+H\s*([☐☒☑■●✓])/);
  if (!match) return '';
  return ['L', 'M', 'H'].find((_, index) => isChecked(match[index + 1])) || '';
}

function parseDelivery(text) {
  const match = text.match(/^音檔收件方式\s+(.+?)\s+版面需求\s+(.+)$/m);
  const audioText = clean(match?.[1]);
  const layoutText = clean(match?.[2]);
  const count = (label) => Number(audioText.match(new RegExp(`${label}格式[^\\d]*(\\d+)片`))?.[1] || 0);
  return {
    audio: {
      cloud_link: /[☒☑■●✓]\s*Gmail/.test(audioText),
      mp3_count: count('MP3'),
      cd_count: count('CD'),
    },
    layout: {
      a4_portrait: /[☒☑■●✓]\s*A4直/.test(layoutText),
      b4_portrait: /[☒☑■●✓]\s*B4直/.test(layoutText),
      b4_landscape: /[☒☑■●✓]\s*B4橫/.test(layoutText),
      other: pick(layoutText, /[☒☑■●✓]\s*其他[：:]\s*([^☐☒☑■●✓]+)/),
    },
  };
}

function parseCounts(section, definitions) {
  const counts = {};
  for (const [key, pattern] of definitions) {
    const value = section.match(new RegExp(`(?:^|\\n)${pattern}[^\\n]*?\\s(\\d+)\\s`, 'm'))?.[1];
    if (value) counts[key] = Number(value);
  }
  return counts;
}

function parseAudioOptions(section) {
  const quickMark = section.match(/快速填表\s+([☐☒☑■●✓])/)?.[1];
  let speed = '';
  if (/[☒☑■●✓]\s*參照(?:會考|TELC|中級|初級)/i.test(section)) speed = 'reference';
  else if (/[☒☑■●✓]\s*比(?:會考|TELC|中級|初級)快/i.test(section)) speed = 'faster';
  else if (/[☒☑■●✓]\s*比(?:會考|TELC|中級|初級)慢/i.test(section)) speed = 'slower';

  const gap = (label) => {
    const line = section.match(new RegExp(`${label}[^\\n]*`))?.[0] || '';
    const custom = line.match(/(\d+)秒[^\n]*自訂[）)]?\s*([☐☒☑■●✓])/) || line.match(/(\d+)秒（自訂）([☐☒☑■●✓])/);
    return custom && isChecked(custom[2]) ? Number(custom[1]) : null;
  };
  const repeatLine = section.match(/播放方式\s+([^\n]+)/)?.[1] || '';
  const one = repeatLine.match(/([☐☒☑■●✓])\s*每題唸1遍/)?.[1];
  const two = repeatLine.match(/([☐☒☑■●✓])\s*每題唸2遍/)?.[1];

  return {
    quick_fill: isChecked(quickMark),
    speed,
    picture_gap_seconds: gap('圖題間隔'),
    other_gap_seconds: gap('其他間隔'),
    repeat: isChecked(two) ? 2 : (isChecked(one) ? 1 : null),
  };
}

function buildTypeSummary(label, notes, counts = {}) {
  const countText = Object.entries(counts)
    .map(([key, value]) => `${key} ${value}`)
    .join('、');
  const total = notes.match(/(?:聽力共|共)\s*(\d+)\s*題/)?.[1];
  return [label, total ? `共 ${total} 題` : '', countText].filter(Boolean).join('：').replace('：共', '，共');
}

export function isNewExamForm(text) {
  return /學校名稱\s+.+?\s+年級\s+/s.test(text)
    && /測卷名稱\/CD標籤\s+/.test(text)
    && /段考範圍/.test(text);
}

export function parseNewExamForm(text, { filename = '' } = {}) {
  const header = text.match(/學校名稱\s+(.+?)\s+年級\s+([^\n]+)/);
  const product = text.match(/測卷名稱\/CD標籤\s+(.+?)\s+出題老師\s+([^\n]+)/);
  const contact = text.match(/手機\s+(.+?)\s+E-?mail\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);

  const school = clean(header?.[1]);
  const grade_exam = clean(header?.[2]);
  const name = clean(product?.[1]);
  const teacher_name = clean(product?.[2]).replace(/\s*老師\s*$/, '');
  const teacher_phone = clean(contact?.[1]);
  const teacher_email = clean(contact?.[2]);

  const exam_date = parseIsoLikeDate(pick(text, /學校\s*\n?\s*段考日期\s+(\d{4}[/.-]\d{1,2}[/.-]\d{1,2})/));
  const school_receipt_date = parseIsoLikeDate(pick(text, /收件日\s*\n?\s*\(預設為考前一周\)\s+(\d{4}[/.-]\d{1,2}[/.-]\d{1,2})/));

  const cap = sliceSection(text, '國中教育會考 (CAP)', ['全民英檢初級 (GEPT)']);
  const geptElementary = sliceSection(text, '全民英檢初級 (GEPT)');
  const geptIntermediate = sliceSection(text, '全民英檢中級 (GEPT)', ['高中英語聽力測驗 (TELC)']);
  const telc = sliceSection(text, '高中英語聽力測驗 (TELC)', ['學測']);
  const gsat = sliceSection(text, '學測');

  const capNotes = extractNotes(cap);
  const geptElementaryNotes = extractNotes(geptElementary);
  const geptIntermediateNotes = extractNotes(geptIntermediate);
  const telcNotes = extractNotes(telc);
  const gsatNotes = extractNotes(gsat);
  const allNotes = [capNotes, geptElementaryNotes, geptIntermediateNotes, telcNotes, gsatNotes]
    .filter(Boolean)
    .join('\n');

  let level = '';
  if (/\bSC\b/i.test(filename) || text.includes('高中英語聽力測驗 (TELC)')) level = 'SC';
  else if (/\bLT\b/i.test(filename) || text.includes('國中教育會考 (CAP)')) level = 'LT';

  let listeningProfile = '';
  let listeningSection = '';
  let listeningNotes = '';
  if (telc && (/[☒☑■●✓]\s*參照\s*TELC/i.test(telc) || telcNotes)) {
    listeningProfile = 'TELC';
    listeningSection = telc;
    listeningNotes = telcNotes;
  } else if (cap && (/[☒☑■●✓]\s*參照國中教育會考/.test(cap) || capNotes)) {
    listeningProfile = 'CAP';
    listeningSection = cap;
    listeningNotes = capNotes;
  } else if (geptIntermediateNotes) {
    listeningProfile = 'GEPT 中級';
    listeningSection = geptIntermediate;
    listeningNotes = geptIntermediateNotes;
  } else if (geptElementaryNotes) {
    listeningProfile = 'GEPT 初級';
    listeningSection = geptElementary;
    listeningNotes = geptElementaryNotes;
  }

  const readingCounts = parseCounts(gsat, [
    ['詞彙', '詞彙\\(Vocabulary\\)'],
    ['綜合測驗', '綜合測驗\\(Cloze\\)'],
    ['文意選填', '文意選填\\(Passage Completion\\)'],
    ['篇章結構', '篇章結構\\(Discourse Structure\\)'],
    ['閱讀理解', '閱讀理解\\(Reading Comprehension\\)'],
    ['手寫題', '手寫題\\(混合題\\)'],
  ]);

  const range = parseRange(text, allNotes);
  const difficulty = parseDifficulty(text);
  const delivery = parseDelivery(text);
  const listening_types = buildTypeSummary(
    listeningProfile ? `聽力／${listeningProfile}` : '聽力',
    listeningNotes,
  );
  const reading_types = Object.keys(readingCounts).length
    ? buildTypeSummary('閱讀／學測', gsatNotes, readingCounts)
    : (level === 'LT' ? '無（本卷為聽力測驗）' : '');

  const notes = [
    listeningNotes ? `【${listeningProfile || '聽力'}】${listeningNotes}` : '',
    gsatNotes ? `【學測】${gsatNotes}` : '',
  ].filter(Boolean).join('\n');

  const required = {
    school,
    grade_exam,
    name,
    teacher_name,
    teacher_email,
    exam_date,
    school_receipt_date,
    scope: range.summary,
  };
  const missing_fields = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const application = {
    schema_version: 1,
    format: 'new',
    level,
    template: level === 'SC'
      ? '2025測卷申請表_空中英語教室_20250828更新'
      : '2026測卷申請表_大家說英語_20260102更新',
    source_filename: filename,
    school,
    grade_exam,
    product_name: name,
    teacher: {
      name: teacher_name,
      phone: teacher_phone,
      email: teacher_email,
    },
    range,
    difficulty,
    schedule: {
      exam_date,
      school_receipt_date,
    },
    ...delivery,
    assessments: {
      listening: {
        profile: listeningProfile,
        summary: listening_types,
        notes: listeningNotes,
        audio_options: parseAudioOptions(listeningSection),
        source_text: listeningSection,
      },
      reading: {
        profile: Object.keys(readingCounts).length ? '學測' : '',
        summary: reading_types,
        counts: readingCounts,
        notes: gsatNotes,
      },
    },
    notes,
  };

  return {
    format: 'new',
    level,
    name,
    review_date: null,
    school_receipt_date,
    teacher_name,
    teacher_email,
    teacher_phone,
    scope: range.summary,
    notes,
    listening_types,
    reading_types,
    sales_rep: '',
    sales_assistant: '',
    application,
    missing_fields,
  };
}
