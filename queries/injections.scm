;; oracle_plsql — injections (v1)
;; Spec: docs/spec/08-queries.md (Q3) · DESIGN-NOTES D23
;;
;; Zero outbound injection rules.
;; Embedded SQL is native in this grammar (D7) — do not inject a separate SQL language.
;; WRAPPED / MLE {{…}} payloads stay opaque (D6 / D21) — not injections.
;; Comment injection is not planned.
;;
;; Inbound: hosts may inject this language via tree-sitter.json
;;   scope: source.oracle_plsql
;;   injection-regex: ^oracle_plsql$
;; (D11). That is not expressed in this file.
