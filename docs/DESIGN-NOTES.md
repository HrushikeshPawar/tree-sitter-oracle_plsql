# Design notes

Numbered decision index for the locked design spec. Deliberation lives on the map
tickets; this file gists the lock and points at the source. Area detail lives
under `docs/spec/`.

**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)

## Index

| ID | Title | Status | Source |
|----|--------|--------|--------|
| [D1](#d1--grammar-name-and-node-naming) | Grammar name and node naming | Locked (refined) | Salvage; refined in [#5](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5) |
| [D2](#d2--keywords-and-reserved-words) | Keywords and reserved words | Locked | Salvage; census [#2](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/2) |
| [D3](#d3--supertypes-and-fields) | Supertypes and fields | Locked (refined) | Salvage; refined in [#5](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5) |
| [D4](#d4--version-neutral-grammar) | Version-neutral grammar | Locked | Salvage |
| [D5](#d5--conditional-compilation-envelope) | Conditional compilation envelope | Locked | Salvage |
| [D6](#d6--wrapped-units) | Wrapped units | Locked | Salvage |
| [D7](#d7--embedded-sql) | Embedded SQL | Locked (boundary still open) | Salvage; subset in [#14](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14) |
| [D8](#d8--opaque-literal-tokens) | Opaque literal tokens | Locked | Salvage |
| [D9](#d9--external-scanner-for-strings) | External scanner for strings / q-strings (+ block comments) | Locked (flipped; surface extended) | [#11](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/11); extended [#12](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/12) |
| [D10](#d10--publish-targets-v1) | Publish targets (v1 bindings) | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D11](#d11--file-type-claim) | File-type claim | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D12](#d12--node-shape-versioning) | Node-shape versioning | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D13](#d13--ci-and-private-corpus) | CI and private corpus | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D14](#d14--recovery-vs-precision-rubric) | Recovery-vs-precision rubric | Locked | [#5](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5) |
| [D15](#d15--reference-ambiguity-strategy) | Reference-ambiguity strategy (name/call/member/attribute) | Locked | [#13](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13) |

---

## D1 — Grammar name and node naming

**Locked** (refined 2026-07-16 via [Decide: recovery-vs-precision rubric and node/field conventions](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5)).

- Grammar name is `oracle_plsql`.
- Node names are `lower_snake_case`, mirroring the manual's terminology where one exists (e.g. `cursor_declaration`, not `cursor_decl`).

**Standing naming rules:**

1. **Public rule names** = manual term, `lower_snake_case`, full words (no abbrevs like `decl` / `stmt` / `expr` unless the manual itself uses them).
2. **When the manual has no single term**, use the clearest Tree-sitter-style name common in sibling grammars (`binary_expression`, `if_statement`) — document the choice once in the area spec, not ad hoc.
3. **Hidden rules** (`_foo`) only for pure structure / factoring that must never appear in the tree (no queries, no highlights).
4. **Keyword tokens** stay anonymous in the tree (matched via `keyword()`, not `$.keyword_begin` nodes) unless a query truly needs to distinguish a specific keyword occurrence — default is **no keyword nodes**.
5. **`alias(...)` sparingly** — only to unify shapes consumers treat as the same (e.g. CREATE vs nested procedure definition → same `procedure_definition` surface). Never alias away a distinction queries need.
6. **One concept → one node name** across phases (no `select_stmt` in SQL and `select_statement` in PL/SQL).

---

## D2 — Keywords and reserved words

**Locked** (salvage; evidence in Appendix D census [#2](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/2)).

Keywords are matched case-insensitively via a `keyword()` helper producing `token(prec(1, /regex/))`. Keywords are **not** globally reserved — only Appendix D *reserved words* are excluded from `identifier` contexts, and even then only where it doesn't hurt error recovery (apply [D14](#d14--recovery-vs-precision-rubric)).

---

## D3 — Supertypes and fields

**Locked** (refined 2026-07-16 via [#5](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5)).

### Supertypes

1. **Only five supertypes in v1:** `statement`, `expression`, `declaration`, `type`, `literal`.
2. Every concrete production of those kinds is a subtype of exactly one of the five.
3. **Do not add** `unit`, `clause`, `reference`, `sql_statement`, etc. as supertypes for now — ordinary named nodes, or wait until Phase 8 queries prove the need.
4. **SQL DML** that appears as a PL/SQL statement is under **`statement`** (e.g. `select_statement`, `insert_statement`) — not a separate SQL supertype.
5. **Program units** (`create_package_*`, standalone procedure/function, triggers, types) are **top-level / unit nodes**, not forced under `statement` or `declaration`, unless they also appear nested as declarations (nested subprogram → `declaration`).
6. **`literal` covers** string, q-string, number, boolean/null, date/timestamp/interval. Inquiry `$$` defaults to under `literal` if treated as a primary (confirm in `01-lexical`).

### Fields

1. **Core stable field names** (reuse whenever the role matches):  
   `name`, `end_name`, `condition`, `body`, `parameters`, `arguments`, `type` / `return_type` / `element_type` / `base_type`, `value`, `left` / `right` (binary ops), `operator`, `object`, `target` (assignment/LHS), `label`, `exception`, `handler`, `query` (SQL/cursor), `default` (default value).
2. **Role over type:** field name describes *role in the parent*, not the child node type. Prefer `field("name", $.identifier)` over inventing `identifier` as a field; prefer `condition` even if the child is a full `expression`.
3. **Required when present in syntax:** if the construct has a name/condition/body in the manual diagram, expose it as a field.
4. **No fields for pure punctuation / structural keywords** (`BEGIN`, `;`, `,`, `IS`/`AS` choosers) unless a query must distinguish variants (rare; document when it happens).
5. **Lists:** wrap multi-item syntax in a named node (`parameter_list`, `argument_list`) — prefer **`field("parameters", $.parameter_list)`** over repeating `field("parameter", …)` unless order-sensitive sparse lists need per-item fields.
6. **When unsure, field it** — easier to ignore a field in a query than to recover structure later.

---

## D4 — Version-neutral grammar

**Locked** (salvage).

One version-neutral grammar; no per-release grammars. Release-specific syntax is just added, with provenance noting the source section.

---

## D5 — Conditional compilation envelope

**Locked** (salvage).

Conditional compilation is parsed as a directive envelope with permissive branch content — never desugared into ordinary `if_statement`.

---

## D6 — Wrapped units

**Locked** (salvage).

Wrapped units (`... WRAPPED`) are consumed as an opaque token stream.

---

## D7 — Embedded SQL

**Locked direction** (salvage); exact subset still open in [#14](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14).

Embedded SQL is modeled natively (not injected) for the DML subset; anything beyond the subset should fail *locally*. Apply [D14](#d14--recovery-vs-precision-rubric) when drawing the boundary.

---

## D8 — Opaque literal tokens

**Locked** (salvage).

Numeric/string/q-string literal tokens are single opaque tokens (no internal structure).

---

## D9 — External scanner for strings

**Locked (flipped)** 2026-07-16 via [Spike: q-strings — external scanner or pure grammar (D9)](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/11); **scanner surface extended** 2026-07-16 via [Lock spec: 01-lexical.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/12).

**Scanner owns:**

1. Ordinary string and alternative-quoting (q-string) literals as **opaque tokens** (consistent with D8). Full Oracle close rule: optional `N`/`n`, optional/required `Q`/`q`, any non-whitespace open delimiter, paired close for `[]{}()<>`, same-char close otherwise, close only terminates when immediately followed by `'`.
2. **Block comments** (`/* … */`), non-nesting — still **extras** (not named tree nodes).

**Pure grammar still owns:** line comments (`--`), whitespace, numbers, identifiers, delimiters, binds, inquiry `$$`, keywords.

MLE `{{…}}` / WRAPPED payloads may grow the scanner later only if a units/directives ticket proves pure grammar insufficient.

Assets: `docs/spec/research/spike-q-strings-d9/` (PR #27); area lock `docs/spec/01-lexical.md`.

---

## D10 — Publish targets (v1)

**Locked 2026-07-16** via [Decide: publish targets, CI shape, and file-type claim](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10).

**v1 first-class publish surfaces:**

| Surface | Binding | Registry / form |
|---------|---------|-----------------|
| Node | `node: true` | npm (`tree-sitter-oracle-plsql`) |
| Rust | `rust: true` | crates.io |
| Python | `python: true` | PyPI |
| C | `c: true` | headers / pkg-config (shared host path) |

**Not v1 publish / not release-CI:** Go and Swift (`go: false`, `swift: false` in `tree-sitter.json`). May be re-enabled later if demand appears; until then we do not own their release matrices.

**Also off:** Java, Zig (unchanged).

**Plan applied in** `tree-sitter.json` → `bindings`.

---

## D11 — File-type claim

**Locked 2026-07-16** via [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10).

**Claim these extensions only** (PL/SQL-specific; no bare `.sql`):

```
pks, pkb, pls, plb, pck, prc, fnc, trg
```

**Scope / injection (unchanged):** `scope: source.oracle_plsql`, `injection-regex: ^oracle_plsql$`.

**Not claimed:** `.sql` — collides with generic SQL grammars; editors should keep generic SQL as the default for that extension. Users who store PL/SQL in `.sql` files force-language or inject `oracle_plsql` locally.

**Plan applied in** `tree-sitter.json` → `grammars[0].file-types`.

---

## D12 — Node-shape versioning

**Locked 2026-07-16** via [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10).

| Era | Policy |
|-----|--------|
| **Pre-1.0 (`0.x`)** | Public node/field shapes may change when design or bugfix requires it. Document every break in CHANGELOG. Prefer additive changes when cheap; no cross-minor compatibility promise when a note says otherwise. |
| **1.0.0** | First “stable shape” cut: specs implemented, one real consumer pass on in-repo queries, no known forced renames pending. Freezes the **public** node/field surface. |
| **Post-1.0** | **Major:** remove/rename a public node or field; change child structure under a public node so existing queries break; breaking language name/scope change. **Minor:** new nodes/fields, broader acceptance, recovery that does not remove old shapes. **Patch:** bugfixes that restore intended shape without API change. |

**Private rules:** underscore-prefixed grammar rules (`_…`) are never part of the public contract.

**Queries:** in-repo query files ship with the grammar package (same version). External query forks are unsupported by this policy.

**Note:** Tree-sitter **parser ABI** version (CMake `TREE_SITTER_ABI_VERSION`) is orthogonal to this grammar node-shape policy.

---

## D13 — CI and private corpus

**Locked 2026-07-16** via [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10).

**Bootstrap, then retire private dependency.**

1. **Private ~5k corpus** is required for **initial production readiness** only: local smoke / census ([Census: legacy corpus construct frequencies](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4); tooling on PR #16). Nothing proprietary is committed; aggregate stats and distilled fixtures only.
2. **Distill** representative cases into **committed public** `test/corpus/` (synthetic / own-words, license-clean). That public corpus becomes the long-term quality gate.
3. **After distillation is done:** no ongoing private-corpus gate and **no self-hosted runner requirement**. Release quality is defined by public CI alone.

**Public CI (when added) runs only open artifacts:** generate, `tree-sitter test` / public corpus, and binding smoke for the four D10 publish targets (plus optional wasm). Never uploads or mounts the private tree.

**While corpus access is still pending:** decide tickets remain unblocked; frequency-sensitive cuts stay provisional until census + distillation land (see map Notes).

---

## D14 — Recovery-vs-precision rubric

**Locked 2026-07-16** via [Decide: recovery-vs-precision rubric and node/field conventions](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5).

Consumer priority is **editors and code intelligence equally**. Later tickets **apply this rubric**; they do not re-argue the consumer priority.

### Principle

Prefer **precision** for syntax we claim to model. Prefer **localized recovery** (not fake-valid rules) for unmodeled or invalid input. **Never invent permissive productions that pretend broken or out-of-scope code is legal.**

### Apply checklist

When a ticket faces a recovery-vs-precision fork, answer these in order and stop at the first decisive step:

1. **Claimed surface?** Is this construct in the full R26 PL/SQL-proper surface, or in the embedded-SQL / script subset we explicitly include?
   - **Yes** → model it with a precise node shape; do not paper over with recovery or a catch-all.
   - **No / unknown / deliberately opaque** → envelope or local failure (`ERROR` / `MISSING`), not a fake precise tree.

2. **Valid Oracle vs invalid / broken-legacy?**
   - **Valid** for that surface → the grammar must accept it (precision wins; loosen only if the manual is ambiguous and real code needs it — document as a deliberate extension).
   - **Invalid / broken-legacy** → do **not** add a special rule (see salvage audit); rely on Tree-sitter recovery. Revisit only if smoke-corpus recovery is *not* localized.

3. **Cascade risk?** Does the precise rule risk cascading `ERROR` across otherwise-valid siblings/parents?
   - **Yes, and the construct is out-of-subset or optional trailing junk** → permissive *envelope* or coarse token repeat at that boundary only (still not “broken PL/SQL is valid”).
   - **Yes, but the construct is in-spec** → fix the grammar (precedence/structure); do not paper with recovery.

4. **Lexical looseness?** Would a looser lexical rule (e.g. `_`-start identifiers, Unicode letters) accept invalid input *and* help recovery without poisoning queries?
   - Prefer the **manual** when both are easy.
   - Allow documented looseness only when editors would otherwise mark large valid-looking spans as `ERROR` *and* code intelligence still gets a stable `identifier` (or equivalent) node.

---

## D15 — Reference-ambiguity strategy

**Locked 2026-07-16** via [Decide: reference-ambiguity strategy (name/qualified/call/member)](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13).

Feeds `docs/spec/04-expressions.md` (and name sites in blocks/units). Applies [D14](#d14--recovery-vs-precision-rubric); respects [D3](#d3--supertypes-and-fields) (no `reference` supertype).

### Strategy

**Unified postfix chain** — not competing primaries, not a flattened `reference` node, not a pile of declared conflicts.

1. **Seed primary** (identifier, and other primaries the area specs list: binds, etc.).
2. **Left-associative postfixes** on that chain:
   - `.name` → `member_expression`
   - `%attr` → `attribute_reference`
   - `(…)` → `call_expression` or (when marked) `qualified_expression` — see below
   - `@dblink` → database-link reference on the chain (node name locked in area spec; small named node preferred)
3. **One shared chain everywhere**; **productions restrict which postfixes are legal by context**:
   - Expression position: full chain.
   - Name / type-name / exception / end-label sites: seed + `.` only (no call postfix).
   - `%TYPE` / `%ROWTYPE`: attribute postfix only in type-spec (and related declaration) productions.
4. **No `qualified_name` competing primary** and **no `reference` supertype** (D3). Dotted names are nested `member_expression` (or the same shape under a name-only production).

### `(…)` identity

| Interior | Node |
|----------|------|
| Positional args, empty `()`, or `identifier =>` named args | **`call_expression`** (covers function call, indexing, bare constructor/simple qualified at parse time — identity is semantic) |
| Unambiguous aggregate markers: `OTHERS =>`, indexed `expr => expr` (non-identifier LHS), `FOR … =>` (iterator / sequence / index-iterator) | **`qualified_expression`** (distinct node) |

- **No** parse-time split into `index_expression` vs `collection_constructor` vs call for unmarked forms ([E9](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/8) / E21).
- **Bare `f` is never a call.** Only `f()` (empty or non-empty argument list) is `call_expression`. Parameterless function-as-value is a **semantic** resolution fact on a name reference, not a dual CST ([E17](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/8)).
- **`@dblink` before args:** `f@dblink()` is a `call_expression` whose callee is the database-link reference on `f`.

### `%` attributes

One **`attribute_reference`** for every `base % attr` (cursor attrs, `SQL%…`, `%TYPE`, `%ROWTYPE`). Context limits which attribute names are legal — not parallel node types for “type attribute” vs “cursor attribute.”

### Parentheses (non-call)

- **`parenthesized_expression`:** `(` expression `)` — ordinary grouping only.
- **Subquery / select-as-expression:** only when the interior **starts with** a claimed SQL query keyword (`SELECT` / `WITH` / … per the embedded-SQL subset). Not an open-paren GLR race against any expression.
- **Old-style outer join `(+)`:** separate token/postfix on a column ref — not a parenthesized expression.
- **Multi-value row `(a, b, …)`:** deferred to [Decide: embedded SQL subset boundary](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14) unless pure PL/SQL later forces an expression primary.

### Procedure call statements

- **`procedure_call_statement`** (supertype `statement`) wraps either:
  - a **`call_expression`** when `(…)` is present, or
  - a bare name / member / link chain when not (`do_work;`).
- Do **not** invent a second call-shaped node for statement-only `f(a)`.

### Conflicts

- **None declared** among seed / member / call / attribute / link for this family — structure makes the grammar LR-friendly.
- Other areas keep their own conflict budget (e.g. CASE expression vs statement; anything [#14](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14) forces). Add a justified conflict later only if a lock finds a true irreducible ambiguity.

### Consumer split

- **Editors / queries:** stable shape — call syntax present or not; dotted/member/attribute structure.
- **Code intelligence:** name resolution decides variable vs parameterless function/procedure; the CST does not dual-parse bare names as calls.

---

## Precedence table (Phase 4 — finalize against the manual)

Starting ladder aligned with Oracle PL/SQL Table 3-3 (lowest → highest binding; `call` / `member` are grammar postfix levels beyond the manual table):

```
OR < AND < NOT < comparison (=, <>, LIKE, IN, BETWEEN, IS) < ||, +, - < *, / < unary (+, -) < ** < call < member
```

Verified against [Operator Precedence](https://docs.oracle.com/en/database/oracle/oracle-database/23/lnpls/expressions.html#GUID-65EAAB52-8E2C-45E1-B004-CA00A942FF0C) (Oracle 23c Table 3-3): `**` is highest (above unary identity/negation); binary `+`, `-`, and `||` share one level; `MOD` is a function, not a binary operator on this ladder. Expressions lock should still re-check the current R26 page when implementing.

---

## Salvage audit of `grammar-ref.js`

`grammar-ref.js` was built bottom-up from ~5k proprietary legacy files. It is a
*catalog of real-world phenomena*. Nothing is copied verbatim; re-derive through
the map methodology.

### Keep — real-world knowledge the manual lacks

- **`keyword()` case-insensitive helper** and `commaSep` / `commaSep1` utilities.
- **q-string close semantics** — now owned by external scanner per D9.
- **Old-style outer join `(+)`** and related legacy SQL quirks.
- **Keyword-as-identifier allowances** in `name` / `member_name` positions (D2).
- **Broken-but-common legacy patterns** — **do not** special-case as rules; rely on recovery per D14.
- **SQL*Plus artifacts** (`/` terminator, `SET DEFINE OFF`) — minimal script layer.
- **Database links**, inquiry directives, bind variables.
- **Conflicts list** as a warning map of genuine ambiguity — resolve with structure/precedence where possible.

### Drop / redesign

- `generic_unit` / `generic_group` catch-alls (opaque stream only for D6 wrapped units).
- Flat ad-hoc top-level / XML/JSON / duplicate call forms shaped only by the corpus.

### Known pain points

1. `name` vs `qualified_name` vs `member_expression` vs `call_expression` — **resolved** in [D15](#d15--reference-ambiguity-strategy) ([#13](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13)).
2. `(expr)` vs `(subquery)` vs row constructor — grouping vs subquery **resolved** in [D15](#d15--reference-ambiguity-strategy); multi-value row deferred to [#14](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14).
3. CASE expression vs CASE statement (`END CASE` vs `END`).
4. `%TYPE` / `%ROWTYPE` vs cursor attributes (`%FOUND`, …) — **resolved** in [D15](#d15--reference-ambiguity-strategy) (single `attribute_reference`).

---

## Provenance

Rules and tests cite sources in `docs/provenance/manifest.jsonl` — see
[provenance/README.md](./provenance/README.md).
