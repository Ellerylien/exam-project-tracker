// 開發用：對「段考申請表 Sample」資料夾裡的每個檔案跑一次完整流程
// （擷取文字 → regex 解析 → 算審稿截止日），把結果印出來方便核對。零成本、不需要 API key。
//
// 用法（PowerShell）：
//   node scripts/test-parse-form.mjs "C:\Users\ellerylien\Desktop\段考申請表 Sample"
// 不帶參數時，預設讀上面那個 Sample 路徑。

import fs from 'fs';
import path from 'path';
import WordExtractor from 'word-extractor';
import { normalizeText, parseExamForm, computeDeadline } from '../api/parse-exam-form.js';

const DIR = process.argv[2] || 'C:/Users/ellerylien/Desktop/段考申請表 Sample';
const extractor = new WordExtractor();
const files = fs.readdirSync(DIR).filter((f) => /\.docx?$/i.test(f));

let total = 0;
let filled = 0;
const FIELDS = ['name', 'deadline', 'teacher_name', 'teacher_email', 'scope', 'notes'];

for (const f of files) {
  const text = normalizeText((await extractor.extract(path.join(DIR, f))).getBody());
  const fields = parseExamForm(text);
  const { deadline, source } = computeDeadline(fields.review_date, fields.school_receipt_date);
  const data = { ...fields, deadline };

  console.log(`■ ${f}`);
  console.log(`  專案名稱   : ${data.name || '（空）'}`);
  console.log(`  審稿截止日 : ${deadline || '（空）'}  [來源:${source}]  (審題日:${fields.review_date || '–'} / 收件日:${fields.school_receipt_date || '–'})`);
  console.log(`  閱卷老師   : ${data.teacher_name || '（空）'}`);
  console.log(`  Email      : ${data.teacher_email || '（空）'}`);
  console.log(`  考試範圍   : ${fields.scope === '' ? '（留白）' : fields.scope}`);
  console.log(`  注意事項   : ${(data.notes || '（空）').replace(/\n/g, ' / ')}`);
  console.log('');

  // 統計：scope 留白視為「正確帶入」，其餘欄位非空才算帶到
  for (const k of FIELDS) {
    total += 1;
    if (k === 'scope') filled += 1; // 規則上 scope 可能正確地留白
    else if (data[k]) filled += 1;
  }
}

console.log(`帶入率（不含 scope 例外）：約 ${Math.round((filled / total) * 100)}%（${filled}/${total} 欄）`);
