# Spec: 01 — Lexical layer

**Status:** Locked  
**Ticket:** [Lock spec: 01-lexical.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/12)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Locked:** 2026-07-16  

**Research (inputs, not re-decided here):**

- [Inventory: lexical units](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/3) → `docs/spec/research/01-lexical-units-inventory.md` (flags L1–L29)
- [Census: Appendix D reserved words vs keywords](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/2) → `docs/spec/research/appendix-d-reserved-keywords.md`
- [Spike: q-strings — external scanner or pure grammar (D9)](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/11) → `docs/spec/research/spike-q-strings-d9/`
- Cross-cutting: `docs/DESIGN-NOTES.md` (D1–D3, D8, D9, D14)

**Related tickets:** name-position / reference chain is locked as **D15** in [Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13) (keyword re-admission uses the shared name/postfix surface); script-layer `/` terminator → directives/script; full pragma catalog → directives.

---

## Area-spec template (all later `docs/spec/0N-*.md` follow this)

Every area lock file uses this skeleton:

1. **Header** — status, ticket link, map link, lock date, research inputs, related tickets  
2. **Scope** — what this file decides / does not decide  
3. **Standing rules applied** — which DESIGN-NOTES decisions (D1–D14…) this area inherits without re-arguing  
4. **Decisions** — one subsection or table row per lock, with ID (area flag or D-id), choice, and one-line rationale  
5. **Surface catalog** — named public nodes / tokens / fields this phase owns (shapes, not full grammar.js)  
6. **Deferred / out of scope** — pointers only; never restate other area specs  
7. **Implementation hand-off** — bullets an implementer can execute without reopening design  

Deliberation stays on the ticket; this file is the **outcome**. Inventory/spike markdown under `docs/spec/research/` stays evidence, not the lock.

---

## 1. Scope

**In scope:** every Phase 1 lexical decision — delimiters, identifiers (form + reserved/keyword policy), all literal token shapes, comments and extras, case-insensitivity mechanism, and the external-scanner boundary (extending D9).

**Out of scope for this file:** grammar.js implementation; embedded SQL subset; conditional-compilation *selection* directives (`$IF`…); WRAPPED / MLE bodies; SQL\*Plus `/` line terminator; full reference/name disambiguation productions (only the *lexical policy* is here).

---

## 2. Standing rules applied

| Decision | How it applies here |
|----------|---------------------|
| [D1](../DESIGN-NOTES.md#d1--grammar-name-and-node-naming) | Public names: `identifier`, `quoted_identifier`, `string_literal`, `q_string_literal`, `number_literal`, `date_literal`, … No keyword nodes. |
| [D2](../DESIGN-NOTES.md#d2--keywords-and-reserved-words) | Case-insensitive `keyword()`; only Appendix D reserved words hard-excluded from ordinary identifiers. |
| [D3](../DESIGN-NOTES.md#d3--supertypes-and-fields) | Supertype `literal` covers string, q-string, number, boolean/null, date, timestamp, interval; inquiry `$$` treated as literal-like primary. |
| [D8](../DESIGN-NOTES.md#d8--opaque-literal-tokens) | String / q-string / number are single opaque tokens (no internal tree structure). |
| [D9](../DESIGN-NOTES.md#d9--external-scanner-for-strings) | External scanner owns ordinary + q-string tokens (full Oracle close rule). **Extended here:** scanner also owns block comments. |
| [D14](../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) | Applied to L5 (documented `_` looseness) and L7 (manual-strict quoted ids). |

---

## 3. Decisions

### 3.1 Delimiters

| ID | Lock |
|----|------|
| **L1** | Multi-character delimiters take **longest match**: `**`, `\|\|`, `:=`, `=>`, `..`, `<<`, `>>`, `<>`, `!=`, `~=`, `^=`, `<=`, `>=`, `--`, `/*`, `*/`. No whitespace inside a multi-char delimiter. |
| **L2** | All **four** not-equal spellings are tokens: `<>`, `!=`, `~=`, `^=`. |
| **L4** | `/` as SQL\*Plus terminator is **not** decided here — deferred to directives/script. In pure PL/SQL, `/` is division only. |

Single-character delimiters (from inventory): `+ - * / = < > . , ; ( ) % : @ ' "`.

Operators and punctuation remain **anonymous tokens** in the tree (D1 — no keyword-style nodes for them).

### 3.2 Identifiers and reserved words

| ID | Lock |
|----|------|
| **L5** | Ordinary identifiers **may start with `_`** (documented looseness vs R26 letter-start). Still emit `identifier`. Manual requires letter start; we accept `_` for editor recovery / muscle memory. **Provisional** until legacy census can measure frequency. |
| **L6** | Letter/digit classes are **Unicode** (`\p{L}` / `\p{Nd}` or equivalent), not ASCII-only. Continues with letters, digits, `$`, `#`, `_`. |
| **L7** | Quoted identifiers: `"…"` with **no interior `"`** and **no `""` escape**. Also no newline/null inside (manual). Ref grammar’s `""` escape is rejected. |
| **L8** | **Do not** enforce 30/128-byte length limits (semantic / NLS). |
| **L9** | **85 Appendix D reserved words** are a hard blacklist: they never match as ordinary `identifier`. Membership: `docs/spec/research/appendix-d-reserved-keywords.md` Set 1. |
| **L10** | **252 Appendix D keywords** may be used as ordinary identifiers. They still match as keywords where the grammar requests a keyword; re-admission goes through the shared name / postfix surface locked as **D15** ([Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13)). |
| **L11** | Case-insensitivity: `keyword()` helper → `token(prec(1, /…/i))` (or equivalent). **Source spelling preserved** in the tree; matching is case-insensitive for keywords, reserved words, and unquoted ordinary identifiers at the language level. Quoted identifiers remain case-sensitive. |

**Public nodes:**

- `identifier` — ordinary user-defined identifier token (shape above; not a reserved word).  
- `quoted_identifier` — double-quoted form.  
- Predefined `STANDARD` names are **not** a separate token class (semantic only).

**`word` property:** `word: $ => $.identifier` so adjacent identifier-like tokens do not glue (L26).

### 3.3 Literals

| ID | Lock |
|----|------|
| **L12** | Confirm D8: `string_literal`, `q_string_literal`, and `number_literal` are **opaque single tokens**. |
| **L13** | D9 (already locked): arbitrary-delimiter q-strings require the external scanner. |
| **L14** | National prefix `N`/`n` and combined `NQ`/`nq` (any case mix of N+Q) are supported on the string/q-string family. |
| **L15** | Numeric form includes optional exponent and optional suffix `f`/`F`/`d`/`D` (`BINARY_FLOAT` / `BINARY_DOUBLE`). Decimal separator in numeric literals is always `.`. |
| **L16** | Number tokens are **unsigned**. Leading `+`/`-` are always **unary operators** at the expression layer — never part of the number token. |
| **L17** | Structured named nodes under supertype `literal`: `date_literal`, `timestamp_literal`, `interval_literal` (keyword + string [+ qualifier for interval]). Not scanner-opaque super-tokens. |
| **L18** | Interval qualifier precision is **integer/number only**, not a full expression. Semantic 1..9 range not enforced by the grammar. |
| **L19** | `TRUE`, `FALSE`, `NULL` are case-insensitive boolean/null **literals** under `literal`. `NULL` is reserved; `TRUE`/`FALSE` are special-cased even though absent from Appendix D lists. |
| **L20** | Named float constants (`BINARY_FLOAT_NAN`, `BINARY_FLOAT_INFINITY`, `BINARY_DOUBLE_NAN`, `BINARY_DOUBLE_INFINITY`) are **ordinary identifiers** — no special tokens. |
| **L21** | Ordinary string bodies may include **physical newlines** (scanner). Empty `''` is a valid string token (Oracle null string); not BOOLEAN `NULL`. |

**Opaque token sketches (implementer-facing, own words):**

```
-- external scanner (see §4)
string_literal   = [N|n]? ' ( '' | any )* '     -- newline allowed; opaque
q_string_literal = [N|n]? [Q|q] ' open body close '   -- full Oracle close rule

-- pure grammar
number_literal   = digits [ '.' digits? ] [ e|E [+|-]? digits ] [ f|F|d|D ]
                 | '.' digits [ e|E [+|-]? digits ] [ f|F|d|D ]
```

**Structured literal sketches:**

```
date_literal      = keyword(DATE)      string_literal
timestamp_literal = keyword(TIMESTAMP) string_literal
interval_literal  = keyword(INTERVAL)  string_literal interval_qualifier

interval_qualifier =
    YEAR  [ '(' number_literal ')' ] [ TO MONTH ]
  | MONTH [ '(' number_literal ')' ]
  | DAY   [ '(' number_literal ')' ] [ TO ( HOUR | MINUTE | SECOND [ '(' number_literal ')' ] ) ]
  | HOUR  [ '(' number_literal ')' ] [ TO ( MINUTE | SECOND [ '(' number_literal ')' ] ) ]
  | MINUTE[ '(' number_literal ')' ] [ TO SECOND [ '(' number_literal ')' ] ]
  | SECOND[ '(' number_literal [ ',' number_literal ] ')' ]
```

String payload shapes for DATE/TIMESTAMP/INTERVAL are **not** validated by the grammar (Oracle validates).

**Fields (D3):** for structured datetime/interval literals prefer `value` (or equivalent) for the string payload; interval may expose a named `qualifier` / nested qualifier node. Exact field names locked here as: `value` for the string child; interval qualifier as child node `interval_qualifier` (no extra field name required if single child).

### 3.4 Comments, whitespace, extras

| ID | Lock |
|----|------|
| **L3 / L22** | Comments are **extras** — never named nodes in the syntax tree. Line comments pure-grammar; block comments scanner-owned but still extras. |
| **L23** | Block comments are **non-nesting** (first `*/` closes). |
| **L24** | Unterminated block comment → incomplete token / Tree-sitter recovery; do **not** invent a synthetic close. |
| **L25** | Whitespace in `extras` (ASCII or Unicode space class). |

```
line_comment  = '--'  { any except newline } newline?     -- pure grammar, extras
block_comment = '/*'  { any } '*/'                        -- external scanner, extras; non-nesting
```

### 3.5 Bind variables and inquiry directives

| ID | Lock |
|----|------|
| **L27** | Bind / host variables are **own tokens**: `:identifier_shape` and `:digits` (not bare `:` + separate name node at the lexical layer). |
| **L28** | Inquiry directive `$$` + identifier shape is **one token** (`inquiry_directive`). When used as a primary, it sits under supertype **`literal`** (D3 default confirmed). |

Ordinary identifier **shape** for bind/inquiry continuations follows L5/L6 (including `_` start and Unicode), not the reserved-word blacklist (the text after `:` / `$$` is not an `identifier` node competing with keywords).

### 3.6 Pragma (lexical shape only)

| ID | Lock |
|----|------|
| **L29** | Generic form only: `PRAGMA` + name + optional `(…)` argument list. No per-pragma productions in v1 lexical/directives surface until the directives lock expands them. Unknown pragma names still parse. Placement rules → directives area. |

---

## 4. External scanner boundary

**Owns (externals):**

1. **Ordinary string literals** — optional `N`/`n`, `'` … `'`, doubled `''`, multiline body.  
2. **Q-string literals** — optional `N`/`n`, required `Q`/`q`, full Oracle delimiter/close rule (paired `[]{}()<>`, same-char otherwise, close only when immediately followed by `'`; open may be `'`).  
3. **Block comments** — `/*` … `*/`, non-nesting, may span lines.

**Does not own (pure grammar / extras):** line comments (`--`), whitespace, numbers, ordinary/quoted identifiers, multi-char delimiters, bind variables, inquiry directives, keywords/reserved.

**Later growth (not this lock):** MLE inline `{{…}}` bodies, WRAPPED payloads — only if a future units/directives ticket proves pure grammar insufficient (same bar as D9).

**D8 consistency:** scanner-emitted string/q-string tokens remain opaque; no sub-tokens for delimiters or body.

---

## 5. Surface catalog (Phase 1 public names)

| Name | Kind | Notes |
|------|------|-------|
| `identifier` | token | Ordinary; L5–L6, L9 |
| `quoted_identifier` | token | L7 |
| `string_literal` | token (external) | Opaque; L12, L14, L21 |
| `q_string_literal` | token (external) | Opaque; D9 |
| `number_literal` | token | Unsigned; L15–L16 |
| `true` / `false` / `null` — prefer rule names | keyword-style literals | Public node names: `boolean_literal` covering TRUE/FALSE, and `null_literal` **or** a single `boolean_or_null_literal` — **lock:** use **`boolean_literal`** for TRUE/FALSE and **`null_literal`** for NULL (both under supertype `literal`) |
| `date_literal` | named rule | L17 |
| `timestamp_literal` | named rule | L17 |
| `interval_literal` | named rule | L17 |
| `interval_qualifier` | named rule | child of interval |
| `bind_variable` | token | L27 |
| `inquiry_directive` | token | L28; literal-like primary |
| line/block comment | extras only | not named tree nodes |

Supertype membership: all of `string_literal`, `q_string_literal`, `number_literal`, `boolean_literal`, `null_literal`, `date_literal`, `timestamp_literal`, `interval_literal`, `inquiry_directive` (as primary) → **`literal`**.

---

## 6. Deferred / out of scope

| Item | Where |
|------|--------|
| Reference / name / call / member chain (keyword re-admission surface) | **D15** — [Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13) (locked) |
| SQL\*Plus `/` terminator, script layer | Directives / script lock |
| Per-pragma semantics and placement | Directives (`07`) |
| MLE `{{…}}`, WRAPPED scanner growth | Units / directives when ticketed |
| Byte-length and NLS validation | Semantic — never grammar |
| Implementing `grammar.js` / `scanner.c` | Execution after map |

---

## 7. Implementation hand-off (Phase 1)

1. Add `externals` for string, q-string, and block comment; implement scanner close rule per D9 spike + non-nesting block comments.  
2. Pure tokens: `number_literal` (unsigned, `f`/`d` suffixes), `identifier` (Unicode + `_` start, reserved blacklist), `quoted_identifier` (no interior `"`), binds, `$$`, multi-char delimiters (longest match, four `≠`).  
3. `extras`: whitespace, line comment, block comment (external).  
4. `word: $ => $.identifier`.  
5. `keyword()` helper for all reserved words + keywords + TRUE/FALSE; reserved list from census Set 1 never appears in `identifier`.  
6. Named rules: `date_literal`, `timestamp_literal`, `interval_literal` (+ `interval_qualifier` with numeric precision only), `boolean_literal`, `null_literal`.  
7. Do **not** special-case `BINARY_*_NAN` / `*_INFINITY`.  
8. Corpus seeds: ordinary/q/national strings (incl. multiline and content-ending-delimiter), all four `≠`, `_`-start ids, Unicode letter id, quoted id without `""`, unsigned numbers with `f`/`d`, DATE/TIMESTAMP/INTERVAL forms, binds, `$$`, line + block comments, unterminated block comment recovery smoke.

---

## 8. Decision index (L1–L29)

| ID | Resolution |
|----|------------|
| L1 | Longest-match multi-char delimiters |
| L2 | All four not-equal operators |
| L3 | Comments as extras (not tree nodes) |
| L4 | SQL\*Plus `/` deferred |
| L5 | Allow `_` start (documented looseness; provisional vs census) |
| L6 | Unicode letter/digit classes |
| L7 | No interior `"` / no `""` escape in quoted ids |
| L8 | No length enforcement |
| L9 | 85 reserved hard-blacklist |
| L10 | 252 keywords re-admitted via D15 name/postfix surface |
| L11 | Case-insensitive `keyword()`; preserve source case |
| L12 | Opaque string / q-string / number (D8) |
| L13 | External scanner for strings (D9) |
| L14 | `N` / `NQ` prefixes |
| L15 | `f`/`d` numeric suffixes |
| L16 | Unsigned numbers; unary for sign |
| L17 | Structured date/timestamp/interval nodes |
| L18 | Interval precision = number only |
| L19 | TRUE/FALSE/NULL as literals (`boolean_literal` / `null_literal`) |
| L20 | Named float constants = ordinary identifiers |
| L21 | Multiline ordinary strings |
| L22 | Comments in extras |
| L23 | Non-nesting block comments |
| L24 | Unterminated block → recovery, no fake close |
| L25 | Whitespace extras |
| L26 | `word` = identifier |
| L27 | Bind vars own tokens |
| L28 | `$$ident` one token; literal-like primary |
| L29 | Generic PRAGMA only |
| Scanner | Strings (D9) **+ block comments** |
