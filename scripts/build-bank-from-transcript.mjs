/**
 * Транскрипттан орысша 300 сұрақты оқып, дұрыс жауапты кездейсоқ орынға қояды,
 * содан data/questions.json және data/questions.js жасайды.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outJson = path.join(root, "data", "questions.json");
const outJs = path.join(root, "data", "questions.js");

const LOCAL_SOURCE = path.join(root, "data", "russian_quiz_source.txt");
const TRANSCRIPT_FALLBACK = path.join(
  "C:",
  "Users",
  "G",
  ".cursor",
  "projects",
  "c-Users-G-OneDrive",
  "agent-transcripts",
  "f1198a41-1d05-4bbf-bf66-c5142ff467c5",
  "f1198a41-1d05-4bbf-bf66-c5142ff467c5.jsonl"
);

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Бұрынғы A (индекс 0) қай индекске түскенін табу үшін пермутация */
function permuteOptions(options, seed) {
  const rnd = mulberry32(seed >>> 0);
  const idx = [0, 1, 2, 3, 4];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const newOpts = idx.map((i) => options[i]);
  const correct = idx.indexOf(0);
  return { options: newOpts, correct };
}

function extractUserBodyFromTranscriptLine(line) {
  const obj = JSON.parse(line);
  const raw = obj.message.content[0].text;
  let body = raw.replace(/^<user_query>\s*/i, "").replace(/<\/user_query>\s*$/i, "");
  const cut = body.search(/\n[^\n]*топта\s+20/i);
  if (cut !== -1) body = body.slice(0, cut).trim();
  return body.trim();
}

function parseQuestions(text) {
  const lines = text.split(/\r?\n/);
  const items = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^(\d+)\.\s+(.+)$/);
    if (!m) {
      i++;
      continue;
    }
    const id = +m[1];
    const question = m[2].trim();
    const opts = [];
    let ok = true;
    for (let k = 0; k < 5; k++) {
      const line = lines[i + 1 + k];
      if (!line) {
        ok = false;
        break;
      }
      const om = line.match(/^([A-E])\)\s+(.+)$/);
      if (!om) {
        ok = false;
        break;
      }
      opts.push(om[2].trim());
    }
    if (!ok || opts.length !== 5) {
      i++;
      continue;
    }
    items.push({ id, question, options: opts });
    i += 6;
  }
  items.sort((a, b) => a.id - b.id);
  return items;
}

function loadSourceText() {
  if (fs.existsSync(LOCAL_SOURCE)) {
    return fs.readFileSync(LOCAL_SOURCE, "utf8").trim();
  }
  if (fs.existsSync(TRANSCRIPT_FALLBACK)) {
    const all = fs.readFileSync(TRANSCRIPT_FALLBACK, "utf8").split("\n");
    const line = all.find(
      (l) =>
        l.includes("1.\\tЧто означает сопровождение") ||
        l.includes("1.\tЧто означает сопровождение")
    );
    if (line) {
      const body = extractUserBodyFromTranscriptLine(line);
      fs.writeFileSync(LOCAL_SOURCE, body, "utf8");
      return body;
    }
  }
  throw new Error(
    "Сұрақтар көзі табылмады. data/russian_quiz_source.txt файлын қосыңыз немесе transcript жолын түзетіңіз."
  );
}

const body = loadSourceText();
const parsed = parseQuestions(body);
if (parsed.length < 300) {
  console.warn("Сұрақ саны:", parsed.length, "(күтілген 300)");
}

const bank = parsed.map((q) => {
  const { options, correct } = permuteOptions(q.options, q.id * 100003 + 977);
  return {
    id: q.id,
    question: q.question,
    options,
    correct,
  };
});

fs.writeFileSync(outJson, JSON.stringify(bank, null, 2), "utf8");
fs.writeFileSync(outJs, "window.QUESTIONS_BANK = " + JSON.stringify(bank) + ";\n", "utf8");
console.log("OK:", bank.length, "→", outJson, outJs);
