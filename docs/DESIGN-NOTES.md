# Design notes

Numbered decision index for the locked design spec. Deliberation lives on the map tickets; this file gists the lock and points at the source. Area detail lives under `docs/spec/`.

**Map:** [Map: Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)

## Index

| ID | Title | Status | Source |
|----|--------|--------|--------|
| D1–D9 | Pre-map salvage (naming, reserved words, fields, blocks, opaque literals, q-strings, …) | Partial — cited from inventories; full text not yet restored in-repo | Research inventories; D9 flipped in #11 |
| [D10](#d10--publish-targets-v1) | Publish targets (v1 bindings) | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D11](#d11--file-type-claim) | File-type claim | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D12](#d12--node-shape-versioning) | Node-shape versioning | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |
| [D13](#d13--ci-and-private-corpus) | CI and private corpus | Locked | [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10) |

---

## D10 — Publish targets (v1)

**Locked 2026-07-16** via [Decide: publish targets, CI shape, and file-type claim](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10).

**v1 first-class publish surfaces:**

| Surface | Binding | Registry / form |
|---------|---------|-----------------|
| Node | `node: true` | npm (`tree-sitter-oracle-plsql`) |
| Rust | `rust: true` | crates.io |
| Python | `python: true` | PyPI |
| C | `c: true` | headers / pkg-config (shared host path) |

**Not v1 publish / not release-CI:** Go and Swift (`go: false`, `swift: false` in `tree-sitter.json`). May be re-enabled later if demand appears; until then we do not own their release matrices.

**Also off:** Java, Zig (unchanged).

**Plan applied in** `tree-sitter.json` → `bindings`.

---

## D11 — File-type claim

**Locked 2026-07-16** via [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10).

**Claim these extensions only** (PL/SQL-specific; no bare `.sql`):

```
pks, pkb, pls, plb, pck, prc, fnc, trg
```

**Scope / injection (unchanged):** `scope: source.oracle_plsql`, `injection-regex: ^oracle_plsql$`.

**Not claimed:** `.sql` — collides with generic SQL grammars; editors should keep generic SQL as the default for that extension. Users who store PL/SQL in `.sql` files force-language or inject `oracle_plsql` locally.

**Plan applied in** `tree-sitter.json` → `grammars[0].file-types`.

---

## D12 — Node-shape versioning

**Locked 2026-07-16** via [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10).

| Era | Policy |
|-----|--------|
| **Pre-1.0 (`0.x`)** | Public node/field shapes may change when design or bugfix requires it. Document every break in CHANGELOG. Prefer additive changes when cheap; no cross-minor compatibility promise when a note says otherwise. |
| **1.0.0** | First “stable shape” cut: specs implemented, one real consumer pass on in-repo queries, no known forced renames pending. Freezes the **public** node/field surface. |
| **Post-1.0** | **Major:** remove/rename a public node or field; change child structure under a public node so existing queries break; breaking language name/scope change. **Minor:** new nodes/fields, broader acceptance, recovery that does not remove old shapes. **Patch:** bugfixes that restore intended shape without API change. |

**Private rules:** underscore-prefixed grammar rules (`_…`) are never part of the public contract.

**Queries:** in-repo query files ship with the grammar package (same version). External query forks are unsupported by this policy.

**Note:** Tree-sitter **parser ABI** version (CMake `TREE_SITTER_ABI_VERSION`) is orthogonal to this grammar node-shape policy.

---

## D13 — CI and private corpus

**Locked 2026-07-16** via [#10](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/10).

**Bootstrap, then retire private dependency.**

1. **Private ~5k corpus** is required for **initial production readiness** only: local smoke / census ([Census: legacy corpus construct frequencies](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/4); tooling on PR #16). Nothing proprietary is committed; aggregate stats and distilled fixtures only.
2. **Distill** representative cases into **committed public** `test/corpus/` (synthetic / own-words, license-clean). That public corpus becomes the long-term quality gate.
3. **After distillation is done:** no ongoing private-corpus gate and **no self-hosted runner requirement**. Release quality is defined by public CI alone.

**Public CI (when added) runs only open artifacts:** generate, `tree-sitter test` / public corpus, and binding smoke for the four D10 publish targets (plus optional wasm). Never uploads or mounts the private tree.

**While corpus access is still pending:** decide tickets remain unblocked; frequency-sensitive cuts stay provisional until census + distillation land (see map Notes).
