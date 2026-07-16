# Inventory: statements incl. modern iteration controls (Release 26)

**Ticket:** [Inventory: statements incl. modern iteration controls](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/7) · **Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)

**Primary sources (Release 26 PL/SQL Language Reference):**

- [Block](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/block.html) — `statement` / `sql_statement` catalog
- [PL/SQL Control Statements](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/plsql-control-statements.html) · [LOOP Statements](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/loop-statements.html) · [Iterator](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/iterator.html)
- Language Elements pages for each statement form (links in §14)

**Licensing:** No Oracle prose, tables, or diagram text is copied. What follows is our own factual inventory, EBNF-ish sketches reviewed against the published diagrams / `img_text` alt descriptions, and Tree-sitter decision flags. See research doc §Licensing.

Local ground work: `grammar-ref.js` (statement surface when present), `docs/DESIGN-NOTES.md` (CASE expression↔statement conflict; recovery notes), `docs/ROADMAP.md` Phase 3, prior inventories `01-lexical` / `02-blocks`.

---

## Scope of this inventory

Phase 3 surface from the roadmap and ticket question:

- Complete **statement catalog** from the Block `statement` production
- All **loop** forms: basic `LOOP`, `WHILE`, classic **cursor FOR LOOP**, modern **FOR iterator** (21c+ controls: stepped, single/repeat expression, `VALUES OF` / `INDICES OF` / `PAIRS OF`, cursor, dynamic SQL, multi-control chains, `REVERSE`, `WHILE` stop / `WHEN` skip predicates, mutability)
- Control: `IF`, `CASE` (statement), `GOTO`, `NULL`, assignment, `RAISE`, `RETURN`, `EXIT` / `CONTINUE`
- Cursor ops: `OPEN` / `OPEN FOR` / `FETCH` / `CLOSE`
- Bulk / pipeline: `FORALL`, `PIPE ROW`, `SELECT INTO` (incl. `BULK COLLECT`)
- Dynamic SQL: `EXECUTE IMMEDIATE` (statement form; also as iteration control / `OPEN FOR` bind)
- Embedded SQL DML/TCL envelope under `sql_statement` (depth deferred to #14)
- Procedure call and collection mutator methods as statement-like constructs

**In scope as structure only (details deferred):**

- Expression interiors of conditions, bounds, targets — [Inventory: expressions](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/8)
- Full SQL parse of `select_statement` / DML / `MERGE` bodies — [Decide: embedded SQL subset](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14)
- Name / call / member disambiguation — [Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13)
- Nested block body reuse — already inventoried in [Inventory: blocks and declarations](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/6)

**Out of this inventory:** CREATE unit wrappers, package/trigger layout, conditional compilation, SQL\*Plus `/`, `DBMS_SQL` package API (not language statements).

---

## 1. Statement catalog (Block production)

**Source:** Block → `statement` `img_text` + Block semantics list. Provenance id: `statement-catalog`.

### 1.1 Structure (own words)

A statement may be preceded by zero or more labels (`<< name >>`). The labeled alternative is one of the forms below. Most forms end with `;` as part of their own production; loop/`IF`/`CASE`/`block` forms carry their own terminators.

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
      | plsql_block
      | raise_statement
      | return_statement
      | select_into_statement
      | sql_statement
      | while_loop_statement
    ) ;
```

**Documented on the Block page but not present in the `statement` `img_text`:**

| Construct | Where the manual puts it | Implication |
|-----------|--------------------------|-------------|
| `procedure_call` | Block semantics → `procedure_call` diagram | Must be a statement alternative; classic call-vs-assignment ambiguity with `name;` / `name(args);` |
| `collection_method_call` (`DELETE` / `EXTEND` / `TRIM`) | `sql_statement` `img_text` **and** Block semantics as collection methods | Nested under `sql_statement` **or** first-class statement — decide (S flags) |

**Not in the catalog (handle elsewhere or note):**

- `PRAGMA INLINE (...)` before a call — executable-region pragma; Phase 7 / directives ticket, but must not be rejected if it appears in a statement list (S-flag)
- SQL `CALL` statement — host/SQL surface; not a PL/SQL `statement` alternative

### 1.2 Labels on statements

Same lexical shape as block labels (`<<` `name` `>>`). Multiple labels allowed before one statement. `GOTO` / labeled `EXIT` / `CONTINUE` / loop `END LOOP label` reference them (semantic match).

### 1.3 Decision flags

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S1** | Flat `statement` choice vs grouped categories (control / cursor / sql / …) | Query modules; error recovery | Lock: 03-statements |
| **S2** | Include `procedure_call` as first-class alternative despite missing from `statement` img_text? | **Yes required** for real code | Lock: 03-statements; #13 |
| **S3** | `collection_method_call` under `sql_statement` vs own alternative vs method-invocation expression | Overlaps DML `DELETE` keyword | Lock: 03-statements; #14 |
| **S4** | Multi-label field: `repeat(label)` vs flattened | Navigation queries | Lock: 03-statements; B5 |
| **S5** | Accept `PRAGMA INLINE` (and other executable pragmas) in statement list? | Real code; Phase 7 | Lock: 03-statements; #15 |

**Ref grammar (when present):** typically a large choice; procedure call often unified with expression call. Salvage: label prefix + broad choice. Drop: any legacy recovery-only pseudo-statements (e.g. unterminated select) — same policy as B inventory.

---

## 2. Conditional selection: IF and CASE (statement)

### 2.1 IF

**Source:** [IF Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/IF-statement.html). Provenance: `if-statement`.

```
if_statement =
    "IF" boolean_expression "THEN"
        statement { statement }
    { "ELSIF" boolean_expression "THEN"
        statement { statement } }
    [ "ELSE"
        statement { statement } ]
    "END" "IF"
    ";" ;
```

Notes:

- `ELSIF` (not `ELSEIF`). Zero or more `ELSIF` arms.
- Each arm is a **statement list** (one or more). Empty arm needs `NULL;`.
- Trailing `;` after `END IF`.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S6** | Node: single `if_statement` with optional elsif/else fields vs chained binary if-else | Query shape for branches | Lock: 03-statements |
| **S7** | Require ≥1 statement per arm (manual) vs empty for recovery | Recovery rubric | Lock: 03-statements; #5 |

### 2.2 CASE statement (simple + searched)

**Source:** [CASE Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/CASE-statement.html). Provenance: `case-statement`.

```
case_statement =
      simple_case_statement
    | searched_case_statement ;

simple_case_statement =
    "CASE" selector
    { "WHEN" case_choice { "," case_choice }
      "THEN" statement { statement } }
    [ "ELSE" statement { statement } ]
    "END" "CASE" [ label ]
    ";" ;

case_choice =
      selector_value
    | dangling_predicate ;

searched_case_statement =
    "CASE"
    { "WHEN" boolean_expression
      "THEN" statement { statement } }
    [ "ELSE" statement { statement } ]
    "END" "CASE" [ label ]
    ";" ;
```

Notes:

- Statement form closes with **`END CASE`** (optional label), not bare `END`.
- Expression form closes with bare **`END`** — primary structural distinguisher (expressions inventory E7; DESIGN-NOTES pain point).
- Simple CASE: multi-choice `WHEN` (comma-separated) and **dangling predicates** (left-side-omitted comparisons) — same modern surface as CASE expression.
- Manual notes some dangling predicates (e.g. `IS JSON`, `IS OF`) currently unsupported — grammar may still accept for permissiveness (flag).
- Without `ELSE`, no matching arm raises `CASE_NOT_FOUND` (semantic).
- Optional label after `END CASE` matches an opening statement label (semantic).

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S8** | Keep single declared conflict `case_expression` ↔ `case_statement` (disambiguate by `END` vs `END CASE`)? | **Recommended yes** — do not over-factor | Lock: 03-statements; #8; #5 |
| **S9** | Multi-choice WHEN + dangling_predicate on **statement** CASE (parity with expression)? | R26 surface | Lock: 03-statements; #8 |
| **S10** | Optional label field on `END CASE` | Rare; navigation | Lock: 03-statements |
| **S11** | Permissive dangling predicates beyond currently-supported set? | Recovery / future R | Lock: 03-statements; #5 |

---

## 3. Loop statements (family)

**Source:** [LOOP Statements](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/loop-statements.html), Language Elements for each form.

Conceptual family (own words):

```
loop_statement =
    [ iteration_scheme ] "LOOP"
        statement { statement }
    "END" "LOOP" [ label ]
    ";" ;

iteration_scheme =
      "WHILE" boolean_expression
    | "FOR" iterator
    | cursor_for_header ;   -- classic form; see §3.4
```

Labels may also appear *before* the loop (statement labels). `END LOOP` optional name should match (semantic only).

### 3.1 Basic LOOP

**Source:** [Basic LOOP Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/basic-LOOP-statement.html). Provenance: `basic-loop-statement`.

```
basic_loop_statement =
    "LOOP"
        statement { statement }
    "END" "LOOP" [ label ]
    ";" ;
```

Infinite unless `EXIT` / `GOTO` / exception. Body ≥1 statement.

### 3.2 WHILE LOOP

**Source:** [WHILE LOOP Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/WHILE-LOOP-statement.html). Provenance: `while-loop-statement`.

```
while_loop_statement =
    "WHILE" boolean_expression
    "LOOP"
        statement { statement }
    "END" "LOOP" [ label ]
    ";" ;
```

### 3.3 FOR LOOP (modern iterator) — critical 21c+ surface

**Source:** [FOR LOOP Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/FOR-LOOP-statement.html) + [Iterator](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/iterator.html). Provenance: `for-loop-statement`, `iterator`.

```
for_loop_statement =
    "FOR" iterator
    "LOOP"
        statement { statement }
    "END" "LOOP" [ label ]
    ";" ;

iterator =
    iterand_decl [ "," iterand_decl ]
    "IN"
    iteration_ctl_seq ;

iterand_decl =
    identifier
    [ "MUTABLE" | "IMMUTABLE" ]
    [ constrained_type ] ;

iteration_ctl_seq =
    qual_iteration_ctl { "," qual_iteration_ctl } ;

qual_iteration_ctl =
    [ "REVERSE" ]
    iteration_control
    [ "WHILE" boolean_expression ]    -- stopping predicate
    [ "WHEN" boolean_expression ] ;   -- skipping predicate

iteration_control =
      stepped_control
    | single_expression_control
    | values_of_control
    | indices_of_control
    | pairs_of_control
    | cursor_iteration_control ;

stepped_control =
    lower_bound ".." upper_bound [ "BY" step ] ;

single_expression_control =
    [ "REPEAT" ] expression ;

values_of_control =
    "VALUES" "OF"
    ( expression
    | cursor_source ) ;

indices_of_control =
    "INDICES" "OF"
    ( expression
    | cursor_source ) ;
-- R26 also allows parenthesized cursor_variable: "(" cursor_variable ")"

pairs_of_control =
    "PAIRS" "OF"
    ( expression
    | cursor_source ) ;

cursor_iteration_control =
    "(" (
        cursor_object
      | cursor_variable
      | sql_statement          -- implicit cursor / SELECT
      | dynamic_sql_control
    ) ")" ;

dynamic_sql_control =
    "EXECUTE" "IMMEDIATE" dynamic_sql_stmt
    [ "USING" [ "IN" ] bind_argument { "," [ "IN" ] bind_argument } ] ;

-- Shared source for VALUES/INDICES/PAIRS OF (R26 img_text shape).
-- dynamic_sql and sql_statement / cursor_object require parentheses here;
-- bare dynamic_sql_control is invalid (only legal inside the parens).
cursor_source =
      cursor_variable
    | "(" cursor_object ")"
    | "(" sql_statement ")"
    | "(" dynamic_sql_control ")" ;
```

**Own-words behavior summary (not a copy of the manual):**

| Control | Generates | Notes |
|---------|-----------|-------|
| Stepped range `lo..hi [BY step]` | Numeric sequence | Default step 1; `REVERSE` flips direction; bounds evaluated once |
| Single expression | One value | With `REPEAT`, re-eval until stop predicate exhausts |
| `VALUES OF` | Collection elements (or cursor rows as values) | Collection / cursor / dynamic SQL |
| `INDICES OF` | Collection indexes | Index iterand cannot be made mutable |
| `PAIRS OF` | Index + value pair | **Requires two iterands**; cannot mix with other control kinds in the same iterator |
| Cursor control | Records from cursor / SELECT / ref cursor / dynamic SQL | No `REVERSE` |

**Multiple controls:** comma-chained `iteration_ctl_seq` — each control runs to exhaustion, then the next starts (iterand carries last value across the boundary).

**Mutability:** default **immutable** unless all controls are cursor controls (then default **mutable**). Explicit `MUTABLE` / `IMMUTABLE` after the iterand name. Keywords are not reserved — if the type name is `MUTABLE`/`IMMUTABLE`, mutability must be stated explicitly to avoid ambiguity (S-flag).

**Predicates:** optional `WHILE expr` (stop / exhaust control) then optional `WHEN expr` (skip body for this value). Order fixed: stop then skip.

**Type on iterand:** optional constrained type after mutability; implicit type from first control (PLS_INTEGER for stepped/single expr; `%ROWTYPE` for cursor; element/index types for collection controls).

**Qualified expressions** re-use `iterator` (expressions inventory) — same production should be shared.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S12** | Shared `iterator` rule for FOR LOOP and qualified expressions? | **Yes recommended** | Lock: 03-statements; #8 |
| **S13** | Node split: one `for_loop_statement` vs per-control subtypes | Highlight / structure | Lock: 03-statements |
| **S14** | Enforce `PAIRS OF` isolation (no mix with other controls) in grammar? | Semantic vs recovery | Lock: 03-statements; #5 |
| **S15** | `MUTABLE`/`IMMUTABLE` as keywords vs identifiers with contextual rules | Lexical interaction (keywords usable as ids) | Lock: 03-statements; #12 |
| **S16** | How deep is `sql_statement` / SELECT inside cursor iteration controls? | Opacity vs full SQL | Lock: 03-statements; #14 |
| **S17** | Dynamic SQL control: only `USING [IN] …` (no INTO) — dedicated production? | Differs from full EXECUTE IMMEDIATE | Lock: 03-statements |
| **S18** | `REVERSE` accepted even where manual forbids (cursor, single expr, pipelined) — recover or reject? | Recovery rubric | Lock: 03-statements; #5 |

### 3.4 Classic cursor FOR LOOP

**Source:** [Cursor FOR LOOP Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/cursor-FOR-LOOP-statement.html). Provenance: `cursor-for-loop-statement`.

Still a **separate** Language Element in R26 (not only as an iterator cursor control):

```
cursor_for_loop_statement =
    "FOR" record "IN"
    (
        cursor [ "(" actual_param { "," actual_param } ")" ]
      | "(" select_statement ")"
    )
    "LOOP"
        statement { statement }
    "END" "LOOP" [ label ]
    ";" ;
```

Notes:

- Implicitly declares `record` as `%ROWTYPE` of the cursor/select.
- Explicit cursor must **not** already be open; loop opens/fetches/closes.
- Inline `select_statement` is SQL SELECT (not `SELECT INTO`); implicit cursor is not named `SQL`.
- Overlaps modern `FOR r IN (SELECT …) LOOP` cursor iteration control — both must parse; may share structure.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S19** | Unify classic cursor FOR with `for_loop_statement`+cursor control, or keep distinct node? | Query stability; ref shape | Lock: 03-statements |
| **S20** | Cursor actual params: reuse call argument list (named/`=>`)? | Consistency with #8 / #13 | Lock: 03-statements; #8 |

### 3.5 EXIT / CONTINUE

**Source:** [EXIT](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/EXIT-statement.html), [CONTINUE](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/CONTINUE-statement.html). Provenance: `exit-statement`, `continue-statement`.

```
exit_statement =
    "EXIT" [ label ] [ "WHEN" boolean_expression ] ";" ;

continue_statement =
    "CONTINUE" [ label ] [ "WHEN" boolean_expression ] ";" ;
```

Must appear inside a loop (semantic). Label names enclosing loop. Premature exit of cursor FOR closes the cursor.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S21** | Shared production shape for EXIT/CONTINUE vs separate nodes | Symmetry | Lock: 03-statements |

---

## 4. Sequential control: GOTO, NULL

**Source:** [GOTO](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/GOTO-statement.html), [NULL](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/NULL-statement.html). Provenance: `goto-statement`, `null-statement`.

```
goto_statement = "GOTO" label ";" ;
null_statement = "NULL" ";" ;
```

`GOTO` cannot transfer into IF/CASE/LOOP/sub-block in illegal ways (semantic restrictions — not grammar-enforced for editor grammar unless chosen).

`NULL;` is the empty-body workhorse (required when ≥1 statement demanded).

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S22** | `NULL` statement vs `NULL` literal vs `NULL` datatype modifier | Lexical/keyword roles | Lock: 03-statements; #12; #8 |

---

## 5. Assignment

**Source:** [Assignment Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/assignment-statement.html). Provenance: `assignment-statement`.

```
assignment_statement =
    assignment_target ":=" expression ";" ;

assignment_target =
      collection_variable [ "(" index ")" ]
    | cursor_variable
    | host_cursor_variable          -- :name
    | object { "." attribute }
    | out_parameter
    | placeholder                   -- :host[:indicator]
    | record_variable { "." field }
    | scalar_variable ;
```

Notes:

- Target shape is a **lvalue** subset of general references — overlaps expression primary / call / member chain (#13).
- Entire collection, record, or object may be assigned without index/field.
- Host binds: no space after `:`.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S23** | `assignment_target` as dedicated node vs general `expression` on the left of `:=` | Precision vs recovery | Lock: 03-statements; #8; #13 |
| **S24** | How targets share structure with `procedure_call` / member call | Ambiguity strategy | #13 |

---

## 6. RAISE and RETURN

**Source:** [RAISE](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/RAISE-statement.html), [RETURN](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/RETURN-statement.html). Provenance: `raise-statement`, `return-statement`.

```
raise_statement =
    "RAISE" [ exception_name ] ";" ;

return_statement =
    "RETURN" [ expression ] ";" ;
```

- Bare `RAISE;` only valid in a handler (re-raise) — semantic.
- `RETURN` expression required in functions (semantic); optional/absent in procedures and anonymous blocks.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S25** | Exception name: bare id vs qualified | Packages | Lock: 03-statements; #13 |
| **S26** | Always allow optional RETURN expr (permissive) vs context-sensitive | Recovery / simplicity | Lock: 03-statements; #5 |

---

## 7. Cursor OPEN / FETCH / CLOSE / OPEN FOR

### 7.1 OPEN

**Source:** [OPEN Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/OPEN-statement.html). Provenance: `open-statement`.

```
open_statement =
    "OPEN" cursor
    [ "(" actual_param { "," actual_param } ")" ]
    ";" ;
```

Explicit cursor only (not cursor variable).

### 7.2 OPEN FOR

**Source:** [OPEN FOR Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/OPEN-FOR-statement.html). Provenance: `open-for-statement`.

```
open_for_statement =
    "OPEN" ( cursor_variable | host_cursor_variable )
    "FOR"
    (
        select_statement
      | dynamic_string
    )
    [ using_clause ]
    ";" ;
```

- Static `select_statement` **or** dynamic string expression (`CHAR`/`VARCHAR2`/`CLOB`).
- `using_clause` binds placeholders (also used when static select has binds in some contexts).
- Diagram `img_text` only shows `select_statement [using_clause]`; semantics document `dynamic_string` — **inventory treats both as required surface**.

### 7.3 FETCH

**Source:** [FETCH Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/FETCH-statement.html). Provenance: `fetch-statement`.

```
fetch_statement =
    "FETCH" ( cursor | cursor_variable | host_cursor_variable )
    (
        into_clause
      | bulk_collect_into_clause [ "LIMIT" numeric_expression ]
    )
    ";" ;
```

### 7.4 CLOSE

**Source:** [CLOSE Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/CLOSE-statement.html). Provenance: `close-statement`.

```
close_statement =
    "CLOSE" ( cursor | cursor_variable | host_cursor_variable ) ";" ;
```

### 7.5 Shared INTO / BULK COLLECT / USING fragments

**Source:** [RETURNING INTO Clause](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/RETURNING-INTO-clause.html) (shared diagrams). Provenance: `into-clause`, `bulk-collect-into-clause`, `using-clause`.

```
into_clause =
    "INTO" ( variable { "," variable } | record ) ;

bulk_collect_into_clause =
    "BULK" "COLLECT" "INTO"
    bulk_target { "," bulk_target } ;

bulk_target =
      collection
    | host_array ;                 -- :host_array

using_clause =
    "USING"
    [ "IN" | "OUT" | "IN" "OUT" ] bind_argument
    { "," [ "IN" | "OUT" | "IN" "OUT" ] bind_argument } ;
```

These fragments also appear on `EXECUTE IMMEDIATE`, `SELECT INTO`, and DML `RETURNING`.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S27** | Shared named rules for `into_clause` / `bulk_collect_into_clause` / `using_clause`? | **Yes recommended** | Lock: 03-statements |
| **S28** | OPEN FOR: static select opacity depth | Same as cursor query | #14 |
| **S29** | Dynamic string vs select disambiguation after `FOR` | Starts with id/`SELECT`/string/paren | Lock: 03-statements; #8; #14 |

---

## 8. SELECT INTO

**Source:** [SELECT INTO Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/SELECT-INTO-statement.html). Provenance: `select-into-statement`.

```
select_into_statement =
    "SELECT" [ "DISTINCT" | "UNIQUE" | "ALL" ]
    select_list
    ( into_clause | bulk_collect_into_clause )
    "FROM" rest_of_select
    ";" ;
```

- PL/SQL-specific: `INTO` / `BULK COLLECT INTO` between select list and `FROM`.
- `rest_of_select` is "anything valid after `FROM` in SQL SELECT" — **embedded SQL boundary** (#14).
- Not the same production as SQL SELECT used in cursor FOR / OPEN FOR (those forbid INTO).

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S30** | Factor `select_into` vs general `select` with optional into | Avoid accepting INTO in cursor contexts | Lock: 03-statements; #14 |
| **S31** | How much of select_list / rest_of_select is real SQL grammar vs opaque | Coverage vs ship size | #14 |

---

## 9. EXECUTE IMMEDIATE

**Source:** [EXECUTE IMMEDIATE Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/EXECUTE-IMMEDIATE-statement.html). Provenance: `execute-immediate-statement`.

```
execute_immediate_statement =
    "EXECUTE" "IMMEDIATE" dynamic_sql_stmt
    [
          ( into_clause | bulk_collect_into_clause ) [ using_clause ]
        | using_clause [ dynamic_returning_clause ]
        | dynamic_returning_clause
    ]
    ";" ;
```

- `dynamic_sql_stmt` is a string expression (not parsed as SQL inside the string).
- Optional INTO / BULK COLLECT / USING / RETURNING combinations per diagram.
- Distinct from the slimmer `dynamic_sql_control` used inside iterators (USING IN only).

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S32** | Separate `execute_immediate_statement` vs shared core with iterator dynamic_sql? | Shape reuse | Lock: 03-statements |
| **S33** | `dynamic_returning_clause` shape shared with static DML RETURNING? | Consistency | Lock: 03-statements; #14 |

---

## 10. FORALL

**Source:** [FORALL Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/FORALL-statement.html). Provenance: `forall-statement`.

```
forall_statement =
    "FORALL" index "IN" bounds_clause
    [ "SAVE" "EXCEPTIONS" ]
    dml_statement ;

bounds_clause =
      lower_bound ".." upper_bound
    | "INDICES" "OF" collection
        [ "BETWEEN" lower_bound "AND" upper_bound ]
    | "VALUES" "OF" index_collection ;

dml_statement =
      insert_statement
    | update_statement
    | delete_statement
    | merge_statement
    | execute_immediate_statement ;   -- dynamic DML subset; each form carries its own ";"
```

Notes:

- **Not** a `LOOP` … `END LOOP` form — single DML (or dynamic DML) per FORALL.
- R26 `forall_statement` img_text shows a trailing `;` after `dml_statement`, but the DML alternatives (and `execute_immediate_statement`) already terminate with `";"`. Sketch omits an extra outer semicolon to avoid double-`;;` composition; the statement terminator lives on the DML body.
- Index is implicitly declared; not usable as a general expression target (semantic).
- `SAVE EXCEPTIONS` continues on DML failures (semantic).
- Server-only feature (semantic/doc note).

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S34** | `dml_statement` reuse vs dedicated FORALL body alternatives | SQL depth | Lock: 03-statements; #14 |
| **S35** | Dynamic FORALL: only simple collection binds in USING (no expressions) — enforce? | Semantic; prefer permissive | Lock: 03-statements; #5 |

---

## 11. PIPE ROW

**Source:** [PIPE ROW Statement](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/PIPE-ROW-statement.html). Provenance: `pipe-row-statement`.

```
pipe_row_statement =
    "PIPE" "ROW" "(" expression ")" ";" ;
```

Only legal in pipelined table function body (semantic). Grammar should still accept wherever statements appear (permissive editor grammar) unless lock session chooses context-sensitive restriction.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S36** | Accept `PIPE ROW` anywhere statements appear? | Recovery / simplicity | Lock: 03-statements; #5; #9 |

---

## 12. Procedure call (statement)

**Source:** Block → `procedure_call` diagram. Provenance: `procedure-call`.

```
procedure_call =
    procedure_name
    [ "(" [ actual_param { "," actual_param } ] ")" ]
    ";" ;
```

- Empty argument list `()` allowed when all formals have defaults / no params.
- Named and mixed notation use `=>` (expressions inventory).
- **Ambiguity:** `name;` could be call or (invalid) incomplete assignment; `name(x);` call vs ambiguous with other constructs; package-qualified and member calls (`obj.method(…)`) interact with #13.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S37** | Statement-level call node vs expression call + `;` wrapper | Tree shape for highlights | Lock: 03-statements; #8; #13 |
| **S38** | Require `procedure_call` in catalog (override img_text omission)? | **Yes** | Lock: 03-statements |

---

## 13. Collection method invocation (statement-like)

**Source:** [Collection Method Invocation](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/collection-method.html); `sql_statement` img_text lists `collection_method_call`. Provenance: `collection-method-call`.

Procedure-style methods usable as statements:

```
collection_method_call =
    collection_variable "."
    (
        "DELETE"  [ "(" [ index [ "," index ] ] ")" ]
      | "EXTEND"  [ "(" expression [ "," expression ] ")" ]
      | "TRIM"    [ "(" expression ")" ]
    )
    ";" ;
```

Function-style methods (`COUNT`, `EXISTS`, `FIRST`, `LAST`, `LIMIT`, `NEXT`, `PRIOR`) are **expressions**, not statements.

**Keyword clash:** `DELETE` also starts SQL `DELETE` statement. Disambiguation: `identifier . DELETE` vs `DELETE FROM` / `DELETE` soft-parse — #14 + #13.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S39** | Statement node for mutators only; functions via member expression? | **Recommended** | Lock: 03-statements; #8 |
| **S40** | Placement under `sql_statement` (per img_text) vs top-level statement | Catalog fidelity | Lock: 03-statements |

---

## 14. Embedded SQL statements (`sql_statement`)

**Source:** Block → `sql_statement` img_text + semantics. Provenance: `sql-statement-envelope`.

```
sql_statement =
      commit_statement
    | collection_method_call      -- per img_text (see §13)
    | delete_statement
    | insert_statement
    | lock_table_statement
    | merge_statement
    | rollback_statement
    | savepoint_statement
    | set_transaction_statement
    | update_statement ;
```

Plus PL/SQL **extensions** documented separately:

- `DELETE` / `UPDATE` … `WHERE CURRENT OF cursor`
- `INSERT` … record in `VALUES`
- `UPDATE` … record SET / `WHERE CURRENT OF`
- `RETURNING INTO` / `RETURN … BULK COLLECT INTO` on DML

**This inventory does not expand full SQL EBNF.** Decision list for the SQL subset lives primarily in #14; statements lock only needs:

1. Which keywords introduce an `sql_statement` alternative
2. Whether the body is opaque vs structured
3. How PL/SQL extensions hang off the SQL spine

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **S41** | Keyword-led dispatch table for SQL stmts in the PL/SQL grammar | Entry points | Lock: 03-statements; #14 |
| **S42** | TCL (`COMMIT`/`ROLLBACK`/`SAVEPOINT`/`SET TRANSACTION`) fully spelled vs opaque | Small surface — likely full | Lock: 03-statements; #14 |
| **S43** | DML: structured minimal spine + opaque tail vs full SQL grammar | Ship scope | #14 |

---

## 15. Cross-cutting ambiguity map

| # | Clash | Sketch of resolution space |
|---|-------|----------------------------|
| A1 | `CASE` … `END` vs `END CASE` | Declared conflict or lookahead (S8) |
| A2 | `FOR` classic cursor FOR vs modern iterator FOR | Shared `FOR` prefix; diverge at `IN` shape (`record IN cursor` / `(select)` vs `iterand [type] IN control`) |
| A3 | `FORALL` vs `FOR` | Distinct keyword `FORALL` |
| A4 | Assignment `t := e` vs call `p(…)` vs member | #13 strategy; `:=` forces assignment |
| A5 | `DELETE` DML vs `coll.DELETE` | Dot before `DELETE` → method; else SQL |
| A6 | `OPEN c FOR` select vs dynamic string | Token after `FOR` |
| A7 | `SELECT` → `SELECT INTO` statement vs SQL select in cursor contexts | Context: statement start vs parenthesized / after `IN` / after `FOR` |
| A8 | `NULL;` statement vs other NULL roles | Keyword in statement position |
| A9 | `MUTABLE`/`IMMUTABLE` type names vs mutability marks | Contextual (S15) |
| A10 | Iterator dynamic `EXECUTE IMMEDIATE` vs statement form | Inside `IN` control vs statement start |

---

## 16. Decision index (all Tree-sitter flags S1–S43)

| ID | Topic | Severity for Phase 3 | Owner ticket |
|----|-------|----------------------|--------------|
| S1 | Statement choice factorization | Medium | Lock: 03-statements |
| **S2 / S38** | **`procedure_call` in catalog** | **Required** | **Lock: 03-statements; #13** |
| S3 / S39–S40 | Collection method placement | Hard | Lock: 03-statements; #14 |
| S4 | Multi-label fields | Minor | Lock: 03-statements |
| S5 | Executable pragmas in stmt list | Medium | Lock: 03-statements; #15 |
| S6–S7 | IF shape / empty arms | Medium | Lock: 03-statements; #5 |
| **S8–S11** | **CASE statement vs expression; modern WHEN** | **Hard** | **Lock: 03-statements; #8; #5** |
| **S12–S18** | **Modern iterator / FOR LOOP** | **Hard** | **Lock: 03-statements; #8; #14; #5** |
| S19–S20 | Classic cursor FOR unify? | Hard | Lock: 03-statements |
| S21 | EXIT/CONTINUE | Minor | Lock: 03-statements |
| S22 | NULL roles | Medium | Lock: 03-statements; #12 |
| **S23–S24** | **Assignment targets** | **Hard** | **Lock: 03-statements; #13; #8** |
| S25–S26 | RAISE / RETURN | Medium | Lock: 03-statements; #5 |
| S27–S29 | Cursor ops + shared INTO/USING | Medium | Lock: 03-statements; #14 |
| **S30–S31** | **SELECT INTO vs SQL select** | **Hard** | **Lock: 03-statements; #14** |
| S32–S33 | EXECUTE IMMEDIATE shapes | Medium | Lock: 03-statements |
| S34–S35 | FORALL body | Medium | Lock: 03-statements; #14 |
| S36 | PIPE ROW permissiveness | Minor | Lock: 03-statements; #5 |
| **S37** | **Call node shape** | **Hard** | **#13; #8** |
| **S41–S43** | **SQL envelope / TCL / DML depth** | **Hard** | **#14; Lock: 03-statements** |

---

## 17. Decision list for locking `docs/spec/03-statements.md`

These are the questions the lock session must answer (not answered here):

1. **Catalog completeness** — Confirm S2/S38 (`procedure_call`) and S3/S40 (collection methods) membership and placement.
2. **CASE boundary** — Adopt S8 conflict policy; lock multi-choice WHEN + dangling predicates (S9) for statement parity with expressions.
3. **Iterator surface** — Full R26 controls in v1 (recommended by coverage commitment) vs phased; shared `iterator` with qualified expressions (S12); PAIRS isolation (S14); mutability keywords (S15).
4. **Cursor FOR classic vs modern** — Unify or dual nodes (S19).
5. **Assignment / call / member** — Target production strategy (S23–S24, S37) aligned with #13.
6. **SQL / dynamic boundary** — Entry keywords (S41); SELECT INTO factoring (S30); OPEN FOR / iterator SQL opacity (S16, S28, S31); FORALL DML (S34).
7. **Recovery** — Empty arms (S7), illegal REVERSE (S18), PIPE ROW anywhere (S36), bare RAISE/RETURN (S26), executable pragmas (S5) — apply rubric from #5.
8. **Node/field conventions** — Labels, loop end names, INTO/USING shared rules (S4, S27) per D3-style conventions from #5.
9. **Provenance + corpus** — One corpus example family per statement form; modern iterator cases mandatory.

**Recommended lean (not locked):** full R26 iterator in v1; shared iterator production; declared CASE conflict; procedure_call first-class; collection mutators as statements; SQL bodies opaque-or-minimal per #14; permissive semantic restrictions.

---

## 18. Ref grammar salvage map

| Area | Keep | Drop / redesign |
|------|------|-----------------|
| IF / ELSIF / ELSE / END IF | Yes | — |
| Basic / WHILE loop | Yes | — |
| Classic FOR `i IN lo..hi` | Yes as stepped subset | Extend to full iterator |
| Cursor FOR `FOR r IN c LOOP` | Yes | Align with modern cursor control |
| EXIT / CONTINUE WHEN | Yes | — |
| Assignment `:=` | Yes | Unify targets with #13 |
| GOTO / NULL / RAISE / RETURN | Yes | — |
| OPEN / FETCH / CLOSE | Yes | Add OPEN FOR dynamic string explicitly |
| EXECUTE IMMEDIATE | Partial | Full optional clause matrix |
| FORALL + SAVE EXCEPTIONS | If present | INDICES OF / VALUES OF bounds |
| SELECT INTO | Partial | BULK COLLECT; distinct from SQL select |
| CASE statement `END CASE` | Yes | Multi-choice WHEN; dangling predicates |
| Procedure call | Often via expr | Explicit statement alternative |
| Modern iterator controls | Likely missing | **Major add** — VALUES/INDICES/PAIRS OF, REPEAT, multi-control, predicates, MUTABLE |
| Collection `.DELETE/.EXTEND/.TRIM` | Maybe via call | Dedicated or member statement |

---

## 19. Provenance entries (for `docs/provenance/manifest.jsonl`)

Suggested rows (own summaries only) — also appended in this PR:

```json
{"id": "statement-catalog", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/block.html", "section": "Block — statement / sql_statement", "release": "26", "retrieved": "2026-07-16", "summary": "Full statement alternative catalog + sql_statement envelope; procedure_call and collection methods noted across diagram vs semantics. Inventory: docs/spec/research/03-statements-inventory.md.", "rules": ["statement", "sql_statement", "procedure_call"], "notes": "Flags S1–S43."}
{"id": "if-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/IF-statement.html", "section": "IF Statement", "release": "26", "retrieved": "2026-07-16", "summary": "IF / ELSIF* / ELSE? / END IF; boolean guards; statement lists per arm.", "rules": ["if_statement"]}
{"id": "case-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/CASE-statement.html", "section": "CASE Statement", "release": "26", "retrieved": "2026-07-16", "summary": "Simple and searched CASE statements; END CASE; multi-choice WHEN; dangling predicates.", "rules": ["case_statement", "simple_case_statement", "searched_case_statement"]}
{"id": "basic-loop-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/basic-LOOP-statement.html", "section": "Basic LOOP Statement", "release": "26", "retrieved": "2026-07-16", "summary": "LOOP … END LOOP [label];", "rules": ["basic_loop_statement"]}
{"id": "while-loop-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/WHILE-LOOP-statement.html", "section": "WHILE LOOP Statement", "release": "26", "retrieved": "2026-07-16", "summary": "WHILE cond LOOP … END LOOP [label];", "rules": ["while_loop_statement"]}
{"id": "for-loop-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/FOR-LOOP-statement.html", "section": "FOR LOOP Statement", "release": "26", "retrieved": "2026-07-16", "summary": "FOR iterator LOOP … END LOOP; modern iterand controls.", "rules": ["for_loop_statement"]}
{"id": "iterator", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/iterator.html", "section": "Iterator", "release": "26", "retrieved": "2026-07-16", "summary": "iterand_decl+; controls: stepped, single/REPEAT, VALUES/INDICES/PAIRS OF, cursor, dynamic SQL; REVERSE; WHILE/WHEN predicates; MUTABLE/IMMUTABLE.", "rules": ["iterator", "iterand_decl", "iteration_control"], "notes": "Also used by qualified expressions."}
{"id": "cursor-for-loop-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/cursor-FOR-LOOP-statement.html", "section": "Cursor FOR LOOP Statement", "release": "26", "retrieved": "2026-07-16", "summary": "Classic FOR record IN cursor|(select) LOOP … END LOOP.", "rules": ["cursor_for_loop_statement"]}
{"id": "exit-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/EXIT-statement.html", "section": "EXIT Statement", "release": "26", "retrieved": "2026-07-16", "summary": "EXIT [label] [WHEN cond];", "rules": ["exit_statement"]}
{"id": "continue-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/CONTINUE-statement.html", "section": "CONTINUE Statement", "release": "26", "retrieved": "2026-07-16", "summary": "CONTINUE [label] [WHEN cond];", "rules": ["continue_statement"]}
{"id": "goto-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/GOTO-statement.html", "section": "GOTO Statement", "release": "26", "retrieved": "2026-07-16", "summary": "GOTO label;", "rules": ["goto_statement"]}
{"id": "null-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/NULL-statement.html", "section": "NULL Statement", "release": "26", "retrieved": "2026-07-16", "summary": "NULL; no-op statement.", "rules": ["null_statement"]}
{"id": "assignment-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/assignment-statement.html", "section": "Assignment Statement", "release": "26", "retrieved": "2026-07-16", "summary": "assignment_target := expression; targets include collection elements, records, objects, binds.", "rules": ["assignment_statement", "assignment_target"]}
{"id": "raise-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/RAISE-statement.html", "section": "RAISE Statement", "release": "26", "retrieved": "2026-07-16", "summary": "RAISE [exception];", "rules": ["raise_statement"]}
{"id": "return-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/RETURN-statement.html", "section": "RETURN Statement", "release": "26", "retrieved": "2026-07-16", "summary": "RETURN [expression];", "rules": ["return_statement"]}
{"id": "open-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/OPEN-statement.html", "section": "OPEN Statement", "release": "26", "retrieved": "2026-07-16", "summary": "OPEN cursor [(params)];", "rules": ["open_statement"]}
{"id": "open-for-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/OPEN-FOR-statement.html", "section": "OPEN FOR Statement", "release": "26", "retrieved": "2026-07-16", "summary": "OPEN cursor_var FOR select|dynamic_string [USING …];", "rules": ["open_for_statement"]}
{"id": "fetch-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/FETCH-statement.html", "section": "FETCH Statement", "release": "26", "retrieved": "2026-07-16", "summary": "FETCH … INTO|BULK COLLECT INTO [LIMIT n];", "rules": ["fetch_statement"]}
{"id": "close-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/CLOSE-statement.html", "section": "CLOSE Statement", "release": "26", "retrieved": "2026-07-16", "summary": "CLOSE cursor|cursor_var|host_cursor_var;", "rules": ["close_statement"]}
{"id": "select-into-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/SELECT-INTO-statement.html", "section": "SELECT INTO Statement", "release": "26", "retrieved": "2026-07-16", "summary": "SELECT … INTO|BULK COLLECT INTO … FROM …; PL/SQL-specific INTO placement.", "rules": ["select_into_statement"]}
{"id": "execute-immediate-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/EXECUTE-IMMEDIATE-statement.html", "section": "EXECUTE IMMEDIATE Statement", "release": "26", "retrieved": "2026-07-16", "summary": "EXECUTE IMMEDIATE string [INTO|BULK COLLECT] [USING] [RETURNING];", "rules": ["execute_immediate_statement"]}
{"id": "forall-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/FORALL-statement.html", "section": "FORALL Statement", "release": "26", "retrieved": "2026-07-16", "summary": "FORALL index IN bounds [SAVE EXCEPTIONS] dml;", "rules": ["forall_statement", "bounds_clause"]}
{"id": "pipe-row-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/PIPE-ROW-statement.html", "section": "PIPE ROW Statement", "release": "26", "retrieved": "2026-07-16", "summary": "PIPE ROW (expr); pipelined table functions.", "rules": ["pipe_row_statement"]}
{"id": "collection-method-call", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/collection-method.html", "section": "Collection Method Invocation", "release": "26", "retrieved": "2026-07-16", "summary": "Statement form: collection.DELETE/EXTEND/TRIM; other methods are expressions.", "rules": ["collection_method_call"]}
{"id": "loop-statements-overview", "kind": "reference", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/loop-statements.html", "section": "LOOP Statements", "release": "26", "retrieved": "2026-07-16", "summary": "Overview of loop family, iteration controls list, EXIT/CONTINUE role.", "rules": [], "notes": "Conceptual chapter; detailed syntax on Language Elements pages."}
```

---

## 20. What this unlocks / map impact

- **Graduates:** Lock session for `docs/spec/03-statements.md` is now ticketable (decision list §17).
- **Feeds open tickets:** #5 (recovery on S7/S11/S14/S18/S26/S36), #8 (CASE/iterator/calls), #13 (assignment/call/member), #14 (SQL envelope S16/S28/S30–S31/S34/S41–S43), #15 (executable pragmas S5), #9 (PIPE ROW context).
- **Does not implement** grammar rules — map destination is the locked design spec.

This document is the factual base for locking `docs/spec/03-statements.md`.
