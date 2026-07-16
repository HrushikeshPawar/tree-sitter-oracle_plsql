# Inventory: blocks and declarations (Release 26)

**Ticket:** [Inventory: blocks and declarations](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/6) · **Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)

**Primary source:** Oracle Database Release 26, *PL/SQL Language Reference* — "Block"  
<https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/block.html> (retrieved 2026-07-16)

**Supporting sources (declaration/type elements):** Language Elements pages for constant, scalar variable, exception, exception handler, explicit cursor, cursor variable, collection variable, record variable, `%TYPE`, `%ROWTYPE`, function/procedure declaration and definition, formal parameter, `EXCEPTION_INIT` pragma. Links in §9.

**Licensing:** No Oracle prose, tables, or diagram text is copied. What follows is our own factual inventory, EBNF-ish sketches reviewed against the published diagrams, and Tree-sitter decision flags. See `docs/oracle-plsql-release-26-grammar-research.md` §Licensing.

Local ground work: `grammar-ref.js` (block/declare ~319–588), `docs/DESIGN-NOTES.md` (D1, D3, D5–D7; pain points 1–4), `docs/ROADMAP.md` Phase 2.

---

## Scope of this inventory

Phase 2 surface from the roadmap:

- Anonymous / nested **blocks** (labels, `DECLARE`, `BEGIN`/`EXCEPTION`/`END`)
- **Declarations** in the declarative part: variables, constants, exceptions, cursors, cursor variables, collection/record types and variables, subtypes, nested subprogram specs/bodies
- **Exception handlers**
- Shape of **datatype** as used in declarations (not full expression grammar)

**In scope as structure only (details deferred):**

- Statement *list* inside `BEGIN` / handlers — inventory names the alternatives; individual statement syntax is [Inventory: statements](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/7)
- Nested subprogram **modifier clauses** (`DETERMINISTIC`, `PIPELINED`, …) — sketched; full unit-header clauses are [Inventory: program-unit headers](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/9)
- Embedded SQL *inside* cursor queries and SQL statements — [Decide: embedded SQL subset](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14)

**Out of this inventory:** CREATE unit wrappers, package/type body top-level layout, triggers, conditional compilation, script `/` (other phases/tickets).

---

## 1. PL/SQL block (anonymous and nested)

**Source:** Block → `plsql_block`, `declare_section`, `body`, `statement`. Provenance id: `block`.

### 1.1 Structure (own words)

A block has:

1. Zero or more **labels** (`<< name >>`)
2. Optional **declarative part** introduced by `DECLARE`
3. Required **body**: `BEGIN` … optional `EXCEPTION` … `END` [name] `;`

An **anonymous block** is itself an executable statement (may nest). Nested blocks appear as a `statement` alternative.

```
plsql_block =
    { label }
    [ "DECLARE" declare_section ]
    body ;

label =
    "<<" name ">>" ;

body =
    "BEGIN"
    statement { statement }
    [ "EXCEPTION" exception_handler { exception_handler } ]
    "END" [ name ]
    ";" ;
```

**Notes:**

- Declarations are local to the block; not visible to enclosing blocks.
- `END` optional name is the matching block label, or (for named units) the function/procedure/package name — semantic matching; grammar just accepts an optional identifier.
- Trailing `;` is part of `body` in the diagram (so nested blocks carry their own terminator).
- Body requires **one or more** statements (use `NULL;` for empty executable parts).

### 1.2 Labels

| Placement | Form | Notes |
|-----------|------|--------|
| Before block | `{ <<name>> }` | Undeclared identifier; unique for the block (semantic) |
| Before statement | `{ <<name>> }` | Multiple labels allowed on one statement |
| After `END` | optional `name` | Ties to label / unit name |

`GOTO` targets statement labels (Phase 3). Label delimiters `<<` `>>` are multi-char lexical units (see lexical inventory L1).

### 1.3 Tree-sitter decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B1** | Node shape: single `block` vs split `anonymous_block` / `nested_block` / body-only | Queryability; CREATE units reuse `body` | Lock: 02-blocks |
| **B2** | Field layout: `declare_section`, `statements`, `handlers`, `end_name`, `label` | DESIGN-NOTES D3 fields | Lock: 02-blocks |
| **B3** | Require ≥1 statement in `BEGIN` (manual) vs allow empty for recovery | Recovery rubric | Lock: 02-blocks; #5 |
| **B4** | Top-level anonymous block: require trailing `;` always; `/` is script-layer only | SQL\*Plus interaction | Directives/script |
| **B5** | Multiple labels as `repeat(label)` with field vs flattened | Editor navigation to labels | Lock: 02-blocks |

**Ref grammar:** `anonymous_block` = `declare_block` \| `begin_block` then `;`; `declare_block` starts with `DECLARE`; no multi-label on blocks; `end_name` optional. Salvage: basic three-part shape. Drop: `unterminated_select_statement` special case (legacy recovery — policy is error recovery, not a rule).

---

## 2. Declare section ordering

**Source:** Block → `declare_section`, `item_list_1`, `item_list_2`.

### 2.1 Two-list model (own words)

```
declare_section =
      item_list_1 [ item_list_2 ]
    | item_list_2 ;

item_list_1_item =
      type_definition
    | cursor_declaration          -- forward cursor spec (RETURN …; no query)
    | item_declaration
    | function_declaration        -- nested function spec
    | procedure_declaration       -- nested procedure spec
    ;

item_list_2_item =
      cursor_declaration
    | cursor_definition           -- CURSOR … IS select …
    | function_declaration
    | function_definition         -- with body / call_spec
    | procedure_declaration
    | procedure_definition
    ;

item_list_1 = item_list_1_item { item_list_1_item } ;
item_list_2 = item_list_2_item { item_list_2_item } ;
```

**Implication:** After the first nested subprogram **definition** or cursor **definition** (item_list_2-only constructs), you cannot go back to pure item_list_1 items (variables, type defs, exceptions, …). Specs of subprograms/cursors may appear in either list.

**Semantic restrictions (not grammar-enforced for a permissive editor grammar unless chosen):**

- `PRAGMA AUTONOMOUS_TRANSACTION` banned in some package/compound-trigger declare sections
- `LONG` / `LONG RAW` variables banned in some trigger bodies

### 2.2 Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B6** | Enforce item_list_1 → item_list_2 order strictly? | Manual fidelity vs recovery (misordered legacy code) | Lock: 02-blocks; #5 |
| **B7** | Flat `declaration` choice (ref style) vs two-phase lists | Simpler grammar if order is not enforced | Lock: 02-blocks |
| **B8** | Where do **pragmas** live? R26 `item_declaration` diagram **omits** them, but declarative pragmas (`EXCEPTION_INIT`, `AUTONOMOUS_TRANSACTION`, …) are real | Must accept `PRAGMA …;` in declare_section | Lock: 02-blocks; Phase 7 |

**Recommendation lean (not locked):** flat `declaration` choice including generic pragma (D-style Phase 7), **without** hard two-list enforcement in v1 — document order as preferred shape in corpus; use recovery for violations. Final call is B6/B7/B8.

---

## 3. Item declarations (variables, constants, exceptions, cursor vars)

**Sources:** item_declaration diagram; Constant / Scalar Variable / Exception / Cursor Variable / Collection Variable / Record Variable pages.

### 3.1 Item declaration alternatives

```
item_declaration =
      collection_variable_decl
    | constant_declaration
    | cursor_variable_declaration
    | exception_declaration
    | record_variable_declaration
    | variable_declaration   -- scalar
    ;
```

### 3.2 Scalar variable

```
variable_declaration =
    name datatype
    [ [ "NOT" "NULL" ] ( ":=" | "DEFAULT" ) expression ]
    ";" ;
```

- Initializer optional; if `NOT NULL` is present, an initializer is required (diagram groups them).
- `datatype` is any scalar type name with optional size/precision qualifiers (see §7).

### 3.3 Constant

```
constant_declaration =
    name "CONSTANT" datatype
    [ "NOT" "NULL" ]
    ( ":=" | "DEFAULT" ) expression
    ";" ;
```

- Initializer **required**.
- `CONSTANT` keyword is the sole disambiguator vs variable.

### 3.4 Exception

```
exception_declaration =
    name "EXCEPTION" ";" ;
```

- `EXCEPTION_INIT` associates error codes (pragma; §8). Not part of this production.

### 3.5 Cursor variable

```
cursor_variable_declaration =
    name datatype ";" ;
-- datatype is SYS_REFCURSOR or a user REF CURSOR type name
```

No initializer in the diagram. Package-spec public cursor variables are restricted (semantic).

### 3.6 Collection variable

```
collection_variable_decl =
    name
    (  assoc_array_type_name
         [ ":=" ( qualified_expression | function_call | collection_var ) ]
    |  ( varray_type_name | nested_table_type_name )
         [ ":=" ( collection_constructor | collection_var ) ]
    |  collection_var "%TYPE"
    )
    ";" ;
```

- Associative arrays may initialize from qualified expressions / function calls (18c+ style).
- Varray / nested table constructors and copy-from-same-type.
- `%TYPE` of another collection variable is a third form; the R26 `collection_variable_decl` diagram shows **no** declaration-time initializer on that form (only `:=` on named collection types — not `DEFAULT`).

### 3.7 Record variable

```
record_variable_declaration =
    name
    ( record_type_name
    | rowtype_attribute      -- name%ROWTYPE
    | record_var "%TYPE"
    )
    ";" ;
```

No declaration-time initializer in the R26 `record_variable_declaration` diagram (type / `%ROWTYPE` / `%TYPE` only). Field defaults live on `field_definition`. Declaration-time qualified expressions appear for **record constants** (`constant_declaration` with a record datatype), not this production.

### 3.8 Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B9** | Unified `variable_declaration` (name + type + optional CONSTANT/NOT NULL/default) vs separate constant/scalar/collection/record/cursor_var nodes | D1 naming vs fewer conflicts | Lock: 02-blocks |
| **B10** | `CONSTANT` as field/child vs separate rule | Highlighting + structure | Lock: 02-blocks |
| **B11** | Collection/record variable vs type definition disambiguation (`TYPE` keyword starts type defs) | First-token driven | Lock: 02-blocks |
| **B12** | Allow bare `NOT NULL` without default (illegal in Oracle) for recovery? | Recovery rubric | Lock: 02-blocks; #5 |

**Ref grammar:** single `variable_declaration` with optional `CONSTANT`, `declaration_modifier` (`NOT NULL` / bare `NULL` / `CONSTANT` — loose), `default_clause`. Salvage: unified shape. Drop: bare `NULL` as modifier (not in R26 scalar diagram).

---

## 4. Type definitions (collection, record, ref cursor, subtype)

**Source:** Block → `type_definition`, `subtype_definition`; Collection Variable; Record Variable; Cursor Variable pages.

### 4.1 Family

```
type_definition =
      collection_type_definition
    | record_type_definition
    | ref_cursor_type_definition
    | subtype_definition
    ;
```

`TYPE` keyword for collection/record/ref cursor; `SUBTYPE` for subtypes (still under `type_definition` in the block diagram).

### 4.2 Collection type

```
collection_type_definition =
    "TYPE" name "IS"
    ( assoc_array_type_def | varray_type_def | nested_table_type_def )
    ";" ;

assoc_array_type_def =
    "TABLE" "OF" datatype [ "NOT" "NULL" ]
    "INDEX" "BY"
    ( "PLS_INTEGER" | "BINARY_INTEGER"
    | "VARCHAR2" "(" size ")"
    | index_datatype                 -- %TYPE / %ROWTYPE forms; must resolve to PLS_INTEGER | BINARY_INTEGER | VARCHAR2(n) (semantic)
    ) ;

varray_type_def =
    ( "VARRAY" | [ "VARYING" ] "ARRAY" )
    "(" size_limit ")"
    "OF" datatype [ "NOT" "NULL" ] ;

nested_table_type_def =
    "TABLE" "OF" datatype [ "NOT" "NULL" ] ;
```

- **Associative array** = `TABLE OF … INDEX BY …` (block/package only; not CREATE TYPE).
- **Nested table** = `TABLE OF …` without `INDEX BY`.
- **INDEX BY** may use `%TYPE` / `%ROWTYPE` in the R26 diagram; semantics require the resolved type to be `PLS_INTEGER`, `BINARY_INTEGER`, or `VARCHAR2(n)` (not a record).
- **Varray** spellings in the R26 railroad: `VARRAY` or `[VARYING] ARRAY` (bare `ARRAY` is diagram-legal; whether the compiler accepts it is **B16**). Size is an integer literal (semantic range 1..2^31−1); grammar can accept a numeric expression/int token.
- Element type cannot be `REF CURSOR` (semantic); nested table also excludes `NCLOB` (semantic).

### 4.3 Record type

```
record_type_definition =
    "TYPE" name "IS" "RECORD"
    "(" field_definition { "," field_definition } ")"
    ";" ;

field_definition =
    name datatype
    [ [ "NOT" "NULL" ] ( ":=" | "DEFAULT" ) expression ]
    ;
```

Nested records and varray fields are just `datatype` recursion / named types.

### 4.4 REF CURSOR type

```
ref_cursor_type_definition =
    "TYPE" name "IS" "REF" "CURSOR"
    [ "RETURN" rowtype_return ]
    ";" ;

rowtype_return =
      ( table_or_view | cursor | cursor_variable ) "%ROWTYPE"
    | record_var "%TYPE"
    | record_type_name
    | ref_cursor_type_name      -- return type of another ref cursor type
    ;
```

- With `RETURN` → strong; without → weak.
- R26 diagram includes `ref_cursor_type` among `RETURN` alternatives (return type of another REF CURSOR type).
- `SYS_REFCURSOR` is a predefined weak type name (not defined with this production).

### 4.5 Subtype

```
subtype_definition =
    "SUBTYPE" name "IS" base_type
    [ constraint | "CHARACTER" "SET" character_set ]
    [ "NOT" "NULL" ]
    ";" ;
-- no trailing "TYPE" keyword (unlike TYPE … IS …).

constraint =
      precision [ "," scale ]
    | "RANGE" low ".." high     -- PLS_INTEGER family only (semantic)
    ;
```

- Manual: static expressions allowed in subtype declarations.
- R26 `subtype_definition` img_text omits the trailing `;` (unlike e.g. `constant_declaration`), but real subtype declarations are terminated like every other declarative item. Sketch includes `";"` for consistency; **B13 lean = required yes.**

### 4.6 Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B13** | Subtype trailing `;` required? | Diagram omits; real code needs it — **lean yes** (sketch includes) | Lock: 02-blocks |
| **B14** | One `type_declaration` node (`TYPE name IS …`) with `definition` field vs four top-level rules | D1 + queries | Lock: 02-blocks |
| **B15** | `TABLE OF` + optional `INDEX BY` as one production vs split assoc/nested | Shared prefix | Lock: 02-blocks |
| **B16** | Varray spellings: `VARRAY` / `VARYING ARRAY` / `ARRAY` | Completeness | Lock: 02-blocks |
| **B17** | `size_limit` / precision: int literal only vs expression | Static-expression surface | Lock: 02-blocks; expressions |
| **B18** | Supertype `type` / `declaration` (D3) membership | Editor queries | Lock: 02-blocks; #5 conventions |

**Ref grammar:** `type_declaration` → `type_definition` choice of record / table / varray / ref_cursor / **generic**. Salvage: four real forms. Drop: `generic_type_definition` catch-all (DESIGN-NOTES).

---

## 5. Explicit cursors

**Source:** Explicit Cursor Declaration and Definition.

### 5.1 Spec vs body

```
cursor_declaration =
    "CURSOR" name
    [ "(" cursor_parameter_dec { "," cursor_parameter_dec } ")" ]
    "RETURN" rowtype
    ";" ;

cursor_definition =
    "CURSOR" name
    [ "(" cursor_parameter_dec { "," cursor_parameter_dec } ")" ]
    [ "RETURN" rowtype ]
    "IS" select_statement
    ";" ;

cursor_parameter_dec =
    name [ "IN" ] datatype
    [ ( ":=" | "DEFAULT" ) expression ]
    ;

rowtype =   -- cursor RETURN form
      ( table_or_view | cursor | cursor_variable ) "%ROWTYPE"
    | record_var "%TYPE"
    | record_type_name
    ;
```

- **Declaration** always has `RETURN` and **no** `IS` query (forward spec).
- **Definition** has `IS select_statement`; `RETURN` optional if inferable.
- Cursor parameters are IN-only (optional `IN` keyword); datatype must be unconstrained (semantic).
- `select_statement` is SQL `SELECT` (not `SELECT INTO`); **no `WITH` clause** (manual restriction).
- Name `SQL` is reserved for the implicit cursor (semantic / reserved word).

### 5.2 Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B19** | Separate `cursor_declaration` vs `cursor_definition` nodes vs one rule with optional `IS` | Spec/body queries | Lock: 02-blocks |
| **B20** | Cursor query: full SQL select subset vs opaque until Phase 5 | Phase ordering | Lock: 02-blocks; #14 |
| **B21** | Enforce no `WITH` in cursor query? | Fidelity vs recovery | Lock: 02-blocks; #5 |
| **B22** | Parameter list shared with subprograms vs cursor-specific (IN-only) | Reuse vs precision | Lock: 02-blocks |

**Ref grammar:** one `cursor_declaration` with `IS` query always — no forward-spec form. **Gap:** forward `CURSOR c RETURN t;` is missing; add under B19.

---

## 6. Nested subprograms

**Sources:** Function / Procedure Declaration and Definition; Formal Parameter Declaration. Nested only (not CREATE).

### 6.1 Function

```
function_heading =
    "FUNCTION" name
    [ "(" parameter_declaration { "," parameter_declaration } ")" ]
    "RETURN" datatype ;

function_declaration =
    function_heading
    { "DETERMINISTIC" | "PIPELINED" | "PARALLEL_ENABLE" | "RESULT_CACHE" }
    ";" ;

function_definition =
    function_heading
    { "DETERMINISTIC" | "PIPELINED" | "PARALLEL_ENABLE"
      | "RESULT_CACHE" [ relies_on_clause ] }
    ( "IS" | "AS" )
    ( [ declare_section ] body | call_spec ) ;
```

### 6.2 Procedure

```
procedure_heading =
    "PROCEDURE" name
    [ "(" parameter_declaration { "," parameter_declaration } ")" ] ;

procedure_declaration =
    procedure_heading
    [ procedure_properties ]   -- standalone/package; nested: none
    ";" ;

procedure_definition =
    procedure_heading [ procedure_properties ]
    ( "IS" | "AS" )
    ( [ declare_section ] body | call_spec ) ;
```

**Nested restriction (semantic, may inform permissiveness):** procedure properties (`AUTHID`, `ACCESSIBLE BY`, collation, …) **cannot** appear on nested procedures. Nested functions may still list `DETERMINISTIC` / `PIPELINED` / `PARALLEL_ENABLE` / `RESULT_CACHE` per the nested-function diagrams.

### 6.3 Formal parameters

```
parameter_declaration =
    name
    (  [ "IN" ] datatype [ ( ":=" | "DEFAULT" ) expression ]
    |  ( "OUT" | "IN" "OUT" ) [ "NOCOPY" ] datatype
    ) ;
```

- Default mode is `IN` when mode omitted.
- Defaults only on the IN branch in the diagram (not on OUT / IN OUT).
- Formal datatype: constrained subtype OK; **inline** constraints like `NUMBER(2)` / `VARCHAR2(20)` are not allowed (semantic; grammar may still accept type args for recovery — B24).

### 6.4 Call specification

`call_spec` is an alternative to `[declare_section] body` after `IS`/`AS` (Java / C / MLE). Full surface is unit-header territory; for Phase 2, accept an opaque or coarse `LANGUAGE …` envelope (align with DESIGN-NOTES drop of ad-hoc external_call_spec detail).

### 6.5 Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B23** | Nested modifiers: allow full set vs strip properties for nested | Fidelity | Lock: 02-blocks; #9 |
| **B24** | Parameter types: forbid inline constraints vs permissive | Recovery | Lock: 02-blocks; #5 |
| **B25** | `IS` vs `AS` both accepted (yes) — single field `is_or_as`? | Node noise | Lock: 02-blocks |
| **B26** | `call_spec` opaque envelope depth | Phase 2 vs Phase 6 | Lock: 02-blocks; #9 |
| **B27** | Forward declaration + later definition: two nodes same name | Scoping / locals queries | Lock: 02-blocks; queries fog |

**Ref grammar:** procedure/function declaration and definition present; modifiers as `routine_modifier` repeat. Salvage. Nested declare reuses `declaration` list without two-list split.

---

## 7. Datatype and attributes (`%TYPE` / `%ROWTYPE`)

**Sources:** datatype diagram (on ADT element / datatype attribute pages); `%TYPE`; `%ROWTYPE`; used everywhere above.

### 7.1 Datatype (declaration-site)

```
datatype =
      collection_type_name
    | [ "REF" ] object_type_name
    | record_type_name
    | ref_cursor_type_name
    | rowtype_attribute
    | scalar_datatype
    | type_attribute
    ;
```

**Scalar datatype** (own words, declaration shape): named scalar (or subtype) with optional parenthesized precision/length, optional `CHAR`/`BYTE` length semantics, and multi-word forms (`TIMESTAMP [(n)] [WITH [LOCAL] TIME ZONE]`, `INTERVAL YEAR …`, `LONG RAW`, …). Exact token structure overlaps Phase 1 lexical + expression inventories.

### 7.2 `%TYPE`

```
type_attribute =
    (
        collection_variable
      | cursor_variable
      | table_or_view "." column
      | object_instance
      | record_variable [ "." field ]
      | scalar_variable
    )
    "%TYPE" ;
```

### 7.3 `%ROWTYPE`

```
rowtype_attribute =
    ( explicit_cursor | cursor_variable | table_or_view )
    "%ROWTYPE" ;
```

### 7.4 Shared `%` attribute lexer concern

`%TYPE` / `%ROWTYPE` share the `%` delimiter with **cursor attributes** (`%FOUND`, `%ISOPEN`, `%NOTFOUND`, `%ROWCOUNT`) and implicit cursor attrs (`SQL%…`). DESIGN-NOTES pain point 4:

- Attribute name is a keyword after `%`
- Context (declaration type position vs expression primary) disambiguates

### 7.5 Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B28** | `%TYPE`/`%ROWTYPE` as postfix on a `name`/`qualified_name` vs dedicated attribute node | Tree shape; shared with cursor attrs | Lock: 02-blocks; #13 |
| **B29** | Qualify `schema.table.column%TYPE` depth | Name grammar | Lock: 02-blocks; #13 |
| **B30** | Scalar type args: reuse expression vs restricted static/int | Precision `(p,s)`, `VARCHAR2(n CHAR)` | Lock: 02-blocks; expressions |
| **B31** | Treat `SYS_REFCURSOR` as ordinary type name (yes) | No special rule needed | Lock: 02-blocks (easy) |

**Ref grammar:** `type_attribute` on `type_spec` as `%` + `TYPE`\|`ROWTYPE`; cursor attrs elsewhere in expressions. Salvage pattern; unify naming under B28.

---

## 8. Exception handlers and declarative pragmas

### 8.1 Exception handler

**Source:** Exception Handler; Block → body.

```
exception_handler =
    "WHEN"
    ( exception_name { "OR" exception_name } | "OTHERS" )
    "THEN"
    statement { statement } ;
```

- `OTHERS` optional; at most once; must be **last** (semantic — B33 may enforce).
- Handler body is a statement list (same as `BEGIN` part).
- Exception names: predefined or user-defined (ordinary identifiers / qualified).

### 8.2 EXCEPTION_INIT (declarative)

```
exception_init_pragma =
    "PRAGMA" "EXCEPTION_INIT"
    "(" exception_name "," error_code ")"
    ";" ;
```

- Must appear in the **same** declarative part as the exception, after its declaration (semantic order).
- Other declarative pragmas (`AUTONOMOUS_TRANSACTION`, `SERIALLY_REUSABLE`, `DEPRECATE`, …) share the generic shape `PRAGMA name [(args)];` (lexical inventory L29; Phase 7).

### 8.3 Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B32** | Handler list node vs repeat of `exception_handler` under `exception_section` | Queries | Lock: 02-blocks |
| **B33** | Enforce `OTHERS` last / unique? | Recovery vs fidelity | Lock: 02-blocks; #5 |
| **B34** | Named exception in WHEN: `name` vs `qualified_name` | Packages | Lock: 02-blocks; #13 |
| **B35** | Specific pragma productions vs generic only | Phase 2 vs Phase 7 | Lock: 02-blocks; directives |

**Ref grammar:** `exception_section` + `WHEN` … `OR` … / `OTHERS`. Matches manual. Pragma is generic `pragma_declaration`. Salvage both.

---

## 9. Statement list (block body inventory only)

**Source:** Block → `statement` (and related productions). Full statement inventory is ticket #7; listed here so Phase 2 knows the **hole** shape.

```
statement =
    { label }
    (
        assignment_statement
      | basic_loop_statement
      | case_statement
      | close_statement
      | continue_statement
      | cursor_for_loop_statement
      | execute_immediate_statement
      | exit_statement
      | fetch_statement
      | for_loop_statement
      | forall_statement
      | goto_statement
      | if_statement
      | null_statement
      | open_statement
      | open_for_statement
      | pipe_row_statement
      | plsql_block                 -- nested block
      | raise_statement
      | return_statement
      | select_into_statement
      | sql_statement              -- commit/rollback/dml/…
      | while_loop_statement
      -- also documented on Block page but not in statement img_text:
      -- procedure_call ; collection_method_call (DELETE/EXTEND/TRIM)
    ) ;
```

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **B36** | Phase 2: stub `statement` as `plsql_block \| null_statement \| ERROR` vs full #7 surface | Implementation order | Lock: 02-blocks; #7 |
| **B37** | `procedure_call` vs assignment/call expression ambiguity | Classic PL/SQL conflict | #13; #7; #8 |
| **B38** | Collection methods `EXTEND`/`TRIM`/`DELETE` as statements | Not in statement img_text; in Block semantics | #7 |

---

## 10. Decision index (all Tree-sitter flags)

| ID | Topic | Severity for Phase 2 | Owner ticket |
|----|-------|----------------------|--------------|
| B1 | Block node factorization | Required | Lock: 02-blocks |
| B2 | Fields on block | Required (D3) | Lock: 02-blocks |
| B3 | Empty BEGIN allowed? | Recovery | Lock: 02-blocks; #5 |
| B4 | Top-level `;` vs `/` | Script | Directives/script |
| B5 | Multi-label representation | Minor | Lock: 02-blocks |
| **B6–B7** | **Declare-section two-list order** | **Hard** | **Lock: 02-blocks; #5** |
| **B8** | **Pragma placement in declare** | **Required** | **Lock: 02-blocks; Phase 7** |
| B9–B12 | Variable/constant/collection shapes | Required | Lock: 02-blocks |
| B13–B18 | Type / subtype / collection forms | Required | Lock: 02-blocks |
| B19–B22 | Cursor decl vs def; query opacity | Hard | Lock: 02-blocks; #14 |
| B23–B27 | Nested subprograms / params / call_spec | Medium | Lock: 02-blocks; #9 |
| **B28–B29** | **`%TYPE` / `%ROWTYPE` shape + qualification** | **Hard** | **Lock: 02-blocks; #13** |
| B30–B31 | Scalar type args; SYS_REFCURSOR | Medium | Lock: 02-blocks; expressions |
| B32–B35 | Handlers + pragmas | Medium | Lock: 02-blocks; #5 |
| B36–B38 | Statement stubs / procedure_call | Boundary | #7; #8; #13 |

---

## 11. Ref grammar salvage map

| Area | Keep | Drop / redesign |
|------|------|-----------------|
| Block triple (`DECLARE`/`BEGIN`/`EXCEPTION`/`END`) | Yes | `unterminated_select_statement` rule |
| Labels `<< >>` | Yes | — |
| Unified variable + CONSTANT | Yes (decide B9) | Bare `NULL` modifier |
| Type defs record/table/varray/ref cursor | Yes | `generic_type_definition` |
| Exception handlers | Yes | — |
| Nested procedure/function | Yes | Ad-hoc `external_call_spec` detail → opaque call_spec |
| Cursor | Partial | Add forward `RETURN`-only declaration |
| Declare order | Flat list | Consider two-list only if B6 says enforce |
| `%TYPE`/`%ROWTYPE` | Postfix on type_spec | Unify with cursor-attr `%` policy (#13) |

---

## 12. Provenance entries (for `docs/provenance/manifest.jsonl`)

Suggested rows (own summaries only):

```json
{"id": "block", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/block.html", "section": "Block", "release": "26", "retrieved": "2026-07-16", "summary": "plsql_block labels+optional DECLARE+body; declare_section two-list model; type_definition family; body BEGIN/EXCEPTION/END; statement catalog. Inventory: docs/spec/research/02-blocks-declarations-inventory.md.", "sketch": "See inventory §§1–2, §9.", "rules": ["block", "label", "declare_section", "exception_handler", "type_definition", "subtype_definition"], "notes": "Decision flags B1–B38. Statement bodies deferred to statements inventory."}
{"id": "constant-declaration", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/constant-declaration.html", "section": "Constant Declaration", "release": "26", "retrieved": "2026-07-16", "summary": "name CONSTANT datatype [NOT NULL] :=|DEFAULT expression;", "rules": ["constant_declaration"]}
{"id": "scalar-variable-declaration", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/scalar-variable-declaration.html", "section": "Scalar Variable Declaration", "release": "26", "retrieved": "2026-07-16", "summary": "name datatype [[NOT NULL] :=|DEFAULT expression];", "rules": ["variable_declaration"]}
{"id": "exception-declaration", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/exception-declaration.html", "section": "Exception Declaration", "release": "26", "retrieved": "2026-07-16", "summary": "name EXCEPTION;", "rules": ["exception_declaration"]}
{"id": "exception-handler", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/exception-handler.html", "section": "Exception Handler", "release": "26", "retrieved": "2026-07-16", "summary": "WHEN exception [OR exception]... | OTHERS THEN statements", "rules": ["exception_handler"]}
{"id": "explicit-cursor", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/explicit-cursor-declaration-and-definition.html", "section": "Explicit Cursor Declaration and Definition", "release": "26", "retrieved": "2026-07-16", "summary": "CURSOR decl with RETURN; definition with IS select; cursor params IN-only.", "rules": ["cursor_declaration", "cursor_definition"]}
{"id": "cursor-variable", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/cursor-variable-declaration.html", "section": "Cursor Variable Declaration", "release": "26", "retrieved": "2026-07-16", "summary": "REF CURSOR type def strong/weak; cursor_variable type; SYS_REFCURSOR.", "rules": ["ref_cursor_type_definition", "cursor_variable_declaration"]}
{"id": "collection-variable", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/collection-variable.html", "section": "Collection Variable Declaration", "release": "26", "retrieved": "2026-07-16", "summary": "Associative array / varray / nested table type defs and variable decls.", "rules": ["collection_type_definition", "collection_variable_decl"]}
{"id": "record-variable", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/record-variable-declaration.html", "section": "Record Variable Declaration", "release": "26", "retrieved": "2026-07-16", "summary": "RECORD type with fields; record variable via type / %ROWTYPE / %TYPE.", "rules": ["record_type_definition", "record_variable_declaration"]}
{"id": "type-attribute", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/TYPE-attribute.html", "section": "%TYPE Attribute", "release": "26", "retrieved": "2026-07-16", "summary": "Anchored type to variable/column/field/object.", "rules": ["type_attribute"]}
{"id": "rowtype-attribute", "kind": "type", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/ROWTYPE-attribute.html", "section": "%ROWTYPE Attribute", "release": "26", "retrieved": "2026-07-16", "summary": "Record type from table/view/cursor/cursor variable.", "rules": ["rowtype_attribute"]}
{"id": "function-declaration", "kind": "unit", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/function-declaration-and-definition.html", "section": "Function Declaration and Definition", "release": "26", "retrieved": "2026-07-16", "summary": "Nested function heading, modifiers, IS|AS body or call_spec.", "rules": ["function_declaration", "function_definition"]}
{"id": "procedure-declaration", "kind": "unit", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/procedure-declaration-and-definition.html", "section": "Procedure Declaration and Definition", "release": "26", "retrieved": "2026-07-16", "summary": "Nested procedure heading, properties (not on nested), IS|AS body or call_spec.", "rules": ["procedure_declaration", "procedure_definition"]}
{"id": "formal-parameter", "kind": "unit", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/formal-parameter-declaration.html", "section": "Formal Parameter Declaration", "release": "26", "retrieved": "2026-07-16", "summary": "IN/OUT/IN OUT NOCOPY; defaults on IN only.", "rules": ["parameter_declaration"]}
{"id": "exception-init-pragma", "kind": "directive", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/EXCEPTION_INIT-pragma.html", "section": "EXCEPTION_INIT Pragma", "release": "26", "retrieved": "2026-07-16", "summary": "PRAGMA EXCEPTION_INIT(exception, error_code); declarative part only.", "rules": ["pragma_declaration"]}
```

---

## 13. What this inventory does *not* decide

Deferred explicitly:

- **All B1–B38 lock choices** — graduate to a **Lock spec: 02-blocks.md** grilling ticket (this inventory is the decision list).
- **Recovery-vs-precision** for B3/B6/B12/B21/B24/B33 — [Decide: recovery-vs-precision rubric](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5).
- **Name / qualified / call / member** — [Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13) (B28–B29, B34, B37).
- **Cursor query & SQL statement depth** — [Decide: embedded SQL subset boundary](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14) (B20).
- **Full statement catalog** — [Inventory: statements](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/7) (B36–B38).
- **Standalone unit headers / package layout** — [Inventory: program-unit headers](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/9) (B23, B26).
- **Per-pragma catalog & conditional compilation** — Phase 7 / directives tickets (B8, B35).
- **Implementation** in `grammar.js` — out of scope for this map.

This document is the factual base for locking `docs/spec/02-blocks.md`.
