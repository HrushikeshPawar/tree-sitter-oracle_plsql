/**
 * External scanner for oracle_plsql (D9 / 01-lexical §4).
 *
 * Tracer (#38): owns non-nesting block comments only.
 * Ordinary/q-string tokens land with the lexical-layer ticket.
 *
 * Block comment: slash-star … star-slash — first close pair wins (L23);
 * no synthetic close for unterminated comments (L24). Still an extra,
 * not a tree node.
 *
 * Note: the external scanner is invoked *before* the pure-grammar extras
 * skip whitespace. We therefore skip whitespace here so `/*` after spaces
 * is still recognized in the same lex cycle.
 */

#include "tree_sitter/parser.h"

enum TokenType {
  BLOCK_COMMENT,
};

static inline bool is_space(int32_t c) {
  return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f' ||
         c == '\v';
}

static bool scan_block_comment(TSLexer *lexer) {
  if (lexer->lookahead != '/') {
    return false;
  }
  lexer->advance(lexer, false);
  if (lexer->lookahead != '*') {
    return false;
  }
  lexer->advance(lexer, false);

  /* Non-nesting: stop at first star-slash */
  while (lexer->lookahead != 0) {
    if (lexer->lookahead == '*') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '/') {
        lexer->advance(lexer, false);
        lexer->result_symbol = BLOCK_COMMENT;
        lexer->mark_end(lexer);
        return true;
      }
      /* lone '*', keep scanning */
      continue;
    }
    lexer->advance(lexer, false);
  }

  /* Unterminated: do not invent a close (L24). */
  return false;
}

void *tree_sitter_oracle_plsql_external_scanner_create(void) {
  return NULL;
}

void tree_sitter_oracle_plsql_external_scanner_destroy(void *payload) {
  (void)payload;
}

unsigned tree_sitter_oracle_plsql_external_scanner_serialize(void *payload,
                                                             char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_oracle_plsql_external_scanner_deserialize(void *payload,
                                                           const char *buffer,
                                                           unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_oracle_plsql_external_scanner_scan(void *payload,
                                                    TSLexer *lexer,
                                                    const bool *valid_symbols) {
  (void)payload;

  if (!valid_symbols[BLOCK_COMMENT]) {
    return false;
  }

  /* Skip whitespace so we see `/*` after spaces in this external call. */
  while (is_space(lexer->lookahead)) {
    lexer->advance(lexer, true);
  }

  return scan_block_comment(lexer);
}
