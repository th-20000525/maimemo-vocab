#!/usr/bin/env node
/**
 * Merge essence-understanding explanations into phrase-guide.js.
 * Phrase keys / tiers / stars / wordIds stay identical. blankStart/blankEnd
 * are recomputed only when the example sentence text itself changes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GUIDE_PATH = path.join(ROOT, "phrase-guide.js");
const ESSENCE_CANDIDATES = [
  process.env.ESSENCE_MD,
  "/cursor/stores/bc-043dd815-210c-4eeb-82b6-fbeb77801006/docs/考研短语2462条本质理解全本.md",
  "/cursor/stores/self/docs/考研短语2462条本质理解全本.md",
].filter(Boolean);

const MISSING_GLOSS_FALLBACK = {
  "according to": "按照、根据",
  "be indifferent to": "对…漠不关心、无动于衷",
  "bring to": "使苏醒、使恢复知觉",
  "i.e.": "即、也就是",
  "rare bird": "稀有之物、珍品",
  "sit back": "袖手旁观、休息、放松",
};

const FORCE_EXAMPLE_FIX = {
  "in harmony": {
    sentence: "They lived in harmony.",
    sentenceZh: "他们和睦相处。",
  },
  "refer to ... as": {
    sentence: "I always refer to him as a bookworm.",
    sentenceZh: "我总是把他称作书呆子。",
  },
  "bring to a halt": {
    // Keep the headword contiguous so blank indices stay exact.
    sentence: "Please bring to a halt any unsafe activity.",
    sentenceZh: "请立即停止任何不安全的活动。",
  },
};

/** Fix export glitch + CJK compatibility ideographs/radicals only (keep fullwidth punct). */
function cleanText(s) {
  return String(s || "")
    .replace(/09/g, "、")
    .replace(/[\u2E80-\u2EFF\u2F00-\u2FDF\uF900-\uFAFF]/gu, (ch) => ch.normalize("NFKC"))
    .replace(/\u3000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function isPlaceholderGloss(zh) {
  const t = cleanText(zh);
  return !t || /词本(未给|释义缺失)/.test(t);
}

function isWeakSentence(phrase, sentence) {
  const p = String(phrase || "").trim();
  const s = String(sentence || "").trim();
  if (!s) return true;
  if (/（词本无例句）/.test(s)) return true;
  if (/eg[ûu]/i.test(s)) return true;
  if (/harmonious society/.test(s) && /Smoking is harmful/i.test(s)) return true;
  const bare = s.replace(/[.。！？!?]+$/u, "").trim();
  if (bare.toLowerCase() === p.toLowerCase()) return true;
  // synonym dump pretending to be a sentence
  if (s.includes("=") && !/[.!?。]/.test(s.slice(0, Math.min(40, s.length)))) return true;
  if (/^(Pause|Cease|Halt)\b/i.test(s) && /\bCall it quits\b/i.test(s)) return true;
  // leading noise / mojibake
  if (/^[^\sA-Za-z"']/.test(s) && /[ûüeg]/i.test(s.slice(0, 6))) return true;
  return false;
}

function splitExample(raw) {
  const text = String(raw || "").trim();
  if (!text || text === "（词本无例句）") {
    return { en: "", zh: "", weak: true, truncated: false };
  }
  const truncated = /译文残缺/.test(text);
  const body = text.replace(/\s*⚠\s*译文残缺，以英文为准\s*$/u, "").trim();
  const m = body.match(/^(.+?[.!?])\s+(.+)$/u);
  if (m) return { en: m[1].trim(), zh: cleanText(m[2]), weak: false, truncated };
  const idx = body.search(/[\u4e00-\u9fff]/u);
  if (idx > 0) {
    return {
      en: body.slice(0, idx).trim(),
      zh: cleanText(body.slice(idx)),
      weak: false,
      truncated,
    };
  }
  return { en: body, zh: "", weak: false, truncated };
}

function parseEssence(md) {
  const map = new Map();
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const head = lines[i].match(/^- \*\*(.+?)\*\* ｜ (.+)$/);
    if (!head) {
      i += 1;
      continue;
    }
    const phrase = head[1].trim();
    const zh = head[2].trim();
    let center = "";
    let split = "";
    let exampleRaw = "";
    i += 1;
    while (i < lines.length) {
      const line = lines[i];
      if (/^- \*\*/.test(line) || /^#{2,3} /.test(line)) break;
      const c = line.match(/^\s+- 中心词：\s*(.+)$/);
      const s = line.match(/^\s+- 拆解：\s*(.+)$/);
      const e = line.match(/^\s+- 例句：\s*(.+)$/);
      if (c) center = c[1].trim();
      else if (s) split = s[1].trim();
      else if (e) exampleRaw = e[1].trim();
      i += 1;
    }
    center = cleanText(center.replace(/\*\*/g, ""));
    split = cleanText(split.replace(/\*\*/g, ""));
    const ex = splitExample(exampleRaw);
    map.set(phrase, {
      zh: cleanText(zh),
      center,
      split,
      exampleEn: ex.en,
      exampleZh: ex.zh,
      exampleWeak: ex.weak || isWeakSentence(phrase, ex.en),
      exampleTruncated: ex.truncated,
    });
  }
  return map;
}

function loadGuide(src) {
  const m = src.match(/const PHRASE_GUIDE = (\{[\s\S]*\});\n  window\.PHRASE_GUIDE/);
  if (!m) throw new Error("PHRASE_GUIDE object not found");
  // eslint-disable-next-line no-eval
  return { guide: eval(`(${m[1]})`) };
}

function extractTipDecor(oldTip) {
  const lines = String(oldTip || "").split(/\n/);
  const headers = [];
  const asides = [];
  for (const line of lines) {
    if (/^[〔\[](真题|自编)/.test(line) || /^★\s*高频/.test(line)) headers.push(line.trim());
    else if (/^旁义：/.test(line)) asides.push(line.trim());
  }
  return { headers, asides };
}

function applyGlossToSplit(split, zh) {
  if (!split) return split;
  if (!/→\s*（词本未给释义）\s*$/.test(split)) return split;
  if (!zh || isPlaceholderGloss(zh)) return split;
  return split.replace(/→\s*（词本未给释义）\s*$/, `→ ${zh}`);
}

function buildTip(entry, oldTip, tier, zh) {
  const center = entry.center;
  const split = applyGlossToSplit(entry.split, zh);
  const body = [];
  if (center) body.push(`中心词：${center}`);
  if (split) body.push(`拆解：${split}`);
  const essenceTip = body.join("\n");
  if (!essenceTip) return cleanText(oldTip);

  if (tier === "B") {
    const old = String(oldTip || "").trim();
    if (!old) return essenceTip;
    if (old.includes("中心词：") && old.includes("拆解：")) return essenceTip;
    return `${essenceTip}\n${old}`;
  }

  if (tier === "A") {
    const { headers, asides } = extractTipDecor(oldTip);
    return [...headers, essenceTip, ...asides].filter(Boolean).join("\n");
  }

  return essenceTip;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a regex that tolerates ... gaps, one's→possessive, and light verb inflection. */
function phraseMatchRegex(phrase) {
  const parts = String(phrase || "")
    .trim()
    .split(/\s*\.\.\.\s*/);
  const chunkToRe = (chunk, allowInflectFirst) => {
    const words = chunk.trim().split(/\s+/).filter(Boolean);
    return words
      .map((w, i) => {
        if (/^one's$/i.test(w)) return "(?:one'?s|my|his|her|your|their|our)";
        if (allowInflectFirst && i === 0 && /^[A-Za-z]+$/.test(w) && w.length > 1) {
          const stem = escapeRe(w);
          // give/gives/gave/given/giving; take/takes/took/taken/taking; set/sets/setting
          return `${stem}(?:s|es|ed|ied|ing|d|n)?`;
        }
        return escapeRe(w);
      })
      .join("\\s+");
  };
  const body = parts
    .map((chunk, i) => chunkToRe(chunk, i === 0))
    .filter(Boolean)
    .join(".{0,40}?");
  return body ? new RegExp(body, "i") : null;
}

function findBlank(phrase, sentence) {
  const p = String(phrase || "").trim();
  const s = String(sentence || "");
  if (!p || !s) return null;
  const exact = s.toLowerCase().indexOf(p.toLowerCase());
  if (exact >= 0) return { blankStart: exact, blankEnd: exact + p.length };

  // drop leading "be " (common in guide examples)
  if (/^be\s+/i.test(p)) {
    const rest = p.replace(/^be\s+/i, "");
    const idx = s.toLowerCase().indexOf(rest.toLowerCase());
    if (idx >= 0) return { blankStart: idx, blankEnd: idx + rest.length };
  }

  const re = phraseMatchRegex(p);
  if (re) {
    const m = re.exec(s);
    if (m) return { blankStart: m.index, blankEnd: m.index + m[0].length };
  }
  return null;
}

function blankLooksSafe(phrase, sentence, blank) {
  if (!blank) return false;
  const slice = String(sentence || "").slice(blank.blankStart, blank.blankEnd).trim();
  if (!slice) return false;
  // Reject "fell back" to start-of-string garbage: blank must cover real phrase content.
  const tokens = String(phrase || "")
    .toLowerCase()
    .replace(/\.\.\./g, " ")
    .split(/\s+/)
    .filter((t) => t && t !== "be" && t !== "a" && t !== "an" && t !== "the" && t !== "to" && t !== "of");
  const lower = slice.toLowerCase();
  // at least half of content tokens appear
  let hit = 0;
  for (const t of tokens) {
    if (lower.includes(t.replace(/'s$/, ""))) hit += 1;
  }
  if (tokens.length === 0) return lower.length >= Math.min(3, phrase.length);
  return hit >= Math.ceil(tokens.length * 0.6);
}

function sameEnglish(a, b) {
  const norm = (x) =>
    String(x || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.!?。！？]+$/u, "")
      .trim();
  return norm(a) && norm(a) === norm(b);
}

/** Strip synonym-dump / mojibake prefixes that sit before the real example. */
function sanitizeSentence(phrase, sentence) {
  let s = String(sentence || "").trim();
  if (!s) return s;
  // drop leading CJK/radical junk + digits (e.g. "⽕0 Put out...")
  s = s.replace(/^[^\x00-\x7F0-9A-Za-z"'“‘]+[0-9]*\s+/, "");
  // drop leading "=foo Bar Baz The real sentence"
  s = s.replace(/^=\s*[A-Za-z][^=\n]{0,40}?\s+(?=[A-Z("])/, "");
  const blank = findBlank(phrase, s);
  if (!blank) return String(sentence || "").trim();
  // If there is a long synonym dump before the match, keep from nearest sentence start.
  if (blank.blankStart > 0) {
    const before = s.slice(0, blank.blankStart);
    if (/=/.test(before) || /(?:\b[A-Z][a-z]+\b\s+){2,}/.test(before) || /A as B/i.test(before)) {
      const window = s.slice(Math.max(0, blank.blankStart - 80), blank.blankEnd + 120);
      const m = window.match(/[A-Z("][^]*$/);
      if (m) {
        const cut = s.indexOf(m[0]);
        if (cut >= 0 && cut <= blank.blankStart) s = s.slice(cut).trim();
      }
    }
  }
  return s.replace(/\s+/g, " ").trim();
}

function tryAdoptSentence(phrase, sentence, sentenceZh, originalSentence = null) {
  const cleaned = sanitizeSentence(phrase, sentence);
  const blank = findBlank(phrase, cleaned);
  if (!blankLooksSafe(phrase, cleaned, blank)) {
    return null;
  }
  const orig = String(originalSentence ?? sentence ?? "").trim();
  return {
    sentence: cleaned,
    sentenceZh: cleanText(sentenceZh || ""),
    blank,
    changedSentence: cleaned !== orig,
  };
}

function pickSentence(phrase, deck, entry) {
    if (FORCE_EXAMPLE_FIX[phrase]) {
    const adopted = tryAdoptSentence(
      phrase,
      FORCE_EXAMPLE_FIX[phrase].sentence,
      FORCE_EXAMPLE_FIX[phrase].sentenceZh,
      deck.sentence
    );
    if (adopted) return adopted;
  }

  const deckWeak = isWeakSentence(phrase, deck.sentence);
  const essenceWeak = !entry || entry.exampleWeak || !entry.exampleEn;
  const deckZh = cleanText(deck.sentenceZh || "");

  // Prefer sanitizing the live deck sentence when it already has a usable example.
  if (!deckWeak) {
    let zh = deckZh;
    if (!zh && entry && !essenceWeak && sameEnglish(deck.sentence, entry.exampleEn) && !entry.exampleTruncated) {
      zh = entry.exampleZh;
    }
    const sanitized = sanitizeSentence(phrase, deck.sentence);
    if (sanitized && sanitized !== deck.sentence) {
      const adopted = tryAdoptSentence(phrase, sanitized, zh, deck.sentence);
      if (adopted) return adopted;
    }
    return { sentence: deck.sentence, sentenceZh: zh, changedSentence: false };
  }

  if (deckWeak && !essenceWeak) {
    const adopted = tryAdoptSentence(
      phrase,
      entry.exampleEn,
      entry.exampleTruncated ? "" : entry.exampleZh,
      deck.sentence
    );
    if (adopted) return adopted;
  }

  // Last resort: sanitize a weak deck sentence in place if possible.
  {
    const sanitized = sanitizeSentence(phrase, deck.sentence);
    if (sanitized && sanitized !== deck.sentence) {
      const adopted = tryAdoptSentence(phrase, sanitized, deckZh, deck.sentence);
      if (adopted) return adopted;
    }
  }

  return { sentence: deck.sentence, sentenceZh: deckZh, changedSentence: false };
}

function serializeGuide(guide, originalSrc) {
  const keys = Object.keys(guide);
  const lines = keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(guide[k])}`);
  const body = `{\n${lines.join(",\n")}\n  }`;
  return originalSrc.replace(
    /const PHRASE_GUIDE = \{[\s\S]*\};\n  window\.PHRASE_GUIDE/,
    `const PHRASE_GUIDE = ${body};\n  window.PHRASE_GUIDE`
  );
}

function main() {
  const essencePath = ESSENCE_CANDIDATES.find((p) => fs.existsSync(p));
  if (!essencePath) throw new Error("essence md not found");
  const essence = parseEssence(fs.readFileSync(essencePath, "utf8"));
  const src = fs.readFileSync(GUIDE_PATH, "utf8");
  const { guide } = loadGuide(src);
  const deckKeys = Object.keys(guide);

  const stats = {
    essencePath,
    essence: essence.size,
    deck: deckKeys.length,
    zhUpdated: 0,
    tipUpdated: 0,
    sentenceUpdated: 0,
    sentenceZhUpdated: 0,
    blankRecomputed: 0,
    missingInEssence: [],
    missingGlossFallback: [],
    forceFixed: [],
  };

  // Snapshot stable fields / blanks before mutation
  const before = Object.fromEntries(
    deckKeys.map((k) => [
      k,
      {
        wordId: guide[k].wordId,
        word: guide[k].word,
        pos: guide[k].pos,
        phonetic: guide[k].phonetic,
        tier: guide[k].tier,
        star: guide[k].star,
        blankStart: guide[k].blankStart,
        blankEnd: guide[k].blankEnd,
        sentence: guide[k].sentence,
      },
    ])
  );

  for (const phrase of deckKeys) {
    const deck = guide[phrase];
    const entry = essence.get(phrase);
    if (!entry) {
      stats.missingInEssence.push(phrase);
      continue;
    }

    let nextZh = deck.zh;
    if (!isPlaceholderGloss(entry.zh)) nextZh = entry.zh;
    else if (MISSING_GLOSS_FALLBACK[phrase]) {
      nextZh = MISSING_GLOSS_FALLBACK[phrase];
      stats.missingGlossFallback.push(phrase);
    }
    nextZh = cleanText(nextZh);
    if (nextZh !== deck.zh) stats.zhUpdated += 1;
    deck.zh = nextZh;

    const nextTip = cleanText(buildTip(entry, deck.tip, deck.tier, nextZh));
    if (nextTip !== deck.tip) stats.tipUpdated += 1;
    deck.tip = nextTip;

    const picked = pickSentence(phrase, deck, entry);
    const oldSentence = deck.sentence;
    const oldZh = deck.sentenceZh;
    deck.sentence = picked.sentence;
    deck.sentenceZh = cleanText(picked.sentenceZh || "");
    if (picked.changedSentence && oldSentence !== deck.sentence && picked.blank) {
      stats.sentenceUpdated += 1;
      if (FORCE_EXAMPLE_FIX[phrase]) stats.forceFixed.push(phrase);
      deck.blankStart = picked.blank.blankStart;
      deck.blankEnd = picked.blank.blankEnd;
      stats.blankRecomputed += 1;
    } else {
      // keep original English + blank span; still allow cleaned Chinese gloss/translation
      deck.sentence = oldSentence;
      deck.blankStart = before[phrase].blankStart;
      deck.blankEnd = before[phrase].blankEnd;
      deck.sentenceZh = cleanText(picked.sentenceZh || oldZh || "");
    }
    if (oldZh !== deck.sentenceZh) stats.sentenceZhUpdated += 1;
  }

  const out = serializeGuide(guide, src);
  const outGuide = loadGuide(out).guide;
  const outKeys = Object.keys(outGuide);
  if (outKeys.length !== deckKeys.length) throw new Error("key count changed");
  for (let i = 0; i < deckKeys.length; i++) {
    if (deckKeys[i] !== outKeys[i]) throw new Error(`key order drift at ${i}`);
    const k = deckKeys[i];
    const a = before[k];
    const b = outGuide[k];
    for (const f of ["wordId", "word", "pos", "phonetic", "tier", "star"]) {
      if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) throw new Error(`stable ${f} changed: ${k}`);
    }
    if (a.sentence === b.sentence) {
      if (a.blankStart !== b.blankStart || a.blankEnd !== b.blankEnd) {
        throw new Error(`blank drifted without sentence change: ${k}`);
      }
    }
  }

  fs.writeFileSync(GUIDE_PATH, out);
  console.log(
    JSON.stringify(
      {
        ...stats,
        missingInEssence: stats.missingInEssence.length,
        missingInEssenceSamples: stats.missingInEssence.slice(0, 10),
      },
      null,
      2
    )
  );
}

main();
