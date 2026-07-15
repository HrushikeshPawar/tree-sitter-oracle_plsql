/**
 * @file Tree-Sitter grammar for Oracle PLSQL
 * @author Hrushikesh Pawar
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-nocheck

export default grammar({
  name: "oracle_plsql",

  rules: {
    source_file: $ => repeat($._top_level_item),
    _top_level_item: $ => $.identifier, //placeholder
    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_$]*/,
  }
});
