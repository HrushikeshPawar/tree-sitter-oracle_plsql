# Spike: q-strings — external scanner or pure grammar (D9)

**Ticket:** [Spike: q-strings — external scanner or pure grammar (D9)](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/11)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Status:** PROTOTYPE / throwaway — answers L13 / D9; not production grammar code.

## Question

Can arbitrary-delimiter `q'X…X'` literals (and other lexical edges the inventory flags) be handled **acceptably without an external scanner**, or does **D9 flip** toward a scanner?

## What was built

Two minimal tree-sitter grammars that only parse one literal per file:

| Approach | Path | Mechanism |
|----------|------|-----------|
| **A — Pure grammar** | `pure/` | `token(choice(...))` of fixed delimiter regexes (ref-style set: paired `[]{}()<>` + same `!#\|/"`) |
| **B — External scanner** | `scanner/` | `externals` for ordinary + q-string; `src/scanner.c` implements full Oracle close rule |

Shared corpus: `corpus/cases.tsv` (32 cases).  
One-command runner: `bash docs/spec/research/spike-q-strings-d9/run-spike.sh`  
Latest matrix: `results.tsv`.

## Oracle rules under test (own words)

From the lexical inventory / SQL text-literal diagram:

- Form: `[N\|n]? [Q\|q] ' <open> <text> <close> '`
- Open = any non-whitespace character (space/tab/CR/LF forbidden as delimiter)
- Close = matching `]` `}` `)` `>` when open is `[` `{` `(` `<`; else close = open
- Text may contain the close character **unless** it is immediately followed by `'`
- Ordinary strings remain `[N\|n]? ' ('' \| [^'])* '`

## Results (32 cases)

| Metric | Pure (common set) | Scanner |
|--------|-------------------|---------|
| Match expect | **22 / 32** | **32 / 32** |
| `pure_gap` (Oracle-ok, scanner-ok, pure-miss) | **10** | — |
| Wrong-pair / unclosed rejected | yes | yes |
| Multiline body (`q'!…\n…!'`) | yes | yes |
| Interior delimiter not before `'` | yes | yes |
| Quotes inside body (`sql_in_q`) | yes (after body-class fix) | yes |
| Content ending with delimiter (`q'!x!!'`) | **no** | **yes** |
| Arbitrary delimiter (`@ ~ x 0 $ _ : * …`) | **no** | **yes** |

### Gap breakdown (pure misses)

| Kind | Cases | Why pure fails |
|------|-------|----------------|
| Arbitrary delimiter outside common set | 9 (`arb_*`, `n_arb_at`) | Not in the enumerated `choice` |
| Content ends with close delimiter | 1 (`content_ends_delim` = `q'!x!!'`) | Tree-sitter regex has **no negative lookahead**; classic `([^D]\|D[^'])*D'` encoding cannot end the body on a lone `D` before final `D'` |

### Scanner correctness notes

- Owns **both** ordinary and q-string tokens so `n'…'` vs `nq'…'` never requires un-advancing after a speculative `N`.
- Paired brackets and same-char delimiters share one path (`matching_close`).
- Stateless (no serialize payload) — fine for this token.

## Complexity comparison

| | Pure | Scanner |
|--|------|---------|
| Hand-written source | ~77 LOC `grammar.js` (mostly delimiter table + regex builders) | ~26 LOC `grammar.js` + ~134 LOC `scanner.c` |
| Generated `parser.c` (spike) | ~345 LOC | ~229 LOC + scanner |
| WASM / editor load | No C scanner to compile into WASM… until you need one | Needs scanner compiled for native **and** WASM (supported, but more build surface) |
| Extending delimiter set | Add another regex alt (or generate ~90 ASCII alts) | Already accepts any non-ws code point |
| Full Oracle fidelity | **Unreachable** in pure regex: (1) arbitrary open char, (2) no-lookahead body rule | Reachable in ~100 LOC of straightforward C |
| Risk profile | Silent under-parse of rare but legal literals | Hand-written lexer bugs; must keep in sync with D8 (opaque token) |

### “Enumerate all ASCII” pure variant (not checked in as third grammar)

~90 same-char alts + 4 paired ≈ full **printable ASCII** coverage. That still:

1. Misses **multibyte / non-ASCII** delimiters the manual allows.
2. **Still fails** `content_ends_delim` (encoding limit, not set size).
3. Bloats the lexer with dozens of near-identical tokens for a rare construct.

So expanding the set is not a path to full correctness.

## Other lexical edges (inventory L\* scan)

| Edge | Needs external scanner? |
|------|-------------------------|
| L13 q-string arbitrary delimiter | **Yes for full fidelity** (this spike) |
| Multi-char delimiters (`:=`, `**`, `..`, …) | No — pure `token` / string literals |
| Ordinary / national strings | No — regex; or fold into scanner if q-string already forces one |
| Block / line comments | No — non-nested `/*…*/` is regular |
| Quoted identifiers `"…"` | No |
| Bind `:id` / inquiry `$$id` | No |

**Conclusion on “any other edge”:** nothing else in the current lexical inventory **forces** a scanner. Q-strings are the sole hard L13/D9 driver. If a scanner exists for q-strings, folding ordinary strings into it is optional hygiene (avoids `n`/`q` prefix hazards), not a second requirement.

## Design implications for D9

Three coherent policies:

### Option 1 — Pure grammar, common delimiters only (D9 stays “no scanner”)

- Ship the ref-style set: `[]{}()<> !#|/"`.
- Document intentional non-coverage: rare delimiters + content-ending-with-delimiter.
- Simplest build; no C.
- **Against map coverage commitment** (“full Release 26 PL/SQL-proper surface gets a spec decision”) unless the decision is explicitly “accept under-parse” with a recorded exception.

### Option 2 — Pure grammar, expanded ASCII set, still no scanner

- Better practical coverage; still incomplete (unicode delimiters + `content_ends_delim`).
- Lexer bloat; little win over Option 1 if the long tail is already “unsupported.”

### Option 3 — External scanner for string literals (D9 flips)

- Full Oracle q-string rule in one place; 32/32 on this corpus including arbitrary delimiters and `q'!x!!'`.
- Ordinary strings can live in the same scanner (recommended) or stay regex if carefully ordered.
- Aligns with D8 (opaque literal tokens) cleanly: one external token type per literal kind.
- Cost: maintain `scanner.c`, WASM build, slightly higher review bar.

## Recommendation (for grilling)

**Flip D9 to external scanner (Option 3)** for q-string (and preferably ordinary string) tokens.

Reasons:

1. Map notes commit to **full R26 PL/SQL-proper surface**, not “common cases only.”
2. Pure grammar cannot express the real close rule without lookahead — gaps are **semantic**, not just “rare delimiter.”
3. Scanner complexity in the spike is small, localized, and state-free.
4. No other lexical feature currently forces a second scanner; one small scanner is enough for Phase 1.

Acceptable alternative if human prefers zero C: **Option 1** with an explicit, named coverage exception in `01-lexical.md` (and tests that document the misses). That is a deliberate product cut, not “pure is complete.”

## How to re-run

```bash
bash docs/spec/research/spike-q-strings-d9/run-spike.sh
```

Requires `tree-sitter` CLI and `gcc` on `PATH`.

## Files

```
spike-q-strings-d9/
  README.md           ← this comparison (decision asset)
  run-spike.sh
  results.tsv         ← last run matrix
  corpus/cases.tsv
  pure/grammar.js
  pure/tree-sitter.json
  pure/src/…          ← generated
  scanner/grammar.js
  scanner/tree-sitter.json
  scanner/src/scanner.c
  scanner/src/…       ← generated parser
```
