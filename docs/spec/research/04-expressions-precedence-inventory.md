# Inventory: expressions and operator precedence (Release 26)

**Ticket:** [Inventory: expressions and operator precedence](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/8) · **Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)

**Primary source:** Oracle Database Release 26, *PL/SQL Language Reference* — "Expressions" (operator precedence, CASE, comparison, static expressions)  
<https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/expressions.html> (retrieved 2026-07-16)

**Language-element syntax:** "Expression"  
<https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/expression.html> (retrieved 2026-07-16)

**Supporting sources:**

| Topic | URL |
|-------|-----|
| Collection constructors | <https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/collection-constructors.html> |
| Qualified expressions overview | <https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/qualified-expressions-overview.html> |
| Qualified expression (syntax) | <https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/qualified-expression.html> |
| Subprogram parameters (positional / named / mixed) | <https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/subprogram-parameters.html> |
| CASE statement (boundary vs expression) | <https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/CASE-statement.html> |

**Licensing:** No Oracle prose, tables, or diagram text is copied. What follows is our own factual inventory, EBNF-ish sketches reviewed against the published diagrams and Table 3-3, and Tree-sitter decision flags. See map Notes §Licensing.

Local ground work: `grammar-ref.js` expression tier (`PREC` map; `unary_expression` / `binary_expression` / `case_expression` / call / member / attribute; declared conflicts), `docs/DESIGN-NOTES.md` §"Precedence table (Phase 4)", `docs/ROADMAP.md` Phase 4. (`grammar-ref.js` / DESIGN-NOTES may live only in the private charting workspace; PREC numbers below were read from that salvage corpus.)

---

## Scope of this inventory

Phase 4 surface (expressions) that the `04-expressions.md` lock must decide:

- **Operator precedence ladder** (Table 3-3) and how it differs from the ref grammar / DESIGN-NOTES starting ladder
- **Expression top-level alternatives** (manual language element)
- **CASE expressions** (simple + searched; multi-choice WHEN; dangling predicates)
- **Calls** with positional / named / mixed actual parameters
- **Collection constructors** (varray / nested table)
- **Qualified expressions** (18c+ aggregates, iterators, `OTHERS`)
- **Member `.` and attribute `%` access** (precedence only; structural reference ambiguity is #13)
- Primaries that sit above the operator ladder: parenthesized expr, literals, names, bind/inquiry, cursor attributes, collection methods used as values

**In scope as structure only (details deferred):**

- SQL functions allowed / banned in PL/SQL expressions — inventory names the ban list shape; which SQL surface is embedded is [Decide: embedded SQL subset boundary](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14)
- Static expressions (conditional compilation / subtype bounds) — sketch + flags; full directive placement is Phase 7 / #15
- Procedure call as *statement* vs function call as *expression* — [Inventory: statements](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/7) and [Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13)

**Out of this inventory:** implementing the grammar; locking field names (lock ticket); full statement CASE / IF surface; CREATE-unit headers.

---

## 1. Manual expression top-level shape

**Source:** Expression language element → `expression` railroad. Provenance id: `expression`.

Own-words alternatives (any one of):

```
expression =
    boolean_expression
  | character_expression
  | collection_constructor
  | date_expression
  | numeric_expression
  | qualified_expression
  | searched_case_expression
  | simple_case_expression
  | "(" expression ")"
  ;
```

Notes for Tree-sitter:

- The manual's *typed* expression families (boolean / character / date / numeric) are semantic partitions. A single recursive `expression` production with operator tiers is the usual Tree-sitter encoding; type-family split is not required in the CST.
- `collection_constructor` and `qualified_expression` are listed as first-class alternatives alongside CASE — they are not "just" ordinary calls in the manual's railroad, even though their surface often collides with calls (see §5–§6).
- Function / method invocations, names, placeholders, and literals appear *inside* the typed families and `function_call`, not as a bare top-level alternative in the `expression` railroad. For the CST, treat them as **primaries** under the operator ladder.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E11** | One recursive `expression` vs typed family nonterminals (`boolean_expression`, …) | Node noise vs manual fidelity | Lock: 04-expressions |
| **E12** | Promote `function_call` / name / literal to explicit primary alternatives at the root | Matches how queries and #13 want to see trees | Lock: 04-expressions; #13 |

---

## 2. Operator precedence (authoritative)

**Source:** Expressions → Operator Precedence, Table 3-3. Provenance id: `expr-precedence`.

Highest → lowest (tighter → looser):

| Level | Operators (own gloss) | Kind |
|-------|----------------------|------|
| 1 (highest) | `**` | exponentiation |
| 2 | unary `+`, `-` | identity, negation |
| 3 | `*`, `/` | multiplication, division |
| 4 | binary `+`, `-`, `\|\|` | addition, subtraction, **concatenation** |
| 5 | `=` `<` `>` `<=` `>=` `<>` `!=` `~=` `^=` ; `IS [NOT] NULL` ; `LIKE` ; `BETWEEN` ; `IN` | comparison |
| 6 | `NOT` | logical negation |
| 7 | `AND` | conjunction |
| 8 (lowest) | `OR` | disjunction |

Manual rules that fix parser behaviour:

1. **Equal-precedence operators are evaluated in no particular order** — Oracle does not guarantee left-to-right for a same-level run. A *parser* still needs a deterministic tree: we choose associativity and record it as **ours**, not the manual's (**E3**).
2. Parentheses override; most-deeply-nested first.
3. The table lists **operators only**. Structural postfixes — call `()`, member `.`, attribute `%`, host/collection index `(…)` — are not in the table; they bind as **primaries / postfixes above every operator**. The ref grammar models this with `CALL` / `MEMBER` above all operators; that part is correct and stays.
4. `**` is a **PL/SQL** operator (SQL uses `POWER(m,n)`). Relevant if embedded SQL reuses this ladder — hand-off to #14.
5. `PRIOR` / `CONNECT_BY_ROOT` are **absent** from Table 3-3 (SQL hierarchical operators). The ref grammar carries `PRIOR` in `unary_expression`. Out of the PL/SQL ladder; route to #14.

### 2.1 Comparison surface (own words)

At the comparison level the manual groups:

- Relational: `=` `<>` `!=` `~=` `^=` `<` `>` `<=` `>=`
- `IS [NOT] NULL`
- `LIKE` / `NOT LIKE` (optional `ESCAPE`)
- `BETWEEN` / `NOT BETWEEN` (`x BETWEEN a AND b` ≜ `(x>=a) AND (x<=b)`; `x` evaluated once)
- `IN` / `NOT IN` (set membership)

Related boolean forms (expression railroad `other_boolean_form`, not all named in Table 3-3):

- Cursor attributes: `{ named_cursor | SQL } % { FOUND | ISOPEN | NOTFOUND }` (and `%ROWCOUNT` / bulk attrs appear in numeric context)
- Collection: `collection.EXISTS(index)`
- Multiset / SQL extensions in the ref (`MEMBER OF`, quantified `ANY`/`ALL`/`SOME`, `IS [NOT] NAN`, `IS [NOT] INFINITE`, …) — keep only what #14 admits for embedded SQL; PL/SQL-native multiset membership is real on collections

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E6** | Flat `COMPARE` tier for all comparison ops vs nested non-associative | `a = b = c` is rare; left-assoc + permissive is fine | Lock: 04-expressions |
| **E13** | Which non-Table-3-3 comparison forms ship in v1 (`MEMBER OF`, quantified, `IS NAN`, …) | Surface size | Lock: 04-expressions; #14 |

---

## 3. Reconciliation vs the ref grammar ladder

Ref grammar `PREC` (higher number = tighter bind), as salvaged:

```
OR:1 < AND:2 < NOT:3 < COMPARE:4 < CONCAT:5 < ADD:6 < MUL:7 < POW:8 < UNARY:9 < CALL:10 < MEMBER:11
```

DESIGN-NOTES §Precedence starting ladder (own paraphrase):

```
OR < AND < NOT < comparison < || < +,- < *,/ (MOD) < ** < unary < call < member
```

**Logical / comparison tiers already match the manual:** `OR < AND < NOT < comparison` (so `NOT a = b` → `NOT (a = b)`). Keep.

**Discrepancies are all in arithmetic / concat / unary / exponent:**

| # | Operator | Ref / DESIGN-NOTES | Manual Table 3-3 | Consequence | Verdict |
|---|----------|--------------------|------------------|-------------|---------|
| A | unary `+` `-` | bundled with `NOT` at `PREC.NOT` (low) | **level 2**, just under `**`, above `* /` | `-a*b`: ref → `-(a*b)`; manual → `(-a)*b` | **Fix:** dedicated high `UNARY`; unbundle from `NOT` |
| B | `**` vs unary | `POW` **below** `UNARY` | `**` **above** unary | `-2**2`: ref → `(-2)**2`; manual → `-(2**2)` | **Fix:** `**` outranks unary |
| C | `\|\|` | `CONCAT` **below** `ADD` | **same level (4)** as binary `+`/`-` | `a \|\| b + c`: ref → `a \|\| (b+c)`; manual → same-level (assoc choice) | **Fix:** co-locate `\|\|` with binary `+`/`-` |
| D | `**` associativity | `prec.right` | silent (equal-prec unspecified) | `2**3**2` | **Keep** right-assoc (math convention); record as ours |
| E | infix `MOD` | binary op at `MUL` | **not an operator** — `MOD(a,b)` is a function | `a mod b` is not PL/SQL surface | **Drop** infix `mod`; parse `MOD(...)` as call |
| F | `~=` `^=` | missing (ref has `!=`, `<>`, sometimes `!`+`=`) | listed as comparison | `a ~= b` / `a ^= b` fail | **Add** both tokens (aligns with L2 in lexical inventory) |

Everything else in the ref tier (`CALL` / `MEMBER` above operators; `BETWEEN` / `IN` / `LIKE` / `IS` at `COMPARE`) is consistent with the manual.

### 3.1 Proposed reconciled ladder (for `04-expressions.md` + DESIGN-NOTES)

Lowest → highest:

```
OR < AND < NOT < comparison < (additive == concat) < multiplicative < unary(+ -) < ** < call < member
```

Minimal `PREC` map edit (higher = tighter):

```js
const PREC = {
  OR: 1,
  AND: 2,
  NOT: 3,
  COMPARE: 4,
  ADD_CONCAT: 5, // '+', '-', '||'  (merged; was ADD=6, CONCAT=5)
  MUL: 6,        // '*', '/'        (no infix MOD)
  UNARY: 7,      // unary '+', '-'  (off the NOT level)
  POW: 8,        // '**'            (above unary; right-assoc)
  CALL: 9,
  MEMBER: 10,
};
```

Concrete grammar implications (lock / implement later, not this ticket):

- `binary_expression`: `||`, `+`, `-` all at `ADD_CONCAT`; `*`, `/` at `MUL`; delete `mod` entry
- `**` stays `prec.right(POW, …)` — top arithmetic level
- `unary_expression`: arithmetic `+`/`-` at `UNARY`; `NOT` stays at `NOT`. `PRIOR` / `DISTINCT` are not PL/SQL expression operators — `DISTINCT`/`ALL` belong to SQL aggregate-call args; `PRIOR` → #14
- Add `~=`, `^=` to comparison operators
- Same-level non-`**` runs: **left-associative** as our deterministic choice (**E3**)

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E1** | Adopt Table 3-3 as authoritative ladder (§3.1) | Entire Phase 4 tree shape | Lock: 04-expressions |
| **E2** | Concatenation shares additive level | Discrepancy C | Lock: 04-expressions |
| **E3** | Unary below `**` / above `*`; left-assoc same-level; right-assoc `**` | Discrepancies A,B,D | Lock: 04-expressions |
| **E4** | Drop infix `MOD` | Discrepancy E | Lock: 04-expressions |
| **E5** | Tokenize / parse `~=` and `^=` as comparison | Discrepancy F; L2 | Lock: 04-expressions; 01-lexical |

---

## 4. CASE expressions

**Source:** Expressions → CASE Expressions; Expression → `simple_case_expression` / `searched_case_expression`; CASE statement railroad for the boundary. Provenance ids: `expr-case`, `case-statement`.

### 4.1 Simple CASE (expression)

```
simple_case_expression =
    "CASE" selector
    { "WHEN" case_choice { "," case_choice } "THEN" result }+
    [ "ELSE" result ]
    "END"
  ;

case_choice =
    selector_value
  | dangling_predicate
  ;
```

- **Multi-choice WHEN:** comma-separated choices per `WHEN` (`WHEN 1000, 2000 THEN 'low'`) — **required** modern surface.
- **Dangling predicate:** left-operand-elided comparison / range / set form (`WHEN < 0`, `WHEN BETWEEN 10 AND 30`, `WHEN IN (...)`). The selector supplies the missing left operand. Manual: allows more complex comparisons without rewriting as searched CASE; selector is computed once.
- Expression closes with **`END`** (not `END CASE`).
- Without `ELSE`, unmatched selector yields **`NULL`** (expression); the *statement* form raises `CASE_NOT_FOUND` without `ELSE`.

### 4.2 Searched CASE (expression)

```
searched_case_expression =
    "CASE"
    { "WHEN" boolean_expression "THEN" result }+
    [ "ELSE" result ]
    "END"
  ;
```

First true boolean wins; remaining not evaluated; no `ELSE` → `NULL`.

### 4.3 CASE expression vs CASE statement

| | Expression | Statement |
|---|------------|-----------|
| Opens | `CASE` | `CASE` |
| `THEN` payload | expression (`result`) | statement list |
| Closes | **`END`** | **`END CASE` [label] `;`** |

Ref grammar keeps a declared conflict `[case_expression, case_statement]`. Recommendation: **keep exactly one documented conflict** (or GLR resolve on `END` vs `END CASE`); do not try to eliminate by structural merge. Statement-side multi-choice / dangling predicates exist too (#7).

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E7** | Multi-choice WHEN + dangling predicates in simple CASE expression | Coverage hole vs ref | Lock: 04-expressions |
| **E14** | Dangling-predicate node shape (`dangling_predicate` vs partial comparison) | Queryability | Lock: 04-expressions; #5 |
| **E15** | Keep single `case_expression`↔`case_statement` conflict | Recovery / GLR | Lock: 04-expressions; #7; #5 |

**Ref salvage:** separate `case_expression` / when-clauses — keep skeleton; **add** multi-choice + dangling; document `END` vs `END CASE` conflict.

---

## 5. Calls with named / mixed arguments

**Source:** Subprogram Parameters → positional / named / mixed notation; Expression → `function_call`. Provenance id: `named-parameters`.

```
function_call =
    function [ "(" [ actual_parameter { "," actual_parameter } ] ")" ]
  ;

actual_parameter =
    expression                         -- positional
  | formal_name "=>" expression        -- named
  ;
```

Findings:

- Named form is `formal => actual`. **`formal` is a simple identifier** (parameter name), never a dotted name.
- **Positional-before-named** is a *semantic* Oracle rule for mixed notation. Grammar should stay permissive (any order) — "the grammar parses; it does not judge."
- Empty parameter list `f()` and omitted list `f` are both diagram-legal for functions with no required params; bare `f` collides with a name primary — **#13**.
- Optional outer parentheses in the railroad deepen the name/call ambiguity.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E8** | Named-arg LHS = simple identifier only | Ref may allow full `name` | Lock: 04-expressions |
| **E16** | Enforce positional-before-named? | Recommend **no** (semantic) | Lock: 04-expressions |
| **E17** | Require `()` for zero-arg calls in expression position? | Ambiguity with names | Lock: 04-expressions; #13 |

**Ref salvage:** `named_expression` + mixed `argument_list` — keep mix; **tighten** name field to identifier; drop SQL-only argument variants unless #14 keeps them.

---

## 6. Collection constructors

**Source:** Collection Constructors; Expression → `collection_constructor`. Provenance id: `collection-constructor`.

```
collection_constructor =
    collection_type "(" [ expression { "," expression } ] ")"
  ;
```

- Applies to **varrays and nested tables only**. Associative arrays use **qualified expressions** (§7).
- Empty `T()` is a valid **empty non-NULL** collection.
- **Syntactically identical to a function call** `T(a, b)`. Type identity is name-resolution / semantic.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E9** | Distinct `collection_constructor` node vs always `call_expression` | Recommend: **no distinct node** for bare positional form; identity is semantic | Lock: 04-expressions; #13 |

---

## 7. Qualified expressions (18c+ aggregates) — main coverage gap

**Source:** Qualified Expressions Overview + qualified_expression language element. Provenance id: `qualified-expressions`.

The ref grammar has **no** production for qualified expressions. Largest Phase-4 hole this ticket surfaces.

```
qualified_expression =
    typemark "(" ")"                                    -- empty
  | typemark "(" expression ")"                         -- simple
  | typemark "(" aggregate ")"                          -- aggregate
  ;

typemark =
    type_name                                           -- id or dotted id
  ;

aggregate =
    [ positional_choice_list ]
    [ explicit_choice_list ]
    [ others_choice ]
  ;

positional_choice_list =
    expression { "," expression }
  | "FOR" iterator "SEQUENCE" "=>" expression
  ;

explicit_choice_list =
    named_choice_list      -- field => expr  (records; alternation of names)
  | indexed_choice_list    -- expr => expr   (vector / assoc)
  | iterator_choice        -- FOR iterator => expr
  | index_iterator_choice  -- FOR iterator INDEX expr => expr
  ;

others_choice =
    "OTHERS" "=>" expression                            -- last if present
  ;
```

Additional surface the overview documents (own words):

- Named choices may use **name alternation** (`N1 | N2 => expr`) for structured types.
- Indexed / iterator choices may use **alternation and ranges** (`I1 | F2..L2 => expr`).
- Order constraint: **positional before explicit before `OTHERS`**.
- Empty `T()` and simple `T(expr)` are also qualified-expression forms in the overview (overlap with constructors / calls / parenthesized).

### 7.1 Ambiguity map (critical input to #13)

| Surface | Looks like | Unambiguous marker? |
|---------|------------|---------------------|
| `T(1, 2, 3)` | call **and** constructor **and** positional aggregate | no |
| `T(id => 1, val => 2)` | named-arg call **and** named aggregate | no (LHS identifiers) |
| `T(3 => 2, OTHERS => 3)` | not a named-arg call (`3` / `OTHERS` not formal names) | **yes** — indexed / `OTHERS` |
| `T(FOR i IN 1..n => fib(i))` | iterator aggregate | **yes** — `FOR … =>` |
| `T(FOR i IN 2..n BY 2 INDEX i/2 => i)` | index-iterator | **yes** |
| `T(FOR … SEQUENCE => …)` | sequence iterator | **yes** |

**Recommendation:**

1. Extend call / argument interiors to accept **indexed** (`expr => expr`), **`OTHERS =>`**, and **iterator** forms (`FOR … [SEQUENCE|INDEX …] => …`), plus name-alternation on the left of `=>` where needed.
2. Bare positional and bare `identifier =>` interiors stay **`call_expression`** at parse time; constructor / qualified / call identity is semantic (#13).
3. Mint a distinct `qualified_expression` (or `aggregate_expression`) node **only** when interior markers make the form unambiguous — recommend **yes** for `OTHERS` / indexed / iterator; **no** for bare positional/named.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E10** | Add aggregate interior forms (`OTHERS`, indexed, iterator, alternation) | Main gap | Lock: 04-expressions |
| **E18** | Distinct node only for marked aggregates vs always `qualified_expression` when typemark known | Semantic vs structural | Lock: 04-expressions; #13 |
| **E19** | Iterator grammar: reuse loop iterator from statements vs dedicated expression iterator | Shared surface with #7 modern iteration | Lock: 04-expressions; #7 |

---

## 8. Member `.` and attribute `%` access

**Source:** Expression / collection methods / cursor attributes; DESIGN-NOTES pain points #1 and #4. Provenance: `expression`, cursor-attribute pages.

- `member_expression` (`obj.prop` / method name) and `attribute_reference` (`obj%attr`) sit at **MEMBER** (highest structural level). Precedence is correct; **no ladder change**.
- Collection methods used as *values* (`COUNT`, `FIRST`, `LAST`, `LIMIT`, `NEXT`, `PRIOR`, `EXISTS`) appear in numeric / boolean expression railroads; methods used as *statements* (`DELETE`/`EXTEND`/`TRIM`) are #7 / B38.
- **Structural** problem — `name` vs `qualified_name` vs `member_expression` vs `call_expression` (many declared conflicts; single `reference` production idea) — is **not** a precedence question. Hand entirely to **#13**.
- `%` ambiguity (`%TYPE` / `%ROWTYPE` in declarations vs `%FOUND` / `%ROWCOUNT` / … in expressions) is **context-driven** — declarations inventory B28–B29 + #13.

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E20** | Unified postfix chain (`.`, `%`, call/index `(…)`) vs separate expression nodes | Tree shape | Lock: 04-expressions; #13 |
| **E21** | Indexing `a(i)` as call-like postfix vs dedicated `index_expression` | Collides with calls | Lock: 04-expressions; #13 |

---

## 9. Primaries and other expression forms (brief)

Own-words primary inventory (bind tighter than / outside the operator table):

| Primary | Notes |
|---------|--------|
| Literals | string, q-string, number, boolean, null, date/timestamp/interval (lexical inventory) |
| Name / qualified name | #13 |
| Bind variable / placeholder | `:name`, `:1` |
| Inquiry directive | `$$name` (static + ordinary expression) |
| Parenthesized expression | `( expression )` |
| Function call | §5 |
| CASE | §4 |
| Constructor / qualified | §6–§7 |
| Cursor attributes | `SQL%…`, `cursor%…` |
| Collection method call (function form) | `c.COUNT`, `c.EXISTS(i)`, … |
| Conditional predicates | `INSERTING` / `UPDATING` / `DELETING` — trigger context; may be boolean primaries |

### 9.1 Static expressions (sketch)

Used in conditional compilation and some subtype / constraint bounds. Manual: only certain operators and a fixed function allow-list; no variables / non-static calls. Full placement is Phase 7; Phase 4 should either:

- reuse ordinary `expression` and let semantics reject non-static forms, or
- maintain a restricted `static_expression` nonterminal

| ID | Question | Why it matters | Feeds |
|----|----------|----------------|-------|
| **E22** | Restricted `static_expression` vs ordinary expression + semantic check | Directives / subtype bounds | Lock: 04-expressions; #15 |

### 9.2 SQL functions in PL/SQL expressions

Manual lists banned classes (aggregates, analytics, many JSON/XML/model/object-ref functions, …). Grammar does **not** need a ban list if every call is a generic `function_call`; bans are semantic. Relevant only if #14 injects SQL-only call shapes.

---

## 10. Decision index (all Tree-sitter flags)

| ID | Topic | Severity for Phase 4 | Owner ticket |
|----|-------|----------------------|--------------|
| **E1** | Adopt Table 3-3 ladder (§3.1) | **Hard / required** | Lock: 04-expressions |
| **E2** | `\|\|` co-located with binary `+`/`-` | **Hard** | Lock: 04-expressions |
| **E3** | Unary / `**` order + associativity policy | **Hard** | Lock: 04-expressions |
| **E4** | Drop infix `MOD` | Required | Lock: 04-expressions |
| **E5** | `~=` / `^=` comparison tokens | Required (with L2) | Lock: 04-expressions; 01-lexical |
| **E6** | Flat permissive `COMPARE` tier | Medium | Lock: 04-expressions |
| **E7** | CASE multi-choice + dangling predicates | **Hard** | Lock: 04-expressions |
| **E8** | Named-arg LHS = identifier | Required | Lock: 04-expressions |
| **E9** | Constructor ≡ call at parse time | **Hard** | Lock: 04-expressions; #13 |
| **E10** | Qualified-expression aggregate interiors | **Hard** | Lock: 04-expressions; #13 |
| E11–E12 | Typed families vs one `expression`; primaries | Medium | Lock: 04-expressions |
| E13 | Extra comparison forms (`MEMBER OF`, …) | Medium | Lock: 04-expressions; #14 |
| E14–E15 | Dangling-predicate node; CASE conflict | Medium / hard | Lock: 04-expressions; #5; #7 |
| E16–E17 | Mixed-notation enforcement; bare calls | Medium | Lock: 04-expressions; #13 |
| E18–E19 | Aggregate node policy; iterator reuse | **Hard** | Lock: 04-expressions; #13; #7 |
| E20–E21 | Postfix chain / indexing | **Hard** | Lock: 04-expressions; #13 |
| E22 | Static expression strategy | Medium | Lock: 04-expressions; #15 |

---

## 11. Reconciled precedence proposal (copy-ready for DESIGN-NOTES)

Replace the DESIGN-NOTES Phase-4 starting ladder with:

```
OR < AND < NOT < comparison
  < ( + | - | || )
  < ( * | / )
  < unary(+|-)
  < **                    -- right-associative
  < call / index postfix
  < member (.) / attribute (%)
```

Associativity policy (parser-only; manual leaves same-level order unspecified):

- `**`: right-associative
- All other binary operator tiers: left-associative
- Comparison: left-associative and permissive (no semantic non-associativity enforcement)

---

## 12. Ref grammar salvage map

| Area | Keep | Drop / redesign |
|------|------|-----------------|
| Logical ladder `OR < AND < NOT < COMPARE` | Yes | — |
| `CALL` / `MEMBER` above operators | Yes | — |
| `BETWEEN` / `IN` / `LIKE` / `IS` at COMPARE | Yes | — |
| Arithmetic / concat / unary / `**` | Structure | **Reorder per §3.1**; merge concat with add; raise unary; raise `**` above unary |
| Infix `mod` | — | **Drop** |
| Comparison ops | `= != <> < > <= >=` | **Add** `~=` `^=`; avoid only splitting `!` `=` / `<` `=` unless extras demand it |
| `PRIOR` / `DISTINCT` unary | — | Remove from PL/SQL expr; #14 / SQL args |
| CASE expression | Skeleton | Multi-choice WHEN; dangling predicates; document `END` vs `END CASE` |
| Named args | Mixed list | Tighten LHS to identifier |
| Qualified expressions | — | **Add** (§7) |
| Collection constructor | — | No dedicated node if E9 says call |
| Conflicts name/call/member | As declared | Redesign under #13 |

---

## 13. Provenance entries (for `docs/provenance/manifest.jsonl`)

Suggested rows (own summaries only):

```json
{"id": "expr-precedence", "kind": "expression", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/expressions.html", "section": "Expressions — Operator Precedence (Table 3-3)", "release": "26", "retrieved": "2026-07-16", "summary": "Authoritative ladder highest→lowest: ** ; unary +/- ; */ ; binary +/- || ; comparison incl. IS NULL/LIKE/BETWEEN/IN ; NOT ; AND ; OR. Equal-precedence order unspecified. Inventory: docs/spec/research/04-expressions-precedence-inventory.md.", "rules": ["expression", "binary_expression", "unary_expression"], "notes": "Reconcile vs grammar-ref PREC; flags E1–E5."}
{"id": "expression", "kind": "expression", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/expression.html", "section": "Expression", "release": "26", "retrieved": "2026-07-16", "summary": "Top-level alternatives: boolean/character/date/numeric families, collection_constructor, qualified_expression, simple/searched CASE, parenthesized expression; function_call and other_boolean_form nested.", "rules": ["expression", "function_call", "case_expression"], "notes": "Flags E11–E12, E20–E21."}
{"id": "expr-case", "kind": "expression", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/expressions.html", "section": "Expressions — CASE Expressions", "release": "26", "retrieved": "2026-07-16", "summary": "Simple CASE with multi-choice WHEN and dangling predicates; searched CASE; expression closes with END.", "rules": ["simple_case_expression", "searched_case_expression", "dangling_predicate"], "notes": "Flags E7, E14–E15."}
{"id": "collection-constructor", "kind": "expression", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/collection-constructors.html", "section": "Collection Constructors", "release": "26", "retrieved": "2026-07-16", "summary": "collection_type([value,...]) for varray/nested table; empty T() allowed; assoc arrays use qualified expressions.", "rules": ["collection_constructor"], "notes": "Syntactic call collision; flag E9."}
{"id": "qualified-expressions", "kind": "expression", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/qualified-expressions-overview.html", "section": "Qualified Expressions Overview", "release": "26", "retrieved": "2026-07-16", "summary": "typemark(...) empty/simple/aggregate; positional, named, indexed, iterator, sequence, OTHERS choices; main ref-grammar gap.", "rules": ["qualified_expression", "aggregate"], "notes": "Flags E10, E18–E19; feeds #13."}
{"id": "named-parameters", "kind": "expression", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/subprogram-parameters.html", "section": "Positional, Named, and Mixed Notation for Actual Parameters", "release": "26", "retrieved": "2026-07-16", "summary": "formal => actual named notation; mixed positional-then-named semantic rule; LHS is formal parameter name.", "rules": ["function_call", "named_argument"], "notes": "Flags E8, E16–E17."}
{"id": "case-statement", "kind": "statement", "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/CASE-statement.html", "section": "CASE Statement", "release": "26", "retrieved": "2026-07-16", "summary": "Statement form closes END CASE [label]; THEN holds statements; multi-choice/dangling predicates also documented.", "rules": ["case_statement"], "notes": "Boundary vs case expression; flag E15; statements inventory #7."}
```

---

## 14. What this inventory does *not* decide

Deferred explicitly:

- **All E1–E22 lock choices** — graduate to **Lock spec: 04-expressions.md** (this inventory is the decision list + reconciled ladder proposal).
- **Name / call / member / qualified / constructor identity** — [Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13) (E9, E10, E17–E21).
- **Embedded SQL expression surface** (`PRIOR`, analytic clauses, SQL-only functions) — [Decide: embedded SQL subset boundary](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/14).
- **CASE statement and procedure-call statements** — [Inventory: statements](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/7).
- **Recovery-vs-precision** for conflict retention — [Decide: recovery-vs-precision rubric](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/5).
- **Implementation** of the grammar — out of map scope until specs lock.
