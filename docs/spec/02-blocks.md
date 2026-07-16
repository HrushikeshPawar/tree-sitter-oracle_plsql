# Spec: 02 — Blocks and declarations

**Status:** Locked  
**Ticket:** [Lock spec: 02-blocks.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/20)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Locked:** 2026-07-16  

**Research (inputs, not re-decided here):**

- [Inventory: blocks and declarations](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/6) → `docs/spec/research/02-blocks-declarations-inventory.md` (flags B1–B38)
- Cross-cutting: `docs/DESIGN-NOTES.md` (D1–D3, D7, D14–D17; **D18** from this lock)

**Related tickets:** statements catalog → [Lock spec: 03-statements.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22); expressions / name chain → **D15** + [Lock spec: 04-expressions.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/26); embedded SQL / cursor query → **D7** + [Lock spec: 05-sql.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32); unit headers / CREATE → [Lock spec: 06-units.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24); pragmas / script `/` → **D16** / **D17** + [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34).

---

## 1. Scope

**In scope:** Phase 2 structure — anonymous and nested **blocks** (labels, optional `DECLARE`, `body`); **declare-section** item shapes (variables, constants, exceptions, collection/record/cursor vars, type definitions, cursors, nested subprogram specs/bodies, declarative pragmas); **exception handlers**; declaration-site **type_spec** / parameter types / `%TYPE` / `%ROWTYPE` as applied here.

**Out of scope for this file:** full statement catalog (except nested `block` as a statement alternative); CREATE unit wrappers and full header clauses; expression ladder; deep SQL beyond D7 hooks; per-pragma catalog; script-layer `/`; `grammar.js` implementation.

---

## 2. Standing rules applied

| Decision | How it applies here |
|----------|---------------------|
| [D1](../DESIGN-NOTES.md#d1--grammar-name-and-node-naming) | Manual terms: `block`, `body`, `cursor_declaration`, `cursor_definition`, `exception_handler`, … No keyword nodes; `IS`/`AS` anonymous. |
| [D3](../DESIGN-NOTES.md#d3--supertypes-and-fields) | `block` → `statement`; all declare items → `declaration`; type-specs → `type`. Core fields: `name`, `end_name`, `body`, `label`, `parameters`, `type` / `return_type` / `base_type` / `element_type`, `default` / `value`, `handlers`, `query`. |
| [D7](../DESIGN-NOTES.md#d7--embedded-sql) | Cursor `IS` query = nested select spine (no `INTO`); no `WITH` (OUT). |
| [D14](../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) | Empty `BEGIN`, bare `NOT NULL`, invalid formal constraints, misordered handlers: precision productions + recovery — no fake-valid rules. Flat declare list is **not** a fake-valid dialect (see D18). |
| [D15](../DESIGN-NOTES.md#d15--reference-ambiguity-strategy) | Name sites seed+`.`; single `attribute_reference` for `%TYPE`/`%ROWTYPE`; procedure call shape deferred to statements but not re-opened. |
| [D16](../DESIGN-NOTES.md#d16--pragma-shape-and-placement) | Generic `pragma_declaration` as declarative peer (B8/B35). |
| [D17](../DESIGN-NOTES.md#d17--minimal-script-layer) | Top-level `/` is script peer, not block body (B4). |
| [D18](../DESIGN-NOTES.md#d18--block-shape-and-flat-declare-section) | Single `block` + reusable `body`; flat `declaration` list (no two-phase item lists). |

---

## 3. Decisions

### 3.1 Block factorization and fields (B1–B5)

| ID | Lock |
|----|------|
| **B1** | **One public `block`** for anonymous and nested forms. Reusable public **`body`** (`BEGIN` … optional handlers … `END` [name] `;`) also hangs off nested units / package bodies (units lock). No `anonymous_block` / `nested_block` split — parent context distinguishes role. |
| **B2** | **`block` fields:** `label` (repeat), optional `declarations` → `declare_section`, required `body` → `body`. **`body` fields:** `statements` → `statement_list`, optional `handlers` → `exception_section`, optional `end_name`. No fields for `DECLARE`/`BEGIN`/`EXCEPTION`/`END`/`;`. |
| **B3** | **`statement_list` = `repeat1(statement)`** in `body` and in each `exception_handler`. Empty executable parts are invalid → Tree-sitter recovery; do not allow zero-statement lists. |
| **B4** | Top-level `;` vs `/` **not** decided here — **D17** / directives. Block `body` always carries its trailing `;` per R26. |
| **B5** | Multiple labels: **`field("label", $.label)*`**; each `label` = `<<` name-site `>>` with field `name`. No `label_list` wrapper. Same label shape for statement-leading labels in Phase 3. |

**Sketch (own words):**

```
block =
    { label }
    [ "DECLARE" declare_section ]
    body ;

label = "<<" name ">>" ;

body =
    "BEGIN"
    statement_list
    [ "EXCEPTION" exception_section ]
    "END" [ end_name ]
    ";" ;

statement_list = statement { statement } ;   -- ≥1
```

### 3.2 Declare section (B6–B8)

| ID | Lock |
|----|------|
| **B6–B7** | **Flat** `declare_section` = `repeat1(declaration)`. **No** public `item_list_1` / `item_list_2`. Preferred R26 order (type/var/exception before subprogram/cursor **definitions**) is documented for corpus authors; grammar does not enforce phase barriers ([D18](../DESIGN-NOTES.md#d18--block-shape-and-flat-declare-section)). |
| **B8** | **`pragma_declaration`** is a `declaration` alternative (generic shape per **D16** / L29). |

`declaration` choice includes at least: type definitions, item declarations (below), cursor decl/def, nested function/procedure decl/def, pragma.

### 3.3 Item declarations (B9–B12)

| ID | Lock |
|----|------|
| **B9–B10** | **Hybrid:** `variable_declaration` covers **scalar and constant** (`name [CONSTANT] type_spec [[NOT NULL] default] ;`). **No** separate `constant_declaration` node — `CONSTANT` is an anonymous keyword. Separate nodes: `collection_variable_declaration`, `record_variable_declaration`, `cursor_variable_declaration`, `exception_declaration`. |
| **B11** | **Keyword-led** disambiguation: `TYPE` / `SUBTYPE` → type definitions; otherwise name-led item decls. |
| **B12** | **`NOT NULL` only with required initializer** (`:=` \| `DEFAULT` expression) on scalar/constant and record fields. Bare `NOT NULL` → recovery. Constants always require an initializer. |

**Fields (typical):** `name`; optional presence of `CONSTANT`; `type` → `type_spec`; optional `default` / `value` for initializer. Exception: `name` only + `EXCEPTION` keyword.

### 3.4 Type definitions (B13–B18)

| ID | Lock |
|----|------|
| **B13** | Subtype trailing **`;` required** (despite diagram omission). |
| **B14** | **Four sibling public nodes:** `collection_type_definition`, `record_type_definition`, `ref_cursor_type_definition`, `subtype_definition`. No `generic_type_definition`. Shared `TYPE name IS` may be factored in hidden rules only. |
| **B15** | Public parent **`collection_type_definition`** with three named body shapes: associative array (`TABLE OF … INDEX BY …`), nested table (`TABLE OF …` without `INDEX BY`), varray. |
| **B16** | Varray spellings: **`VARRAY` \| `VARYING ARRAY` \| `ARRAY`** (all R26 diagram forms) inside one varray body shape. |
| **B17** | Structural sizes / precision / `VARCHAR2(n)` index / varray limit / subtype precision: **`number_literal` only** (optional unary `+`/`-` on `RANGE` bounds if needed). Not full `expression`. |
| **B18** | Type **definitions** → supertype **`declaration` only**. Supertype **`type`** is for **type-spec / datatype** nodes only. `block` → `statement`. Nested subprogram decl/def → `declaration`. |

**Record fields:** `field_definition` = `name type_spec [[NOT NULL] default]` (same NOT NULL+init grouping as B12).

**REF CURSOR:** optional `RETURN` rowtype → strong; omit → weak. `SYS_REFCURSOR` is not defined by this production (B31).

### 3.5 Explicit cursors (B19–B22)

| ID | Lock |
|----|------|
| **B19** | **Separate** `cursor_declaration` (`RETURN` required, no `IS`) vs `cursor_definition` (`IS` query required; `RETURN` optional). |
| **B20** | Cursor query field `query` → **D7 nested select spine** (no `INTO`); detail in `05-sql.md`. |
| **B21** | **No `WITH`** on cursor select (manual + D7 OUT). |
| **B22** | **Cursor-specific** `cursor_parameter` / `cursor_parameter_list`: name, optional `IN`, unconstrained parameter type, optional default. Do **not** reuse full formal-parameter (OUT/NOCOPY) production. |

### 3.6 Nested subprograms (B23–B27)

| ID | Lock |
|----|------|
| **B23** | Nested **functions:** optional repeat of `DETERMINISTIC` \| `PIPELINED` \| `PARALLEL_ENABLE` \| `RESULT_CACHE` [relies_on]. Nested **procedures:** **no** CREATE/package-only properties (`AUTHID`, `ACCESSIBLE BY`, …). Full header catalog → units lock; same public node names may be reused/aliased for CREATE (D1). |
| **B24** | Formals and cursor params use **`parameter_type`**: name / `%TYPE` / `%ROWTYPE` / REF forms **without** inline precision/length parens. Variables, returns, collection elements, etc. keep full **`type_spec`** (may include `(n[,s])`, `CHAR`/`BYTE`). |
| **B25** | **`IS` \| `AS`** both accepted; anonymous keywords; **no** `is_or_as` field. |
| **B26** | After `IS`/`AS`: `[declare_section] body` **or** coarse **`call_spec`** envelope (`LANGUAGE` …). Deep call-spec → units. |
| **B27** | Forward **declaration** and later **definition** are two nodes sharing name text only — no synthetic CST link. |

**Formal parameters (subprograms):** `parameter_declaration` with IN / OUT / IN OUT / NOCOPY per R26; defaults only on IN branch; types via `parameter_type` (B24). List: `parameter_list` with field `parameters`.

### 3.7 Datatype and attributes (B28–B31)

| ID | Lock |
|----|------|
| **B28** | `%TYPE` / `%ROWTYPE` use single **`attribute_reference`** (D15) — not a parallel `type_attribute` public type. |
| **B29** | Qualification depth = D15 name-site chain (seed + `.` → `member_expression`) then `%` attr. No competing `qualified_name` primary. |
| **B30** | Scalar type args / precision = **`number_literal`** (shared with B17); optional `CHAR`/`BYTE` length semantics keywords. Not full expression. |
| **B31** | **`SYS_REFCURSOR`** = ordinary type name (identifier); no special token. |

**`type_spec` (supertype `type`)** includes at least: named types (collection/record/ref/object/`REF` object), scalar-with-optional-args, `attribute_reference` for `%TYPE`/`%ROWTYPE`, and other R26 datatype alternatives as needed without inventing a catch-all opaque type.

### 3.8 Exception handlers and pragmas (B32–B35)

| ID | Lock |
|----|------|
| **B32** | **`exception_section`** after `EXCEPTION` holds `repeat1(exception_handler)`; field `handlers` on `body`. |
| **B33** | **Do not** enforce `OTHERS` last/unique in the grammar; each handler is a precise node. Order/uniqueness is semantic. |
| **B34** | `WHEN` exception names = D15 name-site chain; `OTHERS` alternative. Multiple exceptions: `OR`-separated. |
| **B35** | Generic pragma only in this phase (**D16**); no per-pragma productions. |

```
exception_handler =
    "WHEN" ( exception_name { "OR" exception_name } | "OTHERS" )
    "THEN" statement_list ;
```

### 3.9 Statement boundary (B36–B38)

| ID | Lock |
|----|------|
| **B36** | **`statement` is owned by** [Lock spec: 03-statements.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22). This area only requires: body/handler lists are `repeat1(statement)`, and **`block` is one `statement` alternative**. Design lock is the full catalog — staging stubs in implementation are temporary, not the locked surface. |
| **B37** | Procedure-call vs assignment ambiguity → **D15** (`procedure_call_statement`); not re-opened here. |
| **B38** | Collection methods `EXTEND`/`TRIM`/`DELETE` as statements → **statements** area. |

---

## 4. Surface catalog (Phase 2 public names)

| Name | Kind | Supertype | Notes |
|------|------|-----------|-------|
| `block` | named | `statement` | B1 |
| `label` | named | — | field `name` |
| `declare_section` | named | — | flat list container |
| `body` | named | — | reusable |
| `statement_list` | named | — | ≥1 statements |
| `exception_section` | named | — | B32 |
| `exception_handler` | named | — | B32–B34 |
| `variable_declaration` | named | `declaration` | scalar + constant |
| `collection_variable_declaration` | named | `declaration` | |
| `record_variable_declaration` | named | `declaration` | |
| `cursor_variable_declaration` | named | `declaration` | |
| `exception_declaration` | named | `declaration` | |
| `pragma_declaration` | named | `declaration` | D16 |
| `collection_type_definition` | named | `declaration` | three body shapes |
| `record_type_definition` | named | `declaration` | |
| `ref_cursor_type_definition` | named | `declaration` | |
| `subtype_definition` | named | `declaration` | trailing `;` |
| `field_definition` | named | — | record fields |
| `cursor_declaration` | named | `declaration` | forward RETURN |
| `cursor_definition` | named | `declaration` | IS query |
| `cursor_parameter_list` / `cursor_parameter` | named | — | IN-only |
| `function_declaration` / `function_definition` | named | `declaration` | nested |
| `procedure_declaration` / `procedure_definition` | named | `declaration` | nested |
| `parameter_list` / `parameter_declaration` | named | — | full modes |
| `call_spec` | named | — | coarse envelope |
| `type_spec` | named / choice | `type` | full declaration-site types |
| `parameter_type` | named / choice | `type` | unconstrained formals |
| `attribute_reference` | named | (D15; also type use) | `%TYPE` / `%ROWTYPE` / cursor attrs |
| `statement` | supertype hole | `statement` | filled by Phase 3 |

Hidden rules (`_…`) may factor shared prefixes (`TYPE name IS`, function heading, etc.).

---

## 5. Deferred / out of scope

| Item | Where |
|------|--------|
| Full statement alternatives (except nested `block`) | [Lock spec: 03-statements.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22) |
| Expression ladder / defaults interiors | [Lock spec: 04-expressions.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/26) |
| Nested select / SQL clause depth | **D7**; [Lock spec: 05-sql.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32) |
| CREATE headers, package layout, deep call_spec | [Lock spec: 06-units.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24) |
| Per-pragma catalog; conditional compilation; script `/` | **D5**, **D16**, **D17**; [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34) |
| Two-list declare **semantic** lint | Out of grammar (D18) |
| Implementation in `grammar.js` | After map |

---

## 6. Implementation hand-off (Phase 2)

1. Rules: `block`, `label`, `declare_section`, `body`, `statement_list`, `exception_section`, `exception_handler`.  
2. `declaration` choice: all item kinds in §4 (flat list; no item_list phases).  
3. `variable_declaration` with optional `CONSTANT` and grouped `NOT NULL`+default; separate collection/record/cursor-var/exception rules.  
4. Four type-definition rules; collection body three-way; varray three spellings; subtype with `;`.  
5. `cursor_declaration` vs `cursor_definition`; `cursor_parameter_list`; `query` → D7 select spine.  
6. Nested function/procedure decl vs def; function modifiers only on nested functions; `parameter_list` with `parameter_type`; coarse `call_spec`.  
7. `type_spec` vs `parameter_type`; `%TYPE`/`%ROWTYPE` via `attribute_reference` (D15).  
8. Wire `statement` to Phase 3 catalog; ensure `block` is one alternative; `repeat1` in body/handlers.  
9. Corpus seeds: labeled block; declare+body; empty BEGIN recovery; constant vs variable; each type form; forward cursor + defined cursor; nested function forward+body; EXCEPTION handlers with OR/OTHERS; pragma in declare; NOT NULL without init recovery; nested block as statement.

---

## 7. Decision index (B1–B38)

| ID | Resolution |
|----|------------|
| B1 | Single `block` + reusable `body` |
| B2 | Fields: labels, `declare_section`, `body` / `statement_list` / `exception_section` / `end_name` |
| B3 | ≥1 statement in body and handlers |
| B4 | `/` → D17 / directives |
| B5 | Repeat `label` field; no label_list |
| B6–B7 | Flat `declaration` list (D18); no two-phase public nodes |
| B8 | Generic `pragma_declaration` in declare (D16) |
| B9–B10 | Unified scalar+constant `variable_declaration`; no constant node |
| B11 | TYPE/SUBTYPE keyword-led vs name-led items |
| B12 | NOT NULL only with initializer |
| B13 | Subtype `;` required |
| B14 | Four sibling type-definition nodes |
| B15 | collection_type_definition + three named bodies |
| B16 | VARRAY \| VARYING ARRAY \| ARRAY |
| B17 | Sizes/precision = number_literal |
| B18 | Defs → declaration; type_spec → type; block → statement |
| B19 | cursor_declaration ≠ cursor_definition |
| B20 | D7 nested select for query |
| B21 | No WITH on cursor select |
| B22 | Cursor-specific IN-only parameters |
| B23 | Nested function modifiers only; no nested procedure properties |
| B24 | parameter_type unconstrained; type_spec full elsewhere |
| B25 | IS\|AS anonymous; no field |
| B26 | Coarse call_spec envelope |
| B27 | Forward decl + def = two nodes; no CST link |
| B28 | attribute_reference (D15) for %TYPE/%ROWTYPE |
| B29 | D15 member chain for qualification |
| B30 | Type args = number_literal (+ CHAR/BYTE) |
| B31 | SYS_REFCURSOR ordinary name |
| B32 | exception_section wrapper |
| B33 | Do not enforce OTHERS last/unique |
| B34 | WHEN names = D15 name-site |
| B35 | Generic pragma only (D16) |
| B36 | statement catalog owned by 03-statements; block is one alternative |
| B37 | procedure_call_statement per D15 |
| B38 | Collection methods → statements area |
