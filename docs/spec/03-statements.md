# Spec: 03 — Statements

**Status:** Locked  
**Ticket:** [Lock spec: 03-statements.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Locked:** 2026-07-16  

**Research (inputs, not re-decided here):**

- [Inventory: statements incl. modern iteration controls](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/7) → `docs/spec/research/03-statements-inventory.md` (flags S1–S43)
- Cross-cutting: `docs/DESIGN-NOTES.md` (**D7**, **D14**, **D15**, **D16**, **D18**; **D19** from this lock)

**Related tickets:** blocks / nested `block` as statement → [Lock spec: 02-blocks.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/20); expressions / CASE expr + iterator reuse → [Lock spec: 04-expressions.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/26); SQL spine depth → **D7** + [Lock spec: 05-sql.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32); units / `PIPE ROW` semantic context → [Lock spec: 06-units.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24); executable pragmas catalog → **D16** + [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34).

---

## 1. Scope

**In scope:** Phase 3 statement catalog — every Block `statement` alternative (plus `procedure_call_statement` and collection mutators), control forms (IF / CASE statement / all loops incl. full R26 iterator), sequential control (GOTO / NULL / assignment / RAISE / RETURN / EXIT / CONTINUE), cursor ops (OPEN / OPEN FOR / FETCH / CLOSE), SELECT INTO, EXECUTE IMMEDIATE, FORALL, PIPE ROW, keyword-led embedded-SQL **entry** shapes, labels on statements, and shared clause helpers (`into` / `bulk_collect_into` / `using` / returning).

**Out of scope for this file:** expression ladder interiors (conditions, bounds, RHS); full SQL spine/opaque depth (D7 / `05-sql`); CREATE unit wrappers; declarative-only pragma catalog detail; script `/`; `grammar.js` implementation.

---

## 2. Standing rules applied

| Decision | How it applies here |
|----------|---------------------|
| [D1](../DESIGN-NOTES.md#d1--grammar-name-and-node-naming) | Manual terms: `if_statement`, `for_loop_statement`, `execute_immediate_statement`, … No keyword nodes. |
| [D3](../DESIGN-NOTES.md#d3--supertypes-and-fields) | All statement alternatives → supertype `statement`. No category supertypes (`control_statement`, …). Fields: `label`, `condition`, `body` / statement lists, `name` / `end_label`, `target`, `value`, `into`, `using`, … |
| [D7](../DESIGN-NOTES.md#d7--embedded-sql) | SQL entry keywords + collection mutators IN; depth = spine + opaque; nested select never free `INTO`. |
| [D14](../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) | Claimed R26 surface gets precise nodes; semantic-only bans stay permissive in grammar where noted (S7, S11, S14, S18, S26, S35, S36). |
| [D15](../DESIGN-NOTES.md#d15--reference-ambiguity-strategy) | `procedure_call_statement`; `assignment_target` on shared postfix chain; RAISE name-site; cursor actuals = call args. |
| [D16](../DESIGN-NOTES.md#d16--pragma-shape-and-placement) | Executable `PRAGMA` as statement peer (generic shape). |
| [D18](../DESIGN-NOTES.md#d18--block-shape-and-flat-declare-section) | Nested `block` is a statement alternative; block `body` still requires ≥1 statement (stricter than IF arms — see S7). |
| [D19](../DESIGN-NOTES.md#d19--statement-catalog-case-and-iterator) | Catalog completeness, CASE conflict, unified FOR / full iterator (this lock). |

---

## 3. Decisions

### 3.1 Catalog and factorization (S1–S5, S38–S40)

| ID | Lock |
|----|------|
| **S1** | **Flat** `statement` choice of named alternatives. No intermediate category-supertype wrappers. `sql_statement` is a **named alternative** (envelope), not a D3 supertype. |
| **S2 / S38** | **`procedure_call_statement`** is a first-class alternative (Block img_text omits it; semantics + real code require it). Shape per **D15**. |
| **S3 / S39–S40** | Collection mutators **`DELETE` / `EXTEND` / `TRIM`** are **statement-level** constructs. Other collection methods remain expression/member chain. Nesting under `sql_statement` for keyword routing is an implementer detail — one public mutator statement shape. DML `DELETE` vs mutator: member/`.` before method name (**D7**). |
| **S4** | Leading labels: **`field("label", $.label)*`** — same as blocks **B5**; no `label_list` wrapper. |
| **S5** | Executable **`pragma_statement`** (generic **D16** shape, e.g. `INLINE`) is a statement-list peer. Full name catalog → directives. |

**Catalog (public statement alternatives):**

```
statement =
    { label }
    (
        assignment_statement
      | basic_loop_statement
      | block                          -- nested plsql_block (02-blocks)
      | case_statement
      | close_statement
      | continue_statement
      | execute_immediate_statement
      | exit_statement
      | fetch_statement
      | for_loop_statement             -- includes classic cursor FOR (S19)
      | forall_statement
      | goto_statement
      | if_statement
      | null_statement
      | open_statement
      | open_for_statement
      | pipe_row_statement
      | pragma_statement              -- executable region (D16 / S5)
      | procedure_call_statement
      | raise_statement
      | return_statement
      | select_into_statement
      | sql_statement                 -- DML/TCL/LOCK + mutator placement
      | while_loop_statement
      | collection_method_statement   -- DELETE/EXTEND/TRIM (name flexible if nested under sql_statement)
    ) ;
```

No separate public `cursor_for_loop_statement` (**S19**).

### 3.2 IF and CASE statement (S6–S11)

| ID | Lock |
|----|------|
| **S6** | Single **`if_statement`**: `IF` cond `THEN` stmts `{ ELSIF … }` `[ ELSE stmts ]` `END IF` `;`. Not chained binary if-else nodes. |
| **S7** | IF / CASE **arms** use `repeat(statement)` — **empty arms allowed** for half-edited recovery. Distinct from block `body` / handlers, which stay `repeat1` (**B3** / **D18**). Manual “≥1 or `NULL;`” is semantic/style, not grammar. |
| **S8** | **One declared conflict** `case_expression` ↔ `case_statement`. Disambiguate by closer: expression → bare `END`; statement → `END CASE` [label] `;`. Do not merge into a fake shared node that hides the conflict. |
| **S9** | Statement CASE has **full parity** with expression CASE: multi-choice `WHEN` + `dangling_predicate`. |
| **S10** | Optional **`end_label`** after `END CASE` (semantic match to opening label only). |
| **S11** | **Permissive** dangling predicates (accept forms the manual may not fully support yet). |

**END families (do not conflate):**

| Shape | Closes |
|-------|--------|
| `END IF` | `if_statement` |
| `END LOOP` [label] | loop forms |
| `END CASE` [label] | **CASE statement** |
| `END` [name] `;` | **block / unit `body`** (02-blocks) — legacy bare `END` / `END name` traffic |
| bare `END` | **CASE expression** only (expression context) |

`END name` is never a CASE statement closer; CASE statement always has the keyword `CASE` after `END`.

### 3.3 Loops and iterator (S12–S21)

| ID | Lock |
|----|------|
| **Iterator v1** | **Full R26** controls in v1: stepped `..` [`BY`], single expression / `REPEAT`, `VALUES OF` / `INDICES OF` / `PAIRS OF`, cursor control, dynamic SQL control, multi-control chains, `REVERSE`, `WHILE` stop / `WHEN` skip, `MUTABLE` / `IMMUTABLE` on iterands. Not phased. |
| **S12** | **Shared** public `iterator` production with qualified expressions (04-expressions). |
| **S13** | One **`for_loop_statement`** + structured iteration-control children — not per-control statement node types. |
| **S14** | **Do not** enforce `PAIRS OF` isolation (two iterands; no mix) in the grammar — semantic. |
| **S15** | `MUTABLE` / `IMMUTABLE` are **keywords** in `iterand_decl`; re-admission as identifiers elsewhere via **D15**. |
| **S16** | SQL inside cursor / `VALUES|INDICES|PAIRS OF` sources: depth **per D7** (spine + opaque). |
| **S17** | Iterator **dynamic SQL control**: dedicated thin form — `EXECUTE IMMEDIATE` … optional `USING [IN] …` only (**no** `INTO` / returning). Full matrix stays on `execute_immediate_statement`. |
| **S18** | Accept **`REVERSE`** even where the manual forbids it (cursor, single-expr, pipelined contexts) — documented looseness. |
| **S19** | **Unify** classic cursor FOR into `for_loop_statement` + cursor control (no separate public `cursor_for_loop_statement`). |
| **S20** | Cursor actual parameters: **reuse** call argument list (positional + `name =>` named) from expressions / **D15**. |
| **S21** | Separate **`exit_statement`** and **`continue_statement`** with shared optional `label` + `WHEN` condition fields. |

**Other loop forms:**

- **`basic_loop_statement`:** `LOOP` stmts `END LOOP` [end_label] `;`
- **`while_loop_statement`:** `WHILE` cond `LOOP` stmts `END LOOP` [end_label] `;`
- Optional **`end_label`** after `END LOOP`: semantic match only.

### 3.4 Sequential control and assignment (S22–S26, S37)

| ID | Lock |
|----|------|
| **S22** | Three `NULL` roles by **production**: `null_statement` (`NULL;`); `null_literal` (expressions / 01-lexical); `NULL` in type / `NOT NULL` (blocks). One keyword family; context selects role. |
| **S23** | LHS of `:=` is dedicated **`assignment_target`**, not a free full `expression`. |
| **S24** | Target core = **D15 postfix chain** (name / member / attribute / call for indexing / link / binds as allowed). No parallel assignment-only member/call nodes. |
| **S25** | `RAISE` [exception]: exception = **name-site** chain (seed + `.` only). Bare `RAISE` = re-raise. |
| **S26** | `RETURN` **always** allows optional expression in the grammar; procedure vs function is semantic. |
| **S37** | Confirm **D15**: `procedure_call_statement` wraps `call_expression` **or** bare name/member/link chain. No second call-shaped node. |

**Also:**

- **`goto_statement`:** `GOTO` label_name `;` (name-site).
- **`null_statement`:** `NULL` `;`.

### 3.5 Cursor ops, SELECT INTO, dynamic SQL, FORALL, PIPE ROW (S27–S36)

| ID | Lock |
|----|------|
| **S27** | Shared helpers: **`into_clause`**, **`bulk_collect_into_clause`**, **`using_clause`**, plus returning helpers aligned with DML (**S33**). Reused across FETCH / SELECT INTO / EXECUTE IMMEDIATE / OPEN FOR / related forms. |
| **S28 / S31 / S16** | Static select depth after OPEN FOR / in controls → **D7** / lock `05-sql`. Statements only fix entry productions and boundaries. |
| **S29** | After `OPEN … FOR`: **first-token** dispatch — query keyword (`SELECT` / `WITH` / … per subset) → static select; string/expression → dynamic. |
| **S30** | **`select_into_statement`** is factored separately (carries `INTO` / `BULK COLLECT INTO`). Nested/cursor selects **must not** accept free `INTO` via a shared unrestricted select. |
| **S32** | Own node **`execute_immediate_statement`**; share clause helpers with iterator dynamic control where shapes match. |
| **S33** | **`dynamic_returning_clause`** field shape aligned with static DML `RETURNING` (D7 hooks). |
| **S34** | FORALL body reuses **DML / `EXECUTE IMMEDIATE`** alternatives (string body unparsed per D7). |
| **S35** | Dynamic FORALL `USING`: **permissive** (expressions allowed); “simple collection name only” is semantic. |
| **S36** | **`pipe_row_statement`** accepted wherever statements appear; pipelined-only is semantic. |

**Cursor sketch (own words):**

```
open_statement     = "OPEN" cursor_name [ "(" argument_list ")" ] ";"
open_for_statement = "OPEN" cursor_var "FOR" ( select | dynamic_expr ) [ using_clause ] ";"
fetch_statement    = "FETCH" cursor ( into_clause | bulk_collect_into_clause [ "LIMIT" expr ] ) ";"
close_statement    = "CLOSE" cursor_name ";"
```

### 3.6 Embedded SQL entry (S41–S43)

| ID | Lock |
|----|------|
| **S41** | **Keyword-led** dispatch for SQL statement alternatives — no “tokens until `;`” catch-all pseudo-SQL. |
| **S42** | **TCL fully structured:** `COMMIT` / `ROLLBACK` / `SAVEPOINT` / `SET TRANSACTION` (per **D7**). |
| **S43** | DML / select: **minimal spine + opaque tail** per **D7**; not a full SQL grammar in this file. Detail → lock `05-sql`. |

---

## 4. Surface catalog (public nodes / fields)

**Supertype:** `statement` (D3).

| Node | Notes |
|------|--------|
| `label` | `<<` name `>>` — reused from blocks |
| `if_statement` | fields: condition(s), consequence / elsif arms / else statement lists |
| `case_statement` | simple or searched; `end_label` optional |
| `basic_loop_statement` / `while_loop_statement` / `for_loop_statement` | `end_label` optional |
| `iterator` / `iterand_decl` / iteration controls | shared with qualified expressions |
| `exit_statement` / `continue_statement` | optional label + `WHEN` |
| `goto_statement` / `null_statement` | |
| `assignment_statement` | `assignment_target` + value expression |
| `assignment_target` | D15 chain restricted to LHS |
| `raise_statement` / `return_statement` | |
| `open_statement` / `open_for_statement` / `fetch_statement` / `close_statement` | |
| `select_into_statement` | distinct from nested select |
| `execute_immediate_statement` | full optional clause matrix |
| `forall_statement` | bounds + optional SAVE EXCEPTIONS + DML/dynamic body |
| `pipe_row_statement` | |
| `procedure_call_statement` | D15 |
| `collection_method_statement` (or equivalent under `sql_statement`) | mutators only |
| `pragma_statement` | executable generic pragma |
| `sql_statement` | keyword-led DML/TCL/LOCK envelope |
| `into_clause` / `bulk_collect_into_clause` / `using_clause` | shared helpers |

Operators/keywords remain anonymous tokens (D1).

---

## 5. Deferred / out of scope

| Item | Where |
|------|--------|
| Expression ladder, CASE **expression** node detail, qualified-expression iterator use | Lock `04-expressions` (shares `iterator`, S8 conflict) |
| SQL spine/opaque depth, precise WHERE, DML guts | **D7** + lock `05-sql` |
| Block empty-body policy, declare section | **D18** + `02-blocks` |
| Pragma name catalog / script `/` | **D16** / **D17** + lock `07-directives` |
| PIPE ROW legal only in pipelined functions | Semantic / units |
| Implementing `grammar.js` | Execution after map |

---

## 6. Implementation hand-off (Phase 3)

1. Flat `statement` choice including `procedure_call_statement`, nested `block`, `pragma_statement`, SQL envelope, mutators.  
2. IF / CASE statement with multi-choice WHEN + dangling predicates; declare **one** conflict with `case_expression`.  
3. Loops: basic, WHILE, single `for_loop_statement` + full R26 `iterator` (shared export for expressions).  
4. No separate classic cursor-FOR node; cursor actuals = call `argument_list`.  
5. `assignment_target` on D15 chain; `procedure_call_statement` per D15.  
6. Shared `into` / `bulk_collect_into` / `using` / returning helpers.  
7. `select_into_statement` separate from nested select; OPEN FOR first-token static vs dynamic.  
8. EXECUTE IMMEDIATE full clause matrix; FORALL reuses DML/dynamic; PIPE ROW anywhere in statement lists.  
9. SQL: keyword dispatch + TCL structured; DML depth from D7 — do not re-litigate subset here.  
10. **Corpus:** ≥1 public family per statement form; **modern iterator** cases mandatory (stepped, VALUES/INDICES/PAIRS OF, multi-control, REVERSE, WHILE/WHEN, MUTABLE, dynamic control). CASE `END` vs `END CASE` pair. Assignment targets (index/member). OPEN FOR static + dynamic.

---

## 7. Decision index (S1–S43)

| ID | Resolution |
|----|------------|
| S1 | Flat statement choice; `sql_statement` named alternative only |
| S2 / S38 | `procedure_call_statement` first-class |
| S3 / S39–S40 | Mutators statement-level; other methods via expression chain |
| S4 | `field("label", $.label)*` |
| S5 | Executable generic `pragma_statement` (D16) |
| S6 | Single `if_statement` with elsif/else fields |
| S7 | Empty arms allowed on IF/CASE (`repeat`); block body stays `repeat1` |
| S8 | One conflict vs `case_expression`; `END` vs `END CASE` |
| S9 | Multi-choice WHEN + dangling_predicate on statement CASE |
| S10 | Optional `end_label` after `END CASE` |
| S11 | Permissive dangling predicates |
| S12 | Shared `iterator` with qualified expressions |
| S13 | One `for_loop_statement` + control children |
| S14 | No PAIRS isolation in grammar |
| S15 | MUTABLE/IMMUTABLE keywords in iterand_decl |
| S16 | Iterator/cursor SQL depth per D7 |
| S17 | Thin dynamic control USING (no INTO) |
| S18 | Permissive REVERSE |
| S19 | Classic cursor FOR unified into `for_loop_statement` |
| S20 | Cursor actuals = call argument list |
| S21 | Separate EXIT/CONTINUE nodes; shared field pattern |
| S22 | NULL roles by production context |
| S23 | Dedicated `assignment_target` |
| S24 | Target uses D15 chain |
| S25 | RAISE name-site (seed+`.`) |
| S26 | Optional RETURN expr always; bare RAISE OK |
| S27 | Shared into / bulk_collect_into / using helpers |
| S28 | OPEN FOR select depth → D7 / 05-sql |
| S29 | FOR: first-token static select vs dynamic |
| S30 | Factored `select_into_statement` |
| S31 | Select list/rest depth → D7 / 05-sql |
| S32 | Own execute_immediate_statement + shared clauses |
| S33 | Returning clause aligned with DML |
| S34 | FORALL body = DML / EXECUTE IMMEDIATE |
| S35 | Permissive FORALL USING |
| S36 | PIPE ROW anywhere statements appear |
| S37 | D15 procedure_call_statement shape |
| S41 | Keyword-led SQL dispatch |
| S42 | TCL fully structured |
| S43 | DML spine + opaque per D7 |

---

## 8. DESIGN-NOTES entries

Non-obvious cross-cutting locks are gisted as **[D19](../DESIGN-NOTES.md#d19--statement-catalog-case-and-iterator)** (catalog + CASE conflict + full iterator / unified FOR). SQL depth remains **D7**; call/assignment chain remains **D15**; executable pragmas **D16**.
