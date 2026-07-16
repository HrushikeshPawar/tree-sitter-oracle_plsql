;; oracle_plsql — highlights (v1 stub)
;; Spec: docs/spec/08-queries.md (Q4–Q6, Q10–Q11) · DESIGN-NOTES D23
;; Policy: hybrid keywords; specific-before-general; SQL soup = token-class only.
;; Expand as grammar nodes land. Case: match source; grammar uses case-insensitive keywords.

; --- Lexical / comments ---
(comment) @comment

(string_literal) @string
(q_string_literal) @string
(number_literal) @number
(boolean_literal) @boolean
(null_literal) @constant.builtin
(date_literal) @string
(timestamp_literal) @string
(interval_literal) @string
(bind_variable) @variable.builtin
(inquiry_directive) @keyword.directive

; --- CC / script (anonymous $… tokens from dollar_keyword helper; DIR9) ---
[
  "$IF"
  "$THEN"
  "$ELSIF"
  "$ELSE"
  "$END"
  "$ERROR"
] @keyword.directive

(script_slash) @punctuation.special

(set_define_command) @keyword.directive

; --- Pragmas ---
(pragma_declaration
  name: (_) @function.builtin)
(pragma_statement
  name: (_) @function.builtin)
(pragma
  name: (_) @function.builtin)

; --- Name-site roles (examples; extend per production) ---
(label
  name: (_) @label)

(variable_declaration
  name: (_) @variable)
(exception_declaration
  name: (_) @variable)
(parameter_declaration
  name: (_) @variable.parameter)

(call_expression
  function: (_) @function.call)
; procedure_call callee: wire field once 03-statements implementation freezes it (D15)

; CREATE / nested outline names (highlight as function/type; tags own outline)
(create_function
  name: (_) @function)
(create_procedure
  name: (_) @function)
(create_package
  name: (_) @namespace)
(create_package_body
  name: (_) @namespace)
(create_type
  name: (_) @type)
(create_trigger
  name: (_) @function)

; --- SQL spine (claimed keywords only — do NOT list JOIN/GROUP inside soup) ---
; Parent-scoped examples once statement nodes exist:
; (select_into_statement "SELECT" @keyword)
; (select_into_statement "INTO" @keyword)
; (insert_statement "INSERT" @keyword)
; (commit_statement "COMMIT" @keyword)

; Opaque regions: no keyword lists — strings/numbers/binds already covered above.

; --- Fallback identifiers (LAST) ---
(identifier) @variable
(quoted_identifier) @variable
