/* global process */
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const TEMPLATE_FILES = {
  LT: 'LT-2026.docx',
  SC: 'SC-2025.docx',
};

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function cleanXmlText(value) {
  const safe = [...String(value ?? '')]
    .filter((character) => {
      const code = character.codePointAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join('');
  return safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}/${match[2]}/${match[3]}` : String(value || '');
}

function findDirectChild(xml, parent, tagName, occurrence) {
  const tokenRe = /<\/?([A-Za-z_][\w:.-]*)(?:\s[^<>]*?)?\/?>/g;
  tokenRe.lastIndex = parent.openEnd;
  const stack = [];
  let seen = 0;
  let target = null;

  while (true) {
    const match = tokenRe.exec(xml);
    if (!match || match.index >= parent.closeStart) break;
    const token = match[0];
    const name = match[1];
    const closing = token.startsWith('</');
    const selfClosing = /\/>$/.test(token);

    if (closing) {
      const opened = stack.pop();
      if (!opened || opened.name !== name) throw new Error(`Invalid OOXML near ${name}`);
      if (stack.length === 0 && target && opened.start === target.start) {
        return {
          start: opened.start,
          openEnd: opened.openEnd,
          closeStart: match.index,
          end: tokenRe.lastIndex,
        };
      }
      continue;
    }

    if (stack.length === 0 && name === tagName) {
      seen += 1;
      if (seen === occurrence) {
        target = { name, start: match.index, openEnd: tokenRe.lastIndex };
        if (selfClosing) {
          return {
            start: match.index,
            openEnd: tokenRe.lastIndex,
            closeStart: tokenRe.lastIndex,
            end: tokenRe.lastIndex,
          };
        }
      }
    }

    if (!selfClosing) stack.push({ name, start: match.index, openEnd: tokenRe.lastIndex });
  }

  throw new Error(`Template slot not found: ${tagName}[${occurrence}]`);
}

function rootRange(xml) {
  return { openEnd: 0, closeStart: xml.length };
}

function cellRange(xml, tableNumber, rowNumber, cellNumber) {
  const document = findDirectChild(xml, rootRange(xml), 'w:document', 1);
  const body = findDirectChild(xml, document, 'w:body', 1);
  const table = findDirectChild(xml, body, 'w:tbl', tableNumber);
  const row = findDirectChild(xml, table, 'w:tr', rowNumber);
  return findDirectChild(xml, row, 'w:tc', cellNumber);
}

function paragraphXml(originalCell, value, { fontSize = null, lineHeight = null } = {}) {
  const tcPr = originalCell.match(/<w:tcPr(?:\s[^>]*)?>[\s\S]*?<\/w:tcPr>/)?.[0] || '';
  let pPr = originalCell.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] || '';
  if (lineHeight) {
    const spacing = `<w:spacing w:before="0" w:after="0" w:line="${lineHeight}" w:lineRule="exact"/>`;
    if (pPr) {
      pPr = pPr.replace(/<w:spacing(?:\s[^>]*)?\/>/g, '').replace('</w:pPr>', `${spacing}</w:pPr>`);
    } else {
      pPr = `<w:pPr>${spacing}</w:pPr>`;
    }
  }
  const parts = String(value ?? '').split(/\r?\n/);
  const content = parts
    .map((part, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${cleanXmlText(part)}</w:t>`)
    .join('');
  const rPr = fontSize ? `<w:rPr><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr>` : '';
  return `${tcPr}<w:p>${pPr}<w:r>${rPr}${content}</w:r></w:p>`;
}

function replaceCell(xml, tableNumber, rowNumber, cellNumber, value, options = {}) {
  const range = cellRange(xml, tableNumber, rowNumber, cellNumber);
  const originalCell = xml.slice(range.openEnd, range.closeStart);
  const replacement = paragraphXml(originalCell, value, options);
  return xml.slice(0, range.openEnd) + replacement + xml.slice(range.closeStart);
}

function setCell(xml, slot, value, options = {}) {
  return replaceCell(xml, slot[0], slot[1], slot[2], value, options);
}

function checked(value) {
  return value ? '☒' : '☐';
}

function splitNotes(value, count) {
  const raw = String(value || '').trim();
  let parts = raw
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    parts = (raw.match(/[^。]+(?:。|$)/g) || [])
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const result = Array.from({ length: count }, () => '');
  parts.forEach((part, index) => {
    const target = Math.min(index, count - 1);
    result[target] = result[target] ? `${result[target]} ${part}` : part;
  });
  return result;
}

function validateApplication(application) {
  const missing = [];
  if (!['LT', 'SC'].includes(application?.level)) missing.push('level');
  if (!application?.school) missing.push('school');
  if (!application?.grade_exam) missing.push('grade_exam');
  if (!application?.product_name) missing.push('product_name');
  if (!application?.teacher?.name) missing.push('teacher.name');
  if (!application?.teacher?.email) missing.push('teacher.email');
  if (!application?.schedule?.exam_date) missing.push('schedule.exam_date');
  if (!application?.schedule?.school_receipt_date) missing.push('schedule.school_receipt_date');
  return missing;
}

function applyCommonFields(xml, application) {
  const range = application.range?.months?.[0] || {};
  const month = range.month ? `${range.month}月` : '';
  const lessons = new Set(range.lessons || []);
  const difficulty = application.difficulty || '';
  const audio = application.audio || {};
  const layout = application.layout || {};

  const values = [
    [[1, 1, 2], application.school],
    [[1, 1, 4], application.grade_exam],
    [[1, 2, 2], application.product_name],
    [[1, 2, 4], application.teacher?.name || ''],
    [[1, 3, 2], application.teacher?.phone || ''],
    [[1, 3, 4], application.teacher?.email || ''],
    [[1, 6, 1], month],
    [[1, 6, 2], `All${checked(range.all)}`],
    [[1, 8, 2], `L ${checked(difficulty === 'L')}`],
    [[1, 8, 3], `M ${checked(difficulty === 'M')}`],
    [[1, 8, 4], `H ${checked(difficulty === 'H')}`],
    [[1, 8, 6], formatDate(application.schedule?.exam_date)],
    [[1, 8, 8], formatDate(application.schedule?.school_receipt_date)],
    [[1, 9, 2], `${checked(audio.cloud_link)} Gmail／雲端連結（MP3自行下載）\n${checked(Number(audio.mp3_count) > 0)} MP3格式 片數：${Number(audio.mp3_count) || 0}片\n${checked(Number(audio.cd_count) > 0)} CD格式 片數：${Number(audio.cd_count) || 0}片`],
    [[1, 9, 4], `${checked(layout.a4_portrait)} A4直\n${checked(layout.b4_portrait)} B4直\n${checked(layout.b4_landscape)} B4橫\n${checked(Boolean(layout.other))} 其他：${layout.other || ''}`],
  ];

  for (let lesson = 1; lesson <= 14; lesson += 1) {
    values.push([[1, 6, lesson + 2], `L${lesson}${checked(lessons.has(lesson))}`]);
  }
  for (const [slot, value] of values) xml = setCell(xml, slot, value);
  return xml;
}

function applyLtFields(xml, application) {
  const listening = application.assessments?.listening || {};
  const options = listening.audio_options || {};
  const notes = splitNotes(listening.notes || application.notes || '', 3);
  const pictureGap = options.picture_gap_seconds || '';
  const otherGap = options.other_gap_seconds || '';
  const repeat = Number(options.repeat) || 2;
  const quick = Boolean(options.quick_fill);

  const values = [
    [[2, 14, 2], `${checked(quick)} 參照國中教育會考 （若勾選以下無需填寫）\n（每題唸兩遍：每遍間隔4秒）`],
    [[2, 16, 2], `${checked(options.speed === 'reference' || (!options.speed && !quick))} 參照會考`],
    [[2, 17, 2], `${checked(options.speed === 'faster')} 比會考快`],
    [[2, 18, 2], `${checked(options.speed === 'slower')} 比會考慢`],
    [[2, 19, 6], pictureGap ? `${pictureGap}秒（自訂）☒` : '____秒（自訂）☐'],
    [[2, 20, 6], otherGap ? `${otherGap}秒（自訂）☒` : '____秒（自訂）☐'],
    [[2, 21, 2], `${checked(repeat === 1)} 每題唸1遍`],
    [[2, 21, 3], `${checked(repeat === 2)} 每題唸2遍`],
    [[2, 24, 2], notes[0], { fontSize: 14, lineHeight: 160 }],
    [[2, 24, 3], notes[1], { fontSize: 14, lineHeight: 160 }],
    [[2, 24, 4], notes[2], { fontSize: 14, lineHeight: 160 }],
  ];
  for (const [slot, value, options] of values) xml = setCell(xml, slot, value, options);
  return xml;
}

function applyScFields(xml, application) {
  const listening = application.assessments?.listening || {};
  const reading = application.assessments?.reading || {};
  const options = listening.audio_options || {};
  const quick = options.quick_fill ?? true;
  const listeningNotes = splitNotes(listening.notes || '', 3);
  const readingNotes = splitNotes(reading.notes || '', 3);
  const counts = reading.counts || {};

  const values = [
    [[2, 36, 2], `${checked(quick)} 參照 TELC（若勾選以下無需填寫）\n（各題型秒數依大考英聽）`],
    [[2, 48, 2], listeningNotes[0]],
    [[2, 48, 3], listeningNotes[1]],
    [[2, 48, 4], listeningNotes[2]],
    [[3, 4, 2], counts['詞彙'] || ''],
    [[3, 5, 2], counts['綜合測驗'] || ''],
    [[3, 6, 2], counts['文意選填'] || ''],
    [[3, 7, 2], counts['篇章結構'] || ''],
    [[3, 8, 2], counts['閱讀理解'] || ''],
    [[3, 9, 2], counts['手寫題'] || ''],
    [[3, 10, 2], readingNotes[0]],
    [[3, 10, 3], readingNotes[1]],
    [[3, 10, 4], readingNotes[2]],
  ];
  for (const [slot, value] of values) xml = setCell(xml, slot, value);
  return xml;
}

function safeFilename(application) {
  const base = `${application.school}_${application.grade_exam}_${application.level}_申請表`
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return `${base || '測卷申請表'}.docx`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const application = body?.application;
    const missing = validateApplication(application);
    if (missing.length) {
      return sendJson(res, 400, { ok: false, error: `缺少必要欄位：${missing.join(', ')}` });
    }

    const templateName = TEMPLATE_FILES[application.level];
    const templatePath = path.join(process.cwd(), 'templates', templateName);
    const template = await fs.readFile(templatePath);
    const zip = await JSZip.loadAsync(template);
    const documentPart = zip.file('word/document.xml');
    if (!documentPart) throw new Error('範本缺少 word/document.xml');

    let xml = await documentPart.async('string');
    xml = applyCommonFields(xml, application);
    xml = application.level === 'SC'
      ? applyScFields(xml, application)
      : applyLtFields(xml, application);

    zip.file('word/document.xml', xml);
    const output = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const filename = safeFilename(application);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.status(200).send(output);
  } catch (error) {
    console.error('[generate-exam-form] error', error);
    return sendJson(res, 500, { ok: false, error: 'Word 申請表產生失敗' });
  }
}
