/**
 * @file Tree-Sitter grammar for Oracle PLSQL
 * @author Hrushikesh Pawar
 * @license MIT
 *
 * Composed from grammar/* modules:
 *   helpers.js      — PREC, keyword, reserved tokens, patterns
 *   opaque.js       — balanced / stop-before-`;` delimited spans
 *   blocks.js       — block/body/handlers + minimal statements (#41 / 02-blocks)
 *   types.js        — type supertype, type_spec, type defs, D15 name-site
 *   declarations.js — declare items, cursors, nested subprograms
 *   expressions.js  — PREC ladder, D15 postfix, CASE, aggregates (#40 / 04)
 *
 * Spec map: docs/spec/01-lexical.md … 04-expressions.md; DESIGN-NOTES D1–D20.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-nocheck

import {
  RESERVED_WORDS,
  keyword,
  reservedTokenRules,
} from "./grammar/helpers.js";
import { opaqueRules } from "./grammar/opaque.js";
import { blockRules } from "./grammar/blocks.js";
import { typeRules } from "./grammar/types.js";
import { declarationRules } from "./grammar/declarations.js";
import { expressionRules } from "./grammar/expressions.js";

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

  // Shared positional prefix of call vs marked aggregate needs GLR (D15).
  // CASE expression vs statement may reappear as the statement catalog grows.
  conflicts: ($) => [
    [$.case_expression, $.case_statement],
    [$.call_expression, $.qualified_expression],
    [$._actual_parameter, $._unmarked_aggregate_element],
    // Bare `_type_core` is shared by type_spec and parameter_type (D3 `type`).
    [$.type_spec, $.parameter_type],
  ],

  // D3 — five live supertypes in v1.
  supertypes: ($) => [
    $.literal,
    $.expression,
    $.statement,
    $.declaration,
    $.type,
  ],

  rules: {
    // Top-level: blocks, expression seeds, thin CASE statement (E15 pair).
    // expression_statement is a test/seed harness only — not a PL/SQL statement.
    source_file: ($) =>
      repeat(choice($.block, $.expression_statement, $.case_statement)),

    // Thin seed so lexical / expression corpus cases appear at top level.
    expression_statement: ($) => seq($.expression, ";"),

    ...opaqueRules(),
    ...blockRules(),
    ...typeRules(),
    ...declarationRules(),
    ...expressionRules(),

    // L9 reserved-word token rules — referenced by reserved.global
    ...reservedTokenRules(),
  },
});
