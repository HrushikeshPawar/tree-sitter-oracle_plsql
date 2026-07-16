# Provenance manifest

`manifest.jsonl` — one JSON object per line, one entry per manual section (or
other source) consulted while implementing a grammar feature. No Oracle content
is copied here: links, our own summaries, and our own EBNF-ish sketches only
(see the licensing section of `../oracle-plsql-release-26-grammar-research.md`).

## Entry schema

```json
{
  "id": "lexical-units",                  // stable slug, referenced from corpus tests & commits
  "kind": "lexical | reserved-words | statement | expression | type | unit | directive | sql | legacy-corpus | reference",
  "source": "https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/lexical-units.html",
  "section": "Lexical Units",             // heading as displayed
  "release": "26",
  "retrieved": "2026-07-16",
  "summary": "Own-words summary of what was taken from this section.",
  "sketch": "optional EBNF-ish notes, own words, reviewed against the diagram",
  "rules": ["line_comment", "block_comment", "identifier", "quoted_identifier"],
  "notes": "deviations, permissiveness decisions, open questions"
}
```

For knowledge derived from the private legacy corpus instead of the manual, use
`"kind": "legacy-corpus"` and describe the pattern in `summary` (never commit
the source files).

## Referencing from corpus tests

Corpus test names embed the provenance id after a `::`, e.g.:

```
==================
identifier :: lexical-units :: quoted identifier with embedded quote
==================
```

This keeps every accepted test traceable to a reviewed source.
