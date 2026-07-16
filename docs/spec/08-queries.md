# Spec: 08 — Queries (highlights / locals / injections / tags)

**Status:** Locked  
**Ticket:** [Decide: queries design (highlights / locals / injections)](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/37)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Locked:** 2026-07-16  

**Research / inputs (not re-decided here):**

- Public node/field surface: [01-lexical](01-lexical.md) … [07-directives](07-directives.md)
- Cross-cutting: `docs/DESIGN-NOTES.md` (D1 keyword anonymity, D3 fields/supertypes, D7 native SQL, D10–D12 package/versioning, D15 name chain, D22 CC/pragma/script)
- Consumer priority: editors and code intelligence equally (map Notes)

**Related:** [D23](../DESIGN-NOTES.md#d23--queries-highlights-locals-injections-tags) gists this lock.

---

## 1. Scope

**In scope:** v1 **query conventions** so implementers can write Tree-sitter query files without reopening node shapes:

1. **Highlights** — capture strategy, keyword policy, SQL spine vs opaque, CC/pragma/script, name-site roles  
2. **Locals** — syntactic scopes, definitions, best-effort references; explicit non-goals  
3. **Injections** — outbound injection policy (file present, rules empty)  
4. **Tags** — definition-only outline captures  
5. **File layout** — which `queries/*` ship in v1  
6. **Capture dialect** — one written vocabulary  
7. **Stubs / seeds** — what this lock commits now vs implementation later  

**Out of scope for this file:** `grammar.js` implementation; semantic resolution / LSP / lint; folds/indents query files; dual-grammar SQL highlighting; re-arguing D1/D3/D7/D14/D15 node shapes.

---

## 2. Standing rules applied

| Decision | How it applies here |
|----------|---------------------|
| [D1](../DESIGN-NOTES.md#d1--grammar-name-and-node-naming) | Keywords are **anonymous** in the tree — no `keyword_*` nodes. Captures use anonymous strings and/or parent named nodes. Hidden `_…` rules never appear in queries. |
| [D2](../DESIGN-NOTES.md#d2--keywords-and-reserved-words) | Keyword re-admission at name sites — prefer **parent-scoped** keyword captures where re-admission can paint an identifier. |
| [D3](../DESIGN-NOTES.md#d3--supertypes-and-fields) | Role fields (`name`, `function`, `parameters`, …) are the primary query handles. Five supertypes only; no extra query-driven supertype in v1. |
| [D7](../DESIGN-NOTES.md#d7--embedded-sql) | SQL is **native** — never inject another SQL grammar for claimed regions. |
| [D10](../DESIGN-NOTES.md#d10--publish-targets-v1) / [D12](../DESIGN-NOTES.md#d12--node-shape-versioning) | Queries ship **with** the grammar package (same version). |
| [D11](../DESIGN-NOTES.md#d11--file-type-claim) | `injection-regex: ^oracle_plsql$` is **inbound** (hosts inject *this* language), not outbound SQL. |
| [D15](../DESIGN-NOTES.md#d15--reference-ambiguity-strategy) | Name/call/member/attribute chain is the reference surface for locals refs and name-site highlights. |
| [D22](../DESIGN-NOTES.md#d22--directives-pragmas-and-script-shapes) | `$…` from `dollar_keyword` helper are **anonymous tokens**; pragma `name` is a field; script peers are named nodes. |

---

## 3. Decisions

### 3.1 Artifact form (Q1)

| ID | Lock |
|----|------|
| **Q1** | Area file **`docs/spec/08-queries.md`** is the store; **D23** in DESIGN-NOTES is the index gist. Not DESIGN-NOTES-only; not stub `.scm` as sole source of truth. |

### 3.2 Ship set (Q2)

| ID | Lock |
|----|------|
| **Q2** | v1 commits and publishes under `queries/`: **`highlights.scm`**, **`locals.scm`**, **`injections.scm`**, **`tags.scm`**. |
| **Q2b** | **Not** v1: `folds.scm`, `indents.scm` (additive later under D12 if a consumer pass needs them). |

### 3.3 Injections (Q3)

| ID | Lock |
|----|------|
| **Q3** | **`injections.scm` is present and has zero injection rules** (header comment only). |
| **Q3b** | **Not planned** for v1 (and not default roadmap): inject generic `sql` into named SQL regions (fights D7); inject into WRAPPED / MLE opaque payloads; inject a separate comment language. Hosts may still inject **`oracle_plsql`** into their buffers via D11. |

### 3.4 Highlights — keyword strategy (Q4)

| ID | Lock |
|----|------|
| **Q4** | **Hybrid:** (1) **Parent-scoped** structural keywords where re-admission matters (e.g. `(if_statement "IF" @keyword)`). (2) **Always-safe** / directive / script via anonymous lists or named parents (`"$IF"`, `(script_slash) @…`). (3) **Lexical classes** via named nodes: strings, numbers, comments, binds, operators. |
| **Q4b** | Reject bare global keyword lists that can paint re-admitted identifiers at name sites without a parent guard. |

### 3.5 Highlights — SQL spine vs opaque (Q5)

| ID | Lock |
|----|------|
| **Q5** | Paint **claimed spine** keywords and PL/SQL hooks (`SELECT`/`INTO`/`RETURNING`/`CURRENT OF`/TCL arms, …) on the public statement / clause nodes. |
| **Q5b** | Inside opaque/coarse soup regions (`select_list`, `from_clause`, `select_tail`, DML guts, `merge_body`, `lock_table_body`, …): only **token-class** captures that already match (`string_literal`, `q_string_literal`, `number_literal`, `bind_variable`, comments). **No** aggressive anonymous keyword lists inside soup. |
| **Q5c** | Deepening (opaque → precise) keeps the **same region node names** so query targets stay stable (SQL2/SQL3). |

### 3.6 Highlights — CC, pragmas, script (Q6)

| ID | Lock |
|----|------|
| **Q6** | **Distinct special captures** (not collapsed to ordinary statement keywords only): |
| | • `$IF` / `$THEN` / `$ELSIF` / `$ELSE` / `$END` / `$ERROR` → `@keyword.directive` (anonymous tokens; DIR9) |
| | • `inquiry_directive` (`$$…`) → `@keyword.directive` (or `@constant` if an editor theme lacks directive — **primary contract is `@keyword.directive`**) |
| | • `PRAGMA` keyword → `@keyword`; pragma **`name`** field → `@function.builtin` |
| | • `script_slash` → `@punctuation.special` |
| | • `set_define_command` / `SET` `DEFINE` [`ON`\|`OFF`] → `@keyword.directive` |

### 3.7 Locals (Q7)

| ID | Lock |
|----|------|
| **Q7** | **Syntactic only** — no semantic resolution (map out of scope). |
| **Q7a — scopes** (`@local.scope`): `block`; subprogram definition bodies (nested + CREATE function/procedure bodies); package / package body units; `loop_statement` (iterator / cursor-FOR binding scope); `exception_handler`. |
| **Q7b — definitions** (`@local.definition.*`): `name` fields on variable / collection·record·cursor-var / exception declarations; formal `parameter_declaration`; cursor decl/def; type / subtype definitions; nested subprogram names; `label` names; CREATE unit names. Prefer fine captures when cheap (`@local.definition.var`, `.parameter`, `.function`, `.type`, `.namespace` for package, …). |
| **Q7c — references** (`@local.reference`): best-effort on D15 name-site / expression name positions. **Not** guaranteed precision (re-admission, chains, SQL soup). |
| **Q7d — out for locals v1** | Package public vs private; overload resolution; SQL table/column binding; `%TYPE` target linking; forward-decl ↔ body identity beyond shared name text. |

### 3.8 Tags (Q8)

| ID | Lock |
|----|------|
| **Q8** | **Definition-only** outline tags. **No** `@reference.call` / variable-reference tags in v1. |
| **Q8a** | Tag CREATE + nested **units/subprograms/types/methods** `name` fields. |
| **Q8b** | Capture names: `@definition.function` for both **function and procedure** (parent node distinguishes); `@definition.package` for package / package body; `@definition.type` for CREATE TYPE / TYPE BODY / nested type defs as applicable; `@definition.method` for type-body methods; `@definition.trigger` for triggers if the consumer set supports it — otherwise fold trigger under `@definition.function` and document. |
| **Q8c** | **Do not** tag every variable/parameter (keeps outline usable). Locals cover those. |

### 3.9 Seeds / what lands now (Q9)

| ID | Lock |
|----|------|
| **Q9** | This lock commits: **`08-queries.md` + D23 + stub `queries/*.scm`** (header + representative captures against locked node names). |
| **Q9b** | Full query CI greenness and rich corpus fixtures wait on grammar implementation. Stubs may not pass `tree-sitter test` until nodes exist — that is expected. |

### 3.10 Capture dialect (Q10)

| ID | Lock |
|----|------|
| **Q10** | **One** vocabulary: nvim-treesitter-style modern captures (below). Other editors **remap** in editor config — this repo does **not** dual-annotate. |
| **Q10b** | `$…` are **anonymous** tokens from the `dollar_keyword` helper — never a public `(dollar_keyword)` node. |

**Primary highlight captures (contract):**

`@keyword`, `@keyword.function`, `@keyword.directive`, `@keyword.return`, `@keyword.operator`,  
`@function`, `@function.call`, `@function.builtin`,  
`@variable`, `@variable.parameter`, `@variable.builtin`,  
`@constant`, `@constant.builtin`,  
`@type`, `@type.builtin`,  
`@string`, `@number`, `@boolean`,  
`@operator`,  
`@punctuation.delimiter`, `@punctuation.bracket`, `@punctuation.special`,  
`@comment`, `@label`, `@attribute`, `@namespace`

**Locals:** `@local.scope`, `@local.definition` / `@local.definition.*`, `@local.reference`  
**Tags:** `@definition.function`, `@definition.package`, `@definition.type`, `@definition.method`, `@definition.trigger` (optional alias note above)

### 3.11 Name-site highlights (Q11)

| ID | Lock |
|----|------|
| **Q11** | **Role-from-parent:** declaration/parameter/label/unit/type `name` fields → role captures (`@variable`, `@variable.parameter`, `@label`, `@function`, `@type`, `@namespace` as appropriate). |
| **Q11b** | `call_expression` / `procedure_call` callee → `@function.call`. |
| **Q11c** | Type positions (`type_spec`, attribute type marks, CREATE type names) → `@type`. |
| **Q11d** | Query **order: specific before general**. Bare `(identifier) @variable` / `(quoted_identifier) @variable` only as **last-resort fallback**. |

---

## 4. Surface catalog (query files)

| File | v1 content | Notes |
|------|------------|--------|
| `queries/highlights.scm` | Hybrid keywords + lexical + SQL spine + CC/pragma/script + role names | Stubs seed patterns; expand during Phase 8 implementation |
| `queries/locals.scm` | Scopes + definitions + best-effort references | Syntactic only |
| `queries/injections.scm` | **Empty of rules** | Header documents Q3 |
| `queries/tags.scm` | Definition-only unit/nested outline | No reference tags |

**Does not own:** grammar productions (01–07); publish bindings (D10); file extensions (D11).

---

## 5. Deferred / out of scope

| Item | Where |
|------|--------|
| Folds / indents queries | Not v1 (Q2b); future D12 additive |
| Dual-grammar SQL injection | Not planned (Q3b); would reopen D7 |
| Semantic locals / LSP | Map **out of scope** |
| Full capture tables for every statement keyword | Implementation expands stubs against 03-statements catalog |
| Named per-pragma productions for richer tags | D12 / DIR10 later if needed |
| Query CI as release gate | After grammar + public corpus (D13) |
| `grammar.js` | Execution after map |

---

## 6. Implementation hand-off (Phase 8 / queries)

1. Keep stubs in `queries/`; expand captures as each grammar phase lands public nodes.  
2. **highlights.scm:** specific-before-general; parent-scoped keywords; SQL per Q5; CC/pragma/script per Q6; name roles per Q11.  
3. **locals.scm:** wire `@local.scope` on Q7a nodes; definitions on `name` fields (Q7b); references only on clear D15 name sites (Q7c).  
4. **injections.scm:** leave rule-free unless a **new** design ticket revises Q3.  
5. **tags.scm:** CREATE + nested outline only (Q8).  
6. When testing becomes possible: add license-clean highlight/locals smoke under tree-sitter’s query test layout (or corpus + manual query check) — not required to close this design ticket.  
7. Do **not** reopen node names to make queries prettier — adjust queries, or open a D12-shaped design ticket.

### Seed ideas (implementer; synthetic)

| # | Seed |
|---|------|
| 1 | Anonymous block: labels, declare vars/params, nested procedure, exception handler — locals + highlights |
| 2 | `IF` / `LOOP` / `CASE` statement keywords parent-scoped; keyword used as identifier in a name site |
| 3 | `SELECT … INTO` spine + opaque `from_clause` (strings/binds highlight; no fake JOIN keyword capture requirement) |
| 4 | `$IF` / `$ERROR` / `$$inquiry` directive captures |
| 5 | `PRAGMA EXCEPTION_INIT (…);` — keyword + builtin name |
| 6 | CREATE package + package body names → tags `@definition.package` / nested function → `@definition.function` |
| 7 | `script_slash` + `SET DEFINE OFF` after a unit |
| 8 | Call chain: `a.b(c)` → `@function.call` on callee, not every identifier as function |

---

## 7. Decision index (Q1–Q11)

| ID | Gist |
|----|------|
| Q1 | Area file `08-queries.md` + D23 index |
| Q2 | Ship highlights, locals, injections, tags; no folds/indents |
| Q3 | Zero outbound injection rules; dual-SQL inject not planned |
| Q4 | Hybrid keyword captures |
| Q5 | SQL spine + token-class in soup; no soup keyword lists |
| Q6 | Directive-like CC/script; pragma name builtin |
| Q7 | Syntactic scopes/defs + best-effort refs; listed non-goals |
| Q8 | Definition-only tags for units/nested |
| Q9 | Spec + stub `.scm` now; full CI later |
| Q10 | nvim-style capture dialect; anonymous `$…` |
| Q11 | Role-from-parent names; specific-before-general |

Cross-cutting gist: **[D23](../DESIGN-NOTES.md#d23--queries-highlights-locals-injections-tags)**.
