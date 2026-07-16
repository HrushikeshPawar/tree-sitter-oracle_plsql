/**
 * @file Tree-Sitter grammar for Oracle PLSQL
 * @author Hrushikesh Pawar
 * @license MIT
 *
 * Phase 1 lexical layer (#39 / docs/spec/01-lexical.md L1–L29):
 * identifiers, literals, delimiters, comments/extras, scanner boundary,
 * reserved-word blacklist, structured date/timestamp/interval nodes.
 *
 * Tracer block surface kept; minimal expression statement surface so corpus
 * seeds can exercise every lexical token. Full expression ladder → #40.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-nocheck

/**
 * Appendix D Table D-1 — reserved words (never ordinary identifiers). L9.
 * Source: docs/spec/research/appendix-d-reserved-keywords.md Set 1.
 */
const RESERVED_WORDS = [
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
 * Case-insensitive keyword token (D2 / L11). Anonymous in the tree (D1).
 * Prefer $._kw_* for reserved words so reserved.global stays consistent.
 * @param {string} word
 */
function keyword(word) {
  return token(prec(1, new RegExp(word, "i")));
}

/** Named reserved-word tokens for the global reserved set (L9). Hidden (D1). */
function reservedTokenRules() {
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
const IDENTIFIER_PATTERN = /[\p{L}_][\p{L}\p{Nd}$#_]*/u;

/**
 * Unsigned number (L15–L16): digits, optional fraction, optional exponent,
 * optional f/F/d/D suffix. Leading +/− are unary, not part of the token.
 */
const NUMBER_LITERAL =
  /(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fFdD]?/;

export default grammar({
  name: "oracle_plsql",

  extras: ($) => [
    /\s+/, // L25
    $._line_comment, // L22 pure-grammar line comment (extra, not a tree node)
    $._block_comment, // L22–L24 scanner-owned extra
  ],

  externals: ($) => [
    $.string_literal, // D9 / L12–L14, L21
    $.q_string_literal, // D9
    $._block_comment, // L23–L24
  ],

  // L26 — adjacent identifier-like tokens do not glue; keywords via word.
  word: ($) => $.identifier,

  // L9 — Appendix D reserved words never match as ordinary identifier.
  reserved: {
    global: ($) => RESERVED_WORDS.map((w) => $[`_kw_${w}`]),
  },

  supertypes: ($) => [$.literal],

  rules: {
    // ------------------------------------------------------------------
    // Root & tracer block surface
    // ------------------------------------------------------------------

    source_file: ($) => repeat(choice($.block, $.expression_statement)),

    // Minimal block: BEGIN … END ; — statements inside (widen in #41/#42).
    block: ($) =>
      seq(
        $._kw_begin,
        repeat1($.statement),
        $._kw_end,
        optional($.identifier),
        ";",
      ),

    statement: ($) => choice($.null_statement, $.expression_statement),

    // Prefer null_statement over expression_statement(null_literal) for `NULL;`.
    null_statement: ($) => prec(1, seq($._kw_null, ";")),

    // Thin statement so lexical seeds can appear at top level or in blocks.
    expression_statement: ($) => seq($._expression, ";"),

    // ------------------------------------------------------------------
    // Minimal expression surface (lexical tokens only; ladder → #40)
    // ------------------------------------------------------------------

    _expression: ($) =>
      choice($.binary_expression, $.unary_expression, $._primary),

    // Unary +/− so leading signs stay operators (L16), not number tokens.
    unary_expression: ($) =>
      prec(2, seq(field("operator", choice("+", "-")), $._expression)),

    // Flat binary so multi-char delimiters (L1–L2) appear in the grammar.
    binary_expression: ($) =>
      prec.left(
        1,
        seq(
          $._expression,
          field(
            "operator",
            choice(
              // multi-char (longest match vs single-char forms)
              "**",
              "||",
              ":=",
              "=>",
              "..",
              "<<",
              ">>",
              "<>",
              "!=",
              "~=",
              "^=",
              "<=",
              ">=",
              // single-char
              "+",
              "-",
              "*",
              "/",
              "=",
              "<",
              ">",
            ),
          ),
          $._expression,
        ),
      ),

    _primary: ($) =>
      choice(
        $.literal,
        $.identifier,
        $.quoted_identifier,
        $.bind_variable,
        seq("(", $._expression, ")"),
      ),

    // ------------------------------------------------------------------
    // Literals (supertype `literal` — D3 / surface catalog)
    // ------------------------------------------------------------------

    literal: ($) =>
      choice(
        $.string_literal,
        $.q_string_literal,
        $.number_literal,
        $.boolean_literal,
        $.null_literal,
        $.date_literal,
        $.timestamp_literal,
        $.interval_literal,
        $.inquiry_directive,
      ),

    number_literal: ($) => token(NUMBER_LITERAL),

    // L19 — TRUE/FALSE special-cased (not in Appendix D lists).
    boolean_literal: ($) => choice(keyword("true"), keyword("false")),

    // NULL is reserved; named null_literal under literal supertype.
    null_literal: ($) => $._kw_null,

    // L17 — structured datetime/interval (keyword + string [+ qualifier]).
    date_literal: ($) =>
      seq(keyword("date"), field("value", $.string_literal)),

    timestamp_literal: ($) =>
      seq(keyword("timestamp"), field("value", $.string_literal)),

    interval_literal: ($) =>
      seq(
        keyword("interval"),
        field("value", $.string_literal),
        $.interval_qualifier,
      ),

    // L18 — precision is number_literal only (not full expression).
    // `TO` is reserved → $._kw_to; YEAR/MONTH/DAY/… are Set-2 keywords.
    interval_qualifier: ($) =>
      choice(
        seq(
          keyword("year"),
          optional(seq("(", $.number_literal, ")")),
          optional(seq($._kw_to, keyword("month"))),
        ),
        seq(keyword("month"), optional(seq("(", $.number_literal, ")"))),
        seq(
          keyword("day"),
          optional(seq("(", $.number_literal, ")")),
          optional(
            seq(
              $._kw_to,
              choice(
                keyword("hour"),
                keyword("minute"),
                seq(
                  keyword("second"),
                  optional(seq("(", $.number_literal, ")")),
                ),
              ),
            ),
          ),
        ),
        seq(
          keyword("hour"),
          optional(seq("(", $.number_literal, ")")),
          optional(
            seq(
              $._kw_to,
              choice(
                keyword("minute"),
                seq(
                  keyword("second"),
                  optional(seq("(", $.number_literal, ")")),
                ),
              ),
            ),
          ),
        ),
        seq(
          keyword("minute"),
          optional(seq("(", $.number_literal, ")")),
          optional(
            seq(
              $._kw_to,
              keyword("second"),
              optional(seq("(", $.number_literal, ")")),
            ),
          ),
        ),
        seq(
          keyword("second"),
          optional(
            seq(
              "(",
              $.number_literal,
              optional(seq(",", $.number_literal)),
              ")",
            ),
          ),
        ),
      ),

    // ------------------------------------------------------------------
    // Identifiers, binds, inquiry (L5–L8, L27–L28)
    // ------------------------------------------------------------------

    // Ordinary identifier: Unicode letters, may start with _ (L5–L6).
    identifier: ($) => token(IDENTIFIER_PATTERN),

    // L7 — double-quoted; no interior ", no "" escape, no newline/null.
    quoted_identifier: ($) => token(/"[^\n\x00"]+"/),

    // L27 — own tokens; shape after : is not an identifier node.
    bind_variable: ($) =>
      token(/:[\p{L}_][\p{L}\p{Nd}$#_]*|:\d+/u),

    // L28 — $$ + identifier shape; literal-like primary.
    inquiry_directive: ($) =>
      token(/\$\$[\p{L}_][\p{L}\p{Nd}$#_]*/u),

    // L22 — line comment pure grammar, extras only (hidden → not a tree node).
    _line_comment: ($) => token(/--[^\n]*/),

    // ------------------------------------------------------------------
    // Reserved-word token rules (L9) — referenced by reserved.global
    // ------------------------------------------------------------------
    ...reservedTokenRules(),
  },
});
