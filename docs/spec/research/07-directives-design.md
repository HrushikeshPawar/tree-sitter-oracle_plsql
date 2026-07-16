# Directives, pragmas, and script-layer design (D5 / D16 / D17)

**Ticket:** [Decide: directives, pragmas, and script-layer design](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15)  
**Status:** Locked 2026-07-16 (architecture); area shapes locked in [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34) → `docs/spec/07-directives.md`  
**Applies:** Phase 7 / `docs/spec/07-directives.md` (locked)  
**Rubric:** [D14](../../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) · consumer priority: both equally  
**Cross-links:** [D5](../../DESIGN-NOTES.md#d5--conditional-compilation-envelope) · [D9](../../DESIGN-NOTES.md#d9--external-scanner-for-strings) · [D11](../../DESIGN-NOTES.md#d11--file-type-claim) · L28/L29 in [01-lexical.md](../01-lexical.md)

---

## 1. Scope of `07-directives`

This area owns three surfaces that are not pure PL/SQL statements/declarations but appear in real unit files:

| Surface | Role |
|---------|------|
| **Conditional compilation** | `$IF` / `$THEN` / `$ELSIF` / `$ELSE` / `$END`, `$ERROR` |
| **Pragmas** | `PRAGMA name [(args)];` placement |
| **Minimal script layer** | Top-level `/` terminator; `SET DEFINE [ON\|OFF]` |

**Does not own:** inquiry-directive **token** form (`$$name` — L28 / lexical); string/block-comment scanner (D9); full SQL\*Plus/SQLcl; semantic validation of static expressions or pragma meaning.

---

## 2. Conditional compilation (D5 refined)

### 2.1 Architecture

| Axis | Lock |
|------|------|
| Modeling | **Directive envelope** — never desugared into ordinary `if_statement` |
| Branch content | **Context-recursive (precise)** — each arm re-enters the surrounding production; recovery (D14) for broken / version-skew arms |
| Not | Opaque arm blobs; fully opaque whole-envelope tokens |

### 2.2 Placement lattice (core four)

`$IF … $END` is a **peer** of the production it replaces, in exactly these homes:

| Slot | Arms re-enter |
|------|----------------|
| **Declaration** | declare-section item(s) |
| **Statement** | statement(s) in a sequence of statements |
| **Unit / package item** | package spec/body items, type body items (same peer set as ordinary items) |
| **Top-level source** | top-level unit / anonymous-block / script peer sequence |

**Arm packing:** each `$THEN` / `$ELSIF` / `$ELSE` arm holds **one or more** peers of that production (not single-item-only).

**Out (v1):** expression-primary `$IF`; type-mark / formal / select-list fragment `$IF`. Recover if present; [legacy census](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4) may promote.

### 2.3 Condition: `static_expression`

Between `$IF` / `$ELSIF` and `$THEN`:

| In (v1) | Out (recover if forced) |
|---------|-------------------------|
| Inquiry directives (`$$…`, L28) | Assignments |
| Boolean / number / string literals | Full SQL interiors |
| Relational comparisons | Deliberate “local variable as primary” design (tolerate only if call-shaped over-accept) |
| `AND` / `OR` / `NOT`, parentheses | |
| Dotted static-looking calls (`pkg.fn(…)`, name chains + call) | |

- **Slightly over-accept** on call shapes — do not maintain a closed allow-list of static functions in the grammar.
- **No semantic “must be static” check** (map out of scope: no validation).
- Prefer sharing tokens/primaries with the main expression ladder; this is a **restricted entry**, not a second full expression grammar.

### 2.4 `$ERROR`

| Axis | Lock |
|------|------|
| Node | First-class **`error_directive`** (or lock-spec final name under the `*_directive` family) |
| Shape | `$ERROR` + **string literal** payload + `$END` |
| Placement | **Only inside CC arms** as a peer of that arm’s production |
| Elsewhere | Recovery — not a designed declaration/statement home |
| Payload | Reuse D9 string / q-string tokens; free-form non-string text → recover until evidence |

### 2.5 Scanner

| Axis | Lock |
|------|------|
| `$IF` / `$THEN` / `$ELSIF` / `$ELSE` / `$END` | **Pure grammar** dollar-prefixed keyword tokens (case-insensitive like `keyword()`) |
| Structure + `static_expression` | Pure grammar |
| `$ERROR` payload | Existing **D9 string tokens** — **no CC scanner growth** |
| D9 surface | Unchanged (strings + block comments only) |

### 2.6 Suggested public nodes (for lock spec to finalize names)

| Node | Role |
|------|------|
| `conditional_compilation_directive` (or manual-aligned name) | Whole `$IF … $END` envelope |
| `static_expression` | Condition under `$IF` / `$ELSIF` |
| `error_directive` | `$ERROR … $END` inside arms |
| Arm containers (optional named nodes) | e.g. then/elsif/else arm lists — lock chooses fields vs intermediate nodes |

**Supertypes (D3):** the envelope is **not** forced under `statement` / `declaration` as a single supertype — it **is** a peer in each lattice slot (when in a statement list it behaves like a statement peer for sequencing; when in declare section, like a declaration peer). Lock spec records the practical supertype membership (or “no extra supertype; ordinary named node in each choice”). Prefer **not** adding a sixth supertype for directives.

**Fields (D3 vocabulary):** `condition` on `$IF`/`$ELSIF` arms; message/`value` for `$ERROR` string; arm bodies as lists or repeated fields — lock chooses, defaulting to “when unsure, field it.”

---

## 3. Pragmas (D16)

| Axis | Lock |
|------|------|
| Shape | **Generic only (v1):** `PRAGMA` + name + optional `( argument_list )` + `;` where required by context |
| Named productions | **None** — no `exception_init_pragma` etc. in v1 |
| Unknown names | Still parse (Oracle ignores unknown pragmas) |
| Deepening | Later additive named forms allowed under D12 if queries need fields (e.g. EXCEPTION_INIT) |

### 3.1 Placement

| Home | Examples |
|------|----------|
| **Declarative peer** | `EXCEPTION_INIT`, `AUTONOMOUS_TRANSACTION`, `SERIALLY_REUSABLE`, `DEPRECATE`, `UDF`, … |
| **Statement peer** | `INLINE` and any other executable pragmas (**S5**) |
| **Package / unit item peer** | package-level pragmas; deprecated unit forms (e.g. old `RESTRICT_REFERENCES`) via **generic** node |

**Not:** semantic placement bans in the grammar (e.g. “AUTONOMOUS_TRANSACTION illegal in package” is semantic — accept, don’t special-case).

Confirms **L29** for v1.

---

## 4. Script layer (D17)

### 4.1 Breadth — minimal

| In (v1) | Out (v1) |
|---------|----------|
| Top-level **`/`** terminator after a unit / anonymous block / top-level CC peer | Full SQL\*Plus / SQLcl |
| **`SET DEFINE`**, **`SET DEFINE ON`**, **`SET DEFINE OFF`** | Other `SET …` client commands |
| | `PROMPT`, `REM`/`REMARK`, `WHENEVER`, `EXIT`/`QUIT`, `@`/`@@`, `COLUMN`, … |

**Provisional:** [legacy census](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4) may promote a **small editor set** (PROMPT / REM / WHENEVER / EXIT) as a later tier — not pre-built.

### 4.2 `/` vs division

| Context | Meaning |
|---------|---------|
| **Top-level** script peer (after a completed top-level PL/SQL item) | **Terminator** |
| **Expression** / ordinary PL/SQL | **Division** (L4) |

Design intent: disambiguate by **position in the source tree**, not by treating every `/` as terminator. Lock spec records the concrete token/precedence strategy.

### 4.3 Root

One grammar root (name finalized in lock — e.g. `source_file`) that **sequences**:

- CREATE / nested-looking top-level units  
- Anonymous blocks  
- Top-level CC envelopes  
- Minimal script peers (`/`, `SET DEFINE…`)

**Native** in this grammar — **not** injection into a separate script grammar (same instinct as D7).

**D11:** file-type claim remains PL/SQL extensions only (no `.sql`). Script artifacts still appear inside claimed extensions (`.pks`, `.pkb`, …).

---

## 5. Interaction with other areas

| Area | Interaction |
|------|-------------|
| **01-lexical** | L28 `inquiry_directive`; L29 generic pragma token shape; L4 `/` deferred → **resolved here** for top-level terminator |
| **02-blocks** | CC + pragma as declaration peers; B4 `/` is script-only; B8/B35 pragmas → generic + placement |
| **03-statements** | CC + pragma as statement peers; S5 executable pragmas |
| **04-expressions** | `static_expression` shares primaries; full expr `$IF` out |
| **05-sql** | No script SQL\*Plus as SQL; no change to D7 |
| **06-units** | CC + pragma as unit/package items; U3 `/` script-only; U28 deprecated pragma via generic |

---

## 6. Lock checklist for `docs/spec/07-directives.md`

When locking the area spec, resolve shape detail without re-opening D5/D16/D17:

1. Final public node names for CC envelope, arms, `static_expression`, `error_directive`, generic `pragma`, `/` terminator, `set_define_command` (or equivalent).
2. Field vocabulary on each (D3).
3. Supertype membership for CC/pragma when they appear as statement vs declaration peers.
4. Concrete `/` vs division token strategy.
5. Keyword-token spelling for `$IF` family (regex / `keyword()`-like helper).
6. Corpus seeds (synthetic) for: multi-arm `$IF`, nested CC, `$ERROR` in dead arm, `PRAGMA INLINE` in statement list, `PRAGMA EXCEPTION_INIT` in declare, unit + `/`, `SET DEFINE OFF`.
7. Apply D14 to any edge the lock uncovers; mark frequency-sensitive widenings provisional pending census.

---

## 7. Provenance notes

- R26 conditional compilation and pragma chapters (link-only; no Oracle text copied) — cite in `docs/provenance/manifest.jsonl` when the lock writes rules.
- Salvage: `grammar-ref.js` catalogued `/` and `SET DEFINE OFF` as real-world script noise — kept as **minimal** layer only.
- Deliberation: issue #15 grilling session 2026-07-16.
