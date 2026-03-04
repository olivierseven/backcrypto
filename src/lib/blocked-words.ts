/**
 * Lista de palavras bloqueadas (PT/EN) para nomes de configuração.
 * Verificação por palavra inteira para evitar falsos positivos.
 */
const BLOCKED_WORDS = new Set([
  // ======================
  // 🇧🇷 PORTUGUÊS
  // ======================
  "merda", "bosta", "porra", "caralho", "caralha", "cacete",
  "foda", "foder", "fodido", "fodida", "fodase", "foda-se",
  "cu", "cú",
  "buceta", "xoxota", "xereca", "perereca",
  "puta", "puto", "putinha", "putaria",
  "vadia", "vagabunda", "vagabundo",
  "piranha",
  "arrombado", "arrombada",
  "filho da puta", "filhadaputa",
  "desgraca", "desgracado",
  "corno", "cornudo",
  "otario", "otaria", "idiota", "imbecil",
  "pau", "rola", "piroca",
  "boquete", "punheta",
  "bunda", "bundas", "bumbum", "rabo", "raba",
  "peito", "peitos", "peitao", "peitoes", "tetas", "teta", "mamilos", "seios",
  "xota", "xana", "bct", "ppk",
  "penis", "vagina", "pica",

  // ======================
  // 🇺🇸 ENGLISH
  // ======================
  "fuck", "fucking", "fucked", "motherfucker",
  "shit", "bullshit",
  "ass", "asshole",
  "bitch", "son of a bitch",
  "dick", "cock",
  "piss", "pissed",
  "cunt",
  "whore", "slut",
  "bastard",
  "fag", "faggot",
  "retard", "retarded",
  "nigger", "nigga",
  "boob", "boobs", "booby", "butt", "butts", "buttock",
  "tit", "tits", "titty", "titties",
  "nipple", "nipples",
  "breast", "breasts",
  "penis", "vagina", "pussy",

  // ======================
  // VARIAÇÕES COMUNS
  // ======================
  "fck", "fuk", "fuq",
  "sht",
  "btch", "b1tch",
  "d1ck",
  "c0ck",
  "p0rn", "porn",
  "pr0n",
]);

/** Normaliza antes da checagem: lowercase, remove acentos. Símbolos viram espaço (separador). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " "); // símbolos viram espaço (preserva fronteira entre palavras)
}

/** Retorna true se o texto contém alguma palavra bloqueada como palavra inteira. */
export function containsBlockedWord(text: string): boolean {
  const normalized = normalize(text);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (BLOCKED_WORDS.has(token)) return true;
  }
  return false;
}
