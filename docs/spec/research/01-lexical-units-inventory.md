# Inventory: lexical units (Release 26)

**Ticket:** [Inventory: lexical units (identifiers, literals, delimiters, comments)](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/3) · **Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)

**Primary source:** Oracle Database Release 26, *PL/SQL Language Reference* — "Lexical Units"  
<https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/lexical-units.html> (retrieved 2026-07-16)

**Supporting sources (literals):** *SQL Language Reference* — "Literals"  
<https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/Literals.html> (retrieved 2026-07-16)

**Related census:** [Census: Appendix D reserved words vs keywords](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/2) → `docs/spec/research/appendix-d-reserved-keywords.md`

**Licensing:** No Oracle prose, tables, or diagram text is copied. What follows is our own factual inventory, EBNF-ish sketches, and decision flags. See `docs/oracle-plsql-release-26-grammar-research.md` §Licensing.

Local ground work: `grammar-ref.js` (lexical tokens ~1997–2066; `extras`; `qAltQuotePair`), `docs/DESIGN-NOTES.md` (D2, D8, D9), `docs/ROADMAP.md` Phase 1.

---

## Scope of this inventory

The manual's lexical units are: **delimiters**, **identifiers**, **literals**, **pragmas**, **comments**, plus **whitespace between units**. This asset covers each with sketches and Tree-sitter decision flags. Identifier *membership* (reserved vs keyword sets) lives in the Appendix D census; this asset covers identifier *form* and delimiter/literal/comment rules.

Also inventoried because Phase 1 / ROADMAP lists them as lexical-layer tokens even though the Lexical Units chapter only alludes to them indirectly:

- bind variables (`:name`, `:1`)
- inquiry directives (`$$name`)

Pragma *names and placement* are structural (Phase 7); only the lexical shape is sketched here.

---

## 1. Delimiters

**Source:** Lexical Units → Delimiters (Table 3-2). Provenance id: `lexical-units`.

A delimiter is a single character or multi-character combination with special meaning. **No characters (including whitespace) may be embedded inside a multi-character delimiter** — longest-match / adjacency is required at the token level.

### 1.1 Inventory (own words)

| Delimiter | Role (our gloss) | Multi-char? |
|-----------|------------------|-------------|
| `+` | addition | no |
| `-` | subtraction / negation | no |
| `*` | multiplication | no |
| `/` | division | no |
| `**` | exponentiation | **yes** |
| `=` | equal | no |
| `<>` `!=` `~=` `^=` | not equal (four spellings) | **yes** |
| `<` `>` | less / greater | no |
| `<=` `>=` | ≤ / ≥ | **yes** |
| `\|\|` | concatenation | **yes** |
| `:=` | assignment | **yes** |
| `=>` | association (named arg / aggregate) | **yes** |
| `..` | range | **yes** |
| `.` | component / member | no |
| `,` | list separator | no |
| `;` | statement terminator | no |
| `(` `)` | group / list | no |
| `%` | attribute indicator (`%TYPE`, `%ROWCOUNT`, …) | no |
| `:` | host / bind indicator | no |
| `@` | remote access / DB link | no |
| `'` | string delimiter | no |
| `"` | quoted-identifier delimiter | no |
| `<<` `>>` | label begin / end | **yes** |
| `--` | single-line comment start | **yes** |
| `/*` `*/` | multiline comment begin / end | **yes** |

### 1.2 Sketch (tokenization order)

```
multi_char_delim =
    "**" | "||" | ":=" | "=>" | ".." | "<<" | ">>"
  | "<>" | "!=" | "~=" | "^=" | "<=" | ">="
  | "--" | "/*" | "*/" ;

single_char_delim =
    "+" | "-" | "*" | "/" | "=" | "<" | ">"
  | "." | "," | ";" | "(" | ")" | "%" | ":" | "@"
  | "'" | '"' ;
```

### 1.3 Tree-sitter decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **L1** | Longest-match priority among multi-char operators vs single-char | `**` vs `* *`, `:=` vs `:` + `=`, `..` vs `.`, `\|\|` vs `|` (if `|` ever appears), `<=` vs `<` | Lock: 01-lexical |
| **L2** | Tokenize all four not-equal spellings (`<>` `!=` `~=` `^=`) | Manual lists all four; ref grammar may miss `~=`/`^=` | Lock: 01-lexical; expressions inventory |
| **L3** | Keep comment openers as tokens vs pure `extras` | Standard: comments as `extras` tokens, not visible structure | Lock: 01-lexical (settled pattern unless recovery needs visibility) |
| **L4** | `/` at start of line as SQL\*Plus terminator vs division | Script-layer vs expression; not pure lexical ambiguity in PL/SQL-only units | Decide: directives / script layer |

**Ref grammar note:** Operators appear both as bare string tokens and inside expression rules; no separate delimiter table. Salvage: multi-char set is mostly complete except possibly `~=` / `^=`.

---

## 2. Identifiers

**Source:** Lexical Units → Identifiers (+ Ordinary / Quoted user-defined). Provenance: `lexical-units`. Membership: `reserved-words` (Appendix D census).

### 2.1 Categories (own words)

1. **Reserved words** — special meaning; **cannot** be ordinary user-defined identifiers. May appear as *quoted* identifiers (not recommended); then always case-sensitive and always require quotes.
2. **Keywords** — special meaning; **may** be ordinary user-defined identifiers (not recommended).
3. **Predefined identifiers** — declared in package `STANDARD` (e.g. exception names). May be redeclared locally (overrides). **Not a closed lexical set** in the manual; membership comes from the dictionary / `STANDARD`, not Appendix D.
4. **User-defined identifiers** — ordinary or quoted.

Case: ordinary identifiers and unquoted references are **case-insensitive**. Quoted identifiers are **case-sensitive**, with one exception (below).

Adjacent identifiers must be separated by whitespace or punctuation.

### 2.2 Ordinary user-defined identifiers

**Rules (own words):**

- Begins with a **letter** (letter/digit classification is **database-character-set dependent**).
- Continues with letters, digits, `$`, `#`, `_`.
- Must **not** be a reserved word (Appendix D Table D-1).
- Length: representation in DB character set ≤ **128 bytes** if `COMPATIBLE ≥ 12.2`, else ≤ **30 bytes**. (Semantic limit; not required for a permissive editor grammar.)

```
ordinary_identifier =
    letter { letter | digit | "$" | "#" | "_" } ;

-- "letter" / "digit" = database character set classes (not ASCII-only in Oracle)
-- not in reserved_words
```

**Acceptable examples (shape only):** `X`, `t2`, `phone#`, `credit_limit`, `oracle$number`, `try_again_`.  
**Unacceptable examples (shape):** `mine&yours`, `debit-amount`, `on/off`, `user id`.

### 2.3 Quoted user-defined identifiers

**Rules (own words):**

- Enclosed in double quotes: `"…"`.
- Interior: any DB character set character **except** double quote, newline, and null.
- Length of interior (excluding quotes): same 128/30 byte rule as ordinary.
- **Case-sensitive**, except: if the interior (without quotes) is a valid ordinary identifier, then unquoted references are allowed and those unquoted refs are case-insensitive.
- Reserved words as quoted ids: always require quotes; always case-sensitive (`"BEGIN"` ≠ `"begin"`).

```
quoted_identifier =
    '"' { char - ('"' | newline | null) } '"' ;
```

### 2.4 Predefined identifiers (lexical note only)

Not a token class of their own for the grammar: they are ordinary-looking identifiers that resolve to `STANDARD` objects. No special lexer rule. Overriding / shadowing is semantic.

### 2.5 Tree-sitter decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **L5** | Ordinary id start set: letter-only (manual) vs allow `_` (ref grammar `/[A-Za-z_]…/`) | Ref is looser than the manual; recovery vs fidelity | Lock: 01-lexical; recovery rubric |
| **L6** | ASCII-only letter/digit class vs Unicode / multibyte "letter" | Full Oracle uses DB character set; Tree-sitter often uses ASCII + recovery | Lock: 01-lexical; recovery rubric |
| **L7** | Quoted id: **forbid** interior `"` (manual) vs allow `""` escape (ref grammar) | Direct contradiction with `grammar-ref.js` | Lock: 01-lexical |
| **L8** | Enforce 30/128 byte length? | Manual limit; editors usually skip | Lock: 01-lexical (recommend **no** — semantic) |
| **L9** | Reserved-word exclusion from `identifier` | D2 + Appendix D census: hard blacklist for 85 reserved only | Lock: 01-lexical; reference-ambiguity |
| **L10** | Keyword re-admission as identifier in name positions | Keywords tokenize as keywords; need `alias` / contextual rules | Lock: 01-lexical; reference-ambiguity (#13) |
| **L11** | Case folding: lexer keeps original case; matching is case-insensitive for keywords/ordinary ids | Standard Tree-sitter approach with `keyword()` helper | Lock: 01-lexical (D2 already leans this way) |

**Ref grammar deltas:**

| Item | Ref | Manual | Note |
|------|-----|--------|------|
| Ordinary pattern | `[A-Za-z_][A-Za-z0-9_$#]*` | letter start; letters/digits/`$#_` | `_` start is extra-permissive |
| Quoted pattern | allows `""` inside | forbids `"` inside entirely | **L7** |
| Reserved exclusion | incomplete / contextual | full Table D-1 | census + **L9** |

---

## 3. Literals

**Sources:** PL/SQL Lexical Units → Literals (high-level + BOOLEAN); SQL Literals (text, numeric, datetime, interval). Provenance: `lexical-units`, `sql-literals`.

PL/SQL literals include **all SQL literals** plus BOOLEAN `TRUE` / `FALSE` / `NULL`.

### 3.1 Character / text literals (ordinary)

**Rules (own words):**

- Enclosed in single quotes: `'…'`.
- Interior apostrophe doubled: `''` → one `'`.
- Case-sensitive; whitespace significant.
- **No** line-continuation character; a physical newline **inside** the quotes is part of the string value.
- Empty string `''` is a **null string** (NULL-like character value), **not** the BOOLEAN `NULL`.
- Optional national prefix: `N` / `n` before the opening quote → national character set literal.
- Max length is a semantic/NLS concern (`MAX_STRING_SIZE`); not a lexer concern for v1.

```
string_literal =
    [ "N" | "n" ] "'" { char | "''" } "'" ;
```

**Sketch note:** `char` here includes newline. Token must be able to span lines.

### 3.2 Alternative quoting (q-strings)

**Rules (own words) — from SQL text-literal diagram + prose:**

- Form: `[N|n]? [Q|q] ' <quote_delimiter> <text> <quote_delimiter> '`
- `quote_delimiter`: any single- or multibyte character **except** space, tab, return.
- Opening/closing delimiter rules:
  - If open is `[` `{` `<` `(` → close must be matching `]` `}` `>` `)`.
  - Otherwise open and close are the **same** character.
- Interior may contain the delimiter character as long as it is **not immediately followed by** `'`.
- Delimiter may itself be `'`, with the same "not followed by another `'` that would end the literal" care.
- National + alternative: `nq'…'` / `NQ'…'` etc.

```
q_string_literal =
    [ "N" | "n" ] [ "Q" | "q" ] "'"
    quote_open
    { content  -- any char; delimiter only if not followed by "'" }
    quote_close
    "'" ;

quote_open / quote_close =
    paired:  [ ]  |  { }  |  < >  |  ( )
  | same:    any single char ∉ { space, tab, return }
```

**Manual examples of valid shapes (cited by form only):** `q'!…!'`, `q'<…>'`, `q'{…}'`, `nq'…'`, `q'"…"'`.

### 3.3 Numeric literals

**Integer (SQL diagram, own words):**

```
integer_literal = [ "+" | "-" ] digit { digit } ;
-- precision up to 38 digits (semantic)
```

**Number / floating-point (SQL diagram, own words):**

```
number_literal =
    [ "+" | "-" ]
    ( digit { digit } [ "." { digit } ]
    | "." digit { digit }
    )
    [ ( "e" | "E" ) [ "+" | "-" ] digit { digit } ]
    [ "f" | "F" | "d" | "D" ] ;
```

- No suffix → `NUMBER`.
- `f`/`F` → `BINARY_FLOAT`.
- `d`/`D` → `BINARY_DOUBLE`.
- Decimal separator in **numeric** literals is always `.` (NLS-insensitive).
- Exponent range and overflow are semantic.

**Named floating-point constants (SQL, not digit-forms):** `BINARY_FLOAT_NAN`, `BINARY_FLOAT_INFINITY`, `BINARY_DOUBLE_NAN`, `BINARY_DOUBLE_INFINITY` — ordinary identifiers / keywords at expression level, not digit tokens.

### 3.4 BOOLEAN / NULL literals

From PL/SQL Lexical Units:

- `TRUE`, `FALSE`, `NULL` are BOOLEAN / logical literals.
- `NULL` is an **Appendix D reserved word**.
- `TRUE` / `FALSE` are **not** in the Appendix D reserved or keyword lists from the census — treat as predefined / special boolean tokens (still case-insensitive keywords in practice for a Tree-sitter grammar).

```
boolean_or_null_literal = "TRUE" | "FALSE" | "NULL" ;  -- case-insensitive
```

### 3.5 Datetime literals

**DATE (ANSI form):**

```
date_literal = "DATE" string_literal ;
-- string value shape: 'YYYY-MM-DD' (Gregorian); validated by Oracle, not by us
```

**TIMESTAMP** (timezone is **inside** the string, not keyword trailers on the literal form used in examples):

```
timestamp_literal = "TIMESTAMP" string_literal ;
-- e.g. TIMESTAMP '1997-01-31 09:26:50.124'
-- e.g. TIMESTAMP '1997-01-31 09:26:56.66 +02:00'
-- e.g. TIMESTAMP '1999-04-15 8:00:00 US/Pacific'
```

There is **no** distinct `TIMESTAMP WITH LOCAL TIME ZONE` literal syntax; values are written with other datetime forms.

`TO_DATE` / `TO_TIMESTAMP` are function calls, not literals.

### 3.6 Interval literals

Two families: **YEAR TO MONTH** and **DAY TO SECOND**.

```
interval_literal =
    "INTERVAL" string_literal interval_qualifier ;

interval_qualifier =
    -- YEAR TO MONTH family:
      "YEAR" [ "(" precision ")" ] [ "TO" "MONTH" ]
    | "MONTH" [ "(" precision ")" ]
    -- DAY TO SECOND family:
    | "DAY"  [ "(" precision ")" ] [ "TO" ( "HOUR" | "MINUTE" | "SECOND" [ "(" frac_prec ")" ] ) ]
    | "HOUR" [ "(" precision ")" ] [ "TO" ( "MINUTE" | "SECOND" [ "(" frac_prec ")" ] ) ]
    | "MINUTE" [ "(" precision ")" ] [ "TO" "SECOND" [ "(" frac_prec ")" ] ]
    | "SECOND" [ "(" precision [ "," frac_prec ] ")" ] ;

precision / frac_prec = integer   -- leading field 0..9 (default 2); fractional seconds 1..9 (default 6)
```

Trailing field, when present, must be less significant than leading (semantic restriction).

String payloads (own-words shapes): years-months as `'y-m'` or single field; day-second as `'d h:mi:ss.ff'` and abbreviated forms per SQL tables 2-14 / 2-15.

### 3.7 Tree-sitter decision flags (literals)

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **L12** | Single `token()` for entire string / q-string / number (D8) vs internal structure | D8 already prefers single tokens | Lock: 01-lexical (confirm D8) |
| **L13** | **Q-string: pure grammar of common delimiters vs external scanner for arbitrary delimiter** | Manual allows *any* non-whitespace delimiter; ref enumerates `[]{}()<> !#\|/"` only | **Spike: q-strings (#11)** / D9 |
| **L14** | Support `N`/`n` and `NQ`/`nq` prefixes | National character literals are in the SQL diagram | Lock: 01-lexical |
| **L15** | Numeric: include `f`/`F`/`d`/`D` suffixes | In SQL number diagram; **absent from ref** `number_literal` | Lock: 01-lexical |
| **L16** | Leading `+`/`-` as part of number token vs always unary operators | Both legal in SQL diagrams; unary is also an operator — conflict with `-x` vs `-1` | Lock: 01-lexical; expressions |
| **L17** | `DATE`/`TIMESTAMP`/`INTERVAL` + string as structured rules vs keyword+string in expression | Ref uses `date_literal` / `timestamp_literal` / `interval_literal`; conflicts with `name` | Lock: 01-lexical; #13 |
| **L18** | Interval precision: `integer` only vs full `expression` (ref uses `expression`) | Manual uses numeric precision; ref is looser | Lock: 01-lexical |
| **L19** | BOOLEAN `TRUE`/`FALSE` as keyword tokens always | Not in Appendix D; still need reserved-like treatment in expression context | Lock: 01-lexical |
| **L20** | Named float constants (`BINARY_FLOAT_NAN`, …) as special tokens vs ordinary identifiers | SQL table 2-12; rare in PL/SQL | Lock: 01-lexical (recommend ordinary id / no special case) |
| **L21** | Multiline ordinary strings (newline inside quotes) | Manual allows; regex `.*` style tokens need care with `/s` or explicit `\n` | Lock: 01-lexical |

**Ref grammar deltas:**

| Item | Ref | Manual / SQL | Note |
|------|-----|--------------|------|
| `string_literal` | `/'([^']\|'')*'/` | + optional `N`; multiline | Missing `N`; may fail across lines depending on regex flags |
| `q_string_literal` | fixed delimiter set | any delimiter except WS | **L13** / #11 |
| `number_literal` | no `f`/`d` suffix | has suffixes | **L15** |
| date/ts/interval | present | present | keep shape; fix conflicts |
| TRUE/FALSE/NULL | as `keyword` in `literal` | present | keep |

---

## 4. Comments

**Source:** Lexical Units → Comments. Provenance: `lexical-units`.

### 4.1 Single-line

```
line_comment = "--" { any char except newline } newline? ;
```

- Begins with `--`, runs to end of line.
- Caution (Precompiler): end-of-line handling differs in some host tools — out of scope for the grammar.

### 4.2 Multiline

```
block_comment = "/*" { any char } "*/" ;  -- non-nesting
```

- Begins `/*`, ends `*/`, may span lines.
- **Cannot nest:** a block comment must not contain another `/* … */`.
- A block comment **may** contain `--` single-line comment text.

### 4.3 Tree-sitter decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **L22** | Both comment forms as `extras` | Standard; matches ref | Lock: 01-lexical (recommend yes) |
| **L23** | Non-nesting block comments (stop at first `*/`) | Manual forbids nesting; lexer simplicity | Lock: 01-lexical |
| **L24** | Unterminated block comment recovery | Editor quality | Recovery rubric (#5) |

**Ref:** `line_comment` / `block_comment` in `extras` — keep pattern.

---

## 5. Whitespace

**Source:** Lexical Units → Whitespace Characters Between Lexical Units.

- Whitespace **may** appear between lexical units (and often should, for readability).
- Adjacent **identifiers** require separating whitespace or punctuation (stated under Identifiers).
- Whitespace is **not** significant inside multi-character delimiters (cannot split `:=`, `**`, etc.).
- Inside string literals, whitespace **is** significant.

### 5.1 Tree-sitter decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **L25** | `/\s/` (or Unicode whitespace) in `extras` | Universal | Lock: 01-lexical (recommend yes) |
| **L26** | Whether to treat no-separator identifier adjacency as hard error | Oracle rejects; Tree-sitter may glue tokens differently via `word:` | Lock: 01-lexical |

**Ref:** `extras: [/\s/, line_comment, block_comment]` + `word: $ => $.identifier` — keep.

---

## 6. Related lexical-layer tokens (Phase 1 adjacency)

Not full sections of the Lexical Units chapter, but required for a usable Phase 1 surface.

### 6.1 Bind / host variables

```
bind_variable =
    ":" ordinary_identifier_shape
  | ":" digit { digit } ;
```

Ref: `/:[A-Za-z_][A-Za-z0-9_$#]*/` and `/:\d+/`.

| ID | Question | Feeds |
|----|----------|-------|
| **L27** | Bind vars as their own node vs `:` + name | Lock: 01-lexical (recommend own token, matches ref) |

### 6.2 Inquiry directives

```
inquiry_directive = "$$" ordinary_identifier_shape ;
```

Conditional-compilation *selection* directives (`$IF` …) are Phase 7; `$$name` values appear in expressions earlier.

| ID | Question | Feeds |
|----|----------|-------|
| **L28** | Tokenize `$$ident` as one token | Lock: 01-lexical; directives design |

### 6.3 Pragma (lexical shape only)

```
pragma = "PRAGMA" identifier [ "(" argument_list ")" ] ;
```

- Begins with reserved word `PRAGMA`.
- Unknown pragma names: Oracle ignores (no effect) — grammar should still parse generic form.
- Full placement rules → Phase 7 / directives ticket.

| ID | Question | Feeds |
|----|----------|-------|
| **L29** | Generic `PRAGMA name[(args)]` only (no per-pragma productions) | DESIGN-NOTES / Phase 7 (recommend generic) |

---

## 7. Consolidated EBNF-ish sketch (lexical layer)

Own-words composite for the Phase 1 token surface (not a complete Tree-sitter grammar):

```
extras = whitespace | line_comment | block_comment ;

lexical_unit =
    delimiter
  | ordinary_identifier | quoted_identifier
  | string_literal | q_string_literal
  | number_literal | integer_literal
  | boolean_or_null_literal
  | date_literal | timestamp_literal | interval_literal
  | bind_variable | inquiry_directive
  | keyword_or_reserved   -- matched case-insensitively; see Appendix D census
  ;

-- comments & whitespace: see §4–5
-- delimiters: see §1
-- identifiers: see §2
-- literals: see §3
```

Supertype (DESIGN-NOTES D3): `literal` should cover string, q-string, number, boolean/null, date, timestamp, interval (and optionally inquiry directive if treated as a literal-like primary).

---

## 8. Decision index (all Tree-sitter flags)

| ID | Topic | Severity for Phase 1 | Owner ticket |
|----|-------|----------------------|--------------|
| L1 | Multi-char delimiter longest match | Required | Lock: 01-lexical |
| L2 | Four not-equal operators | Required | Lock: 01-lexical |
| L3 | Comments as extras | Easy default | Lock: 01-lexical |
| L4 | `/` script terminator vs division | Script layer | Directives / script |
| L5 | Ordinary id may start with `_`? | Policy | Lock: 01-lexical + recovery rubric |
| L6 | Unicode letters in identifiers | Policy | Lock: 01-lexical + recovery rubric |
| L7 | Quoted id interior `"` / `""` | Spec conflict with ref | Lock: 01-lexical |
| L8 | Byte-length limits | Skip (semantic) | Lock: 01-lexical |
| L9 | Reserved-word blacklist (85) | Required (D2) | Lock: 01-lexical |
| L10 | Keyword re-admission list/positions | Hard | Lock: 01-lexical + #13 |
| L11 | Case-insensitive keyword helper | Easy (D2) | Lock: 01-lexical |
| L12 | Opaque literal tokens (D8) | Confirm | Lock: 01-lexical |
| **L13** | **Q-string arbitrary delimiter / external scanner** | **Hard (D9)** | **#11 Spike** |
| L14 | `N`/`NQ` prefixes | Required | Lock: 01-lexical |
| L15 | Numeric `f`/`d` suffixes | Required | Lock: 01-lexical |
| L16 | Signed number token vs unary | Design | Lock: 01-lexical + expressions |
| L17 | DATE/TIMESTAMP/INTERVAL structure | Design | Lock: 01-lexical + #13 |
| L18 | Interval precision expr vs int | Minor | Lock: 01-lexical |
| L19 | TRUE/FALSE tokenization | Required | Lock: 01-lexical |
| L20 | BINARY_*_NAN/INFINITY | Optional | Lock: 01-lexical |
| L21 | Multiline strings | Required | Lock: 01-lexical |
| L22–L24 | Comment extras / non-nest / recovery | Defaults + recovery | Lock: 01-lexical; #5 |
| L25–L26 | Whitespace extras / word boundary | Defaults | Lock: 01-lexical |
| L27–L28 | Bind + inquiry tokens | Phase 1 surface | Lock: 01-lexical |
| L29 | Generic pragma shape | Phase 7 | Directives design |

---

## 9. Provenance entries (for `docs/provenance/manifest.jsonl`)

Suggested rows (own summaries only):

```json
{"id": "lexical-units", "kind": "lexical", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/lexical-units.html", "section": "Lexical Units", "release": "26", "retrieved": "2026-07-16", "summary": "Complete delimiter table; ordinary/quoted identifier form; comments; whitespace; high-level literals and pragmas. Inventory: docs/spec/research/01-lexical-units-inventory.md.", "sketch": "See inventory §§1–6 EBNF-ish sketches.", "rules": ["line_comment", "block_comment", "identifier", "quoted_identifier", "string_literal", "q_string_literal", "number_literal", "date_literal", "timestamp_literal", "interval_literal", "bind_variable", "inquiry_directive"], "notes": "Tree-sitter decision flags L1–L29. Reserved/keyword membership is separate (reserved-words census)."}
{"id": "sql-literals", "kind": "lexical", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/Literals.html", "section": "Literals (Text, Numeric, Datetime, Interval)", "release": "26", "retrieved": "2026-07-16", "summary": "SQL text (incl. N/q-alternative quoting), integer/number with e/f/d suffixes, DATE/TIMESTAMP literals, INTERVAL YEAR TO MONTH and DAY TO SECOND. PL/SQL defers here for non-BOOLEAN literals.", "sketch": "string ::= [N] ('…' | q'delim…delim'); number ::= [+-] digits/fraction [e exponent] [f|d]; interval ::= INTERVAL str qualifier.", "rules": ["string_literal", "q_string_literal", "number_literal", "date_literal", "timestamp_literal", "interval_literal"], "notes": "Q delimiter is any non-whitespace character with paired brackets for []{}()<> . Arbitrary delimiter forces L13/D9 scanner decision."}
```

---

## 10. What this inventory does *not* decide

Deferred explicitly (already ticketed or fog):

- **Which** keywords are re-admitted as identifiers in which positions — [Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13) + [Lock spec: 01-lexical.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/12).
- **Q-string implementation strategy** — [Spike: q-strings — external scanner or pure grammar (D9)](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/11).
- **Recovery-vs-precision choices** for L5/L6/L8/L24 — [Decide: recovery-vs-precision rubric](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5).
- **Script-layer `/` and SQL\*Plus** — directives/script ticket.
- **Per-pragma semantics** — Phase 7.
- **Implementation** of any rule in `grammar.js` — out of scope for this map.

This document is the factual base for locking `docs/spec/01-lexical.md`.
