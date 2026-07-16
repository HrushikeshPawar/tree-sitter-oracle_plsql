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
| [D5](#d5--conditional-compilation-envelope) | Conditional compilation envelope | Locked (refined) | Salvage; refined in [#15](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15) |
| [D6](#d6--wrapped-units) | Wrapped units | Locked (refined) | Salvage; refined in [#24](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24) |
| [D7](#d7--embedded-sql) | Embedded SQL | Locked (shapes in area spec) | [#14](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14); area [#32](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32) |
| [D8](#d8--opaque-literal-tokens) | Opaque literal tokens | Locked | Salvage |
| [D9](#d9--external-scanner-for-strings) | External scanner for strings / q-strings (+ block comments) | Locked (flipped; surface extended) | [#11](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/11); extended [#12](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/12) |
| [D10](#d10--publish-targets-v1) | Publish targets (v1 bindings) | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D11](#d11--file-type-claim) | File-type claim | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D12](#d12--node-shape-versioning) | Node-shape versioning | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D13](#d13--ci-and-private-corpus) | CI and private corpus | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D14](#d14--recovery-vs-precision-rubric) | Recovery-vs-precision rubric | Locked | [#5](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5) |
| [D15](#d15--reference-ambiguity-strategy) | Reference-ambiguity strategy (name/call/member/attribute) | Locked | [#13](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13) |
| [D16](#d16--pragma-shape-and-placement) | Pragma shape and placement | Locked | [#15](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15) |
| [D17](#d17--minimal-script-layer) | Minimal script layer | Locked | [#15](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15) |
| [D18](#d18--block-shape-and-flat-declare-section) | Block shape and flat declare section | Locked | [#20](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/20) |
| [D19](#d19--statement-catalog-case-and-iterator) | Statement catalog, CASE conflict, full iterator | Locked | [#22](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22) |
| [D20](#d20--expression-precedence-and-surface) | Expression precedence and Phase-4 surface | Locked | [#26](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/26) |
| [D21](#d21--program-unit-create-surface) | Program-unit CREATE surface (nodes, clauses, root, call_spec/WRAPPED) | Locked | [#24](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24) |
| [D22](#d22--directives-pragmas-and-script-shapes) | Directives, pragmas, and script Phase-7 shapes | Locked | [#34](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34) |

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

**Locked (refined)** 2026-07-16 via [Decide: directives, pragmas, and script-layer design](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15).

| Axis | Lock |
|------|------|
| Modeling | **Directive envelope** — never desugared into ordinary `if_statement` |
| Branch content | **Context-recursive** — arms re-enter the surrounding production; recovery for broken/version-skew arms (not opaque blobs) |
| Placement (core four) | declaration peer · statement peer · unit/package/type-body item peer · top-level source peer |
| Arm packing | **One or more** peers per arm |
| Out (v1) | expression-primary / type-clause fragment `$IF` (recover; census may promote) |
| Condition | Dedicated **`static_expression`** — thin ladder (`$$`, literals, boolean/relational ops, parens, dotted static-looking calls); slightly over-accept; no semantic static check |
| `$ERROR` | First-class **`error_directive`**: `$ERROR` + **string literal** + `$END`; **only inside CC arms** |
| Scanner | **No growth** for `$…` — pure grammar + existing D9 string tokens |

**Shapes refined** 2026-07-16 via [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34) — **DIR1–DIR15** / [D22](#d22--directives-pragmas-and-script-shapes): public names, fields, no sixth supertype, `dollar_keyword` tokens.

Full tables: `docs/spec/research/07-directives-design.md`. Area detail: `docs/spec/07-directives.md`.

---

## D6 — Wrapped units

**Locked** (salvage; **shapes refined** 2026-07-16 via [Lock spec: 06-units.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24) — **U38–U40** / [D21](#d21--program-unit-create-surface)).

Wrapped units (`… WRAPPED`) are consumed as an **opaque payload**. v1 **accepts** WRAPPED forms. Public outline keeps **unit kind** + **name** when present before `WRAPPED`; payload is never decoded. Scanner growth only if pure grammar cannot delimit the payload (same bar as D9).

---

## D7 — Embedded SQL

**Locked 2026-07-16** via [Decide: embedded SQL subset boundary](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14); **Phase-5 shapes locked** 2026-07-16 via [Lock spec: 05-sql.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32).

| Axis | Lock |
|------|------|
| Modeling | **Native** in this grammar — **not** tree-sitter injection into a separate SQL grammar |
| Depth | **Structured spine + opaque interior** (interiors may deepen later; does not flip native) |
| Beyond subset | **Fail locally** — never fake-valid full Oracle SQL ([D14](#d14--recovery-vs-precision-rubric)) |

**IN (v1 claim):** `INSERT` / `UPDATE` / `DELETE` / `MERGE`; `SELECT INTO` (incl. `BULK COLLECT INTO`); TCL (`COMMIT` / `ROLLBACK` / `SAVEPOINT` / `SET TRANSACTION`, fully structured); `LOCK TABLE` (thin); collection mutators `.DELETE`/`.EXTEND`/`.TRIM`; nested select spine (no `INTO`) at cursor / `OPEN FOR` / iterator / `EXISTS`&`IN` subqueries; FORALL reuses DML/`EXECUTE IMMEDIATE` (string body unparsed).

**Precise hooks:** `INTO` / `BULK COLLECT INTO` targets; `RETURNING [BULK COLLECT] INTO` targets; `WHERE CURRENT OF` cursor; record `VALUES` / `SET ROW`.

**Precise `WHERE`:** PL/SQL expression ladder + `EXISTS (subquery)` + `IN (subquery)` only. SELECT: coarse select-list; opaque FROM-prefix until clause keyword; then precise `WHERE`; opaque tail for other clauses. `SET` lists, `VALUES` guts, and `MERGE` body stay opaque.

**OUT (v1):** full SQL/DDL; standalone `SELECT` statement; `WITH`/CTE; `ANY`/`ALL`/`SOME`/`PRIOR`/other SQL-only predicates; deep joins/itemized lists/structured SET/full MERGE arms; multi-value row `(a,b,…)` as free expression primary.

**Provisional:** [legacy census](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4) may promote OUT→IN or opaque→precise; core IN not dropped without a new decision.

### Phase-5 shape gist (area lock)

| Topic | Lock |
|-------|------|
| Select nodes | **Two public:** `select_into_statement` vs `select_statement` (no free `INTO` on nested); shared private region helpers |
| Regions | Named `select_list` / `from_clause` / `where_clause` / `select_tail`; field `condition` on WHERE |
| Opaque convention | Named-region **paren-aware token soup** + stop sets — not scanner blobs; deepen under stable names |
| DML | `insert_statement` / `update_statement` / `delete_statement` / `merge_statement`; field `target`; `returning_clause`; `current_of_clause` (`cursor`); MERGE `merge_body` opaque |
| Condition | `condition` ≡ Phase-4 `expression`; add `exists_expression`; extend `in_expression` RHS with subquery |
| Envelope | `sql_statement` named statement alternative per 03 (not a SQL *supertype*); `select_into_statement` sibling |
| TCL / LOCK | TCL fully structured; `lock_table_statement` + opaque `lock_table_body` |
| INTO helpers | Reuse 03 `into_clause` / `bulk_collect_into_clause` (S27) |

**Full construct tables:** `docs/spec/research/05-sql-subset-boundary.md`. **Area detail:** `docs/spec/05-sql.md` (SQL1–SQL9).

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
- **Multi-value row `(a, b, …)`:** **out** as free expression primary in v1 ([D7](#d7--embedded-sql) / `05-sql-subset-boundary`); DML value lists stay inside opaque `VALUES` guts unless a later expressions decision forces a pure-PL/SQL primary.

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

## D16 — Pragma shape and placement

**Locked 2026-07-16** via [Decide: directives, pragmas, and script-layer design](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15).

| Axis | Lock |
|------|------|
| Shape | **Generic only (v1):** `PRAGMA` + name + optional `(args)` — confirms L29 |
| Named productions | **None** in v1 (additive named forms later under D12 if queries need fields) |
| Placement | **Declarative peer** · **statement peer** (executable e.g. `INLINE` — S5) · **package/unit item peer** |
| Unknown / deprecated names | Still parse via generic node (e.g. old `RESTRICT_REFERENCES`) |
| Semantics | Placement bans and pragma meaning are **out of scope** (no validation) |
| Public names | `pragma_declaration` (declaration) · `pragma_statement` (statement) · `pragma` (unit-item) — shared interior (**DIR10–DIR11** / [D22](#d22--directives-pragmas-and-script-shapes)) |

Full tables: `docs/spec/research/07-directives-design.md`. Area detail: `docs/spec/07-directives.md`.

---

## D17 — Minimal script layer

**Locked 2026-07-16** via [Decide: directives, pragmas, and script-layer design](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15).

| Axis | Lock |
|------|------|
| Breadth | **Minimal:** top-level **`/`** terminator + **`SET DEFINE` / `ON` / `OFF` only** |
| Root | One grammar root sequences PL/SQL units **and** these script peers — **native**, not injection |
| `/` vs division | **Terminator** only as top-level script peer; mid-expression `/` remains **division** (L4) |
| Out (v1) | Full SQL\*Plus/SQLcl; other `SET …`; `PROMPT` / `WHENEVER` / `REM` / `EXIT` / … |
| Provisional | Census may promote a small editor set (PROMPT/REM/WHENEVER/EXIT); not pre-built |
| File types | Unchanged [D11](#d11--file-type-claim) — script noise still appears inside claimed PL/SQL extensions |
| Public names | `script_slash` · `set_define_command` (optional `value` for ON/OFF) |
| `/` strategy | **One** anonymous `/` token; meaning by production position only — no second scanner token, no newline-only rule (**DIR13** / [D22](#d22--directives-pragmas-and-script-shapes)) |

Full tables: `docs/spec/research/07-directives-design.md`. Area detail: `docs/spec/07-directives.md`.

---

## D18 — Block shape and flat declare section

**Locked 2026-07-16** via [Lock spec: 02-blocks.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/20).

| Axis | Lock |
|------|------|
| Block node | **One** public `block` (anonymous + nested); parent context distinguishes role |
| Reuse | Public **`body`** (`BEGIN` … handlers … `END` [name] `;`) shared with nested units / package bodies |
| Labels | `field("label", $.label)*` — no `label_list` |
| Empty `BEGIN` | **≥1** statement required; empty → recovery ([D14](#d14--recovery-vs-precision-rubric)) |
| Declare order | **Flat** `repeat1(declaration)` — **no** R26 `item_list_1` / `item_list_2` phase barrier in the grammar |
| Why flat | Phase barriers punish misordered code with cascading ERROR; each item remains a precise declaration node; preferred order is corpus/doc guidance, not CST structure |
| Pragmas in declare | Generic `pragma_declaration` peer ([D16](#d16--pragma-shape-and-placement)) |

**Area detail:** `docs/spec/02-blocks.md` (full B1–B38). Units lock reuses `body` / declare shape without re-arguing flat vs two-list.

---

## D19 — Statement catalog, CASE conflict, full iterator

**Locked 2026-07-16** via [Lock spec: 03-statements.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22).

| Axis | Lock |
|------|------|
| Catalog | Flat `statement` choice; **`procedure_call_statement`** first-class (**D15**); collection mutators statement-level; executable generic **`pragma_statement`** peer (**D16**) |
| CASE | **One** declared conflict `case_expression` ↔ `case_statement`; closers **`END`** vs **`END CASE`** [label]; statement WHEN parity (multi-choice + dangling); block `END` [name] is separate |
| Iterator | **Full R26** controls in v1; shared `iterator` with qualified expressions; one `for_loop_statement`; classic cursor FOR **unified** (no second public node) |
| Recovery looseness | Empty IF/CASE arms; permissive REVERSE / PAIRS mix / dangling predicates / RETURN expr / PIPE ROW placement / FORALL USING — semantic bans not grammar-enforced ([D14](#d14--recovery-vs-precision-rubric)) |
| Assignment | Dedicated `assignment_target` on **D15** chain — not free expression LHS |
| SQL entry | Keyword-led dispatch; TCL structured; DML depth **D7** (not re-litigated here) |

**Area detail:** `docs/spec/03-statements.md` (full S1–S43). Expressions lock owns `case_expression` node detail and shares `iterator` / the S8 conflict.

---

## D20 — Expression precedence and surface

**Locked 2026-07-16** via [Lock spec: 04-expressions.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/26).

| Axis | Lock |
|------|------|
| Ladder | Table 3-3 authoritative: `OR < AND < NOT < comparison < (+ \| - \| \|\|) < (* \| /) < unary(+|-) < ** < call < member/%` |
| Associativity | `**` right; all other binaries left; comparison flat permissive |
| Drop | Infix `MOD` (function call only) |
| Root | One recursive `expression`; no typed-family public nonterminals |
| CASE | One `case_expression`; multi-choice + `dangling_predicate`; one conflict vs `case_statement` (D19) |
| Call / aggregate | D15 identity; full marked-aggregate interiors; permissive arg/aggregate order |
| Compare extras | PL/SQL multiset + float `IS` forms **in**; `ANY`/`ALL`/`SOME`/`PRIOR` **out** (D7) |
| Static | Dedicated `static_expression` for CC only (D5) |

**Area detail:** `docs/spec/04-expressions.md` (full E1–E22). Reference chain **D15**; CASE conflict / shared `iterator` **D19**.

### Precedence table (final)

Lowest → highest binding (`call` / `member` are grammar postfix levels beyond the manual table):

```
OR < AND < NOT < comparison
  < ( + | - | || )
  < ( * | / )
  < unary(+|-)
  < **                    -- right-associative
  < call / index postfix
  < member (.) / attribute (%)
```

Verified against R26 Table 3-3 (inventory §2–§3): `**` above unary; binary `+`, `-`, and `||` same level; no infix `MOD`.

---

## D21 — Program-unit CREATE surface

**Locked 2026-07-16** via [Lock spec: 06-units.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24).

| Axis | Lock |
|------|------|
| CREATE nodes | **Separate** public units: `create_function` / `create_procedure` / `create_package` / `create_package_body` / `create_trigger` / `create_type` / `create_type_body` — not one mega-`create_statement` (**U1**); optional preamble fields per unit (**U2**) |
| Root | Multi-item **`source_file`**: CREATE units + `wrapped_unit` + anonymous `block` + **D17** script peers (**U41**); trailing `;` on CREATE; `/` is script-only (**U3**) |
| Properties | **Typed clause nodes** + free `repeat(choice)` per context; separate function vs procedure bags (**U4/U8/U29**); no order/dupe enforcement |
| Triggers | Four **child kinds** under `create_trigger`; row = optional `FOR EACH ROW`; multi-word timing as **word sequences**; closed R26 event phrases (**U14–U18**) |
| Type body | **Comma-separated** method list — not package declare_section (**U26**); package body reuses **D18** declare + `initialize_section` (**U10**) |
| Call spec / WRAPPED | Three named call_spec arms + opaque payloads; WRAPPED in v1 with outline fields (**U34–U40**); no CREATE LIBRARY/MLE MODULE (**U37**) |
| Recovery | **D14** local failure between top-level items (**U44**); names via **D15** (**U43**) |

**Area detail:** `docs/spec/06-units.md` (full U1–U46). Nested defs / flat declare **D18**; script `/` **D17**; SQL condition depth **D7**.

---

## D22 — Directives, pragmas, and script shapes

**Locked 2026-07-16** via [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34).

Cross-cutting gist of Phase-7 area shapes (architecture stays [D5](#d5--conditional-compilation-envelope) / [D16](#d16--pragma-shape-and-placement) / [D17](#d17--minimal-script-layer)):

| Axis | Lock |
|------|------|
| CC nodes | `conditional_compilation_directive` + `elsif_directive_clause`; `body` / `else_body` fields (no then/else container nodes); `static_expression`; arm-only `error_directive` with `message` (**DIR1–DIR2**, **DIR4–DIR8**) |
| Supertypes | **No** sixth supertype; CC listed by name in each core-four choice; dual pragma names for declaration/statement (**DIR3**) |
| `$` tokens | Pure-grammar `dollar_keyword` closed set (`$IF`…`$ERROR`); no scanner growth (**DIR9**) |
| Pragmas | Generic interior → `pragma_declaration` · `pragma_statement` · unit-item `pragma` (**DIR10–DIR11**) |
| Script | `script_slash` + `set_define_command`; one `/` token, top-level terminator vs expression division by position (**DIR12–DIR14**) |
| Recovery | Local CC failure; OUT expr-fragment `$IF` / extra SQL\*Plus provisional pending census (**DIR15**) |

**Area detail:** `docs/spec/07-directives.md` (full **DIR1–DIR15**). Lexical L4/L28/L29; expressions **E22**; root **D21** / **U41**.

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
- **SQL*Plus artifacts** (`/` terminator, `SET DEFINE OFF`) — minimal script layer (**D17**).
- **Database links**, inquiry directives, bind variables.
- **Conflicts list** as a warning map of genuine ambiguity — resolve with structure/precedence where possible.

### Drop / redesign

- `generic_unit` / `generic_group` catch-alls (opaque stream only for D6 wrapped units).
- Flat ad-hoc top-level / XML/JSON / duplicate call forms shaped only by the corpus.

### Known pain points

1. `name` vs `qualified_name` vs `member_expression` vs `call_expression` — **resolved** in [D15](#d15--reference-ambiguity-strategy) ([#13](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13)).
2. `(expr)` vs `(subquery)` vs row constructor — grouping vs subquery **resolved** in [D15](#d15--reference-ambiguity-strategy); multi-value row **out** as free primary in v1 per [D7](#d7--embedded-sql).
3. CASE expression vs CASE statement (`END CASE` vs `END`) — **resolved** in [D19](#d19--statement-catalog-case-and-iterator) ([#22](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22)); one declared conflict; bare `END` / `END name` remain block/unit closers.
4. `%TYPE` / `%ROWTYPE` vs cursor attributes (`%FOUND`, …) — **resolved** in [D15](#d15--reference-ambiguity-strategy) (single `attribute_reference`).

---

## Provenance

Rules and tests cite sources in `docs/provenance/manifest.jsonl` — see
[provenance/README.md](./provenance/README.md).
