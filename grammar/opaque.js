/**
 * Opaque delimited spans shared by SQL stubs, call_spec, and iterators.
 * One delimiter policy: balanced parens vs stop-before-`;`.
 */

export function opaqueRules() {
  return {
    // Balanced `( … )` with nested parens (`;` allowed inside).
    _balanced_parens: ($) =>
      seq("(", optional($._opaque_inside_parens), ")"),

    _opaque_inside_parens: ($) =>
      repeat1(
        choice(
          /[^()]+/,
          $._balanced_parens,
        ),
      ),

    // Opaque text that must not swallow a decl/statement terminator `;`.
    // Used by cursor_query (unparenthesized SELECT …).
    _opaque_sql_no_semi: ($) =>
      repeat1(
        choice(
          /[^();]+/,
          $._balanced_parens,
        ),
      ),

    // Parenthesized SQL sources (iterator cursor control, etc.).
    _opaque_sql_tail: ($) => $._opaque_inside_parens,
  };
}
