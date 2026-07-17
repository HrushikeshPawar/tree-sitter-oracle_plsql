/**
 * Blocks, exception handlers, and minimal statement surface.
 * Spec: docs/spec/02-blocks.md B1–B5, B32–B38; statements staging B36.
 */

import { keyword } from "./helpers.js";

export function blockRules() {
  return {
    // ------------------------------------------------------------------
    // Blocks (B1–B5, D18)
    // ------------------------------------------------------------------

    // One public block for anonymous and nested forms (B1).
    block: ($) =>
      seq(
        repeat(field("label", $.label)),
        optional(
          seq($._kw_declare, field("declarations", $.declare_section)),
        ),
        field("body", $.body),
      ),

    // B5 — << name >>; no label_list wrapper.
    label: ($) => seq("<<", field("name", $.identifier), ">>"),

    // Flat declare list — no item_list_1 / item_list_2 (B6–B7 / D18).
    declare_section: ($) => repeat1($.declaration),

    // Reusable body (B1–B2) — also hangs off nested units later.
    body: ($) =>
      seq(
        $._kw_begin,
        field("statements", $.statement_list),
        optional(
          seq($._kw_exception, field("handlers", $.exception_section)),
        ),
        $._kw_end,
        optional(field("end_name", $.identifier)),
        ";",
      ),

    // B3 — ≥1 statement; empty BEGIN → recovery.
    statement_list: ($) => repeat1($.statement),

    // B32 — wrapper for handlers.
    exception_section: ($) => repeat1($.exception_handler),

    // B33–B34 — do not enforce OTHERS last/unique; names = D15 name-site.
    exception_handler: ($) =>
      seq(
        $._kw_when,
        choice(
          seq(
            field("exception", $._name_site),
            repeat(seq($._kw_or, field("exception", $._name_site))),
          ),
          keyword("others"),
        ),
        $._kw_then,
        $.statement_list,
      ),

    // ------------------------------------------------------------------
    // Statements (B36 minimal; full catalog → #42 / 03-statements)
    // ------------------------------------------------------------------

    statement: ($) =>
      choice(
        $.null_statement,
        $.assignment_statement,
        $.procedure_call_statement,
        $.block,
        $.case_statement, // E15 pair; full WHEN surface → statements ticket
      ),

    // Prefer null_statement over expression/call of bare NULL (S22).
    null_statement: ($) => prec(2, seq($._kw_null, ";")),

    // S23–S24 / D15 — LHS is assignment_target, not free expression.
    assignment_statement: ($) =>
      seq(
        field("target", $.assignment_target),
        ":=",
        field("value", $.expression),
        ";",
      ),

    // D15 statement reference chain (shared with procedure_call).
    // Assignment also allows binds and attribute targets.
    _stmt_ref_chain: ($) =>
      choice(
        $.identifier,
        $.quoted_identifier,
        $.member_expression,
        $.call_expression,
        $.database_link_reference,
      ),

    assignment_target: ($) =>
      choice(
        $._stmt_ref_chain,
        $.bind_variable,
        $.attribute_reference,
      ),

    // D15 / S37 — call_expression or bare name/member/link chain.
    // prec(-1): lose to keyword-led statements and assignment (`:=`).
    procedure_call_statement: ($) =>
      prec(-1, seq($._stmt_ref_chain, ";")),
  };
}
