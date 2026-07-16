#!/usr/bin/env bash
# Census of construct frequencies across the private legacy PL/SQL corpus.
#
# Aggregate stats ONLY. Never prints, commits, or emits file contents or file
# paths — matched text is piped straight into `wc`/tally and discarded, and
# grep runs with -h so filenames never surface. Safe to run on proprietary code.
#
# This is the evidence base for the embedded-SQL boundary (#14), the
# directives/script-layer design (#15), and lexical decisions (q-strings, D9).
# It is regex-based on purpose: it must not depend on the (placeholder) grammar.
#
# Usage:
#   LEGACY_CORPUS_DIR=/path/to/legacy/plsql scripts/legacy-census.sh
#   LEGACY_CORPUS_DIR=/path/to/legacy/plsql scripts/legacy-census.sh > census.md
set -euo pipefail

dir="${LEGACY_CORPUS_DIR:?Set LEGACY_CORPUS_DIR to the legacy PL/SQL directory}"
[ -d "$dir" ] || { echo "error: '$dir' is not a directory" >&2; exit 1; }

# ---- collect the file list once (same extensions as legacy-smoke.sh) ---------
mapfile -d '' FILES < <(find "$dir" -type f \
  \( -iname '*.sql' -o -iname '*.pks' -o -iname '*.pkb' -o -iname '*.prc' \
     -o -iname '*.fnc' -o -iname '*.trg' -o -iname '*.pls' -o -iname '*.plb' \) -print0)

TOTAL=${#FILES[@]}
[ "$TOTAL" -gt 0 ] || { echo "error: no PL/SQL files found under '$dir'" >&2; exit 1; }

# fgrep helpers — never print matched text or paths, only counts.
occ() { printf '%s\0' "${FILES[@]}" | xargs -0 grep -IhaoiE -- "$1" 2>/dev/null | wc -l | tr -d ' '; }
fic() { printf '%s\0' "${FILES[@]}" | xargs -0 grep -IlaiE -- "$1" 2>/dev/null | wc -l | tr -d ' '; }

# Emit one Markdown table row: | label | occurrences | files (of TOTAL) |
row() {
  local label="$1" pat="$2"
  printf '| %s | %s | %s |\n' "$label" "$(occ "$pat")" "$(fic "$pat")"
}

section() { printf '\n### %s\n\n| Construct | Occurrences | Files |\n|---|---:|---:|\n' "$1"; }

# ---- header ------------------------------------------------------------------
printf '# Legacy corpus census\n\n'
printf -- '- Corpus files scanned: **%s**\n' "$TOTAL"
printf -- '- Method: case-insensitive regex over raw file text (grammar-independent). Occurrence = match count; Files = files with >=1 match.\n'
printf -- '- Aggregate stats only; no file contents or paths were recorded.\n'

printf '\n## Per-extension breakdown\n\n| Extension | Files |\n|---|---:|\n'
printf '%s\0' "${FILES[@]}" | xargs -0 -n1 basename 2>/dev/null \
  | sed -E 's/.*(\.[^.]+)$/\1/' | tr '[:upper:]' '[:lower:]' \
  | sort | uniq -c | sort -rn | awk '{printf "| %s | %s |\n", $2, $1}'

# ---- SQL statement kinds -----------------------------------------------------
section "SQL statement kinds"
row "SELECT"                 '\bselect\b'
row "SELECT ... INTO (PL/SQL)" '\bselect\b[[:space:]].*\binto\b'
row "INSERT"                 '\binsert[[:space:]]+into\b'
row "UPDATE"                 '\bupdate\b[[:space:]]+[a-z]'
row "DELETE"                 '\bdelete[[:space:]]+from\b'
row "MERGE"                  '\bmerge[[:space:]]+into\b'
row "cursor FOR loop"        '\bfor\b.*\bin\b.*\(?[[:space:]]*\bselect\b'
row "OPEN ... FOR"           '\bopen\b.*\bfor\b'
row "EXECUTE IMMEDIATE"      '\bexecute[[:space:]]+immediate\b'
row "FORALL"                 '\bforall\b'
row "BULK COLLECT"           '\bbulk[[:space:]]+collect\b'
row "RETURNING [INTO]"       '\breturning\b'
row "explicit CURSOR decl"   '\bcursor[[:space:]]+[a-z_]'

# ---- SQL clauses & constructs (embedded-SQL boundary, #14) -------------------
section "SQL clauses & constructs"
row "old-style outer join (+)" '\(\+\)'
row "ANSI JOIN (any)"        '\b(inner|left|right|full|cross)[[:space:]]+(outer[[:space:]]+)?join\b|[^a-z]join\b'
row "WITH / CTE"             '\bwith\b[[:space:]]+[a-z_]+[[:space:]]+as[[:space:]]*\('
row "CONNECT BY / hierarchical" '\bconnect[[:space:]]+by\b|\bstart[[:space:]]+with\b'
row "GROUP BY"               '\bgroup[[:space:]]+by\b'
row "HAVING"                 '\bhaving\b'
row "analytic OVER(...)"     '\bover[[:space:]]*\('
row "PARTITION BY"           '\bpartition[[:space:]]+by\b'
row "MODEL clause"           '\bmodel\b[[:space:]]+(dimension|measures|return|ignore|partition)'
row "PIVOT / UNPIVOT"        '\b(un)?pivot\b'
row "dblink reference @"     '\bfrom\b.*@[a-z0-9_]+|[a-z0-9_]+@[a-z0-9_]+[[:space:]]*[,)]'
row "sequence NEXTVAL/CURRVAL" '\.(nextval|currval)\b'
row "hint /*+ ... */"        '/\*\+'

# ---- conditional compilation & pragmas (#15) --------------------------------
section "Conditional compilation & pragmas"
row '$IF'                    '\$if\b'
row '$THEN'                  '\$then\b'
row '$ELSIF'                 '\$elsif\b'
row '$ELSE'                  '\$else\b'
row '$END'                   '\$end\b'
row '$ERROR'                 '\$error\b'
row 'inquiry directive $$'   '\$\$[a-z_]'
row "PRAGMA (any)"           '\bpragma\b'
row "  AUTONOMOUS_TRANSACTION" '\bpragma[[:space:]]+autonomous_transaction\b'
row "  EXCEPTION_INIT"       '\bpragma[[:space:]]+exception_init\b'
row "  SERIALLY_REUSABLE"    '\bpragma[[:space:]]+serially_reusable\b'
row "  RESTRICT_REFERENCES"  '\bpragma[[:space:]]+restrict_references\b'
row "  INLINE"               '\bpragma[[:space:]]+inline\b'
row "  UDF"                  '\bpragma[[:space:]]+udf\b'
row "  DEPRECATE"            '\bpragma[[:space:]]+deprecate\b'

# ---- SQL*Plus / script layer (#15) ------------------------------------------
section "SQL*Plus / script layer"
row "slash terminator (line = /)" '^[[:space:]]*/[[:space:]]*$'
row "SET (SQL*Plus)"         '^[[:space:]]*set[[:space:]]+(define|serveroutput|feedback|echo|pagesize|linesize|verify|termout|heading|scan|sqlblanklines)\b'
row "DEFINE"                 '^[[:space:]]*def(ine)?[[:space:]]+'
row "PROMPT"                 '^[[:space:]]*prompt\b'
row "WHENEVER"               '^[[:space:]]*whenever[[:space:]]+(sqlerror|oserror)\b'
row "SPOOL"                  '^[[:space:]]*spool\b'
row "EXEC / EXECUTE"         '^[[:space:]]*exec(ute)?\b'
row "@ / @@ include"         '^[[:space:]]*@@?[a-z0-9_./]'
row "COLUMN"                 '^[[:space:]]*col(umn)?[[:space:]]+'
row "VARIABLE"               '^[[:space:]]*var(iable)?[[:space:]]+'
row "ACCEPT"                 '^[[:space:]]*accept\b'
row "CONNECT"                '^[[:space:]]*conn(ect)?[[:space:]]+'
row "substitution var &/&&"  '&&?[a-z0-9_]+'

# ---- program units -----------------------------------------------------------
section "Program units (CREATE ...)"
row "CREATE [OR REPLACE]"    '\bcreate\b([[:space:]]+or[[:space:]]+replace)?\b'
row "  PACKAGE BODY"         '\bpackage[[:space:]]+body\b'
row "  PACKAGE (spec)"       '\bpackage\b[[:space:]]+[a-z_]'
row "  PROCEDURE"            '\bcreate\b.*\bprocedure\b'
row "  FUNCTION"             '\bcreate\b.*\bfunction\b'
row "  TRIGGER"              '\bcreate\b.*\btrigger\b'
row "  TYPE BODY"            '\btype[[:space:]]+body\b'
row "  TYPE (spec)"          '\bcreate\b.*\btype\b'
row "  VIEW"                 '\bcreate\b.*\bview\b'
row "  LIBRARY"              '\bcreate\b.*\blibrary\b'

# ---- lexical: wrapped units & q-strings (D9) --------------------------------
section "Wrapped units & lexical forms"
row "WRAPPED units"          '\bwrapped\b'
row "q-string q'...'"        "q'"
row "national char literal N'" "\\bn'"
row "line comment --"        '--'
row "block comment /* */"    '/\*'

# q-string delimiter tally (delimiters are punctuation/letters only — safe).
printf '\n### q-string opening delimiters\n\n| Delimiter | Occurrences |\n|---|---:|\n'
printf '%s\0' "${FILES[@]}" | xargs -0 grep -IhaoiE -- "q'." 2>/dev/null \
  | sed -E "s/^.{2}//" | sort | uniq -c | sort -rn \
  | awk '{printf "| `%s` | %s |\n", $2, $1}'

printf '\n_End of census._\n'
