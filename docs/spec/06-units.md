# Spec: 06 — Program units (CREATE headers and root)

**Status:** Locked  
**Ticket:** [Lock spec: 06-units.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/24)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Locked:** 2026-07-16  

**Research (inputs, not re-decided here):**

- [Inventory: program-unit headers and clauses](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/9) → `docs/spec/research/06-program-units-inventory.md` (flags **U1–U46**)
- Cross-cutting: `docs/DESIGN-NOTES.md` (**D1**, **D3**, **D6**, **D7**, **D14–D20**; **D21** from this lock)

**Related tickets:** nested subprograms / flat declare / shared `body` → [Lock spec: 02-blocks.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/20) (**D18**); statements inside bodies → [Lock spec: 03-statements.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22); expressions / D15 names → [Lock spec: 04-expressions.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/26); trigger `WHEN` / SQL condition depth → **D7** + [Lock spec: 05-sql.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32); script `/` + generic pragma → **D16** / **D17** + [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34).

---

## 1. Scope

**In scope:** Phase 6 — schema-level **CREATE** program units and their headers/clauses; multi-unit **`source_file`** membership; property/call-spec/WRAPPED depth; trigger and type-body structural shapes; boundaries with nested subprograms, embedded SQL, and script `/`.

**Out of scope for this file:** implementing `grammar.js` / scanner; full statement/expression interiors (02–05); full SQL\*Plus surface beyond D17 peers; `CREATE LIBRARY` / `CREATE MLE MODULE` as first-class DDL (see U37); `ALTER`/`DROP` unit admin DDL; semantic validation (heading match, editionability match, property mutual exclusion).

---

## 2. Standing rules applied

| Decision | How it applies here |
|----------|---------------------|
| [D1](../DESIGN-NOTES.md#d1--grammar-name-and-node-naming) | Manual terms: `create_function`, `create_package_body`, `simple_dml_trigger`, … No keyword nodes; multi-word phrases are word sequences. |
| [D3](../DESIGN-NOTES.md#d3--supertypes-and-fields) | CREATE units are **top-level unit nodes** — not under `statement` or `declaration`. Nested/package subprogram **defs** remain `declaration` (D18). Fields: `name`, `end_name`, `parameters`, `return_type`, `body`, `declarations`, … |
| [D6](../DESIGN-NOTES.md#d6--wrapped-units) | WRAPPED payload opaque; outline-friendly unit kind + name (refined **D21** / U38–U40). |
| [D7](../DESIGN-NOTES.md#d7--embedded-sql) | Trigger `WHEN (condition)` reuses SQL/PL expression precision; trigger `CALL` stays thin (not full SQL CALL). |
| [D14](../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) | Claimed unit surface gets precise nodes; semantic bans not grammar-enforced; bad unit must not poison next top-level item. |
| [D15](../DESIGN-NOTES.md#d15--reference-ambiguity-strategy) | Schema-qualified unit names and CALL targets reuse postfix/name surface. |
| [D16](../DESIGN-NOTES.md#d16--pragma-shape-and-placement) | Deprecated `RESTRICT_REFERENCES` via generic pragma; package-item bans semantic only. |
| [D17](../DESIGN-NOTES.md#d17--minimal-script-layer) | `/` is top-level script peer, not part of CREATE production. |
| [D18](../DESIGN-NOTES.md#d18--block-shape-and-flat-declare-section) | Package body reuses flat `declare_section` + public `body` pieces; `initialize_section` is units-only. |
| [D21](../DESIGN-NOTES.md#d21--program-unit-create-surface) | Cross-cutting gist of this lock (separate CREATE nodes, typed clauses, multi-unit root, call_spec/WRAPPED depth). |

---

## 3. Decisions

### 3.1 Root and CREATE node shape (U1–U3, U41, U43–U44)

| ID | Lock |
|----|------|
| **U1** | **Separate public CREATE nodes** — not one `create_statement` mega-node: `create_function`, `create_procedure`, `create_package`, `create_package_body`, `create_trigger`, `create_type`, `create_type_body`. Hidden `_create_*` factoring allowed. |
| **U2** | Preamble on **each** concrete unit as optional structure: `[ OR REPLACE ]`, `[ EDITIONABLE \| NONEDITIONABLE ]`, `[ IF NOT EXISTS ]` (placement per unit diagram). **No** public wrapper node. Mutual exclusion `OR REPLACE` vs `IF NOT EXISTS` is **semantic** only. |
| **U3** | CREATE units **require trailing `;`**. Line `/` is **script-layer only** (**D17**). |
| **U41** | **`source_file`** = `repeat` of top-level peers: the seven CREATE units (incl. wrapped forms), anonymous **`block`**, and D17 script peers (`/`, minimal `SET DEFINE …`). Multiple units per file are normal. |
| **U43** | Schema-qualified names: **D15** name/postfix surface (`schema . name`), not a one-off path type. |
| **U44** | **D14 local recovery** between top-level items: a broken CREATE ends at `;` (or recoverable sync) so the next CREATE/block can still parse. Do not invent fake-valid headers. |

```
source_file =
    { top_level_item } ;

top_level_item =
      create_function | create_procedure
    | create_package | create_package_body
    | create_trigger | create_type | create_type_body
    | wrapped_unit                    -- see §3.7
    | block                           -- anonymous
    | script_slash | set_define_…     -- D17
    ;
```

### 3.2 Function / procedure headers and property bags (U4–U9, U29–U33, U45)

| ID | Lock |
|----|------|
| **U4 / U29** | **Typed clause nodes** (`invoker_rights_clause`, `accessible_by_clause`, `deterministic_clause`, `pipelined_clause`, `parallel_enable_clause`, `result_cache_clause`, `sql_macro_clause`, `aggregate_clause`, `sharing_clause`, `default_collation_clause`, `shard_enable_clause`, …). Parent uses **`repeat(choice(…))`** of the context-allowed set. **No** order or mutual-exclusion enforcement in the grammar. |
| **U8** | **Separate property sets:** function bag (full) vs procedure bag (collation / invoker rights / accessible-by / sharing only on CREATE procedure). Do **not** share one over-permissive bag. |
| **U9** | Nested procedures: **do not** hard-ban properties in grammar (manual forbids; recovery/D14). |
| **U5** | **`AGGREGATE USING`:** accept as **body alternative** (unit may end after aggregate clause without `IS`/`AS` body) **and** as a typed property among others before a normal body/call_spec when present. |
| **U6** | `RETURN` uses general **`datatype`** (reuse from blocks) — no grammar ban on length/precision/`NOT NULL`. |
| **U7** | Share **`function_heading` / `procedure_heading`** core (name, params, return) across nested / package / CREATE; CREATE wraps with preamble + CREATE-only clauses (`SHARING`, full property set, …). |
| **U30** | `PARALLEL_ENABLE` / `PIPELINED`: **structured keywords + opaque interior** from `(` or deep `USING` / partition streaming detail. |
| **U31** | Keep **`RELIES_ON`** under `result_cache_clause` (name list). |
| **U32** | `SQL_MACRO` = ordinary **`create_function`** + typed **`sql_macro_clause`** — not a separate unit kind. |
| **U33** | `SHARING = …` uses bare **`=`** (not `:=`). |
| **U45** | `IS` vs `AS`: **anonymous keywords**, no distinguishing field. |

**Sketch (own words):**

```
create_function =
    "CREATE" [ "OR" "REPLACE" ] [ "EDITIONABLE" | "NONEDITIONABLE" ]
    "FUNCTION" [ "IF" "NOT" "EXISTS" ]
    [ schema "." ] name
    [ sharing_clause ]
    [ "(" parameter_list ")" ]
    "RETURN" datatype
    { function_property }
    (
        ( "IS" | "AS" ) ( [ declare_section ] body | call_spec )
      | /* aggregate may already be in property bag and terminate */
    )
    ";" ;

function_property =
      invoker_rights_clause | accessible_by_clause | default_collation_clause
    | deterministic_clause | shard_enable_clause | parallel_enable_clause
    | result_cache_clause | aggregate_clause | pipelined_clause
    | sql_macro_clause
    ;
```

### 3.3 Package / package body (U10–U13, U46)

| ID | Lock |
|----|------|
| **U10** | Package body: reuse block **`declare_section`** (flat, **D18**) + optional named **`initialize_section`**. |
| **U11** | `initialize_section` = public node: `BEGIN` statements `[ EXCEPTION handlers ]` then package `END` closes. Grammar allows **≥0** statements (empty rare; recovery). |
| **U12** | Package **spec** items: choice of type / cursor / item / package function|procedure **declaration** (+ generic pragma peer). AUTONOMOUS_TRANSACTION bans **semantic**. |
| **U13** | Optional package `END` name → field **`end_name`** (same role as blocks). |
| **U46** | Nested/package **`function_definition` / `procedure_definition`** shared with **02-blocks**; CREATE standalone adds preamble + CREATE-only clauses. Alias only if public surface must unify (D1 sparingly). |

```
create_package_body =
    preamble "PACKAGE" "BODY" [ "IF" "NOT" "EXISTS" ]
    [ schema "." ] name
    [ sharing_clause ]
    ( "IS" | "AS" )
    declare_section
    [ initialize_section ]
    "END" [ end_name ]
    ";" ;

initialize_section =
    "BEGIN"
    { statement }                     -- ≥0 in grammar
    [ "EXCEPTION" exception_section ]
    ;
```

### 3.4 Triggers (U14–U20, U42)

| ID | Lock |
|----|------|
| **U14** | One **`create_trigger`**; four **child kinds**: `simple_dml_trigger`, `instead_of_dml_trigger`, `compound_dml_trigger`, `system_trigger`. |
| **U15** | Row vs statement = **optional `FOR EACH ROW`** presence — not separate row/statement node types. |
| **U16** | `WHEN ( condition )` reuses **D7 / D20** condition precision (expression ladder + SQL hooks); not a fully opaque blob. |
| **U17 / U42** | Multi-word timing and unit phrases as **word sequences** (`BEFORE` `STATEMENT`, `INSTEAD` `OF`, `FOR` `EACH` `ROW`, `PACKAGE` `BODY`, …) — **not** single mega-tokens. |
| **U18** | System DDL/database events: **closed keyword phrases** for R26 inventory list; unknown events → recovery, not free `identifier`. |
| **U19** | Trigger body `CALL`: thin **`call_trigger_body`** = `CALL` + D15 name/path (+ optional args if cheap). Not full SQL CALL. |
| **U20** | `REFERENCING` correlation names = ordinary identifiers. Body `:OLD`/`:NEW` via existing bind/name surface — **no** special correlation node type in this area. |

```
create_trigger =
    preamble "TRIGGER" [ "IF" "NOT" "EXISTS" ]
    [ schema "." ] name
    [ sharing_clause ] [ default_collation_clause ]
    (
        simple_dml_trigger
      | instead_of_dml_trigger
      | compound_dml_trigger
      | system_trigger
    ) ;

trigger_body =
      block
    | call_trigger_body
    ;

timing_point =
      "BEFORE" "STATEMENT" | "BEFORE" "EACH" "ROW"
    | "AFTER"  "STATEMENT" | "AFTER"  "EACH" "ROW"
    | "INSTEAD" "OF" "EACH" "ROW"
    ;
```

### 3.5 CREATE TYPE / TYPE BODY (U21–U28, U26)

| ID | Lock |
|----|------|
| **U21** | One **`create_type`**; **child kinds** for object ADT / varray / nested table / subtype / **incomplete**. |
| **U22** | `[NOT] FINAL \| INSTANTIABLE \| PERSISTABLE` as **anonymous keyword sequences** (optional thin `inheritance_clause` node if queries need a handle — not boolean fields inventing absent keywords). |
| **U23** | Accept optional **`FORCE`** and optional **`OID` string_literal**. |
| **U24** | Incomplete form **`CREATE TYPE [schema.]name ;`** is in. |
| **U25** | Type-spec method params: prefer **thin** `name datatype` per diagrams; type-body methods use full **`parameter_declaration`**. Specs may also accept full form for recovery. |
| **U26** | Type body item list is **comma-separated** (`type_body_item { "," type_body_item }`) — **do not** reuse package/block declare_section. |
| **U27** | `MEMBER` / `STATIC` / `CONSTRUCTOR` / `MAP` / `ORDER` as ordinary keywords / word sequences (`CONSTRUCTOR FUNCTION`, `MAP MEMBER`, …). |
| **U28** | `RESTRICT_REFERENCES` via generic **D16** pragma (optionally after element_spec) — no named production. |

```
create_type_body =
    preamble "TYPE" "BODY" [ "IF" "NOT" "EXISTS" ]
    [ schema "." ] name
    [ sharing_clause ]
    ( "IS" | "AS" )
    type_body_item { "," type_body_item }
    "END"
    ";" ;
```

### 3.6 Call specifications (U34–U37)

| ID | Lock |
|----|------|
| **U34** | Three named arms: **`java_call_spec`**, **`c_call_spec`**, **`mle_call_spec`** — structured **headers** (language + name path / library / module fields). Not one undifferentiated opaque blob from `LANGUAGE`/`MLE`/`EXTERNAL`. |
| **U35** | MLE inline `{{…}}` body = **opaque payload token**. Prefer **external scanner** if pure grammar cannot pair safely (same bar as D9). |
| **U36** | C `PARAMETERS (…)` = **opaque** (or thin name list if cheap). |
| **U37** | **`CREATE LIBRARY` / `CREATE MLE MODULE` out of v1 parse claim** (D11 file-types). Call-spec publish forms on FUNCTION/PROCEDURE remain in. |

```
call_spec =
      java_call_spec
    | c_call_spec
    | mle_call_spec
    ;

java_call_spec = "LANGUAGE" "JAVA" "NAME" string_literal ;

-- mle_call_spec: MODULE…SIGNATURE… | LANGUAGE … [PURE] mle_inline_payload
-- c_call_spec: LANGUAGE C | EXTERNAL + LIBRARY/NAME + optional opaque PARAMETERS
```

### 3.7 WRAPPED units (U38–U40; refines D6)

| ID | Lock |
|----|------|
| **U38** | **Accept WRAPPED in v1** (dumps / legacy). |
| **U39** | Payload = **opaque token** (scanner if needed) from after `WRAPPED` until unit end (`;` and/or script `/` / EOF — implementer closes consistently with D17). Do not decode. |
| **U40** | Public **`wrapped_unit`** (or per-CREATE optional wrapped form) with fields **`unit_kind`**, **`name`** (when present before `WRAPPED`), **`payload`**. Outline still works. |

---

## 4. Surface catalog (Phase 6 public names)

| Name | Kind | Notes |
|------|------|-------|
| `source_file` | root | Multi-unit + block + D17 peers |
| `create_function` | unit | U1 |
| `create_procedure` | unit | U1 |
| `create_package` | unit | U1 |
| `create_package_body` | unit | U1 |
| `create_trigger` | unit | U1; child kinds below |
| `create_type` | unit | U1; child kinds below |
| `create_type_body` | unit | U1; comma list U26 |
| `wrapped_unit` | unit | U40; may factor with CREATE paths |
| `simple_dml_trigger` | named | under create_trigger |
| `instead_of_dml_trigger` | named | |
| `compound_dml_trigger` | named | |
| `system_trigger` | named | |
| `initialize_section` | named | package body only |
| `function_heading` / `procedure_heading` | named | shared core U7 |
| `function_definition` / `procedure_definition` | declaration | reuse 02-blocks U46 |
| `parameter_list` / `parameter_declaration` | named | D3 lists; type-spec may use thin form U25 |
| `invoker_rights_clause` | clause | typed property U29 |
| `accessible_by_clause` | clause | |
| `sharing_clause` | clause | `SHARING` `=` … |
| `default_collation_clause` | clause | |
| `deterministic_clause` | clause | |
| `pipelined_clause` | clause | opaque interior U30 |
| `parallel_enable_clause` | clause | opaque interior U30 |
| `result_cache_clause` | clause | incl. RELIES_ON U31 |
| `sql_macro_clause` | clause | U32 |
| `aggregate_clause` | clause | U5 |
| `shard_enable_clause` | clause | |
| `java_call_spec` / `c_call_spec` / `mle_call_spec` | named | U34 |
| `call_trigger_body` | named | U19 |
| `type_body_item` | named | comma-separated U26 |
| `referencing_clause` | named | U20 |
| `trigger_ordering_clause` | named | FOLLOWS/PRECEDES |
| `timing_point_section` | named | compound trigger |

**Not public unit nodes (v1):** `create_library`, `create_mle_module` (U37).

**Supertype:** CREATE/wrapped units stay **ordinary unit nodes** (D3 — no `unit` supertype in v1). Nested/package subprogram defs remain under **`declaration`**.

**Core fields (D3):** `name`, `end_name`, `parameters`, `return_type`, `body`, `declarations` / declare_section, `payload` (wrapped/MLE), optional marker fields only when structure requires (prefer presence of clause nodes over boolean fields).

---

## 5. Deferred / out of scope

| Item | Where |
|------|--------|
| Nested subprogram interiors, flat declare, shared `body` detail | [02-blocks.md](02-blocks.md) / **D18** |
| Statement lists / procedure call | [03-statements.md](03-statements.md) / **D19** |
| Expression ladder / name chain | [04-expressions.md](04-expressions.md) / **D15** / **D20** |
| SQL condition / SELECT depth | [05-sql.md](05-sql.md) / **D7** |
| Script `/`, SET DEFINE, pragma catalog | [07-directives](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34) / **D16** / **D17** |
| Scanner implementation for MLE `{{…}}` / WRAPPED payload | Implementation; grow D9 scanner only if pure grammar fails (U35/U39) |
| CREATE LIBRARY / MLE MODULE / ALTER / DROP | Out of v1 claim (U37) |
| Semantic heading match, editionability match, property exclusivity | Never grammar |
| Queries (highlights/locals/injections/tags) | [08-queries.md](08-queries.md) / **D23** |
| `grammar.js` implementation | Execution after map |

---

## 6. Implementation hand-off (Phase 6)

1. Root: `source_file` as `repeat` of CREATE units, `wrapped_unit`, `block`, D17 script peers.  
2. Seven `create_*` public rules with optional preamble fields; trailing `;` required.  
3. Typed property clause nodes; separate function vs procedure `repeat(choice)` bags; free order.  
4. Share `function_heading` / `procedure_heading` and package-body definitions with 02-blocks; package body = `declare_section` + optional `initialize_section` + `END` [`end_name`].  
5. `create_trigger` with four child kinds; multi-word timing as sequences; closed system-event phrases; thin `CALL` body; `WHEN` uses shared `condition`/`expression`.  
6. `create_type` child kinds incl. incomplete; `create_type_body` **comma**-separated `type_body_item` list — never declare_section.  
7. Three `*_call_spec` arms with thin headers; opaque MLE/C parameters/payloads; no LIBRARY/MLE MODULE CREATE.  
8. `wrapped_unit` with kind + name + opaque payload (scanner if pure grammar insufficient).  
9. Recovery: prefer local ERROR inside one unit so the next top-level item still parses (U44 / D14).  
10. Corpus seeds: multi-unit file; OR REPLACE / IF NOT EXISTS; function with mixed property order; AGGREGATE without IS body; package body with init; all four trigger kinds; compound timing points; incomplete type; type body with commas; Java/C/MLE call_spec stubs; WRAPPED sample; broken CREATE then valid CREATE recovery smoke.
