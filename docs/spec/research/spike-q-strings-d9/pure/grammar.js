/**
 * PROTOTYPE (throwaway) — pure-grammar q-string approach for D9 / L13.
 *
 * Question: can a fixed delimiter set in grammar.js acceptably cover
 * Oracle alternative quoting without an external scanner?
 *
 * Delimiter set = grammar-ref-style common set:
 *   paired: [] {} () <>
 *   same:   ! # | / "
 *
 * Corpus inputs are bare literals (plus trailing junk markers for err cases).
 * NOT production. See ../README.md.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-nocheck

function escClass(ch) {
  if ("\\^-]".includes(ch)) return "\\" + ch;
  return ch;
}
function escOutside(ch) {
  if ("\\.^$*+?()[]{}|".includes(ch)) return "\\" + ch;
  return ch;
}

// Tree-sitter has no negative lookahead. Body encoding:
//   ( [^CLOSE] | CLOSE [^'] )* CLOSE '
// Quotes are allowed inside the body (the whole point of q-strings).
// Imperfect when content *ends* with CLOSE (e.g. q'!x!!') — see README.
function qSame(delim) {
  const d = escOutside(delim);
  const dClass = escClass(delim);
  return new RegExp(
    String.raw`[nN]?[qQ]'${d}([^${dClass}]|${d}[^'])*${d}'`,
  );
}

function qPaired(open, close) {
  const o = escOutside(open);
  const c = escOutside(close);
  const cClass = escClass(close);
  return new RegExp(
    String.raw`[nN]?[qQ]'${o}([^${cClass}]|${c}[^'])*${c}'`,
  );
}

const SAME_DELIMS = ["!", "#", "|", "/", '"'];
const PAIRED_DELIMS = [
  ["[", "]"],
  ["{", "}"],
  ["(", ")"],
  ["<", ">"],
];

export default grammar({
  name: "spike_q_pure",

  extras: ($) => [/\s+/],

  rules: {
    // One top-level literal per file (spike corpus).
    source_file: ($) => $.literal,

    literal: ($) => choice($.string_literal, $.q_string_literal),

    string_literal: (_) => /[nN]?'([^']|'')*'/,

    q_string_literal: (_) =>
      token(
        choice(
          ...PAIRED_DELIMS.map(([o, c]) => qPaired(o, c)),
          ...SAME_DELIMS.map((d) => qSame(d)),
        ),
      ),
  },
});
