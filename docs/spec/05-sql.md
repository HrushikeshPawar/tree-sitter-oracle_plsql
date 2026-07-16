# Spec: 05 — Embedded SQL subset

**Status:** Locked  
**Ticket:** [Lock spec: 05-sql.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Locked:** 2026-07-16  

**Research (inputs, not re-decided here):**

- [Decide: embedded SQL subset boundary](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14) → `docs/spec/research/05-sql-subset-boundary.md` (**D7** architecture + IN/OUT catalog)
- [Inventory: statements](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/7) → flags S16, S28–S31, S33–S34, S41–S43
- Cross-cutting: `docs/DESIGN-NOTES.md` (**D1**, **D3**, **D7**, **D14**, **D15**, **D19**, **D20**)

**Related tickets:** statement catalog / `sql_statement` envelope / SELECT INTO entry → [Lock spec: 03-statements.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22); expression ladder + `in_expression` + subquery primary → [Lock spec: 04-expressions.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/26); cursor `query` → [Lock spec: 02-blocks.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/20); units / trigger `WHEN` SQL → [Lock spec: 06-units.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24).

---

## 1. Scope

**In scope:** Phase 5 shapes for the **claimed** embedded-SQL subset — keyword dispatch, public node/field names, spine vs opaque regions (token-soup convention), precise `WHERE` + `EXISTS`/`IN` subquery hooks, PL/SQL DML hooks (`INTO` / `RETURNING` / `CURRENT OF` / record DML), nested `select_statement` sites, TCL + `LOCK TABLE`, OUT / fail-local policy, provisional census notes, and implementation hand-off.

**Out of scope for this file:** reopening native-vs-inject or the v1 IN/OUT *catalog* (locked **D7** / boundary doc); full Oracle SQL grammar; statement shells that only *embed* SQL (`FORALL`, `EXECUTE IMMEDIATE`, cursor FOR, OPEN/FETCH) beyond entry boundaries — those stay in 03-statements; expression precedence ladder (04); collection mutator statement shape (03); `grammar.js` implementation.

**Does not re-argue:** D7 modeling (native), core IN kinds, or OUT catalog unless census evidence forces a promotion (separate decision).

---

## 2. Standing rules applied

| Decision | How it applies here |
|----------|---------------------|
| [D1](../DESIGN-NOTES.md#d1--grammar-name-and-node-naming) | Manual terms: `select_into_statement`, `insert_statement`, `where_clause`, … No keyword nodes. One concept → one name across phases. |
| [D3](../DESIGN-NOTES.md#d3--supertypes-and-fields) | SQL DML / TCL / LOCK / SELECT INTO → supertype **`statement`** (or live under the 03 **`sql_statement` envelope** alternative — not a separate SQL *supertype*). Fields: `target`, `condition`, `query`, `cursor`, `name`, … |
| [D7](../DESIGN-NOTES.md#d7--embedded-sql) | Native spine+opaque; fail-local beyond subset; IN/OUT tables are inputs. This file **implements** the §7 checklist as concrete shapes. |
| [D14](../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) | Claimed surface → precise spine + named regions; OUT → local ERROR/MISSING; no fake-valid full SQL. |
| [D15](../DESIGN-NOTES.md#d15--reference-ambiguity-strategy) | Targets / names use postfix chain; subquery primary only when interior **starts with** claimed query keyword (`SELECT` for v1). |
| [D19](../DESIGN-NOTES.md#d19--statement-catalog-case-and-iterator) / [D20](../DESIGN-NOTES.md#d20--expression-precedence-and-surface) | Statement catalog + FORALL/OPEN FOR entries; expression ladder reused for `condition`. |

---

## 3. Decisions

### 3.1 Select: two public nodes (SQL1)

| ID | Lock |
|----|------|
| **SQL1** | **Two public nodes:** **`select_into_statement`** (PL/SQL statement; may carry INTO) and **`select_statement`** (nested spine; **never** free `INTO`). Shared **private** helpers for common regions. Matches **S30** and boundary §2. |

```
select_into_statement =
    "SELECT" [ select_quantifier ]
    select_list
    ( into_clause | bulk_collect_into_clause )   -- 03 shared helpers (S27)
    from_clause
    [ where_clause ]
    [ select_tail ]
    ";" ;

select_statement =
    "SELECT" [ select_quantifier ]
    select_list
    from_clause
    [ where_clause ]
    [ select_tail ] ;
    -- no INTO; terminator depends on embed site (often none; paren/keyword stop)
```

| Detail | Lock |
|--------|------|
| Quantifier | Optional **`ALL` / `DISTINCT` / `UNIQUE`** as keywords on the select node (or tiny `select_quantifier` child) — **outside** `select_list` |
| Bare `SELECT` at statement start without INTO | **OUT** — not a `statement` alternative; fail-local (**D7** / **D14**) |

### 3.2 Select regions and fields (SQL2)

| ID | Lock |
|----|------|
| **SQL2** | Named region children: **`select_list`** (coarse), **`from_clause`** (opaque after `FROM` until stop set), optional **`where_clause`** with field **`condition`**, optional **`select_tail`** (opaque remainder). No per-column or join structure in v1. |

| Region | Treatment | Stop set (illustrative) |
|--------|-----------|-------------------------|
| `select_list` | Coarse token soup | `INTO` / `BULK` / `FROM` (into form); `FROM` (nested) |
| `from_clause` | Opaque soup after `FROM` | `WHERE` / `GROUP` / `HAVING` / `ORDER` / `FETCH` / `FOR` / `;` / parent stop |
| `where_clause` | Precise: `WHERE` + **`condition`** | End of condition (next clause keyword / `;` / parent) |
| `select_tail` | Opaque soup for GROUP/HAVING/ORDER/FETCH/FOR UPDATE/… | `;` / parent terminator |

**INTO helpers (align 03 S27):** reuse public **`into_clause`** and **`bulk_collect_into_clause`** (not a single merged public node). Targets inside those clauses use the name / expression surface (field vocabulary: prefer **`targets`** for the comma-separated list, or unfielded repeat of target expressions — implementer picks one and stays consistent with FETCH).

### 3.3 Opaque / coarse representation (SQL3)

| ID | Lock |
|----|------|
| **SQL3** | Every opaque/coarse region is a **named node** whose interior is a **paren-aware token soup**: repeat of (non-stop tokens \| parenthesized groups \| string/number/bind tokens; comments via extras) until a **region-specific stop set**. Strings and nested parens do not false-stop on inner keywords. **No** external-scanner SQL blobs. **No** invented ERROR for unknown SQL *inside* soup — fail only when the outer claimed spine cannot close. |

**Deepening policy:** later opaque→precise work **replaces soup under the same node names** where possible (stable query targets).

### 3.4 DML spines (SQL4)

| ID | Lock |
|----|------|
| **SQL4** | Public nodes **`insert_statement`**, **`update_statement`**, **`delete_statement`**, **`merge_statement`**. Field **`target`** = name spine (D15) on all four. |

| Node | Precise spine | Opaque / hooks |
|------|----------------|----------------|
| `insert_statement` | `INSERT` [`INTO`] **target** | Opaque column list / `VALUES` guts / subquery guts; optional record-`VALUES` arm; optional **`returning_clause`** |
| `update_statement` | `UPDATE` **target** | Opaque `SET` list **except** precise record **`SET ROW =`** arm; optional **`where_clause`** **or** **`current_of_clause`**; optional **`returning_clause`** |
| `delete_statement` | `DELETE` [`FROM`] **target** | Optional **`where_clause`** **or** **`current_of_clause`**; optional **`returning_clause`** |
| `merge_statement` | `MERGE` [`INTO`] **target** | Entire USING/ON/WHEN body = opaque **`merge_body`**; RETURNING only if cheap later — not required v1 structure |

| Hook | Shape |
|------|--------|
| `where_clause` | Shared with select: `WHERE` + field **`condition`** |
| `current_of_clause` | `WHERE` `CURRENT` `OF` field **`cursor`** (name) — **sibling arm**, not stuffed into `condition` |
| `returning_clause` | `RETURNING` \| `RETURN` + coarse return-list soup + [ `BULK COLLECT` ] `INTO` targets; field shape aligned with **S33** / dynamic returning |
| Record DML | Precise mini-arms: `VALUES` **record** / `SET ROW =` **record** (expression/name) |

**`INSERT … SELECT`:** v1 keeps the select **inside opaque guts** — not a required public `select_statement` child (**provisional**; census may promote).

### 3.5 Precise `WHERE` / condition (SQL5)

| ID | Lock |
|----|------|
| **SQL5** | **`condition`** under `where_clause` **is** the Phase-4 **`expression`** ladder (**D20**) — not a separate type or forked precedence. SQL extensions at COMPARE / primary levels: |

| Form | Public node | Notes |
|------|-------------|--------|
| `EXISTS ( select_statement )` | **`exists_expression`** | New; embed `select_statement` |
| `[NOT] IN ( select_statement )` | **`in_expression`** | **Same** node as PL/SQL value-list `IN` (**04**); RHS alternatives: value list **or** **`query`** → `select_statement`. Compound `NOT IN` on the node (04 NOT policy). |
| Value-list `IN (a,b,c)` | `in_expression` | Owned by expressions; **not** multi-value row as free primary (D7 OUT) |

**OUT of precise condition (v1):** `ANY` / `ALL` / `SOME` (subquery), hierarchical `PRIOR`, other SQL-only predicates — fail-local; do not fake-accept as free forms (**E13 OUT** / **D7**).

**Subquery detection:** interior of `(…)` starts with claimed query keyword — v1 lead is **`SELECT`** only (`WITH` is OUT).

### 3.6 Nested `select_statement` sites (SQL6)

| Site | Embeds | Owner of *site* |
|------|--------|------------------|
| Explicit cursor `IS` / `AS` query | `select_statement` (field `query`) | 02-blocks (**B20**) |
| `OPEN … FOR` static query | `select_statement` | 03-statements (**S29** first-token) |
| Classic / iterator cursor `FOR` with `(SELECT …)` | `select_statement` | 03-statements / **D19** |
| `EXISTS` / `IN` subquery | `select_statement` | 05 + expression ladder |
| Expression-level `(SELECT …)` primary | `select_statement` | 04-expressions + **D15** |
| Opaque DML guts (`INSERT…SELECT`, etc.) | Not required public child | 05 opaque policy |

### 3.7 Statement keyword dispatch + envelope (SQL7)

| ID | Lock |
|----|------|
| **SQL7** | Keyword-led dispatch (**S41**). **`sql_statement`** is the **named statement alternative envelope** from 03 (not a D3 *supertype*). DML / TCL / LOCK (and optional mutator routing) live as choices under that envelope or as documented 03 placement. **`select_into_statement`** remains a **sibling** statement alternative (not under nested select). |

| Lead keyword(s) | Public node |
|-----------------|-------------|
| `SELECT` … `INTO` / `BULK COLLECT INTO` | `select_into_statement` |
| `INSERT` | `insert_statement` |
| `UPDATE` | `update_statement` |
| `DELETE` | `delete_statement` (after mutator disambiguation) |
| `MERGE` | `merge_statement` |
| `COMMIT` / `ROLLBACK` / `SAVEPOINT` / `SET TRANSACTION` | TCL nodes |
| `LOCK TABLE` | `lock_table_statement` |

| Related (not shaped here) | Lock |
|---------------------------|------|
| Collection mutators `.DELETE`/`.EXTEND`/`.TRIM` | Statement shape → **03** (`collection_method_statement` or under envelope). Disambiguation: leading `.` / member → mutator; else DML `DELETE`. |
| `FORALL` body | Reuses DML / `EXECUTE IMMEDIATE` — **03** / **S34** |
| `EXECUTE IMMEDIATE` | String body **not** parsed as SQL — **03** |

### 3.8 TCL + `LOCK TABLE` (SQL8)

| ID | Lock |
|----|------|
| **SQL8** | TCL **fully structured**; `LOCK TABLE` **thin spine**. |

| Node | Structure |
|------|-----------|
| `commit_statement` | `COMMIT` [ `WORK` ] [ `COMMENT` string ] [ `FORCE` … ] [ `WRITE` … ] — **precise optional arms**, not opaque tail |
| `rollback_statement` | `ROLLBACK` [ `WORK` ] [ `TO` [ `SAVEPOINT` ] **savepoint** ] [ `FORCE` string ] — field **`savepoint`** when TO present |
| `savepoint_statement` | `SAVEPOINT` field **`name`** |
| `set_transaction_statement` | `SET TRANSACTION` + **precise choice of arms** (READ ONLY / READ WRITE / ISOLATION LEVEL … / USE ROLLBACK SEGMENT name / NAME string, as R26 allows) |
| `lock_table_statement` | `LOCK TABLE` + opaque **`lock_table_body`** until `;` |

### 3.9 OUT / fail-local + provisional (SQL9)

| ID | Lock |
|----|------|
| **SQL9** | **OUT** items have **no** dedicated claimed productions. Prefer localized recovery (**D14**). Do not add permissive envelopes that make full SQL look intentional. |

**OUT (v1) — from D7, confirmed for this area:**

- Full Oracle SQL / free-standing DDL as SQL statements  
- Standalone **`SELECT` statement** (no INTO)  
- **`WITH` / CTE** as query lead  
- `ANY` / `ALL` / `SOME` / `PRIOR` / other SQL-only precise predicates  
- Deep structured joins, itemized select-list, structured SET, full MERGE WHEN arms  
- Multi-value row `(a,b,…)` as free expression primary  
- Language injection into an external SQL grammar  

**Provisional** until [Census: legacy corpus construct frequencies](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4):

- Opaque depth of FROM / SET / VALUES / MERGE body / select-list (may deepen under same names)  
- OUT→IN candidates: `WITH`/CTE, ANY/ALL/SOME, standalone SELECT-in-script if census demands  
- Whether `INSERT … SELECT` exposes a public `select_statement` child  

**Core IN kinds are firm** — not dropped without a new decision.

---

## 4. Surface catalog (Phase 5 public names)

| Name | Kind | Notes |
|------|------|-------|
| `select_into_statement` | statement | INTO / BULK COLLECT INTO via 03 helpers |
| `select_statement` | nested query spine | No INTO; embedded at SQL6 sites |
| `select_list` | named region | Coarse soup |
| `from_clause` | named region | Opaque soup |
| `where_clause` | named | field `condition` → expression |
| `select_tail` | named region | Opaque soup |
| `into_clause` / `bulk_collect_into_clause` | shared helpers | Owned with **03 S27**; used here |
| `insert_statement` / `update_statement` / `delete_statement` / `merge_statement` | under `sql_statement` / statement | field `target` |
| `merge_body` | named region | Opaque |
| `returning_clause` | named | Aligned with S33 |
| `current_of_clause` | named | field `cursor` |
| `exists_expression` | expression | `EXISTS ( select_statement )` |
| `in_expression` | expression | List **or** subquery RHS (04 + this) |
| `commit_statement` / `rollback_statement` / `savepoint_statement` / `set_transaction_statement` | TCL | Fully structured |
| `lock_table_statement` | statement | + `lock_table_body` opaque |
| `sql_statement` | statement envelope | Per **03 S1** — not a supertype |

Supertype membership: statement-shaped nodes → **`statement`**. `exists_expression` / extended `in_expression` → **`expression`**.

Keywords and operators remain **anonymous tokens** (D1).

---

## 5. Deferred / out of scope

| Item | Where |
|------|--------|
| Full statement catalog, FORALL / EXECUTE IMMEDIATE / OPEN FOR shells | [Lock spec: 03-statements.md](03-statements.md) |
| Expression PREC ladder, free-expression OUT set detail | [Lock spec: 04-expressions.md](04-expressions.md) / **D20** |
| Cursor declaration/definition wrappers | [Lock spec: 02-blocks.md](02-blocks.md) |
| Trigger `WHEN` / unit-level SQL hooks | [Lock spec: 06-units.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24) |
| Collection mutator statement production | 03-statements |
| Legacy frequency promotions | [Census: legacy corpus](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4) |
| Implementing `grammar.js` | Execution after map |

---

## 6. Implementation hand-off (Phase 5)

1. Add **`select_into_statement`** and **`select_statement`** with shared private region helpers; enforce no INTO on nested form (**SQL1**).  
2. Implement region nodes with **paren-aware token soup** and stop sets (**SQL2–SQL3**); quantifiers outside `select_list`.  
3. Wire DML four + MERGE opaque body; hooks `where_clause` / `current_of_clause` / `returning_clause` / record arms (**SQL4**).  
4. Reuse 03 **`into_clause`** / **`bulk_collect_into_clause`**; align returning with S33.  
5. Extend expression surface: **`exists_expression`**; **`in_expression`** subquery RHS; `where_clause.condition` = `expression` (**SQL5**).  
6. Export `select_statement` for cursor / OPEN FOR / iterator / EXISTS / IN / expr primary sites (**SQL6**).  
7. Keyword dispatch under **`sql_statement`** envelope + sibling `select_into_statement` (**SQL7**); mutator vs DML `DELETE` by member/`.` .  
8. Fully structured TCL; thin `LOCK TABLE` + `lock_table_body` (**SQL8**).  
9. **No** productions for OUT list; recovery only (**SQL9**).  
10. Corpus fixtures (one family each): INSERT / UPDATE / DELETE / MERGE; SELECT INTO + BULK COLLECT INTO; nested select at cursor + OPEN FOR + EXISTS + IN; WHERE with PL/SQL expr; CURRENT OF; RETURNING INTO; each TCL; LOCK TABLE; mutator DELETE vs DML DELETE; fail-local smoke for bare SELECT statement and WITH.

---

## 7. Decision index (SQL1–SQL9)

| ID | Resolution |
|----|------------|
| SQL1 | Two public select nodes: `select_into_statement` vs `select_statement` |
| SQL2 | Named regions: select_list / from_clause / where_clause / select_tail; condition field; 03 into helpers |
| SQL3 | Named-region paren-aware token soup; deepen under stable names |
| SQL4 | DML four + hooks; MERGE merge_body opaque; target field |
| SQL5 | condition ≡ expression; exists_expression; in_expression list\|subquery |
| SQL6 | Nested select site catalog |
| SQL7 | Keyword dispatch; sql_statement envelope (03); select_into sibling |
| SQL8 | TCL precise; LOCK TABLE thin opaque body |
| SQL9 | OUT fail-local; provisional census depth/promotions |

Boundary checklist (`05-sql-subset-boundary.md` §7): items 1–7 covered by SQL1–SQL9 + hand-off corpus list.

Non-obvious cross-cutting locks remain under **[D7](../DESIGN-NOTES.md#d7--embedded-sql)** (expanded with this area). No new D-number.
