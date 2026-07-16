/**
 * @file Tree-Sitter grammar for Oracle PLSQL
 * @author Hrushikesh Pawar
 * @license MIT
 *
 * Phase 1 lexical layer (#39 / docs/spec/01-lexical.md L1–L29).
 * Phase 4 expression surface (#40 / docs/spec/04-expressions.md E1–E22):
 * reconciled Table 3-3 PREC ladder, D15 postfix chain, CASE expression,
 * calls/arguments, marked aggregates, shared iterator, static_expression.
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
 * Table 3-3 reconciled ladder (E1–E6 / D20). Higher = tighter binding.
 * `**` right-assoc; all other binary tiers left-assoc; `||` with additive.
 */
const PREC = {
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
 *
 * Fraction requires ≥1 digit after `.` so `1..10` is range, not `1.` + `.10`
 * (E19 stepped iterator / range choices).
 */
const NUMBER_LITERAL =
  /(?:\d+\.\d+|\.\d+|\d+)(?:[eE][+-]?\d+)?[fFdD]?/;

/** Relational operators at COMPARE (E5 — four ≠ forms). */
const RELATIONAL_OPS = [
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
  // `no_others`: named-arg formals cannot be OTHERS so `OTHERS =>` is only
  // `others_choice` inside `qualified_expression` (E18 / D15).
  reserved: {
    global: ($) => RESERVED_WORDS.map((w) => $[`_kw_${w}`]),
    no_others: ($) => [keyword("others")],
  },

  // E15 / D19 — one declared CASE conflict (expression END vs statement END CASE).
  // Shared positional prefix of call vs marked aggregate needs GLR (D15).
  conflicts: ($) => [
    [$.case_expression, $.case_statement],
    [$.call_expression, $.qualified_expression],
    [$._actual_parameter, $._unmarked_aggregate_element],
  ],

  supertypes: ($) => [$.literal, $.expression],

  rules: {
    // ------------------------------------------------------------------
    // Root & tracer block surface
    // ------------------------------------------------------------------

    // Top-level: blocks, expression seeds, and thin CASE statement (E15 pair).
    source_file: ($) =>
      repeat(choice($.block, $.expression_statement, $.case_statement)),

    // Minimal block: BEGIN … END ; — statements inside (widen in #41/#42).
    block: ($) =>
      seq(
        $._kw_begin,
        repeat1($.statement),
        $._kw_end,
        optional($.identifier),
        ";",
      ),

    statement: ($) =>
      choice(
        $.null_statement,
        $.case_statement, // thin shell for E15 conflict (full surface → #41)
        $.expression_statement,
      ),

    // Prefer null_statement over expression_statement(null_literal) for `NULL;`.
    null_statement: ($) => prec(1, seq($._kw_null, ";")),

    // Thin statement so lexical / expression seeds appear at top level or in blocks.
    expression_statement: ($) => seq($.expression, ";"),

    // ------------------------------------------------------------------
    // Expression root (E11 / D20) — one recursive public `expression`
    // ------------------------------------------------------------------

    expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.between_expression,
        $.in_expression,
        $.like_expression,
        $.is_null_expression,
        $.member_of_expression,
        $.is_nan_expression,
        $.is_infinite_expression,
        $.is_a_set_expression,
        $.is_empty_expression,
        $.submultiset_expression,
        $.case_expression,
        $.call_expression,
        $.qualified_expression,
        $.member_expression,
        $.attribute_reference,
        $.database_link_reference,
        $.outer_join_operator,
        $.parenthesized_expression,
        $.conditional_predicate,
        $.literal,
        $.identifier,
        $.quoted_identifier,
        $.bind_variable,
      ),

    // ------------------------------------------------------------------
    // Binary / unary ladder (E1–E6)
    // ------------------------------------------------------------------

    binary_expression: ($) => {
      const left = field("left", $.expression);
      const right = field("right", $.expression);
      /** @param {number} level @param {string|string[]} ops */
      const bin = (level, ops) =>
        prec.left(
          level,
          seq(left, field("operator", choice(...[].concat(ops))), right),
        );
      return choice(
        bin(PREC.OR, $._kw_or),
        bin(PREC.AND, $._kw_and),
        bin(PREC.COMPARE, RELATIONAL_OPS),
        bin(PREC.ADD_CONCAT, ["+", "-", "||"]),
        bin(PREC.MUL, ["*", "/"]),
        prec.right(
          PREC.POW,
          seq(left, field("operator", "**"), right),
        ),
      );
    },

    unary_expression: ($) =>
      choice(
        // Logical NOT (tier below COMPARE, above AND) — E3
        prec(
          PREC.NOT,
          seq(
            field("operator", $._kw_not),
            field("argument", $.expression),
          ),
        ),
        // Arithmetic unary above mul/div, below ** — E3
        prec(
          PREC.UNARY,
          seq(
            field("operator", choice("+", "-")),
            field("argument", $.expression),
          ),
        ),
      ),

    // ------------------------------------------------------------------
    // COMPARE multi-operand / compound-NOT forms (E6, E13, §3.7)
    // ------------------------------------------------------------------

    between_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          optional($._kw_not),
          $._kw_between,
          field("low", $.expression),
          $._kw_and,
          field("high", $.expression),
        ),
      ),

    in_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          optional($._kw_not),
          $._kw_in,
          field("right", $.in_list),
        ),
      ),

    in_list: ($) =>
      seq("(", $.expression, repeat(seq(",", $.expression)), ")"),

    like_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          optional($._kw_not),
          $._kw_like,
          field("pattern", $.expression),
          optional(seq(keyword("escape"), field("escape", $.expression))),
        ),
      ),

    is_null_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          $._kw_is,
          optional($._kw_not),
          $._kw_null,
        ),
      ),

    // E13 — MEMBER OF (name avoids clash with member_expression)
    member_of_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          optional($._kw_not),
          keyword("member"),
          optional($._kw_of),
          field("right", $.expression),
        ),
      ),

    is_nan_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          $._kw_is,
          optional($._kw_not),
          keyword("nan"),
        ),
      ),

    is_infinite_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          $._kw_is,
          optional($._kw_not),
          keyword("infinite"),
        ),
      ),

    is_a_set_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          $._kw_is,
          optional($._kw_not),
          keyword("a"),
          keyword("set"),
        ),
      ),

    is_empty_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          $._kw_is,
          optional($._kw_not),
          keyword("empty"),
        ),
      ),

    submultiset_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("left", $.expression),
          optional($._kw_not),
          keyword("submultiset"),
          optional($._kw_of),
          field("right", $.expression),
        ),
      ),

    // ------------------------------------------------------------------
    // D15 postfix chain (E20–E21) — above all operators
    // ------------------------------------------------------------------

    member_expression: ($) =>
      prec.left(
        PREC.MEMBER,
        seq(
          field("object", $.expression),
          ".",
          field("name", $.identifier),
        ),
      ),

    attribute_reference: ($) =>
      prec.left(
        PREC.MEMBER,
        seq(
          field("object", $.expression),
          "%",
          field("attribute", $.identifier),
        ),
      ),

    database_link_reference: ($) =>
      prec.left(
        PREC.MEMBER,
        seq(
          field("object", $.expression),
          "@",
          field("link", choice($.identifier, $.quoted_identifier)),
        ),
      ),

    // Marked aggregates only (E18): interior must include a marker form.
    // Unmarked positional / bare `id =>` stay `call_expression` (D15).
    qualified_expression: ($) =>
      prec(
        PREC.CALL,
        seq(
          field("type", $.expression),
          "(",
          $._aggregate_body,
          ")",
        ),
      ),

    call_expression: ($) =>
      prec(
        PREC.CALL,
        seq(
          field("function", $.expression),
          field("arguments", $.argument_list),
        ),
      ),

    // E17 — empty list node for f() so queries stay stable.
    argument_list: ($) =>
      seq(
        "(",
        optional(
          seq($._actual_parameter, repeat(seq(",", $._actual_parameter))),
        ),
        ")",
      ),

    // E16 — any order; E8 — named LHS is simple identifier only.
    _actual_parameter: ($) => choice($.named_argument, $.expression),

    // OTHERS banned as formal name so `OTHERS =>` cannot be a named arg (E18).
    named_argument: ($) =>
      reserved(
        "no_others",
        prec(
          1,
          seq(
            field("name", $.identifier),
            "=>",
            field("value", $.expression),
          ),
        ),
      ),

    // Old-style outer join (+) — not parenthesized_expression (D15).
    outer_join_operator: ($) =>
      prec(
        PREC.CALL,
        seq(field("column", $.expression), "(+)"),
      ),

    parenthesized_expression: ($) =>
      prec(PREC.CALL, seq("(", $.expression, ")")),

    // ------------------------------------------------------------------
    // Marked aggregates (E10, E18) — OTHERS / indexed / FOR / alternation
    // ------------------------------------------------------------------

    /**
     * At least one marked element so unmarked positional / bare `id =>`
     * stay `call_expression` (E18 / D15). Leading positionals allowed
     * (permissive order); GLR conflict with call on the shared prefix.
     */
    _aggregate_body: ($) =>
      choice(
        // Marker-first (and marker-only) forms
        seq(
          $._marked_aggregate_element,
          repeat(seq(",", $._aggregate_element)),
        ),
        // Positional / named prefix then a required marker (permissive order)
        seq(
          $._unmarked_aggregate_element,
          repeat(seq(",", $._unmarked_aggregate_element)),
          ",",
          $._marked_aggregate_element,
          repeat(seq(",", $._aggregate_element)),
        ),
      ),

    _aggregate_element: ($) =>
      choice($._marked_aggregate_element, $._unmarked_aggregate_element),

    _unmarked_aggregate_element: ($) =>
      choice($.named_argument, $.expression),

    _marked_aggregate_element: ($) =>
      choice(
        $.others_choice,
        $.iterator_choice,
        $.alternation_choice,
        $.indexed_choice,
      ),

    others_choice: ($) =>
      seq(keyword("others"), "=>", field("value", $.expression)),

    // Non-identifier index LHS so bare `id =>` remains named_argument / call.
    indexed_choice: ($) =>
      seq(
        field("index", $._non_identifier_expression),
        "=>",
        field("value", $.expression),
      ),

    /**
     * Index / choice LHS that cannot be a bare formal name (E18).
     * Ranges `a..b` and alternations are separate (`alternation_choice`).
     */
    _non_identifier_expression: ($) =>
      choice(
        $.literal,
        $.quoted_identifier,
        $.bind_variable,
        $.unary_expression,
        $.binary_expression,
        $.call_expression,
        $.member_expression,
        $.attribute_reference,
        $.parenthesized_expression,
        $.case_expression,
      ),

    // Name alternation N1 | N2 => expr; index alternation / ranges.
    alternation_choice: ($) =>
      seq(
        field("index", $._choice_alternation),
        "=>",
        field("value", $.expression),
      ),

    _choice_alternation: ($) =>
      prec.left(
        seq(
          $._choice_atom,
          repeat1(seq("|", $._choice_atom)),
        ),
      ),

    _choice_atom: ($) =>
      choice(
        $.range_expression,
        $.expression,
      ),

    range_expression: ($) =>
      prec.left(
        PREC.COMPARE,
        seq(
          field("low", $.expression),
          "..",
          field("high", $.expression),
        ),
      ),

    // FOR iterator [SEQUENCE | INDEX expr] => value
    iterator_choice: ($) =>
      seq(
        $._kw_for,
        field("iterator", $.iterator),
        optional(
          choice(
            keyword("sequence"),
            seq($._kw_index, field("index", $.expression)),
          ),
        ),
        "=>",
        field("value", $.expression),
      ),

    // ------------------------------------------------------------------
    // Shared iterator (E19 / D19 / S12) — full R26 controls
    // ------------------------------------------------------------------

    iterator: ($) =>
      seq(
        field("iterand", $.iterand_decl),
        repeat(seq(",", field("iterand", $.iterand_decl))),
        $._kw_in,
        field("controls", $.iteration_control_sequence),
      ),

    iterand_decl: ($) =>
      seq(
        optional(choice(keyword("mutable"), keyword("immutable"))),
        field("name", $.identifier),
        // Optional constrained type skipped in depth (declaration types → blocks).
      ),

    iteration_control_sequence: ($) =>
      seq(
        $.qual_iteration_control,
        repeat(seq(optional(","), $.qual_iteration_control)),
      ),

    qual_iteration_control: ($) =>
      seq(
        optional(keyword("reverse")),
        $.iteration_control,
        optional($.pred_clause_sequence),
      ),

    iteration_control: ($) =>
      choice(
        $.stepped_control,
        $.values_of_control,
        $.indices_of_control,
        $.pairs_of_control,
        $.dynamic_iteration_control,
        $.cursor_iteration_control,
        $.single_expression_control,
      ),

    stepped_control: ($) =>
      seq(
        field("low", $.expression),
        "..",
        field("high", $.expression),
        optional(seq($._kw_by, field("step", $.expression))),
      ),

    // Cursor name, collection expr, or REPEAT expr (S12–S19). Lowest priority.
    single_expression_control: ($) =>
      prec(
        -1,
        seq(
          optional(keyword("repeat")),
          field("value", $.expression),
        ),
      ),

    values_of_control: ($) =>
      seq($._kw_values, $._kw_of, field("source", $._iteration_source)),

    indices_of_control: ($) =>
      seq(keyword("indices"), $._kw_of, field("source", $._iteration_source)),

    pairs_of_control: ($) =>
      seq(keyword("pairs"), $._kw_of, field("source", $._iteration_source)),

    // Collection name/expr or parenthesized source (SQL depth → D7).
    _iteration_source: ($) =>
      choice($.expression, seq("(", $.expression, ")")),

    // Parenthesized cursor SELECT (classic cursor FOR unified via single expr).
    cursor_iteration_control: ($) =>
      seq("(", $._kw_select, $._opaque_sql_tail, ")"),

    // Thin dynamic control: EXECUTE IMMEDIATE … [USING [IN] …] (S17).
    dynamic_iteration_control: ($) =>
      seq(
        "(",
        keyword("execute"),
        keyword("immediate"),
        field("sql", $.expression),
        optional($.using_clause),
        ")",
      ),

    using_clause: ($) =>
      seq(
        keyword("using"),
        optional($._kw_in),
        $.expression,
        repeat(seq(",", optional($._kw_in), $.expression)),
      ),

    // Opaque SQL tail for parenthesized SELECT sources (D7 spine later).
    _opaque_sql_tail: ($) =>
      repeat1(choice(/[^()]+/, seq("(", optional($._opaque_sql_tail), ")"))),

    pred_clause_sequence: ($) =>
      repeat1(
        choice(
          seq(keyword("while"), field("while", $.expression)),
          seq($._kw_when, field("when", $.expression)),
        ),
      ),

    // ------------------------------------------------------------------
    // CASE expression (E7, E14–E15) + thin case_statement for conflict
    // ------------------------------------------------------------------

    case_expression: ($) =>
      prec.dynamic(
        1,
        seq(
          $._kw_case,
          optional(field("selector", $.expression)),
          repeat1($.when_clause),
          optional(seq($._kw_else, field("default", $.expression))),
          $._kw_end,
        ),
      ),

    when_clause: ($) =>
      seq(
        $._kw_when,
        field("choice", $._case_choice),
        repeat(seq(",", field("choice", $._case_choice))),
        $._kw_then,
        field("consequence", $.expression),
      ),

    _case_choice: ($) => choice($.dangling_predicate, $.expression),

    // E14 — comparison vocabulary without left operand (permissive).
    dangling_predicate: ($) =>
      choice(
        seq(
          field("operator", choice(...RELATIONAL_OPS)),
          field("right", $.expression),
        ),
        seq(
          optional($._kw_not),
          $._kw_between,
          field("low", $.expression),
          $._kw_and,
          field("high", $.expression),
        ),
        seq(
          optional($._kw_not),
          $._kw_in,
          field("right", $.in_list),
        ),
        seq(
          optional($._kw_not),
          $._kw_like,
          field("pattern", $.expression),
          optional(seq(keyword("escape"), field("escape", $.expression))),
        ),
        seq($._kw_is, optional($._kw_not), $._kw_null),
        seq($._kw_is, optional($._kw_not), keyword("nan")),
        seq($._kw_is, optional($._kw_not), keyword("infinite")),
        seq(
          optional($._kw_not),
          keyword("member"),
          optional($._kw_of),
          field("right", $.expression),
        ),
      ),

    /**
     * Thin CASE statement shell (E15 / D19) — END CASE [label] ;
     * Full WHEN statement lists and statement catalog → #41.
     * Enough structure for the one declared conflict vs case_expression.
     */
    case_statement: ($) =>
      prec.dynamic(
        0,
        seq(
          $._kw_case,
          optional(field("selector", $.expression)),
          repeat1($.case_statement_when_clause),
          optional(
            seq($._kw_else, field("default", repeat1($.statement))),
          ),
          $._kw_end,
          $._kw_case,
          optional(field("label", $.identifier)),
          ";",
        ),
      ),

    case_statement_when_clause: ($) =>
      seq(
        $._kw_when,
        field("choice", $._case_choice),
        repeat(seq(",", field("choice", $._case_choice))),
        $._kw_then,
        field("consequence", repeat1($.statement)),
      ),

    // ------------------------------------------------------------------
    // Trigger predicates (E12)
    // ------------------------------------------------------------------

    conditional_predicate: ($) =>
      choice(
        keyword("inserting"),
        keyword("deleting"),
        // Bare UPDATING
        keyword("updating"),
        // UPDATING(col) — separate alt so optional-paren shift/reduce is gone.
        prec(
          PREC.CALL + 1,
          seq(
            keyword("updating"),
            "(",
            field("column", choice($.identifier, $.quoted_identifier)),
            ")",
          ),
        ),
      ),

    // ------------------------------------------------------------------
    // static_expression — CC only (E22 / D5); exported, not wired
    // ------------------------------------------------------------------

    static_expression: ($) =>
      choice(
        $.static_binary_expression,
        $.static_unary_expression,
        $.static_parenthesized_expression,
        $.inquiry_directive,
        $.literal,
        $.identifier,
        $.static_member_expression,
        $.static_call_expression,
      ),

    static_binary_expression: ($) => {
      const left = field("left", $.static_expression);
      const right = field("right", $.static_expression);
      /** @param {number} level @param {string|string[]|any} ops */
      const bin = (level, ops) =>
        prec.left(
          level,
          seq(left, field("operator", choice(...[].concat(ops))), right),
        );
      return choice(
        bin(PREC.OR, $._kw_or),
        bin(PREC.AND, $._kw_and),
        bin(PREC.COMPARE, RELATIONAL_OPS),
        bin(PREC.ADD_CONCAT, ["+", "-", "||"]),
        bin(PREC.MUL, ["*", "/"]),
      );
    },

    static_unary_expression: ($) =>
      choice(
        prec(
          PREC.NOT,
          seq(field("operator", $._kw_not), field("argument", $.static_expression)),
        ),
        prec(
          PREC.UNARY,
          seq(
            field("operator", choice("+", "-")),
            field("argument", $.static_expression),
          ),
        ),
      ),

    static_parenthesized_expression: ($) =>
      seq("(", $.static_expression, ")"),

    static_member_expression: ($) =>
      prec.left(
        PREC.MEMBER,
        seq(
          field("object", $.static_expression),
          ".",
          field("name", $.identifier),
        ),
      ),

    static_call_expression: ($) =>
      prec(
        PREC.CALL,
        seq(
          field("function", $.static_expression),
          "(",
          optional(
            seq(
              $.static_expression,
              repeat(seq(",", $.static_expression)),
            ),
          ),
          ")",
        ),
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

    // Prec so YEAR(n) stays in the qualifier, not a call postfix on the literal.
    interval_literal: ($) =>
      prec(
        PREC.MEMBER,
        seq(
          keyword("interval"),
          field("value", $.string_literal),
          $.interval_qualifier,
        ),
      ),

    // L18 — precision is number_literal only (not full expression).
    // `TO` is reserved → $._kw_to; YEAR/MONTH/DAY/… are Set-2 keywords.
    // prec.right: prefer longer qualifier when optional (n) / TO follow.
    interval_qualifier: ($) =>
      prec.right(
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
