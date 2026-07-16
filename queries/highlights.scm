;; oracle_plsql — highlights (tracer + stubs)
;; Spec: docs/spec/08-queries.md (Q4–Q6, Q10–Q11) · DESIGN-NOTES D23
;; Policy: hybrid keywords; specific-before-general; SQL soup = token-class only.
;; Expand as grammar nodes land. Case: match source; grammar uses case-insensitive keywords.
;;
;; Tracer (#38) public nodes only: source_file, block, null_statement.
;; Keyword tokens are case-insensitive regex (D2) — not queryable as "BEGIN" strings
;; until a later lexical pass settles anonymous-keyword capture strategy.
;; Block comments are extras (scanner-owned, not named nodes).

; Minimal live captures for the tracer surface
(null_statement) @keyword

; --- Planned captures (uncomment / add as nodes land) ---
; (comment) @comment
; (string_literal) @string
; (q_string_literal) @string
; (number_literal) @number
; (boolean_literal) @boolean
; (null_literal) @constant.builtin
; (date_literal) @string
; (timestamp_literal) @string
; (interval_literal) @string
; (bind_variable) @variable.builtin
; (inquiry_directive) @keyword.directive
;
; (block "BEGIN" @keyword)
; (block "END" @keyword)
;
; [
;   "$IF" "$THEN" "$ELSIF" "$ELSE" "$END" "$ERROR"
; ] @keyword.directive
; (script_slash) @punctuation.special
; (set_define_command) @keyword.directive
;
; (pragma_declaration name: (_) @function.builtin)
; (pragma_statement name: (_) @function.builtin)
; (pragma name: (_) @function.builtin)
;
; (label name: (_) @label)
; (variable_declaration name: (_) @variable)
; (exception_declaration name: (_) @variable)
; (parameter_declaration name: (_) @variable.parameter)
; (call_expression function: (_) @function.call)
;
; (create_function name: (_) @function)
; (create_procedure name: (_) @function)
; (create_package name: (_) @namespace)
; (create_package_body name: (_) @namespace)
; (create_type name: (_) @type)
; (create_trigger name: (_) @function)
;
; (identifier) @variable
; (quoted_identifier) @variable
