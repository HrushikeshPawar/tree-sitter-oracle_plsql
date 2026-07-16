/**
 * @file Tree-Sitter grammar for Oracle PLSQL
 * @author Hrushikesh Pawar
 * @license MIT
 *
 * Tracer bullet (#38): bare source_file → block → null_statement,
 * with external scanner owning block comments (D9 / 01-lexical §4).
 * Later tickets widen the surface; keep public nodes to the three named here.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-nocheck

/**
 * Case-insensitive keyword token (D2). Anonymous in the tree (D1).
 * @param {string} word
 */
function keyword(word) {
  return token(prec(1, new RegExp(word, "i")));
}

export default grammar({
  name: "oracle_plsql",

  // Whitespace + line comments pure-grammar; block comments via scanner (L22–L25).
  extras: ($) => [/\s+/, /--[^\n]*/, $._block_comment],

  // Scanner owns block comments for now; strings/q-strings arrive in lexical ticket.
  externals: ($) => [$._block_comment],

  rules: {
    source_file: ($) => repeat($.block),

    // Minimal block: BEGIN … END ; — only null_statement inside (widen in #41/#42).
    block: ($) =>
      seq(keyword("begin"), repeat1($.null_statement), keyword("end"), ";"),

    null_statement: ($) => seq(keyword("null"), ";"),
  },
});
