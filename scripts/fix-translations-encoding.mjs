/**
 * Corrige mojibake em translations.ts (UTF-8 interpretado como Latin-1 + artefatos ÔÇö / ┬).
 */
import fs from "fs";

const path = new URL("../src/app/lib/translations.ts", import.meta.url);
let t = fs.readFileSync(path, "utf8");

// Pontuação / símbolos (substring exata)
const literal = [
  ["ÔÇö", "\u2014"], // em dash
  ["ÔÇô", "\u2013"], // en dash (ranges 14–16, A–Z)
  ["ÔÇó", "\u2022"],
  ["ÔÇª", "\u2026"],
  ["ÔÇÖ", "\u2019"], // apostrophe / right single quote
  ["ÔåÉ", "\u2190"],
  ["ÔåÆ", "\u2192"],
  ["Ôëê", "\u2248"],
  ["ÔÇ£", "\u201c"],
  ["ÔÇØ", "\u201d"],
  ["ÔëÑ", "\u2265"], // ≥
  ["ÔêÆ", "\u2212"], // − (minus)
];
for (const [bad, good] of literal) {
  t = t.split(bad).join(good);
}

// Sequências ┬* (top half + segundo byte)
const topPairs = new Map([
  [0x00c0, "\u00b7"], // · middle dot (Symbol ┬À)
  [0x00bd, "\u00ab"], // «
  [0x2557, "\u00bb"], // »
  [0x2591, "\u00b0"], // ° (Angle (┬░))
  [0x2551, "\u00ba"], // º ordinal (n.┬║, 3.┬║ grau)
]);

// U+251C + segundo byte → letra / símbolo PT e matemática
const box251c = new Map([
  [0x00ae, "\u00e9"], // é
  [0x00a1, "\u00ed"], // í
  [0x00ed, "\u00e1"], // á
  [0x00e1, "\u00e0"], // à
  [0x2502, "\u00f3"], // ó
  [0x00ba, "\u00e7"], // ç
  [0x00fa, "\u00e3"], // ã
  [0x00c1, "\u00f5"], // õ
  [0x00ac, "\u00ea"], // ê
  [0x00f3, "\u00e2"], // â
  [0x2551, "\u00fa"], // ú
  [0x2524, "\u00f4"], // ô
  [0x00e9, "\u00c2"], // Â
  [0x00e7, "\u00e7"], // ç (remove artefato antes do ç)
  [0x00f9, "\u00d7"], // ×
  [0x00c0, "\u00f7"], // ÷
  [0x00dc, "\u00da"], // Ú (Únicos)
  [0x00eb, "\u00c9"], // É
  [0x00fc, "\u00c1"], // Á (├ürea)
  [0x00ec, "\u00cd"], // Í (├ìndigo)
]);

function applyBoxReplacements(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const n = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;

    if (c === 0x251c && box251c.has(n)) {
      out += box251c.get(n);
      i++;
      continue;
    }
    if (c === 0x252c && topPairs.has(n)) {
      out += topPairs.get(n);
      i++;
      continue;
    }
    out += s[i];
  }
  return out;
}

t = applyBoxReplacements(t);

// Foguete quebrado (UTF-8 do emoji lido errado)
t = t.replace(/\u00ad\u0178\u0160\u00c7\u00a0/g, "\u{1F680}");

fs.writeFileSync(path, t, "utf8");
console.log("OK:", path.pathname);
