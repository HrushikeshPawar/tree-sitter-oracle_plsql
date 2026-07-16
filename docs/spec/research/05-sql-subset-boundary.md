# Embedded SQL subset boundary (D7 lock)

**Ticket:** [Decide: embedded SQL subset boundary](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14)  
**Status:** Locked 2026-07-16  
**Applies:** Phase 5 / `docs/spec/05-sql.md` lock; all SQL call-sites in blocks, statements, units, expressions  
**Rubric:** [D14](../../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) · consumer priority: both equally

---

## 1. Architecture

| Decision | Lock |
|----------|------|
| Modeling | **Native** in `oracle_plsql` — **not** tree-sitter language injection |
| Depth philosophy | **Structured spine + opaque interior** (may deepen interiors later without flipping native) |
| Beyond subset | **Fail locally** (`ERROR` / `MISSING`) — never fake-valid full SQL |
| Frequency | Core **IN** catalog is firm; **OUT → IN** or opaque → precise promotions are **provisional** until [Census: legacy corpus construct frequencies](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4) |

This is **not** a full Oracle SQL grammar (map out of scope).

---

## 2. IN — claimed surface (v1)

### 2.1 Statement-level kinds

| Kind | Notes |
|------|--------|
| `INSERT` / `UPDATE` / `DELETE` / `MERGE` | Named DML statements under supertype `statement` ([D3](../../DESIGN-NOTES.md#d3--supertypes-and-fields)) |
| `SELECT INTO` / `SELECT … BULK COLLECT INTO` | PL/SQL-only select form; **not** interchangeable with nested select |
| TCL: `COMMIT` / `ROLLBACK` / `SAVEPOINT` / `SET TRANSACTION` | **Fully structured** (small surface) |
| `LOCK TABLE` | Thin spine |
| Collection mutators: `collection.DELETE` / `.EXTEND` / `.TRIM` | Statement forms; disambiguate DML `DELETE` via leading `.` member shape |

### 2.2 Nested select spine (no `INTO`)

Same select shape **without** `INTO` / `BULK COLLECT INTO`, used at:

- Explicit cursor query  
- `OPEN … FOR` static select  
- Iterator / classic cursor `FOR` with `(SELECT …)`  
- Subquery under **`EXISTS (subquery)`** and **`IN (subquery)`** in precise `WHERE` conditions  
- Expression-level subquery only when interior **starts with** a claimed query keyword (`SELECT` for v1; see OUT for `WITH`) — aligns with reference strategy ([D15](../../DESIGN-NOTES.md#d15--reference-ambiguity-strategy))

### 2.3 FORALL / dynamic SQL

| Form | Treatment |
|------|-----------|
| `FORALL` body | Reuses INSERT / UPDATE / DELETE / MERGE / `EXECUTE IMMEDIATE` spines |
| `EXECUTE IMMEDIATE` string | **PL/SQL statement**; string body **not** parsed as SQL |

### 2.4 Precise PL/SQL hooks (when present)

| Hook | Sites |
|------|--------|
| `INTO` / `BULK COLLECT INTO` **targets** | `SELECT INTO` only — **forbidden** on nested select |
| `RETURNING` / `RETURN` [`BULK COLLECT`] `INTO` **targets** | INSERT / UPDATE / DELETE (MERGE if claimed by form) |
| `WHERE CURRENT OF` **cursor** | UPDATE / DELETE (alongside or instead of predicate `WHERE` per manual shapes) |
| Record DML: `VALUES record` / `SET ROW = record` (and related) | INSERT / UPDATE |

---

## 3. Spine vs opaque (v1 depth)

| Region | Treatment |
|--------|-----------|
| Statement kind keywords + **targets** (name / schema-qualified name spine) | **Precise** |
| TCL full forms | **Precise** |
| Select list (`SELECT` [quantifier] … until `INTO`/`FROM`) | **Coarse** (one region; not per-column nodes) |
| `FROM` … until next clause keyword | **Opaque FROM-prefix** (joins / `ON` / comma-from live here) |
| Clause keywords after FROM-prefix | Keyword-led: `WHERE` / `GROUP` / `HAVING` / `ORDER` / `FETCH` / `FOR` / `;` / … |
| **`WHERE` condition** | **Precise** (see §4) |
| Clauses after `WHERE` (`GROUP BY`, `HAVING`, `ORDER BY`, `FETCH`, …) | **Opaque tail** |
| `SET` assignment lists | **Opaque** |
| `VALUES (…)` expression lists / subquery guts | **Opaque** |
| `MERGE` `USING` / `ON` / `WHEN` body | **Opaque** (only `MERGE [INTO] target` spine + hooks if any) |
| `LOCK TABLE` middle (table list / lock mode) | **Opaque** (end options may be precise if cheap) |

**Expansion policy:** later work may move rows from opaque → precise (or OUT → IN after census). That does not reopen “inject vs native.”

---

## 4. Precise `WHERE` condition (v1)

```
condition  ≈  PL/SQL expression / boolean ladder
           +  EXISTS ( nested_select )
           +  IN ( nested_select )
```

- Reuse the same expression precedence ladder as PL/SQL expressions (Phase 4 / expressions lock).  
- **`EXISTS` + `IN (subquery)` only** as SQL predicate extensions for v1.  
- Nested select = §2.2 spine (no `INTO`).

**Not v1 (OUT of precise condition, promote later if needed):**

- `ANY` / `ALL` / `SOME` (subquery)  
- Hierarchical `PRIOR`  
- Other SQL-only predicates not in the PL/SQL ladder  

---

## 5. OUT — not claimed in v1

No dedicated production; do not invent permissive rules that pretend these are valid claimed surfaces. Prefer localized recovery ([D14](../../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric)).

| Out item | Rationale |
|----------|-----------|
| Full Oracle SQL grammar | Map out of scope |
| Free-standing **DDL** (`CREATE`/`ALTER`/`DROP` table, …) as SQL statements | Not embedded PL/SQL DML subset |
| Standalone **`SELECT` statement** (no `INTO`) | Not a PL/SQL statement; nested sites only |
| **`WITH` / CTE** | Optional promotion after census |
| Deep structured joins, itemized select-list, structured `SET`, full MERGE arms | Depth expansion candidates, not v1 claim |
| Analytics / model clause / pivot / etc. as structure | Opaque tail or fail; not claimed nodes |
| Multi-value row constructor `(a, b, …)` as a free expression primary | Not claimed under this boundary; DML value lists stay inside opaque `VALUES` guts unless a later expressions decision forces a pure-PL/SQL primary |
| Language **injection** into an external SQL grammar | Rejected ([D7](../../DESIGN-NOTES.md#d7--embedded-sql) native) |

**Census proviso:** legacy scan may show OUT items that must become IN (or deepen). Revisit this document + [D7](../../DESIGN-NOTES.md#d7--embedded-sql); do not silently drop core IN.

---

## 6. Disambiguation sketch (for area locks)

| Clash | Direction |
|-------|-----------|
| `DELETE` DML vs `coll.DELETE` | Member / `.` before `DELETE` → collection mutator; else DML |
| `SELECT INTO` vs nested `SELECT` | Statement-start + `INTO` arm vs parenthesized / post-`FOR` / post-`IN` cursor contexts; nested must reject `INTO` |
| `OPEN … FOR` select vs dynamic string | Token after `FOR` (`SELECT` / `(` vs string / expression) |
| Subquery vs parenthesized expression | Interior starts with claimed query keyword (`SELECT`) |

Detail and node names land in `docs/spec/05-sql.md` and statements/expressions locks.

---

## 7. Decision index (for `05-sql` lock checklist)

1. Confirm keyword dispatch table (§2.1) and nested sites (§2.2).  
2. Implement spine/opaque split (§3) under [D1](../../DESIGN-NOTES.md#d1--grammar-name-and-node-naming)/[D3](../../DESIGN-NOTES.md#d3--supertypes-and-fields) naming.  
3. Wire `WHERE` condition production (§4) shared with expression ladder.  
4. Hooks (§2.4) as required fields when present.  
5. OUT list (§5) — recovery only; no fake nodes.  
6. Mark any census-sensitive cut **provisional** in the area spec.  
7. Corpus fixtures: one family per IN kind + WHERE EXISTS/IN + SELECT INTO + CURRENT OF + RETURNING INTO.

---

## 8. Map impact

- **Locks [D7](../../DESIGN-NOTES.md#d7--embedded-sql)** boundary (was “direction only”).  
- **Unblocks / feeds:** Lock `05-sql.md`; statements SQL flags (S16, S28, S30–S31, S34, S41–S43); blocks cursor query (B20); units trigger `WHEN` SQL (U16); expressions SQL-ish ops and subquery primary.  
- **Does not implement** grammar rules.
