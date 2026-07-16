/**
 * PROTOTYPE external scanner — ordinary + q-string literals (D9 spike).
 * Throwaway. Not production.
 *
 * Ordinary: [N|n]? ' ( '' | [^'] )* '
 * Q-string: [N|n]? [Q|q] ' <open> <text> <close> '
 *   open: any non-(space|tab|CR|LF) character
 *   close: matching bracket for [ { ( <  else same as open
 *   text: any chars; a close char ends the literal only when followed by '
 */

#include "tree_sitter/parser.h"

enum TokenType {
  STRING_LITERAL,
  Q_STRING_LITERAL,
};

static inline bool is_ws_delim_forbidden(int32_t c) {
  return c == ' ' || c == '\t' || c == '\r' || c == '\n';
}

static int32_t matching_close(int32_t open) {
  switch (open) {
    case '[': return ']';
    case '{': return '}';
    case '(': return ')';
    case '<': return '>';
    default:  return open;
  }
}

static bool scan_ordinary_body(TSLexer *lexer) {
  // Called after opening ' has been consumed.
  for (;;) {
    if (lexer->lookahead == 0) return false;
    if (lexer->lookahead == '\'') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '\'') {
        lexer->advance(lexer, false); // ''
        continue;
      }
      lexer->result_symbol = STRING_LITERAL;
      lexer->mark_end(lexer);
      return true;
    }
    lexer->advance(lexer, false);
  }
}

static bool scan_q_body(TSLexer *lexer) {
  // Called after opening ' of q-string has been consumed; next is delimiter.
  int32_t open = lexer->lookahead;
  if (open == 0 || is_ws_delim_forbidden(open)) return false;
  int32_t close = matching_close(open);
  lexer->advance(lexer, false);

  while (lexer->lookahead != 0) {
    if (lexer->lookahead == close) {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '\'') {
        lexer->advance(lexer, false);
        lexer->result_symbol = Q_STRING_LITERAL;
        lexer->mark_end(lexer);
        return true;
      }
      // close not followed by ' — content
      continue;
    }
    lexer->advance(lexer, false);
  }
  return false;
}

static bool scan(TSLexer *lexer, const bool *valid_symbols) {
  bool want_str = valid_symbols[STRING_LITERAL];
  bool want_q = valid_symbols[Q_STRING_LITERAL];
  if (!want_str && !want_q) return false;

  int32_t c = lexer->lookahead;
  if (c == 0) return false;

  bool national = false;
  if (c == 'N' || c == 'n') {
    national = true;
    lexer->advance(lexer, false);
    c = lexer->lookahead;
  }

  // Q-string: [Nn]? [Qq] ' …
  if (want_q && (c == 'Q' || c == 'q')) {
    lexer->advance(lexer, false);
    if (lexer->lookahead != '\'') return false;
    lexer->advance(lexer, false);
    return scan_q_body(lexer);
  }

  // Ordinary: [Nn]? ' …
  if (want_str && c == '\'') {
    lexer->advance(lexer, false);
    return scan_ordinary_body(lexer);
  }

  (void)national;
  return false;
}

void *tree_sitter_spike_q_scanner_external_scanner_create(void) {
  return NULL;
}

void tree_sitter_spike_q_scanner_external_scanner_destroy(void *payload) {
  (void)payload;
}

unsigned tree_sitter_spike_q_scanner_external_scanner_serialize(
    void *payload, char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_spike_q_scanner_external_scanner_deserialize(
    void *payload, const char *buffer, unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_spike_q_scanner_external_scanner_scan(
    void *payload, TSLexer *lexer, const bool *valid_symbols) {
  (void)payload;
  return scan(lexer, valid_symbols);
}
