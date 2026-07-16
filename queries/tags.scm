;; oracle_plsql — tags (v1 stub)
;; Spec: docs/spec/08-queries.md (Q8) · DESIGN-NOTES D23
;; Definition-only outline. No @reference.* tags in v1.
;; Procedures and functions both use @definition.function (parent node distinguishes).

(create_function
  name: (_) @definition.function)
(create_procedure
  name: (_) @definition.function)
(create_package
  name: (_) @definition.package)
(create_package_body
  name: (_) @definition.package)
(create_type
  name: (_) @definition.type)
(create_type_body
  name: (_) @definition.type)
(create_trigger
  name: (_) @definition.trigger)

; Nested subprograms / type-body methods — enable when nested definition nodes land:
; (function_definition name: (_) @definition.function)
; (procedure_definition name: (_) @definition.function)
; (method_declaration name: (_) @definition.method)
; (method_definition name: (_) @definition.method)
