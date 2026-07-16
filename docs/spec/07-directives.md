# Spec: 07 — Directives, pragmas, and script layer

**Status:** Locked  
**Ticket:** [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Locked:** 2026-07-16  

**Research (inputs, not re-decided here):**

- [Decide: directives, pragmas, and script-layer design](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15) → `docs/spec/research/07-directives-design.md` (**D5** refined, **D16**, **D17**)
- Cross-cutting: `docs/DESIGN-NOTES.md` (**D1**, **D3**, **D5**, **D9**, **D11**, **D14–D17**, **D18–D21**; **D22** from this lock)
- Lexical: L4 `/`, L28 `inquiry_directive`, L29 generic pragma → [01-lexical.md](01-lexical.md)
- `static_expression` export → **E22** / [04-expressions.md](04-expressions.md)

**Related tickets:** declare peers → [Lock spec: 02-blocks.md](02-blocks.md); statement peers → [Lock spec: 03-statements.md](03-statements.md); expression ladder / static → [Lock spec: 04-expressions.md](04-expressions.md); multi-unit root → [Lock spec: 06-units.md](06-units.md) (**U3**, **U41**).

---

## 1. Scope

**In scope:** Phase 7 shapes for **conditional compilation** (`$IF`…`$END`, `$ERROR`), **generic pragmas** (declarative / statement / unit-item peers), and the **minimal script layer** (top-level `/`, `SET DEFINE` / `ON` / `OFF`) — public node names, fields, supertype membership, `$` keyword tokens, `/` vs division strategy, D14 recovery edges, and corpus seeds.

**Out of scope for this file:** implementing `grammar.js` / scanner; inquiry-directive **token** form (`$$name` — L28); full SQL\*Plus / SQLcl; per-pragma named productions; semantic validation of static expressions or pragma meaning; expression-primary / type-fragment `$IF` (recover only; census may promote).

**Does not re-open:** context-recursive arms, core-four placement, generic-only pragmas, or minimal script breadth (**D5** / **D16** / **D17**) unless census evidence forces a promotion later.

---

## 2. Standing rules applied

| Decision | How it applies here |
|----------|---------------------|
| [D1](../DESIGN-NOTES.md#d1--grammar-name-and-node-naming) | Manual / clear names: `conditional_compilation_directive`, `error_directive`, `pragma_declaration`, `script_slash`, … No keyword nodes for `$IF` / `PRAGMA` / `SET`. |
| [D3](../DESIGN-NOTES.md#d3--supertypes-and-fields) | Role fields (`condition`, `body`, `message`, `name`, `arguments`). No sixth supertype for directives. |
| [D5](../DESIGN-NOTES.md#d5--conditional-compilation-envelope) | Envelope modeling, core-four, context-recursive arms, `static_expression`, `$ERROR` in arms, no CC scanner growth. |
| [D9](../DESIGN-NOTES.md#d9--external-scanner-for-strings) | `$ERROR` string / q-string payload reuses scanner tokens; no new external tokens for `$…`. |
| [D11](../DESIGN-NOTES.md#d11--file-type-claim) | Script peers appear inside claimed PL/SQL extensions only (no `.sql`). |
| [D14](../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) | Claimed CC/pragma/script surface precise; OUT forms fail-local; broken arms must not poison following peers. |
| [D16](../DESIGN-NOTES.md#d16--pragma-shape-and-placement) | Generic only; three placement homes; unknown names parse. |
| [D17](../DESIGN-NOTES.md#d17--minimal-script-layer) | `/` + `SET DEFINE` only; native on `source_file`. |
| [D18](../DESIGN-NOTES.md#d18--block-shape-and-flat-declare-section) / [D19](../DESIGN-NOTES.md#d19--statement-catalog-case-and-iterator) | CC + pragma as declaration / statement peers in those catalogs. |
| [D20](../DESIGN-NOTES.md#d20--expression-precedence-and-surface) | `static_expression` thin ladder; ordinary code uses full `expression`. |
| [D21](../DESIGN-NOTES.md#d21--program-unit-create-surface) | Top-level script peers + multi-item `source_file`; `/` not part of CREATE. |
| [D22](../DESIGN-NOTES.md#d22--directives-pragmas-and-script-shapes) | Cross-cutting gist of this lock (node names, fields, `/` strategy, `$` tokens). |

---

## 3. Decisions

### 3.1 Public node names (DIR1)

| ID | Lock |
|----|------|
| **DIR1** | Final public names: |

| Role | Public node |
|------|-------------|
| Whole `$IF … $END` envelope | `conditional_compilation_directive` |
| `$ELSIF` arm (condition + body) | `elsif_directive_clause` |
| `$THEN` / `$ELSE` body lists | **No** intermediate then/else arm nodes — repeated **`body`** / **`else_body`** fields on the envelope |
| Condition nonterminal | `static_expression` (E22 / D5 — already locked) |
| `$ERROR … $END` | `error_directive` (D5 — already locked) |
| Declarative pragma | `pragma_declaration` (B8) |
| Executable pragma | `pragma_statement` (S5) |
| Unit / package / type-body item pragma | `pragma` (ordinary named peer; not under `statement` / `declaration`) |
| Top-level `/` terminator | `script_slash` |
| `SET DEFINE [ON\|OFF]` | `set_define_command` |

Shared pragma interior may use a hidden `_pragma` factoring rule; public trees always show one of the three placement names above.

---

### 3.2 Field vocabulary (DIR2)

| ID | Lock |
|----|------|
| **DIR2** | Role-over-type fields; when unsure, field it (D3). |

| Node | Fields |
|------|--------|
| `conditional_compilation_directive` | `condition` (on `$IF` branch); `body` (repeat of peers after `$THEN`); zero-or-more `elsif_directive_clause`; optional `else_body` (repeat of peers). `$IF` / `$THEN` / `$ELSE` / `$END` keywords **anonymous**. |
| `elsif_directive_clause` | `condition`, `body` (repeat of peers) |
| `static_expression` | No wrapper fields — children are the E22 ladder nodes/tokens |
| `error_directive` | `message` → string / q-string literal (D9 tokens) |
| `pragma_declaration` / `pragma_statement` / `pragma` | `name` (pragma identifier); optional `arguments` → argument list (reuse call-arg surface if cheap, else thin list) |
| `script_slash` | **No** fields (lone `/` under the named node) |
| `set_define_command` | Optional `value` → `ON` / `OFF` as anonymous keywords; bare `SET DEFINE` has no `value` |

**Arm packing (D5):** each arm holds **one or more** peers of the surrounding production — modeled as repeated field children (`body` / `else_body`), not single-item-only.

---

### 3.3 Supertype membership (DIR3)

| ID | Lock |
|----|------|
| **DIR3** | **No sixth supertype** for directives. Tree-sitter node types have fixed supertypes — one `conditional_compilation_directive` type cannot honestly be both `statement` and `declaration`. |

| Construct | Membership |
|-----------|------------|
| `pragma_declaration` | under **`declaration`** (B8) |
| `pragma_statement` | under **`statement`** (S5) |
| Unit-item `pragma` | **neither** — ordinary named peer in unit / package / type-body item choice |
| `conditional_compilation_directive` | **no** `statement` / `declaration` / extra supertype; listed **by name** as an alternative of `declaration` · `statement` · unit-item · `top_level_item` choices |
| Queries | Match `(conditional_compilation_directive)` or parent context; do **not** rely on dual supertype on one type |
| Rejected alternatives | Dual wrappers (`cc_declaration` / `cc_statement`); forcing a single supertype only |

---

### 3.4 Conditional compilation shape (DIR4–DIR8)

| ID | Lock |
|----|------|
| **DIR4** | Envelope is a **directive**, never desugared into `if_statement` (**D5**). |
| **DIR5** | **Core four** placement only: declaration peer · statement peer · unit/package/type-body item peer · top-level `source_file` peer. Expression-primary / type-mark / select-list fragment `$IF` = **OUT** — recover if present; **provisional** pending census. |
| **DIR6** | Arms are **context-recursive**: each arm re-enters the surrounding production’s peer set (including nested CC and, inside arms only, `error_directive`). |
| **DIR7** | Conditions use **`static_expression`** only (E22): inquiry `$$`, literals, boolean/relational ops, parens, dotted static-looking calls; slightly over-accept; no semantic “must be static” check. |
| **DIR8** | `error_directive` = `$ERROR` + **string/q-string** `message` + `$END`; **only inside CC arms** as a peer of that arm’s production. Elsewhere → recovery. Non-string payload → recovery. |

**Sketch (own words):**

```
conditional_compilation_directive =
    "$IF" condition:static_expression
    "$THEN" body:peer+
    { elsif_directive_clause }
    [ "$ELSE" else_body:peer+ ]
    "$END" ;

elsif_directive_clause =
    "$ELSIF" condition:static_expression
    "$THEN" body:peer+ ;

error_directive =
    "$ERROR" message:string_literal_or_q_string
    "$END" ;

-- peer = surrounding production alternative set
--   (declaration | statement | unit_item | top_level_item),
--   plus error_directive only when inside a CC arm.
```

---

### 3.5 `$` keyword tokens (DIR9)

| ID | Lock |
|----|------|
| **DIR9** | Pure-grammar **`dollar_keyword('IF')`** (etc.) → `token(prec(1, /\$IF/i))` or equivalent — same case-insensitive spirit as `keyword()` (L11), with a leading `$` and **no** whitespace between `$` and the word. |

| Axis | Lock |
|------|------|
| Closed set | `$IF`, `$THEN`, `$ELSIF`, `$ELSE`, `$END`, `$ERROR` |
| Not | Separate `$` token + `IF` keyword |
| Not | Scanner-owned `$…` tokens (no CC scanner growth — D5 / D9 bar) |
| Case | Case-insensitive match; **source spelling preserved** |
| vs L28 | `inquiry_directive` remains the single-token `$$`+id shape — **not** produced by `dollar_keyword` |
| Precedence | Same tier as `keyword()` (`prec(1, …)`) so `$IF` wins over a bare `$` + identifier if `$` is ever a delimiter |

---

### 3.6 Pragmas (DIR10–DIR11)

| ID | Lock |
|----|------|
| **DIR10** | **Generic only (v1):** `PRAGMA` + `name` + optional `( arguments )` + `;` where the surrounding list requires semicolon. **No** named productions (`exception_init_pragma`, …). Additive named forms later under D12 if queries need fields. |
| **DIR11** | Three public placement names, one shared shape: `pragma_declaration` · `pragma_statement` · `pragma`. Unknown / deprecated names (e.g. `RESTRICT_REFERENCES`) still parse. Placement bans and pragma **meaning** are **semantic only** — grammar does not ban. |

```
-- shared interior (hidden factoring OK)
_pragma_interior =
    "PRAGMA" name:identifier
    [ "(" arguments:argument_list ")" ]
    ";" ;

pragma_declaration = _pragma_interior ;   -- declaration
pragma_statement   = _pragma_interior ;   -- statement
pragma             = _pragma_interior ;   -- unit / package / type-body item
```

Confirms **L29** / **D16** / **B8** / **B35** / **S5** / **U12** / **U28**.

---

### 3.7 Script layer and `/` vs division (DIR12–DIR14)

| ID | Lock |
|----|------|
| **DIR12** | **Minimal (D17):** only `script_slash` and `set_define_command`. Out: other `SET …`, `PROMPT`, `REM`/`REMARK`, `WHENEVER`, `EXIT`/`QUIT`, `@`/`@@`, `COLUMN`, … — fail-local (**D14**). Census may promote a **small editor set** later; **not** pre-built. |
| **DIR13** | **One** anonymous `/` token. Meaning from **production position** only: `script_slash` is a **`top_level_item`** alternative; expression division lives only under the expression ladder. **No** second scanner token; **no** newline-only terminator rule. |
| **DIR14** | `set_define_command` = `SET` `DEFINE` [ `ON` \| `OFF` ]; optional field `value` when `ON`/`OFF` present. Native peer on `source_file` — **not** injection into a separate script grammar. |

```
top_level_item =
      create_* | wrapped_unit | block
    | conditional_compilation_directive   -- top-level CC peer
    | script_slash
    | set_define_command
    ;

script_slash = "/" ;

set_define_command =
    "SET" "DEFINE" [ value:("ON" | "OFF") ] ;
```

Mid-expression `/` is always **division** (L4) — never invent `script_slash` there. CREATE units still require trailing `;`; `/` is **not** part of the CREATE production (**U3**).

---

### 3.8 D14 recovery and provisional edges (DIR15)

| ID | Edge | Lock |
|----|------|------|
| **DIR15** | Broken CC arm (bad static expr / missing `$END`) | Prefer **local** ERROR/MISSING inside the envelope so following peers / top-level items still parse (same instinct as U44). |
| | `$IF` outside core four (expr / type / select-list) | OUT — recover; **provisional** pending [Census: legacy corpus construct frequencies](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4) |
| | `$ERROR` outside a CC arm | Recovery only |
| | Non-string `$ERROR` payload | Recovery until evidence |
| | Unknown pragma names | Still parse (not recovery) |
| | Illegal pragma placement | Semantic only — accept |
| | Extra SQL\*Plus | OUT / fail-local; **provisional** small-editor promotion via census |
| | Mid-expression `/` | Division only |
| | Scanner | **No growth** for `$…` or script |

---

## 4. Surface catalog (public nodes / fields)

| Node | Kind | Key fields / notes |
|------|------|--------------------|
| `conditional_compilation_directive` | named | `condition`, `body`, `elsif_directive_clause`*, `else_body`?; no supertype |
| `elsif_directive_clause` | named | `condition`, `body` |
| `static_expression` | named (E22) | CC conditions only; no extra fields |
| `error_directive` | named | `message`; arm-peer only |
| `pragma_declaration` | named | `name`, `arguments`?; supertype **`declaration`** |
| `pragma_statement` | named | `name`, `arguments`?; supertype **`statement`** |
| `pragma` | named | `name`, `arguments`?; unit-item peer |
| `script_slash` | named | no fields; top-level only |
| `set_define_command` | named | optional `value` |

**Tokens / helpers (not public keyword nodes):** `dollar_keyword` closed set; anonymous `/`; `keyword()` for `PRAGMA` / `SET` / `DEFINE` / `ON` / `OFF`.

**Does not own:** `inquiry_directive` (01-lexical L28); full expression ladder (04); CREATE shapes (06).

---

## 5. Deferred / out of scope

| Item | Where |
|------|--------|
| Inquiry `$$` token form | [01-lexical.md](01-lexical.md) **L28** |
| Full `static_expression` ladder detail | [04-expressions.md](04-expressions.md) **E22** / **D20** |
| Declare / statement catalog membership wiring | [02-blocks.md](02-blocks.md) / [03-statements.md](03-statements.md) |
| Multi-unit root / CREATE trailing `;` | [06-units.md](06-units.md) **U3** / **U41** / **D21** |
| Expression / type / select-list `$IF` promotion | Census [#4](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4); provisional OUT |
| Full SQL\*Plus / SQLcl; other `SET` | Map **out of scope** / D17; census may promote small editor set |
| Named per-pragma productions | Later under **D12** if queries need fields |
| Semantic static / pragma validation | Map out of scope (no validation) |
| Queries (highlights/locals/injections/tags) | [08-queries.md](08-queries.md) / **D23** ([#37](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/37)) |
| `grammar.js` implementation | Execution after map |

---

## 6. Implementation hand-off (Phase 7)

1. Add `dollar_keyword` helper; closed `$IF` / `$THEN` / `$ELSIF` / `$ELSE` / `$END` / `$ERROR` tokens (DIR9).  
2. Implement `static_expression` per E22; wire only under `$IF` / `$ELSIF`.  
3. Implement `conditional_compilation_directive` + `elsif_directive_clause` with fields DIR2; context-recursive peers in core four slots only.  
4. Implement `error_directive` as arm peer only.  
5. Shared pragma interior → public `pragma_declaration` / `pragma_statement` / `pragma`; wire into declare, statement, unit-item choices.  
6. Root: ensure `source_file` / `top_level_item` includes CC peer, `script_slash`, `set_define_command` (with CREATE/block/wrapped from D21).  
7. `/` strategy: one token; `script_slash` top-level only; division only in expression ladder (DIR13).  
8. Recovery: local failure inside broken CC; no poison of next peer / top-level item (DIR15).  
9. **No** scanner growth for CC or script.  
10. Corpus seeds (synthetic):

| # | Seed |
|---|------|
| 1 | Multi-arm `$IF` / `$ELSIF` / `$ELSE` / `$END` in a statement list |
| 2 | Nested CC (CC inside a then `body`) |
| 3 | `$ERROR` string + `$END` in a dead arm |
| 4 | `PRAGMA INLINE (…);` in a statement list |
| 5 | `PRAGMA EXCEPTION_INIT (…);` in declare |
| 6 | CREATE unit or anonymous block then `/` |
| 7 | `SET DEFINE OFF` (and bare `SET DEFINE` / `ON` if cheap) |
| 8 | Top-level CC peer between two units |
| 9 | Recovery smoke: broken `$IF` arm then valid next statement / next top-level item |

---

## 7. Decision index (DIR1–DIR15)

| ID | Gist |
|----|------|
| DIR1 | Public node names (envelope, elsif clause, dual pragmas + unit `pragma`, script_slash, set_define_command) |
| DIR2 | Field vocabulary (`condition`, `body`, `else_body`, `message`, `name`, `arguments`, optional `value`) |
| DIR3 | No sixth supertype; CC by name in each choice; pragma dual names for declaration/statement |
| DIR4–DIR8 | Envelope / core four / recursive arms / static_expression / error_directive |
| DIR9 | `dollar_keyword` closed set; no scanner growth |
| DIR10–DIR11 | Generic pragma; three placement names |
| DIR12–DIR14 | Minimal script; positional `/`; set_define_command |
| DIR15 | D14 edges + provisional OUT set |

Non-obvious cross-cutting locks are gisted as **[D22](../DESIGN-NOTES.md#d22--directives-pragmas-and-script-shapes)**. Architecture remains **D5** / **D16** / **D17**.
