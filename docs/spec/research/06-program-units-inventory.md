# Inventory: program-unit headers and clauses (Release 26)

**Ticket:** [Inventory: program-unit headers and clauses](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/9) · **Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)

**Primary sources:** Oracle Database Release 26, *PL/SQL Language Reference* — SQL Statements for Stored PL/SQL Units and Language Elements pages listed in §12. Retrieved 2026-07-16.

**Licensing:** No Oracle prose, tables, or diagram text is copied. What follows is our own factual inventory, EBNF-ish sketches reviewed against the published railroad diagrams (via Oracle’s `img_text` alt descriptions), and Tree-sitter decision flags. See research licensing notes referenced from provenance README.

Local ground work: nested subprogram sketches in `docs/spec/research/02-blocks-declarations-inventory.md` §6; map destination Phase 6 units; script `/` and conditional compilation are other tickets.

---

## Scope of this inventory

Phase 6 surface — schema-level **CREATE** units and their headers/clauses:

| Unit | Covered |
|------|---------|
| `CREATE FUNCTION` | Header, property clauses, body / call_spec / aggregate |
| `CREATE PROCEDURE` | Header, property clauses, body / call_spec |
| `CREATE PACKAGE` | Spec: items, package function/procedure declarations |
| `CREATE PACKAGE BODY` | Body + optional initialize section |
| `CREATE TRIGGER` | Simple DML (statement/row), INSTEAD OF, compound, system |
| `CREATE TYPE` | ADT / subtype / varray / nested table specs |
| `CREATE TYPE BODY` | Method implementations, MAP/ORDER, constructors |
| Shared clauses | `AUTHID`, `ACCESSIBLE BY`, `SHARING`, `DEFAULT COLLATION`, `DETERMINISTIC`, `RESULT_CACHE`, `PIPELINED`, `PARALLEL_ENABLE`, `SHARD_ENABLE`, `SQL_MACRO`, `AGGREGATE USING` |
| Call specs | Java / C / MLE (module + inline) |
| **WRAPPED** | Opaque wrapped-source form |

**In scope as structure only (details deferred):**

- Nested / package-internal subprogram bodies reuse block `declare_section` + `body` — [Inventory: blocks and declarations](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/6)
- Statement lists inside bodies / timing-point sections — [Inventory: statements](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/7)
- Expression / SQL condition in `WHEN (condition)` — expressions + embedded SQL tickets
- Script terminator `/` and SQL\*Plus layer — [Decide: directives, pragmas, and script-layer design](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/15)

**Adjacent (named for scope clarity, not fully inventoried here):**

- `CREATE LIBRARY` (needed by C call specs) — thin DDL envelope if file-type claim includes it
- `CREATE MLE MODULE` — SQL/MLE surface; only the **call-spec** publish forms appear under FUNCTION/PROCEDURE
- `ALTER` / `DROP` unit statements — recompilation/admin; out of parse-for-editors core unless file-type claim expands

---

## 1. Shared CREATE preamble

**Sources:** Each `create_*` diagram; chapter intro for stored units.

```
create_or_replace_preamble =
    "CREATE"
    [ "OR" "REPLACE" ]
    [ "EDITIONABLE" | "NONEDITIONABLE" ]
    unit_keyword_path                  -- FUNCTION | PROCEDURE | PACKAGE [BODY] | TRIGGER | TYPE [BODY]
    [ "IF" "NOT" "EXISTS" ]
    ;
```

**Rules (semantic / diagram):**

- `OR REPLACE` and `IF NOT EXISTS` are **mutually exclusive**.
- `EDITIONABLE` / `NONEDITIONABLE` defaults to `EDITIONABLE` when omitted (semantic default).
- For package body / type body, if editionability is written it **must match** the corresponding specification.
- None of these `CREATE` statements may appear **inside** a PL/SQL block (they are SQL DDL for stored units).
- Client scripts usually terminate a unit with `/` on its own line (SQL\*Plus); that is **not** part of the PL/SQL railroad — see directives/script ticket.

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U1** | One `create_statement` choice vs separate `create_function` / `create_procedure` / … nodes | Highlights, outline, queries | Lock: 06-units |
| **U2** | Model `OR REPLACE` / `IF NOT EXISTS` / editionability as optional fields on a shared wrapper | Field convention | Lock: 06-units; #5 |
| **U3** | Require trailing `;` on CREATE units always; treat `/` as script-layer only | Same as B4 for blocks | Lock: 06-units; #15 |

---

## 2. CREATE FUNCTION

**Source:** CREATE FUNCTION → `create_function`, `plsql_function_source`.

```
create_function =
    "CREATE" [ "OR" "REPLACE" ] [ "EDITIONABLE" | "NONEDITIONABLE" ]
    "FUNCTION" [ "IF" "NOT" "EXISTS" ]
    plsql_function_source ;

plsql_function_source =
    [ schema "." ] function_name
    [ sharing_clause ]
    [ "(" parameter_declaration { "," parameter_declaration } ")" ]
    "RETURN" datatype
    { function_property }          -- zero or more, any order (diagram: choice repeat)
    ( "IS" | "AS" )
    ( [ declare_section ] body
    | call_spec
    | /* AGGREGATE form ends without separate body — see aggregate_clause */
    )
    ";" ;
```

### 2.1 Function properties (standalone CREATE)

From `plsql_function_source` diagram, each may appear zero or more times in any order:

| Property | Sketch | Notes |
|----------|--------|-------|
| `invoker_rights_clause` | `AUTHID` (`CURRENT_USER` \| `DEFINER`) | Invoker vs definer rights |
| `accessible_by_clause` | see §8 | Accessor list |
| `default_collation_clause` | `DEFAULT COLLATION` collation_option | Using_NLS_COMP etc. (identifier/string form) |
| `deterministic_clause` | `DETERMINISTIC` | |
| `shard_enable_clause` | `SHARD_ENABLE` | Sharding |
| `parallel_enable_clause` | see §8 | Optional partition streaming |
| `result_cache_clause` | see §8 | Optional `RELIES_ON` (deprecated-ish but diagrammed) |
| `aggregate_clause` | `AGGREGATE USING` [schema.] type | ODCI aggregate; usually with `PARALLEL_ENABLE` |
| `pipelined_clause` | see §8 | Includes polymorphic table functions |
| `sql_macro_clause` | see §8 | Scalar or table SQL macros |

**Body alternatives:**

1. **PL/SQL implementation:** optional `declare_section` + `body` (`BEGIN`…`END` [name] `;` nested inside — body production already carries its terminator pattern from block inventory; the unit-level `;` closes the CREATE).
2. **Call specification:** Java / C / MLE (§9).
3. **Aggregate:** `AGGREGATE USING implementation_type` supplies the ODCI implementation type; examples omit a PL/SQL body (`PARALLEL_ENABLE AGGREGATE USING SecondMaxImpl`).

Return `datatype` cannot carry length/precision/scale or `NOT NULL` (semantic); grammar may still accept a general `datatype` (recovery).

### 2.2 Nested / package function vs CREATE

| Context | Properties | Spec vs body |
|---------|------------|--------------|
| Nested (block) | `DETERMINISTIC` \| `PIPELINED` \| `PARALLEL_ENABLE` \| `RESULT_CACHE` only (diagram on nested function_declaration/definition) | decl ends `;`; def has `IS`/`AS` |
| Package spec | heading + `ACCESSIBLE BY` / deterministic / pipelined / shard / parallel / result_cache; ends `;` | No body |
| Package body | full definition with body or call_spec | Matches heading word-for-word |
| CREATE standalone | full property set incl. `AUTHID`, collation, `SHARING`, `SQL_MACRO`, `AGGREGATE` | Body or call_spec |

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U4** | Property bag: ordered choice-repeat vs free `repeat(property)` without mutual-exclusion | Conflicts rare; recovery vs fidelity | Lock: 06-units; #5 |
| **U5** | `AGGREGATE USING` as function body alternative vs trailing property before `IS`/`AS` | Examples often omit `IS` body | Lock: 06-units |
| **U6** | Return datatype: unconstrained-only vs general datatype node | Recovery | Lock: 06-units; #5 |
| **U7** | Share `function_heading` across nested/package/CREATE? | DRY vs CREATE-only clauses (`SHARING`, `SQL_MACRO`) | Lock: 06-units |

---

## 3. CREATE PROCEDURE

**Source:** CREATE PROCEDURE → `create_procedure`, `plsql_procedure_source`.

```
create_procedure =
    "CREATE" [ "OR" "REPLACE" ] [ "EDITIONABLE" | "NONEDITIONABLE" ]
    "PROCEDURE" [ "IF" "NOT" "EXISTS" ]
    plsql_procedure_source ;

plsql_procedure_source =
    [ schema "." ] procedure_name
    [ sharing_clause ]
    [ "(" parameter_declaration { "," parameter_declaration } ")" ]
    { default_collation_clause | invoker_rights_clause | accessible_by_clause }
    ( "IS" | "AS" )
    ( [ declare_section ] body | call_spec )
    ";" ;
```

**Note:** Standalone procedures do **not** take `DETERMINISTIC` / `PIPELINED` / `PARALLEL_ENABLE` / `RESULT_CACHE` / `SQL_MACRO` / `AGGREGATE` (those are function-side). Properties are collation, invoker rights, accessible-by, plus `SHARING`.

Nested procedures: **no** procedure properties (manual restriction). Package procedures: only `ACCESSIBLE BY` on the package-level declaration diagram.

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U8** | Separate procedure property set vs one over-permissive property bag for both functions and procedures | Highlight accuracy vs simpler grammar | Lock: 06-units |
| **U9** | Enforce “no properties on nested procedures” in grammar? | Fidelity vs recovery | Lock: 06-units; #5 |

---

## 4. CREATE PACKAGE / PACKAGE BODY

### 4.1 Package specification

**Source:** CREATE PACKAGE → `plsql_package_source`, `package_item_list`, package function/procedure declarations.

```
create_package =
    "CREATE" [ "OR" "REPLACE" ] [ "EDITIONABLE" | "NONEDITIONABLE" ]
    "PACKAGE" [ "IF" "NOT" "EXISTS" ]
    plsql_package_source ;

plsql_package_source =
    [ schema "." ] package_name
    [ sharing_clause ]
    { default_collation_clause | invoker_rights_clause | accessible_by_clause }
    ( "IS" | "AS" )
    package_item_list
    "END" [ package_name ]
    ";" ;

package_item_list =
    package_item { package_item } ;

package_item =
      type_definition
    | cursor_declaration          -- forward cursor specs in package
    | item_declaration
    | package_function_declaration
    | package_procedure_declaration
    ;

package_function_declaration =
    function_heading
    { accessible_by_clause
    | deterministic_clause
    | pipelined_clause
    | shard_enable_clause
    | parallel_enable_clause
    | result_cache_clause
    }
    ";" ;

package_procedure_declaration =
    procedure_heading
    [ accessible_by_clause ]
    ";" ;
```

**Restrictions (semantic):**

- `PRAGMA AUTONOMOUS_TRANSACTION` must not appear in the package specification item list.
- Every public declaration (except polymorphic table functions) needs a matching definition in the body; headings must match “word for word” (whitespace-insensitive).
- Package polymorphic table functions: declared in same package as implementation package (semantic).

### 4.2 Package body

```
create_package_body =
    "CREATE" [ "OR" "REPLACE" ] [ "EDITIONABLE" | "NONEDITIONABLE" ]
    "PACKAGE" "BODY" [ "IF" "NOT" "EXISTS" ]
    plsql_package_body_source ;

plsql_package_body_source =
    [ schema "." ] package_name
    [ sharing_clause ]
    ( "IS" | "AS" )
    declare_section
    [ initialize_section ]
    "END" [ package_name ]
    ";" ;

initialize_section =
    "BEGIN"
    statement { statement }
    [ "EXCEPTION" exception_handler { exception_handler } ]
    ;
```

**Notes:**

- Package body has **no** invoker-rights / accessible-by / collation on the body header (those live on the specification). Diagram allows `sharing_clause` only among the “extra” clauses.
- `declare_section` here holds private items **and** the public subprogram **definitions** (same declare-section productions as blocks — function_definition / procedure_definition / cursors / …).
- `initialize_section` is a body without a trailing `END` of its own — the package `END` closes both. Diagram: `BEGIN` statements `[EXCEPTION handlers]` then package `END`.
- `PRAGMA AUTONOMOUS_TRANSACTION` banned in package body declare section as well (semantic).

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U10** | Package body: reuse block `declare_section` + special `initialize_section` vs one package-specific list | Node reuse from Phase 2 | Lock: 06-units |
| **U11** | Initialize section: require statements ≥1; shape as `package_init` node | Outline / queries | Lock: 06-units |
| **U12** | Package item list: allow pragma / nested freely (recovery) vs package_item_list only | AUTONOMOUS_TRANSACTION ban is semantic | Lock: 06-units; #5; #15 |
| **U13** | `END` optional name: field `end_name` shared with blocks | Consistency with B2 | Lock: 06-units |

---

## 5. CREATE TRIGGER

**Source:** CREATE TRIGGER → `plsql_trigger_source` and subordinate diagrams.

```
create_trigger =
    "CREATE" [ "OR" "REPLACE" ] [ "EDITIONABLE" | "NONEDITIONABLE" ]
    "TRIGGER" [ "IF" "NOT" "EXISTS" ]
    plsql_trigger_source ;

plsql_trigger_source =
    [ schema "." ] trigger_name
    [ sharing_clause ]
    [ default_collation_clause ]
    ( simple_dml_trigger
    | instead_of_dml_trigger
    | compound_dml_trigger
    | system_trigger
    ) ;
```

### 5.1 Simple DML trigger (statement or row)

```
simple_dml_trigger =
    ( "BEFORE" | "AFTER" )
    dml_event_clause
    [ referencing_clause ]
    [ "FOR" "EACH" "ROW" ]          -- presence ⇒ row trigger; absence ⇒ statement
    [ trigger_edition_clause ]
    [ trigger_ordering_clause ]
    [ "ENABLE" | "DISABLE" ]
    [ "WHEN" "(" condition ")" ]    -- requires FOR EACH ROW (semantic)
    trigger_body ;

dml_event_clause =
    dml_event { "OR" dml_event }
    "ON" [ schema "." ] ( table | view ) ;

dml_event =
      "DELETE"
    | "INSERT"
    | "UPDATE" [ "OF" column { "," column } ]
    ;
```

### 5.2 INSTEAD OF DML trigger

```
instead_of_dml_trigger =
    "INSTEAD" "OF"
    ( "DELETE" | "INSERT" | "UPDATE" )
    { "OR" ( "DELETE" | "INSERT" | "UPDATE" ) }
    "ON"
    [ "NESTED" "TABLE" nested_table_column "OF" ]
    [ schema "." ] noneditioning_view
    [ referencing_clause ]
    [ "FOR" "EACH" "ROW" ]          -- documentation only; always row-level
    [ trigger_edition_clause ]
    [ trigger_ordering_clause ]
    [ "ENABLE" | "DISABLE" ]
    trigger_body ;
```

### 5.3 Compound DML trigger

```
compound_dml_trigger =
    "FOR" dml_event_clause
    [ referencing_clause ]
    [ trigger_edition_clause ]
    [ trigger_ordering_clause ]
    [ "ENABLE" | "DISABLE" ]
    [ "WHEN" "(" condition ")" ]
    compound_trigger_block ;

compound_trigger_block =
    "COMPOUND" "TRIGGER"
    [ declare_section ]
    timing_point_section { timing_point_section }
    "END" [ trigger_name ]
    ";" ;

timing_point_section =
    timing_point "IS"
    "BEGIN" tps_body
    "END" timing_point
    ";" ;

timing_point =
      "BEFORE" "STATEMENT"
    | "BEFORE" "EACH" "ROW"
    | "AFTER" "STATEMENT"
    | "AFTER" "EACH" "ROW"
    | "INSTEAD" "OF" "EACH" "ROW"   -- noneditioning view only
    ;

tps_body =
    statement { statement }
    [ "EXCEPTION" exception_handler { exception_handler } ] ;
```

### 5.4 System trigger (DDL / database events)

```
system_trigger =
    ( "BEFORE" | "AFTER" | "INSTEAD" "OF" )
    ( ddl_event { "OR" ddl_event }
    | database_event { "OR" database_event }
    )
    "ON" ( [ schema "." ] "SCHEMA" | [ "PLUGGABLE" ] "DATABASE" )
    [ trigger_ordering_clause ]
    [ "ENABLE" | "DISABLE" ]
    trigger_body ;
```

**DDL events (keyword inventory):** `ALTER`, `ANALYZE`, `ASSOCIATE STATISTICS`, `AUDIT`, `COMMENT`, `CREATE`, `DISASSOCIATE STATISTICS`, `DROP`, `GRANT`, `NOAUDIT`, `RENAME`, `REVOKE`, `TRUNCATE`, `DDL` (catch-all).

**Database events (keyword inventory):** `STARTUP`, `SHUTDOWN`, `DB_ROLE_CHANGE`, `SERVERERROR`, `LOGON`, `LOGOFF`, `SUSPEND`, `CLONE`, `UNPLUG`, `SET CONTAINER` — each with allowed BEFORE/AFTER constraints (semantic; grammar can accept the keyword phrases).

### 5.5 Shared trigger clauses

```
referencing_clause =
    "REFERENCING"
    { ( "OLD" | "NEW" | "PARENT" ) [ "AS" ] name } ;

trigger_edition_clause =
    ( "FORWARD" | "REVERSE" ) "CROSSEDITION" ;

trigger_ordering_clause =
    ( "FOLLOWS" | "PRECEDES" )
    [ schema "." ] trigger_name
    { "," [ schema "." ] trigger_name } ;

trigger_body =
      plsql_block
    | "CALL" routine_clause          -- SQL CALL target; opaque or name path
    ;
```

**Notes:**

- `WHEN (condition)` is a **SQL** condition (no colon before `NEW`/`OLD`/`PARENT` in the condition); subqueries and PL/SQL expressions banned (semantic).
- Crossedition: `NONEDITIONABLE` forbidden; view targets restricted.
- Compound trigger declare section cannot include `PRAGMA AUTONOMOUS_TRANSACTION`.
- Trigger body declare section cannot declare `LONG` / `LONG RAW` variables.

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U14** | Four trigger kinds as separate nodes vs one `create_trigger` with variant field | Outline / folding | Lock: 06-units |
| **U15** | `FOR EACH ROW` as presence flag field vs dedicated row/statement node types | Query simplicity | Lock: 06-units |
| **U16** | `WHEN (condition)`: full SQL expr subset vs opaque until embedded-SQL lock | Phase 5 coupling | Lock: 06-units; #14 |
| **U17** | Compound timing points: multi-word keywords as single tokens vs word sequences | Lexer keyword load | Lock: 06-units; #12 |
| **U18** | System DDL/database event keywords: closed enum vs identifier | Completeness vs future events | Lock: 06-units |
| **U19** | `CALL routine_clause` depth (name only vs full SQL CALL) | Boundary with SQL | Lock: 06-units; #14 |
| **U20** | `REFERENCING` correlation names: special nodes for `:OLD` / `:NEW` in body vs ordinary names | Expressions inventory | Lock: 06-units; #8; #13 |

---

## 6. CREATE TYPE / TYPE BODY

### 6.1 CREATE TYPE

**Source:** CREATE TYPE → `plsql_type_source`, object/varray/nested specs.

```
create_type =
    "CREATE" [ "OR" "REPLACE" ] [ "EDITIONABLE" | "NONEDITIONABLE" ]
    "TYPE" [ "IF" "NOT" "EXISTS" ]
    plsql_type_source ;

plsql_type_source =
    [ schema "." ] type_name
    [ "FORCE" ]
    [ "OID" string_literal ]          -- object identifier string
    [ sharing_clause ]
    [ default_collation_clause ]
    { invoker_rights_clause | accessible_by_clause }
    ( object_base_type_def | object_subtype_def )
    ";" ;

object_base_type_def =
    ( "IS" | "AS" )
    ( object_type_def | varray_type_spec | nested_table_type_spec ) ;

object_type_def =
    "OBJECT"
    "("
        attribute datatype { "," attribute datatype }
        { "," element_spec }
    ")"
    { [ "NOT" ] ( "FINAL" | "INSTANTIABLE" | "PERSISTABLE" ) } ;

object_subtype_def =
    "UNDER" [ schema "." ] supertype
    "("
        { attribute datatype }
        { "," element_spec }
    ")"
    { [ "NOT" ] ( "FINAL" | "INSTANTIABLE" ) } ;   -- PERSISTABLE inherited

varray_type_spec =
    ( "VARRAY" | [ "VARYING" ] "ARRAY" )
    "(" size_limit ")"
    "OF" datatype [ "NOT" "NULL" ]
    [ [ "NOT" ] "PERSISTABLE" ] ;
    -- R26 diagram also allows parenthesized datatype forms when PERSISTABLE present

nested_table_type_spec =
    "TABLE" "OF" datatype [ "NOT" "NULL" ]
    [ [ "NOT" ] "PERSISTABLE" ] ;
```

**Incomplete type:** `CREATE TYPE name;` style forward definition (name only) — used for mutually recursive types; confirm acceptance as empty source / name-only production (**U24**).

**Not in CREATE TYPE:** associative arrays (`INDEX BY`) — package/block only (blocks inventory).

### 6.2 Element specification (ADT methods in type spec)

**Source:** Element Specification.

```
element_spec =
    [ inheritance_clauses ]
    ( subprogram_spec | constructor_spec | map_order_function_spec )
    [ "," "PRAGMA" "RESTRICT_REFERENCES" ... ] ;   -- deprecated pragma form

inheritance_clauses =
    { [ "NOT" ] ( "OVERRIDING" | "FINAL" | "INSTANTIABLE" ) } ;

subprogram_spec =
    ( "MEMBER" | "STATIC" )
    ( procedure_spec | function_spec ) ;

procedure_spec =
    "PROCEDURE" name
    [ "(" parameter datatype { "," parameter datatype } ")" ]
    [ ( "IS" | "AS" ) call_spec ] ;

function_spec =
    "FUNCTION" name
    [ "(" parameter datatype { "," parameter datatype } ")" ]
    "RETURN" datatype
    [ ( "IS" | "AS" ) call_spec ] ;

constructor_spec =
    [ "FINAL" ] [ "INSTANTIABLE" ]
    "CONSTRUCTOR" "FUNCTION" datatype
    [ "(" [ "SELF" "IN" "OUT" datatype "," ]
          parameter datatype { "," parameter datatype } ")" ]
    "RETURN" "SELF" "AS" "RESULT"
    [ ( "IS" | "AS" ) call_spec ] ;

map_order_function_spec =
    ( "MAP" | "ORDER" ) "MEMBER" function_spec ;
```

Type-spec method signatures often use a **thinner** parameter form (`name datatype` without full `IN`/`OUT`/`NOCOPY`/`DEFAULT`) than standalone `parameter_declaration`. Confirm whether full formal-parameter syntax is accepted in practice (**U25**).

### 6.3 CREATE TYPE BODY

```
create_type_body =
    "CREATE" [ "OR" "REPLACE" ] [ "EDITIONABLE" | "NONEDITIONABLE" ]
    "TYPE" "BODY" [ "IF" "NOT" "EXISTS" ]
    plsql_type_body_source ;

plsql_type_body_source =
    [ schema "." ] type_name
    [ sharing_clause ]
    ( "IS" | "AS" )
    type_body_item { "," type_body_item }
    "END"
    ";" ;

type_body_item =
      subprog_decl_in_type
    | map_order_func_declaration ;

subprog_decl_in_type =
      proc_decl_in_type
    | func_decl_in_type
    | constructor_declaration ;

proc_decl_in_type =
    "PROCEDURE" name
    [ "(" parameter_declaration { "," parameter_declaration } ")" ]
    ( "IS" | "AS" )
    ( [ declare_section ] body | call_spec ) ;

func_decl_in_type =
    "FUNCTION" name
    [ "(" parameter_declaration { "," parameter_declaration } ")" ]
    "RETURN" datatype
    { invoker_rights_clause | accessible_by_clause | deterministic_clause
      | parallel_enable_clause | result_cache_clause }
    [ pipelined_clause ]
    ( "IS" | "AS" )
    ( [ declare_section ] body | call_spec ) ;

constructor_declaration =
    [ "FINAL" ] [ "INSTANTIABLE" ]
    "CONSTRUCTOR" "FUNCTION" datatype
    [ "(" [ "SELF" "IN" "OUT" datatype "," ]
          parameter datatype { "," parameter datatype } ")" ]
    "RETURN" "SELF" "AS" "RESULT"
    ( "IS" | "AS" )
    ( [ declare_section ] body | call_spec ) ;

map_order_func_declaration =
    ( "MAP" | "ORDER" ) "MEMBER" func_decl_in_type ;
```

**Note:** Type body item list is **comma-separated** in the R26 diagram (unlike package body declare section which is semicolon-terminated items). This is a high-stakes shape difference (**U26**).

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U21** | ADT / collection / subtype as separate top-level nodes | Outline | Lock: 06-units |
| **U22** | `[NOT] FINAL|INSTANTIABLE|PERSISTABLE` as flag fields | Highlighting | Lock: 06-units |
| **U23** | `OID` literal + `FORCE` support | Rare; recovery | Lock: 06-units |
| **U24** | Incomplete `CREATE TYPE name;` form | Mutual recursion | Lock: 06-units |
| **U25** | Type-spec params: thin `name type` vs full `parameter_declaration` | Conflicts / reuse | Lock: 06-units |
| **U26** | Type body: comma-separated methods vs semicolon-terminated | Must match R26 | Lock: 06-units |
| **U27** | `MEMBER`/`STATIC`/`CONSTRUCTOR`/`MAP`/`ORDER` keyword set | Lexer | Lock: 06-units; #12 |
| **U28** | `RESTRICT_REFERENCES` pragma: accept deprecated form? | Legacy corpus | Lock: 06-units; #4; #15 |

---

## 7. Formal parameters (shared)

**Source:** Formal Parameter Declaration (also blocks inventory §6.3).

```
parameter_declaration =
    name
    (
        [ "IN" ] datatype [ ( ":=" | "DEFAULT" ) expression ]
      | ( "OUT" | "IN" "OUT" ) [ "NOCOPY" ] datatype
    ) ;
```

- Default mode `IN` when mode omitted.
- Defaults only on IN branch (diagram).
- Inline constraints on formal datatypes disallowed (semantic) — same as **B24**.

Used by: CREATE FUNCTION/PROCEDURE, nested/package subprograms, type body methods. Type **spec** may use thinner form (**U25**).

---

## 8. Shared property clauses (detail)

### 8.1 Invoker rights

```
invoker_rights_clause = "AUTHID" ( "CURRENT_USER" | "DEFINER" ) ;
```

### 8.2 ACCESSIBLE BY

```
accessible_by_clause =
    "ACCESSIBLE" "BY"
    "(" accessor { "," accessor } ")" ;

accessor =
    [ unit_kind ] [ schema "." ] unit_name ;

unit_kind =
    "FUNCTION" | "PROCEDURE" | "PACKAGE" | "TRIGGER" | "TYPE" ;
```

- Optional unit_kind recommended to disambiguate same names.
- Accessor entities need not exist at compile time (semantic).
- Appears on function/procedure/package/type (and type body function decls per diagram).

### 8.3 SHARING

```
sharing_clause = "SHARING" "=" ( "METADATA" | "NONE" ) ;
```

Application-common objects (multitenant). Position: after unit name on function/procedure/package/package body/trigger/type/type body sources.

### 8.4 DEFAULT COLLATION

```
default_collation_clause = "DEFAULT" "COLLATION" collation_option ;
```

`collation_option` is a collation name (e.g. `USING_NLS_COMP`). Exact token form: identifier vs quoted — treat as name.

### 8.5 DETERMINISTIC / SHARD_ENABLE

```
deterministic_clause = "DETERMINISTIC" ;
shard_enable_clause  = "SHARD_ENABLE" ;
```

### 8.6 RESULT_CACHE

```
result_cache_clause =
    "RESULT_CACHE"
    [ "RELIES_ON" "(" [ data_source { "," data_source } ] ")" ] ;
```

`RELIES_ON` is historical (Oracle now auto-tracks dependencies); still in the R26 diagram — accept for corpus.

### 8.7 PIPELINED

```
pipelined_clause =
    "PIPELINED"
    (
        [ "USING" [ schema "." ] implementation_type ]
      | ( "ROW" | "TABLE" ) "POLYMORPHIC"
          [ "USING" [ schema "." ] implementation_package ]
    ) ;
```

Covers classic pipelined table functions and polymorphic table functions (PTF).

### 8.8 PARALLEL_ENABLE

```
parallel_enable_clause =
    "PARALLEL_ENABLE"
    [ "(" "PARTITION" argument "BY"
        ( "ANY"
        | ( "HASH" | "RANGE" ) "(" column { "," column } ")" [ streaming_clause ]
        | "VALUE" "(" column ")"
        )
      ")"
    ] ;

streaming_clause =
    ( "ORDER" | "CLUSTER" ) expr "BY" "(" column { "," column } ")" ;
```

### 8.9 AGGREGATE (ODCI)

```
aggregate_clause =
    "AGGREGATE" "USING" [ schema "." ] implementation_type ;
```

User-defined aggregates via ODCIAggregate interface type. Often combined with `PARALLEL_ENABLE`. Implementation lives in the type/type body, not in the function body.

### 8.10 SQL_MACRO

```
sql_macro_clause =
    "SQL_MACRO"
    [ "(" [ "TYPE" "=>" ] ( "SCALAR" | "TABLE" ) ")" ] ;
```

SQL macros (scalar/table); body returns a SQL text expression (semantic). Grammar: accept clause + ordinary function body.

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U29** | One generic `unit_property` node vs typed clause nodes | Field/query design | Lock: 06-units |
| **U30** | `PARALLEL_ENABLE` / `PIPELINED` full sub-syntax vs opaque from `(` / `USING` | Complexity vs fidelity | Lock: 06-units |
| **U31** | Keep `RELIES_ON` (yes for R26 fidelity) | Legacy | Lock: 06-units |
| **U32** | `SQL_MACRO` + body: special node or ordinary function | Editor understanding | Lock: 06-units |
| **U33** | `SHARING = …` equals token: separate from assignment `:=` | Lexer | Lock: 06-units; #3 |

---

## 9. Call specifications (Java / C / MLE)

**Source:** Call Specification.

```
call_spec =
      java_declaration
    | javascript_declaration
    | c_declaration ;

java_declaration =
    "LANGUAGE" "JAVA" "NAME" string_literal ;

javascript_declaration =
    "MLE"
    (
        "MODULE" [ schema "." ] module_name
        [ "ENV" [ env_schema "." ] env_name ]
        "SIGNATURE" string_literal
      | "LANGUAGE" language_name [ "PURE" ] mle_source
    ) ;

c_declaration =
    ( "LANGUAGE" "C" | "EXTERNAL" )
    ( [ "NAME" name ] "LIBRARY" lib_name
    | "LIBRARY" lib_name [ "NAME" name ]
    )
    [ "AGENT" "IN" "(" argument { "," argument } ")" ]
    [ "WITH" "CONTEXT" ]
    [ "PARAMETERS" "(" external_parameter { "," external_parameter } ")" ] ;
```

**MLE inline source:** examples use `AS MLE LANGUAGE JAVASCRIPT {{ … }}` — double-brace (or similar) delimited JavaScript body. Exact delimiter rules need a **scanner** decision analogous to q-strings (**U35**).

**Placement:** After `IS`/`AS` as alternative to `[declare_section] body` on CREATE FUNCTION/PROCEDURE and type methods. Call specs cannot appear inside ordinary nested blocks (manual).

**Related DDL:** `CREATE LIBRARY` for C libraries; `CREATE MLE MODULE` for module-backed JS — file-type claim decides whether to parse them fully or leave opaque.

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U34** | Call_spec: full three-way grammar vs single opaque `LANGUAGE`/`MLE`/`EXTERNAL` envelope | Effort vs coverage | Lock: 06-units |
| **U35** | MLE inline body delimiters (`{{`…`}}`): external scanner? | Same class as D9 q-strings | Lock: 06-units; scanner fog |
| **U36** | C `PARAMETERS` list depth | Rare; opaque OK? | Lock: 06-units |
| **U37** | Parse `CREATE LIBRARY` / `CREATE MLE MODULE` in v1? | File-type claim | Lock: 06-units; #10 |

---

## 10. WRAPPED units

**Source:** PL/SQL Source Text Wrapping / Wrapper utility examples (Release 26).

**Shape (own words):** After the CREATE header names the unit, the keyword `WRAPPED` (case-insensitive, typically written `wrapped`) introduces an **opaque payload**: lines of hexadecimal-ish / base64-ish text (starting commonly with `a000000`) until the statement terminator (`;` and/or script `/`).

```
-- Conceptual, not a railroad from CREATE FUNCTION page:
create_wrapped_unit =
    "CREATE" [ "OR" "REPLACE" ] …
    unit_kind_and_name
    "WRAPPED"
    wrapped_payload                 -- lexer: opaque until end of unit
    ;
```

**Wrappable units** (utility intro): stored PL/SQL units — functions, procedures, packages, package bodies, types, type bodies, triggers (confirm exact set in wrapping intro if locking requires).

**Editor implications:**

- Source is intentionally unreadable; parse tree should still expose unit kind + name when present before `WRAPPED`.
- Do **not** attempt to decode payload.
- Payload can contain almost any character class; safest is an external-scanner or “consume until `/` or EOF” rule.

### Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U38** | Accept WRAPPED form in v1 grammar? | Legacy dump files common | Lock: 06-units; #4; #10 |
| **U39** | Scanner strategy for wrapped payload (until `/` / blank line / EOF) | Correctness | Lock: 06-units; scanner fog |
| **U40** | Node: `wrapped_unit` with fields `unit_kind`, `name`, `payload` | Outline still works | Lock: 06-units |

---

## 11. Cross-cutting Tree-sitter concerns

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **U41** | Source file model: multiple CREATE units per file + anonymous blocks + SQL | Root rule `source_file` | Lock: 06-units; #10 |
| **U42** | Keyword pressure: unit headers add many multi-word keywords (`FOR EACH ROW`, `INSTEAD OF`, `PACKAGE BODY`, …) | Conflicts with #12 | Lock: 06-units; #12 |
| **U43** | Schema-qualified names: reuse reference strategy from #13 | Consistency | Lock: 06-units; #13 |
| **U44** | Error recovery between units (bad CREATE should not poison next) | Editor priority | Lock: 06-units; #5 |
| **U45** | `IS` vs `AS` single field everywhere | Same as B25 | Lock: 06-units |
| **U46** | Reuse nested function/procedure rules inside package/type body | DRY | Lock: 06-units; Lock: 02-blocks |

---

## 12. Sources and provenance ids

| Provenance id (proposed) | URL | Role |
|--------------------------|-----|------|
| `sql-statements-stored-units` | …/sql-statements-for-stored-plsql-units.html | Chapter index |
| `create-function` | …/CREATE-FUNCTION-statement.html | Standalone functions |
| `create-procedure` | …/CREATE-PROCEDURE-statement.html | Standalone procedures |
| `create-package` | …/CREATE-PACKAGE-statement.html | Package spec |
| `create-package-body` | …/CREATE-PACKAGE-BODY-statement.html | Package body |
| `create-trigger` | …/CREATE-TRIGGER-statement.html | All trigger kinds |
| `create-type` | …/CREATE-TYPE-statement.html | Type specs |
| `create-type-body` | …/CREATE-TYPE-BODY-statement.html | Type bodies |
| `function-declaration` | …/function-declaration-and-definition.html | Nested/package headings (existing) |
| `procedure-declaration` | …/procedure-declaration-and-definition.html | Nested/package (existing) |
| `formal-parameter` | …/formal-parameter-declaration.html | Params (existing) |
| `call-specification` | …/call-specification.html | Java/C/MLE |
| `accessible-by-clause` | …/ACCESSIBLE-BY-clause.html | Accessor lists |
| `invoker-rights-clause` | …/invokers_rights_clause.html | AUTHID |
| `sharing-clause` | …/SHARING-clause.html | SHARING= |
| `default-collation-clause` | …/DEFAULT-COLLATION-clause.html | Collation |
| `deterministic-clause` | …/DETERMINISTIC-clause.html | DETERMINISTIC |
| `result-cache-clause` | …/RESULT_CACHE-clause.html | RESULT_CACHE |
| `pipelined-clause` | …/PIPELINED-clause.html | PIPELINED / PTF |
| `parallel-enable-clause` | …/PARALLEL_ENABLE-clause.html | PARALLEL_ENABLE |
| `aggregate-clause` | …/AGGREGATE-clause.html | ODCI aggregates |
| `sql-macro-clause` | …/SQL_MACRO-clause.html | SQL macros |
| `shard-enable-clause` | …/SHARD_ENABLE-clause.html | SHARD_ENABLE |
| `element-specification` | …/element-specification.html | ADT elements |
| `plsql-wrapping` | …/wrapping-pl-sql-source-text-pl-sql-wrapper-utility.html | WRAPPED form |

Railroad alt-text paths under `…/img_text/*.html` were used to reconstruct sketches (retrieved 2026-07-16).

---

## 13. Decision flag index (U1–U46)

| Range | Theme |
|-------|--------|
| U1–U3 | Shared CREATE preamble / root file |
| U4–U9 | Function & procedure headers |
| U10–U13 | Package / package body |
| U14–U20 | Triggers |
| U21–U28 | Types / type bodies |
| U29–U33 | Shared property clauses |
| U34–U37 | Call specs / MLE / LIBRARY |
| U38–U40 | WRAPPED |
| U41–U46 | Cross-cutting |

### Hardest / likely lock-session agenda

1. **U14–U17** — Trigger variant shape + multi-word timing keywords  
2. **U26** — Type body comma separation vs package declare section  
3. **U34–U35** — Call_spec / MLE inline body fidelity vs opaque envelope  
4. **U38–U39** — Whether and how to parse WRAPPED (scanner)  
5. **U4 / U8 / U29** — Property bag modeling across unit kinds  
6. **U41** — Multi-unit source_file + recovery (**#5**, **#10**)  
7. **U16 / U19** — SQL condition and CALL boundary (**#14**)

### Recommended graduation

Create **Lock spec: 06-units.md** (grilling), blocked by this inventory (and ideally soft-blocked by recovery rubric **#5**, reference strategy **#13**, embedded SQL **#14**, publish/file-type **#10** for U37/U38/U41).

---

## 14. Comparison notes vs nested (blocks inventory)

| Topic | Nested (Phase 2) | CREATE (Phase 6) |
|-------|------------------|------------------|
| AUTHID / ACCESSIBLE BY / collation | Not on nested procs; limited on nested funcs | Full on standalone |
| SHARING / editionability / IF NOT EXISTS | N/A | Yes |
| SQL_MACRO / AGGREGATE / SHARD_ENABLE | Not in nested diagrams | CREATE FUNCTION |
| Package item declarations | N/A | Spec ends with `;`, body defines |
| Triggers / types | N/A | CREATE only |
| Body reuse | `declare_section` + `body` | Same productions |
| WRAPPED | N/A | CREATE only |

---

*End of inventory. Outcomes of U1–U46 belong in `docs/spec/06-units.md` when locked; this file stays the evidence base.*
