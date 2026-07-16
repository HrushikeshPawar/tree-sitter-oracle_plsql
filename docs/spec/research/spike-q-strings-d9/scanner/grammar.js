/**
 * PROTOTYPE (throwaway) — external-scanner q-string approach for D9 / L13.
 *
 * Both ordinary and q-string literals are external tokens so the scanner can
 * disambiguate n'…' vs nq'…' without un-advancing (realistic production shape
 * under D8 opaque-literal preference).
 *
 * NOT production. See ../README.md.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-nocheck

export default grammar({
  name: "spike_q_scanner",

  extras: ($) => [/\s+/],

  externals: ($) => [$.string_literal, $.q_string_literal],

  rules: {
    source_file: ($) => $.literal,

    literal: ($) => choice($.string_literal, $.q_string_literal),
  },
});
