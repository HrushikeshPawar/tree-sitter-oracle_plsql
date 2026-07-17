/**
 * Shared DSL helpers, precedence ladder, and reserved-word tokens.
 * Rule functions call tree-sitter globals (seq, choice, …) only when the
 * grammar is evaluated — not at module load time.
 */

/**
 * Appendix D Table D-1 — reserved words (never ordinary identifiers). L9.
 * Source: docs/spec/research/appendix-d-reserved-keywords.md Set 1.
 */
export const RESERVED_WORDS = [
  "all", "alter", "and", "any", "as", "asc", "at",
  "begin", "between", "by",
  "case", "check", "cluster", "clusters", "colauth", "columns", "compress",
  "connect", "crash", "create", "cursor",
  "declare", "default", "desc", "distinct", "drop",
  "else", "end", "exception", "exclusive",
  "fetch", "for", "from", "function",
  "goto", "grant", "group",
  "having",
  "identified", "if", "in", "index", "indexes", "insert", "intersect",
  "into", "is",
  "like", "lock",
  "minus", "mode",
  "nocompress", "not", "nowait", "null",
  "of", "on", "option", "or", "order", "overlaps",
  "procedure", "public",
  "resource", "revoke",
  "select", "share", "size", "sql", "start", "subtype",
  "tabauth", "table", "then", "to", "type",
  "union", "unique", "update",
  "values", "view", "views",
  "when", "where", "with",
];

/**
 * Table 3-3 reconciled ladder (E1–E6 / D20). Higher = tighter binding.
 * `**` right-assoc; all other binary tiers left-assoc; `||` with additive.
 */
export const PREC = {
  OR: 1,
  AND: 2,
  NOT: 3,
  COMPARE: 4,
  ADD_CONCAT: 5, // '+', '-', '||'
  MUL: 6, // '*', '/'
  UNARY: 7, // unary '+', '-'
  POW: 8, // '**' right-assoc
  CALL: 9, // call / index / qualified / outer-join postfix
  MEMBER: 10, // '.'  '%'  '@'
};

/**
 * Case-insensitive keyword token (D2 / L11). Anonymous in the tree (D1).
 * Prefer $._kw_* for reserved words so reserved.global stays consistent.
 * @param {string} word
 */
export function keyword(word) {
  return token(prec(1, new RegExp(word, "i")));
}

/** Named reserved-word tokens for the global reserved set (L9). Hidden (D1). */
export function reservedTokenRules() {
  /** @type {Record<string, function(any): any>} */
  const rules = {};
  for (const w of RESERVED_WORDS) {
    const pattern = new RegExp(w, "i");
    rules[`_kw_${w}`] = (_$) => token(prec(1, pattern));
  }
  return rules;
}

/**
 * Ordinary identifier shape (L5–L6). Reserved blacklist is `reserved:`, not regex.
 * Unicode letters/digits; may start with underscore.
 */
export const IDENTIFIER_PATTERN = /[\p{L}_][\p{L}\p{Nd}$#_]*/u;

/**
 * Unsigned number (L15–L16): digits, optional fraction, optional exponent,
 * optional f/F/d/D suffix. Leading +/− are unary, not part of the token.
 *
 * Fraction requires ≥1 digit after `.` so `1..10` is range, not `1.` + `.10`
 * (E19 stepped iterator / range choices).
 */
export const NUMBER_LITERAL =
  /(?:\d+\.\d+|\.\d+|\d+)(?:[eE][+-]?\d+)?[fFdD]?/;

/** Relational operators at COMPARE (E5 — four ≠ forms). */
export const RELATIONAL_OPS = [
  "=",
  "<>",
  "!=",
  "~=",
  "^=",
  "<",
  ">",
  "<=",
  ">=",
];

/**
 * Comma-separated one-or-more list (no trailing comma).
 * @param {any} rule
 */
export function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
