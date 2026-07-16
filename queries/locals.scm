;; oracle_plsql — locals (tracer + stubs)
;; Spec: docs/spec/08-queries.md (Q7) · DESIGN-NOTES D23
;; Syntactic scopes only — no package visibility, overloads, or SQL object resolution.
;;
;; Tracer (#38): only `block` exists among Q7a scopes.

; --- Scopes (present) ---
(block) @local.scope

; --- Planned scopes (as nodes land) ---
; (loop_statement) @local.scope
; (exception_handler) @local.scope
; (create_function) @local.scope
; (create_procedure) @local.scope
; (create_package) @local.scope
; (create_package_body) @local.scope
; (procedure_definition) @local.scope
; (function_definition) @local.scope

; --- Planned definitions ---
; (label name: (_) @local.definition)
; (variable_declaration name: (_) @local.definition.var)
; (collection_variable_declaration name: (_) @local.definition.var)
; (record_variable_declaration name: (_) @local.definition.var)
; (cursor_variable_declaration name: (_) @local.definition.var)
; (exception_declaration name: (_) @local.definition.var)
; (parameter_declaration name: (_) @local.definition.parameter)
; (cursor_parameter name: (_) @local.definition.parameter)
; (cursor_declaration name: (_) @local.definition)
; (cursor_definition name: (_) @local.definition)
; (create_function name: (_) @local.definition.function)
; (create_procedure name: (_) @local.definition.function)
; (create_package name: (_) @local.definition.namespace)
; (create_package_body name: (_) @local.definition.namespace)
; (create_type name: (_) @local.definition.type)
; (create_trigger name: (_) @local.definition.function)

; --- Planned references ---
; (identifier) @local.reference
; (quoted_identifier) @local.reference
