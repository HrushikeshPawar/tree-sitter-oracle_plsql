/**
 * External scanner for oracle_plsql (D9 / 01-lexical §4).
 *
 * Owns:
 *   1. Ordinary string literals — optional N/n, '…', doubled '', multiline (L14, L21)
 *   2. Q-string literals — optional N/n, required Q/q, full Oracle close rule (D9)
 *   3. Block comments -- slash-star ... star-slash, non-nesting (L23-L24)
 *
 * Pure grammar owns: line comments, whitespace, numbers, identifiers,
 * delimiters, binds, inquiry $$, keywords/reserved.
 *
 * Note: the external scanner is invoked *before* pure-grammar extras skip
 * whitespace. We therefore skip whitespace here so tokens after spaces are
 * still recognized in the same lex cycle.
 *
 * On false return, tree-sitter restores the input position, so it is safe to
 * advance while probing (e.g. '/' then not '*').
 */

#include "tree_sitter/parser.h"

enum TokenType {
  STRING_LITERAL,
  Q_STRING_LITERAL,
  BLOCK_COMMENT,
};

static inline bool is_space_char(int32_t c) {
  return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f' ||
         c == '\v';
}

static inline bool is_ws_delim_forbidden(int32_t c) {
  /* Open delimiter of a q-string may not be space/tab/CR/LF. */
  return c == ' ' || c == '\t' || c == '\r' || c == '\n';
}

static int32_t matching_close(int32_t open) {
  switch (open) {
  case '[':
    return ']';
  case '{':
    return '}';
  case '(':
    return ')';
  case '<':
    return '>';
  default:
    return open;
  }
}

static void skip_whitespace(TSLexer *lexer) {
  while (is_space_char(lexer->lookahead)) {
    lexer->advance(lexer, true);
  }
}

/* Ordinary string body after opening ' has been consumed. */
static bool scan_ordinary_body(TSLexer *lexer) {
  for (;;) {
    if (lexer->lookahead == 0) {
      return false; /* unterminated — no synthetic close */
    }
    if (lexer->lookahead == '\'') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '\'') {
        /* doubled quote escape */
        lexer->advance(lexer, false);
        continue;
      }
      lexer->result_symbol = STRING_LITERAL;
      lexer->mark_end(lexer);
      return true;
    }
    /* Newlines allowed in ordinary string bodies (L21). */
    lexer->advance(lexer, false);
  }
}

/* Q-string body after opening ' of q'…' has been consumed; next is delimiter. */
static bool scan_q_body(TSLexer *lexer) {
  int32_t open = lexer->lookahead;
  if (open == 0 || is_ws_delim_forbidden(open)) {
    return false;
  }
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
      /* close char not followed by ' — still content */
      continue;
    }
    lexer->advance(lexer, false);
  }
  return false; /* unterminated */
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

  /* Non-nesting: first star-slash closes (L23). */
  while (lexer->lookahead != 0) {
    if (lexer->lookahead == '*') {
      lexer->advance(lexer, false);
      if (lexer->lookahead == '/') {
        lexer->advance(lexer, false);
        lexer->result_symbol = BLOCK_COMMENT;
        lexer->mark_end(lexer);
        return true;
      }
      continue;
    }
    lexer->advance(lexer, false);
  }

  /* Unterminated: do not invent a close (L24). */
  return false;
}

/**
 * Ordinary / national / q-string at current lookahead.
 * Shapes: '…' | [Nn]'…' | [Qq]'…' | [Nn][Qq]'…' (any case mix of N+Q).
 */
static bool scan_string_or_q(TSLexer *lexer, const bool *valid_symbols) {
  bool want_str = valid_symbols[STRING_LITERAL];
  bool want_q = valid_symbols[Q_STRING_LITERAL];
  if (!want_str && !want_q) {
    return false;
  }

  int32_t c = lexer->lookahead;
  if (c == 0) {
    return false;
  }

  /* Optional national prefix N/n — only when followed by ' or Q/q. */
  if (c == 'N' || c == 'n') {
    lexer->advance(lexer, false);
    c = lexer->lookahead;
    if (c != '\'' && c != 'Q' && c != 'q') {
      return false;
    }
  }

  /* Q-string: [Nn]? [Qq] ' … */
  if (want_q && (c == 'Q' || c == 'q')) {
    lexer->advance(lexer, false);
    if (lexer->lookahead != '\'') {
      return false;
    }
    lexer->advance(lexer, false);
    return scan_q_body(lexer);
  }

  /* Ordinary: [Nn]? ' … */
  if (want_str && c == '\'') {
    lexer->advance(lexer, false);
    return scan_ordinary_body(lexer);
  }

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

  bool want_str = valid_symbols[STRING_LITERAL];
  bool want_q = valid_symbols[Q_STRING_LITERAL];
  bool want_block = valid_symbols[BLOCK_COMMENT];

  if (!want_str && !want_q && !want_block) {
    return false;
  }

  skip_whitespace(lexer);

  if (lexer->lookahead == 0) {
    return false;
  }

  if (want_block && scan_block_comment(lexer)) {
    return true;
  }

  if ((want_str || want_q) && scan_string_or_q(lexer, valid_symbols)) {
    return true;
  }

  return false;
}
