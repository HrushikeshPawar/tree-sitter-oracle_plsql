# Spec: 04 — Expressions and operator precedence

**Status:** Locked  
**Ticket:** [Lock spec: 04-expressions.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/26)  
**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)  
**Locked:** 2026-07-16  

**Research (inputs, not re-decided here):**

- [Inventory: expressions and operator precedence](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/8) → `docs/spec/research/04-expressions-precedence-inventory.md` (flags E1–E22)
- Cross-cutting: `docs/DESIGN-NOTES.md` (**D15**, **D14**, **D3**, **D7**, **D5**, **D19**, **D20** from this lock)

**Related tickets:** reference chain / call identity → **D15** ([Decide: reference-ambiguity strategy](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/13)); CASE conflict + shared `iterator` → **D19** + [Lock spec: 03-statements.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/22); lexical tokens (`~=`/`^=`, unsigned numbers, binds, `$$`) → [Lock spec: 01-lexical.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/12); SQL free-expression OUT set → **D7** + [Lock spec: 05-sql.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32); `static_expression` placement → **D5** + [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34).

---

## 1. Scope

**In scope:** Phase 4 — operator precedence ladder and associativity; public expression node shapes (binary/unary/comparison/CASE/call/qualified/primaries); argument and aggregate interiors; comparison forms in free PL/SQL expression; inheritance of D15 postfix chain and D19 CASE/`iterator` policy; export of `static_expression` for CC.

**Out of scope for this file:** `grammar.js` implementation; statement catalog (except shared CASE conflict and `iterator`); deep embedded SQL (D7); unit headers; full CC arm placement (07-directives owns sites); semantic type-checking / staticness validation; multi-value row `(a,b,…)` as free primary (D7 OUT).

---

## 2. Standing rules applied

| Decision | How it applies here |
|----------|---------------------|
| [D1](../DESIGN-NOTES.md#d1--grammar-name-and-node-naming) | Manual / Tree-sitter names: `binary_expression`, `case_expression`, `call_expression`, `qualified_expression`, … No keyword nodes; operators are anonymous tokens. |
| [D3](../DESIGN-NOTES.md#d3--supertypes-and-fields) | All expression forms → supertype **`expression`**. Core fields: `left`/`right`/`operator`, `function`, `arguments`, `selector`, `default`, `name`, `value`, `condition` where role matches. Lists via `argument_list` etc. No `reference` supertype. |
| [D5](../DESIGN-NOTES.md#d5--conditional-compilation-envelope) | Dedicated **`static_expression`** for `$IF`/`$ELSIF` only — not ordinary expression. |
| [D7](../DESIGN-NOTES.md#d7--embedded-sql) | Precise WHERE reuses this ladder + `EXISTS`/`IN` subquery; free-expression OUT: `ANY`/`ALL`/`SOME`/`PRIOR`, multi-value row, deep SQL predicates. |
| [D14](../DESIGN-NOTES.md#d14--recovery-vs-precision-rubric) | Claimed R26 PL/SQL → precise ladder and nodes; invalid mixed-arg order / aggregate order → no grammar ban; SQL-only forms not fake-accepted as free primaries. |
| [D15](../DESIGN-NOTES.md#d15--reference-ambiguity-strategy) | Unified postfix chain; unmarked `(…)` → `call_expression`; marked aggregates → `qualified_expression`; bare `f` never a call; single `attribute_reference`; `parenthesized_expression` vs subquery by interior keyword. |
| [D19](../DESIGN-NOTES.md#d19--statement-catalog-case-and-iterator) | One conflict `case_expression` ↔ `case_statement`; shared full-R26 **`iterator`**; permissive dangling predicates. |
| [D20](../DESIGN-NOTES.md#d20--expression-precedence-and-surface) | Reconciled Table 3-3 ladder + associativity + Phase-4 surface gist (this lock). |

---

## 3. Decisions

### 3.1 Precedence ladder and associativity (E1–E6)

| ID | Lock |
|----|------|
| **E1** | **Table 3-3 is authoritative** for PL/SQL operator binding. Final lowest→highest: |
| | `OR < AND < NOT < comparison < ( + \| - \| \|\| ) < ( * \| / ) < unary(+|-) < ** < call/index postfix < member(.) / attribute(%)` |
| **E2** | Concatenation **`||` shares the additive level** with binary `+` / `-` (not a separate tier below add). |
| **E3** | **Unary** arithmetic `+`/`-` sit **above** mul/div and **below** `**`. Logical **`NOT`** stays at its own tier (below comparison, above `AND`). **Associativity (parser-only):** `**` right-associative; all other binary tiers left-associative; comparison left-associative and permissive. |
| **E4** | **No infix `MOD`**. `MOD(a,b)` is a call. Drop any ref-grammar `mod` binary. |
| **E5** | Comparison inequality tokens: all four **`<>` `!=` `~=` `^=`** (inherits [L2](01-lexical.md)). |
| **E6** | **One flat `COMPARE` tier** for all comparison forms (relationals, `IS NULL`, `LIKE`, `BETWEEN`, `IN`, and E13 PL/SQL extras). No nested non-associativity enforcement (`a = b = c` still builds a tree). Multi-operand forms use dedicated nodes at this level (not forced into 2-child `binary_expression`). |

**Concrete bind examples (must hold):**

| Source | Tree sense |
|--------|------------|
| `-a*b` | `(-a)*b` |
| `-2**2` | `-(2**2)` |
| `NOT a = b` | `NOT (a = b)` |
| `a \|\| b + c` | same-level left-assoc (`(a \|\| b) + c` under our policy) |

**PREC map (implementer sketch, higher = tighter):**

```js
const PREC = {
  OR: 1,
  AND: 2,
  NOT: 3,
  COMPARE: 4,
  ADD_CONCAT: 5, // '+', '-', '||'
  MUL: 6,        // '*', '/'
  UNARY: 7,      // unary '+', '-'
  POW: 8,        // '**'  right-assoc
  CALL: 9,       // call / index postfix
  MEMBER: 10,    // '.' and '%'
};
```

**Not on this ladder (D7 / statements):** `PRIOR`, `CONNECT_BY_ROOT`, SQL-only unaries; `DISTINCT`/`ALL` as aggregate-arg markers, not PL/SQL expression unaries.

### 3.2 Root shape and primaries (E11–E12)

| ID | Lock |
|----|------|
| **E11** | **One recursive public `expression`.** No public typed-family nonterminals (`boolean_expression`, `numeric_expression`, …). Operator tiers may be hidden (`_or_expression`, …). |
| **E12** | **Explicit primaries** under the ladder (then D15 postfixes): |

**Primary catalog:**

| Primary | Public node / token | Notes |
|---------|---------------------|--------|
| Literals | per 01-lexical | `literal` supertype; `inquiry_directive` literal-like |
| Name seed | `identifier` / `quoted_identifier` | Then D15 chain |
| Bind | `bind_variable` | |
| Parenthesized | `parenthesized_expression` | `(` expression `)` only |
| CASE | `case_expression` | §3.3 |
| Marked aggregate | `qualified_expression` | D15 / §3.5 |
| Subquery-as-expr | SQL query node per D7/D15 | Interior **starts with** claimed query keyword |
| Trigger predicates | `conditional_predicate` | `INSERTING` / `UPDATING` / `DELETING` (optional column list on `UPDATING` if R26 allows) |

**Not separate primaries** (D15 chain): function call, indexing, bare constructor → `call_expression`; member / attribute / dblink → chain postfixes; collection methods as values → member + optional call.

**OUT as free primary (v1):** multi-value row `(a, b, …)` (D7/D15).

### 3.3 CASE expression (E7, E14–E15)

| ID | Lock |
|----|------|
| **E7** | Simple CASE expression includes **multi-choice WHEN** (`WHEN a, b THEN …`) and **dangling predicates** (`WHEN < 0`, `WHEN BETWEEN …`, `WHEN IN …`). Searched CASE: `WHEN` boolean `THEN` result. Closer: bare **`END`**. No `ELSE` → NULL is semantic. |
| **E14** | Dedicated public **`dangling_predicate`** (shared with statement CASE). Interior = comparison operator vocabulary without a left operand. **Permissive** interiors (S11/D19): accept forms the manual may not fully support yet. |
| **E15** | **Inherit D19/S8:** one declared conflict `case_expression` ↔ `case_statement` (`END` vs `END CASE` [label]). Do not merge into a fake shared node. |
| **Node** | **One** public `case_expression` (not split simple/searched). Optional `selector` present ⇒ simple; absent ⇒ searched. |

**Fields:**

| Node | Fields |
|------|--------|
| `case_expression` | optional `selector`; `when_clause`+ (or list); optional `default` (ELSE result) |
| `when_clause` | choices: selector values and/or `dangling_predicate` (comma-separated multi-choice); `consequence` (THEN result expression / statement list on statement side) |
| `dangling_predicate` | operator + RHS structure matching COMPARE forms minus left |

### 3.4 Calls and arguments (E8, E16–E17)

| ID | Lock |
|----|------|
| **E8** | Named-arg LHS is **simple identifier only** (keyword re-admission per L10/D15 where applicable). Never a member/call chain. Node: `named_argument` fields `name`, `value`. |
| **E16** | **Do not enforce** positional-before-named. Mixed lists any order; semantics judge. |
| **E17** | **Inherit D15:** bare `f` is never a call; only `f()` (empty or non-empty) is `call_expression`. |

**Call shape:**

```
call_expression =
    function  "("  [ argument_list ]  ")"
  ;

argument_list =
    actual { "," actual }
  ;

actual =
    expression                    -- positional
  | named_argument                -- name => value
  ;
```

- Field on `call_expression`: **`function`** (callee expression / chain), **`arguments`** → `argument_list` (empty list node or omitted interior both represent `()` — prefer empty `argument_list` for stable queries).
- Indexing `a(i)` and bare constructors `T(1,2)` are **`call_expression`** at parse time (E9/E21/D15).

### 3.5 Constructors, qualified expressions, postfixes (E9–E10, E18–E21)

| ID | Lock |
|----|------|
| **E9** | **No distinct `collection_constructor` node** for bare positional form — always `call_expression` (identity semantic). |
| **E10** | **Full aggregate interiors** on marked forms: `OTHERS =>`, indexed `expr => expr`, `FOR` iterator `[SEQUENCE\|INDEX …] =>`, name alternation (`N1 \| N2 =>`), ranges on index choices. |
| **E18** | Distinct **`qualified_expression` only** when interior markers make the form unambiguous (E10). Unmarked positional and bare `identifier =>` stay **`call_expression`**. |
| **E19** | **Shared public `iterator`** with loops (D19/S12) — full R26 controls in v1. |
| **E20** | **Unified D15 postfix chain** (not competing primaries). |
| **E21** | Indexing is call-like postfix — **no** `index_expression` node. |

**Aggregate order:** manual prefers positional → explicit → `OTHERS`. Grammar is **permissive** (any order); semantics judge.

**D15 chain public nodes (expression position):**

| Postfix | Node |
|----------|------|
| `.name` | `member_expression` (`object` + `name` or equivalent) |
| `%attr` | `attribute_reference` |
| `(…)` unmarked | `call_expression` |
| `(…)` marked aggregate | `qualified_expression` |
| `@dblink` | **`database_link_reference`** |
| `(+)` outer join | **`outer_join_operator`** postfix on column ref — not `parenthesized_expression` |

### 3.6 Extra comparison / boolean forms (E13)

| ID | Lock |
|----|------|
| **E13 IN** | Table 3-3 set; **`[NOT] MEMBER [OF]`**; **`IS [NOT] NAN`** / **`IS [NOT] INFINITE`**; multiset peers **`IS [NOT] A SET`**, **`IS [NOT] EMPTY`**, **`SUBMULTISET [OF]`**. |
| **E13 OUT** | **`ANY` / `ALL` / `SOME`** (subquery); **`PRIOR`** / hierarchical; deep SQL-only free-expression predicates (e.g. free `IS JSON` type tests). CASE **dangling** remains permissive (S11). |

### 3.7 Comparison node shapes and NOT compounds

| Form | Public node | Notes |
|------|-------------|--------|
| 2-operand relational / arithmetic / concat / `**` | `binary_expression` | fields `left`, `operator`, `right` |
| unary `+` `-` / logical `NOT` | `unary_expression` | fields `operator`, `argument` |
| `BETWEEN` / `NOT BETWEEN` | `between_expression` | compound NOT on same node — not outer unary |
| `IN` / `NOT IN` | `in_expression` | |
| `LIKE` / `NOT LIKE` [ESCAPE] | `like_expression` | |
| `IS [NOT] NULL` | `is_null_expression` | |
| `MEMBER [OF]` / `NOT MEMBER` | **`member_of_expression`** | name avoids clash with `member_expression` (`.`) |
| `IS [NOT] NAN` | `is_nan_expression` | |
| `IS [NOT] INFINITE` | `is_infinite_expression` | |
| `IS [NOT] A SET` | `is_a_set_expression` | |
| `IS [NOT] EMPTY` | `is_empty_expression` | |
| `SUBMULTISET [OF]` | `submultiset_expression` | |

**NOT on comparison forms** (`NOT LIKE`, `NOT BETWEEN`, `NOT IN`, `NOT MEMBER`, `IS NOT NULL`, …) is a **compound form on that node**, not `unary_expression` wrapping the positive form — preserves Table 3-3 binding (`NOT` tier vs COMPARE tier).

### 3.8 Static expression (E22)

| ID | Lock |
|----|------|
| **E22** | Dedicated **`static_expression`** for **conditional compilation only** (D5). Thin ladder: `$$`, literals, boolean/relational ops, parens, dotted static-looking calls; slightly over-accept; no semantic static check. Ordinary code uses full **`expression`**. Subtype sizes remain **B17** (`number_literal` only) — not this ladder. Production **exported** here / finalized for placement in 07-directives. |

---

## 4. Surface catalog (public nodes / fields)

**Supertype:** `expression` (D3), except pure tokens (`identifier`, literals, binds) which participate as leaves.

| Node | Notes / key fields |
|------|---------------------|
| `binary_expression` | `left`, `operator`, `right` |
| `unary_expression` | `operator`, `argument` |
| `between_expression` / `in_expression` / `like_expression` / `is_null_expression` | COMPARE tier |
| `member_of_expression` / `is_nan_expression` / `is_infinite_expression` / `is_a_set_expression` / `is_empty_expression` / `submultiset_expression` | E13 |
| `case_expression` | optional `selector`; when clauses; optional `default` |
| `when_clause` | choices + `consequence` |
| `dangling_predicate` | shared with statement CASE |
| `call_expression` | `function`, `arguments` → `argument_list` |
| `argument_list` / `named_argument` | `name` + `value` on named |
| `qualified_expression` | typemark + aggregate choices; may embed `iterator` |
| `parenthesized_expression` | single `expression` child |
| `member_expression` | `.` access (D15) |
| `attribute_reference` | `%` (D15) |
| `database_link_reference` | `@dblink` |
| `outer_join_operator` | `(+)` postfix |
| `conditional_predicate` | INSERTING / UPDATING / DELETING |
| `static_expression` | CC only (D5/E22) |
| `iterator` / `iterand_decl` / controls | shared with statements (D19) |

Operators and structural keywords remain **anonymous tokens** (D1).

---

## 5. Deferred / out of scope

| Item | Owner |
|------|--------|
| Statement CASE / IF / loops | [Lock spec: 03-statements.md](03-statements.md) / D19 |
| Procedure call **statement** wrapper | D15 + 03-statements |
| SQL spine depth, WHERE hooks, row multi-value | D7 + [Lock spec: 05-sql.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/32) |
| CC arm placement / `$ERROR` | D5 + [Lock spec: 07-directives.md](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/34) |
| Assignment target | D15 + 03-statements (`assignment_target`) |
| Implementation of `grammar.js` | Out of map |

---

## 6. Implementation hand-off (Phase 4)

1. Install reconciled **PREC** map (E1–E6); right-assoc `**` only; merge `||` with additive; drop infix `mod`; add `~=`/`^=` at COMPARE.  
2. Single recursive `expression` + hidden tiers; primary set per E12; D15 postfix chain above all operators.  
3. `binary_expression` / `unary_expression` + dedicated COMPARE multi-operand nodes; compound NOT on LIKE/BETWEEN/IN/MEMBER/IS forms.  
4. `case_expression` with multi-choice + `dangling_predicate`; declare **one** conflict vs `case_statement`.  
5. `call_expression` + `argument_list` / `named_argument` (identifier LHS; any order).  
6. `qualified_expression` only for marked aggregates; full interiors; shared `iterator`.  
7. E13 PL/SQL multiset/float forms in; D7 OUT set not free primaries.  
8. Export thin `static_expression` for CC.  
9. **Corpus (public):** precedence smoke (`-a*b`, `-2**2`, `NOT a=b`, concat+add); all four `≠`; CASE multi-choice + dangling + `END` vs statement `END CASE`; named/mixed args; `f()` vs bare `f`; marked aggregate (`OTHERS`, indexed, `FOR … =>`); `MEMBER OF` / `IS NAN`; dblink + call; outer join `(+)`; trigger predicates.

---

## 7. Decision index (E1–E22)

| ID | Lock summary |
|----|----------------|
| E1 | Table 3-3 ladder authoritative |
| E2 | `\|\|` co-located with `+`/`-` |
| E3 | Unary below `**` / above mul; left-assoc binaries; right-assoc `**` |
| E4 | No infix MOD |
| E5 | Four `≠` tokens (L2) |
| E6 | Flat permissive COMPARE |
| E7 | CASE multi-choice + dangling |
| E8 | Named-arg LHS = identifier |
| E9 | Constructor ≡ call (D15) |
| E10 | Full aggregate interiors; permissive order |
| E11 | One recursive `expression` |
| E12 | Explicit primary catalog |
| E13 | Multiset/float IN; ANY/ALL/SOME/PRIOR OUT |
| E14 | `dangling_predicate` node |
| E15 | One CASE conflict (D19) |
| E16 | No positional-before-named enforcement |
| E17 | Bare `f` never call (D15) |
| E18 | `qualified_expression` only when marked (D15) |
| E19 | Shared `iterator` (D19) |
| E20 | Unified postfix chain (D15) |
| E21 | Indexing as call postfix (D15) |
| E22 | `static_expression` for CC only (D5) |

---

## 8. DESIGN-NOTES entries

Non-obvious cross-cutting locks are gisted as **[D20](../DESIGN-NOTES.md#d20--expression-precedence-and-surface)** (reconciled ladder + Phase-4 surface). Reference chain remains **D15**; CASE conflict / iterator **D19**; SQL free-expression OUT **D7**; CC static ladder **D5**.
