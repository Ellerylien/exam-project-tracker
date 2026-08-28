import fs from 'node:fs';
import path from 'node:path';
import WordExtractor from 'word-extractor';
import { normalizeText, parseExamForm } from '../api/parse-exam-form.js';
import generateHandler from '../api/generate-exam-form.js';

const inputDir = process.argv[2];
const outputDir = process.argv[3];
if (!inputDir || !outputDir) {
  throw new Error('usage: node scripts/test-generate-form.mjs INPUT_DIR OUTPUT_DIR');
}
fs.mkdirSync(outputDir, { recursive: true });

const files = fs.readdirSync(inputDir)
  .filter((name) => /_新版申請表\.docx$/i.test(name));

for (const filename of files) {
  const inputPath = path.join(inputDir, filename);
  const extracted = await new WordExtractor().extract(inputPath);
  const text = normalizeText(extracted.getBody());
  const parsed = parseExamForm(text, { filename });
  if (!parsed.application) throw new Error(`No application data: ${filename}`);

  const state = { statusCode: 200, headers: {}, body: null };
  const res = {
    setHeader(name, value) { state.headers[name] = value; return this; },
    status(code) { state.statusCode = code; return this; },
    json(value) { state.body = value; return this; },
    send(value) { state.body = value; return this; },
  };
  await generateHandler({ method: 'POST', body: { application: parsed.application } }, res);
  if (state.statusCode !== 200 || !Buffer.isBuffer(state.body)) {
    throw new Error(`Generation failed for ${filename}: ${JSON.stringify(state.body)}`);
  }

  const outputName = `roundtrip-${parsed.level}.docx`;
  const outputPath = path.join(outputDir, outputName);
  fs.writeFileSync(outputPath, state.body);
  console.log(`${parsed.level}: ${outputPath} (${state.body.length} bytes)`);
}

