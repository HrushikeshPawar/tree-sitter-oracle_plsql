/**
 * Expression ladder, D15 postfix chain, CASE, aggregates, iterator, literals.
 * Spec: docs/spec/04-expressions.md E1–E22; DESIGN-NOTES D15/D19/D20.
 */

import {
  PREC,
  keyword,
  RELATIONAL_OPS,
  NUMBER_LITERAL,
  IDENTIFIER_PATTERN,
} from "./helpers.js";

/** @param {any} $ */
export function expressionRules($) {
  return {
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

    // Expression-site attribute; attribute name via shared _attribute_name (B28).
    attribute_reference: ($) =>
      prec.left(
        PREC.MEMBER,
        seq(
          field("object", $.expression),
          "%",
          field("attribute", $._attribute_name),
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


  };
}
