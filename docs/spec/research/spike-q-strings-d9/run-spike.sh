#!/usr/bin/env bash
# PROTOTYPE runner — one command for the D9 q-string spike.
# From repo root:
#   bash docs/spec/research/spike-q-strings-d9/run-spike.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CORPUS="$ROOT/corpus/cases.tsv"
PURE="$ROOT/pure"
SCAN="$ROOT/scanner"
OUT="$ROOT/results.tsv"

need() { command -v "$1" >/dev/null || { echo "missing: $1" >&2; exit 1; }; }
need tree-sitter
need gcc

echo "== generate + build pure =="
(cd "$PURE" && tree-sitter generate && mkdir -p build && tree-sitter build --output build/parser.so)

echo "== generate + build scanner =="
(cd "$SCAN" && tree-sitter generate && mkdir -p build && tree-sitter build --output build/parser.so)

# Returns ok|err
parse_one() {
  local dir="$1" src="$2" tmp out
  tmp="$(mktemp --suffix=.plsql)"
  # shellcheck disable=SC2059
  printf '%s' "$src" >"$tmp"
  if out="$(cd "$dir" && tree-sitter parse "$tmp" 2>&1)"; then
    if echo "$out" | grep -qE 'ERROR|MISSING'; then
      echo err
    else
      # must be a single literal under source_file
      if echo "$out" | grep -q '(literal'; then
        echo ok
      else
        echo err
      fi
    fi
  else
    # non-zero exit still may print a tree with ERROR
    if echo "$out" | grep -qE 'ERROR|MISSING'; then
      echo err
    else
      echo err
    fi
  fi
  rm -f "$tmp"
}

echo -e "id\texpect\tpure\tscanner\tverdict" >"$OUT"
pass_p=0; fail_p=0; pass_s=0; fail_s=0; total=0
gaps=0

while IFS=$'\t' read -r id expect input || [[ -n "${id:-}" ]]; do
  [[ -z "${id:-}" || "$id" == \#* ]] && continue
  total=$((total + 1))
  pure_r="$(parse_one "$PURE" "$input")"
  scan_r="$(parse_one "$SCAN" "$input")"

  verdict="agree"
  if [[ "$pure_r" != "$expect" && "$scan_r" != "$expect" ]]; then
    verdict="both_mismatch"
  elif [[ "$pure_r" != "$expect" ]]; then
    if [[ "$expect" == ok && "$scan_r" == ok ]]; then
      verdict="pure_gap"
      gaps=$((gaps + 1))
    else
      verdict="pure_mismatch"
    fi
  elif [[ "$scan_r" != "$expect" ]]; then
    verdict="scanner_mismatch"
  fi

  [[ "$pure_r" == "$expect" ]] && pass_p=$((pass_p + 1)) || fail_p=$((fail_p + 1))
  [[ "$scan_r" == "$expect" ]] && pass_s=$((pass_s + 1)) || fail_s=$((fail_s + 1))

  printf '%s\t%s\t%s\t%s\t%s\n' "$id" "$expect" "$pure_r" "$scan_r" "$verdict" | tee -a "$OUT"
done <"$CORPUS"

echo
echo "==== summary ===="
echo "cases:   $total"
echo "pure:    $pass_p / $total match expect  (mismatches: $fail_p)"
echo "scanner: $pass_s / $total match expect  (mismatches: $fail_s)"
echo "pure_gap (Oracle-ok, scanner-ok, pure-miss): $gaps"
echo "results: $OUT"
