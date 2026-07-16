# Census: Appendix D — Reserved Words vs Keywords

**Ticket:** [Census: Appendix D reserved words vs keywords](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/2) · **Map:** [Locked design spec for the spec-driven Oracle PL/SQL grammar](https://github.com/HrushikeshPawar/tree-sitter-oracle_plsql/issues/1)

**Source:** Oracle Database Release 26, *PL/SQL Language Reference* — Appendix D, "PL/SQL Reserved Words and Keywords"
<https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/plsql-reserved-words-keywords.html> (retrieved 2026-07-16)

**Licensing:** No Oracle prose or tables are copied. What follows is factual word membership (the identity of each reserved word / keyword — data, not expression), captured as our own reviewed lists, plus our own summaries. See `docs/oracle-plsql-release-26-grammar-research.md` §Licensing.

---

## Definitions (our own words)

Appendix D lists two case-insensitive sets of identifiers that have special meaning in PL/SQL:

- **Reserved words (Table D-1)** — can **never** be used as ordinary user-defined identifiers. Using one as a variable/type/routine name is a compile error. The lexer must always tokenize these as their keyword, never as an identifier.
- **Keywords (Table D-2)** — have special meaning **but may still be used as ordinary user-defined identifiers**. Oracle permits `keyword`-named variables etc.; the grammar therefore must let these words fall back to `identifier` in name positions even though they are recognized as keywords elsewhere.

Both sets are **case-insensitive**.

> **Count note & verification method:** Counts here come from **parsing the actual HTML table cells** of Appendix D (retrieved once, discarded — no HTML committed), then deduplicating: **85** reserved words (Table D-1) and **252** keywords (Table D-2), no duplicates in either. This overrides the prose counts a summarizing fetch reported ("84" / "227") — that model miscounted (its own per-letter tallies were internally inconsistent). The membership below was cross-checked against the parsed cells word-for-word (zero difference in either direction) and the plural/singular pairs were confirmed present (CLUSTER/CLUSTERS, INDEX/INDEXES, VIEW/VIEWS, plus TABAUTH/COLAUTH).

---

## Set 1 — Reserved words (never ordinary identifiers) — 85 words

```
ALL        ALTER      AND        ANY        AS         ASC        AT
BEGIN      BETWEEN    BY
CASE       CHECK      CLUSTER    CLUSTERS   COLAUTH    COLUMNS    COMPRESS
CONNECT    CRASH      CREATE     CURSOR
DECLARE    DEFAULT    DESC       DISTINCT   DROP
ELSE       END        EXCEPTION  EXCLUSIVE
FETCH      FOR        FROM       FUNCTION
GOTO       GRANT      GROUP
HAVING
IDENTIFIED IF         IN         INDEX      INDEXES    INSERT     INTERSECT
INTO       IS
LIKE       LOCK
MINUS      MODE
NOCOMPRESS NOT        NOWAIT     NULL
OF         ON         OPTION     OR         ORDER      OVERLAPS
PROCEDURE  PUBLIC
RESOURCE   REVOKE
SELECT     SHARE      SIZE       SQL        START      SUBTYPE
TABAUTH    TABLE      THEN       TO         TYPE
UNION      UNIQUE     UPDATE
VALUES     VIEW       VIEWS
WHEN       WHERE      WITH
```

## Set 2 — Keywords (usable as ordinary identifiers) — 252 words

```
A            ACCESSIBLE   ADD          AGENT        AGGREGATE    ARRAY
ATTRIBUTE    AUTHID       AVG          BFILE_BASE   BINARY       BLOB_BASE
BLOCK        BODY         BOTH         BOUND        BULK         BYTE
C            CALL         CALLING      CASCADE      CHAR         CHAR_BASE
CHARACTER    CHARSET      CHARSETFORM  CHARSETID    CLOB_BASE    CLONE
CLOSE        COLLECT      COMMENT      COMMIT       COMMITTED    COMPILED
CONSTANT     CONSTRUCTOR  CONTEXT      CONTINUE     CONVERT      COUNT
CREDENTIAL   CURRENT      CUSTOMDATUM  DANGLING     DATA         DATE
DATE_BASE    DAY          DEFINE       DELETE       DETERMINISTIC DIRECTORY
DOUBLE       DURATION     ELEMENT      ELSIF        EMPTY        ESCAPE
EXCEPT       EXCEPTIONS   EXECUTE      EXISTS       EXIT         EXTERNAL
FINAL        FIRST        FIXED        FLOAT        FORALL       FORCE
GENERAL      HASH         HEAP         HIDDEN       HOUR         IMMEDIATE
IMMUTABLE    INCLUDING    INDICATOR    INDICES      INFINITE     INSTANTIABLE
INT          INTERFACE    INTERVAL     INVALIDATE   ISOLATION    JAVA
LANGUAGE     LARGE        LEADING      LENGTH       LEVEL        LIBRARY
LIKE2        LIKE4        LIKEC        LIMIT        LIMITED      LOCAL
LONG         LOOP         MAP          MAX          MAXLEN       MEMBER
MERGE        MIN          MINUTE       MOD          MODIFY       MONTH
MULTISET     MUTABLE      NAME         NAN          NATIONAL     NATIVE
NCHAR        NEW          NOCOPY       NUMBER_BASE  OBJECT       OCICOLL
OCIDATE      OCIDATETIME  OCIDURATION  OCIINTERVAL  OCILOBLOCATOR OCINUMBER
OCIRAW       OCIREF       OCIREFCURSOR OCIROWID     OCISTRING    OCITYPE
OLD          ONLY         OPAQUE       OPEN         OPERATOR     ORACLE
ORADATA      ORGANIZATION ORLANY       ORLVARY      OTHERS       OUT
OVERRIDING   PACKAGE      PARALLEL_ENABLE PARAMETER PARAMETERS   PARENT
PARTITION    PASCAL       PERSISTABLE  PIPE         PIPELINED    PLUGGABLE
POLYMORPHIC  PRAGMA       PRECISION    PRIOR        PRIVATE      RAISE
RANGE        RAW          READ         RECORD       REF          REFERENCE
RELIES_ON    REM          REMAINDER    RENAME       RESULT       RESULT_CACHE
RETURN       RETURNING    REVERSE      ROLLBACK     ROW          SAMPLE
SAVE         SAVEPOINT    SB1          SB2          SB4          SECOND
SEGMENT      SELF         SEPARATE     SEQUENCE     SERIALIZABLE SET
SHORT        SIZE_T       SOME         SPARSE       SQLCODE      SQLDATA
SQLNAME      SQLSTATE     STANDARD     STATIC       STDDEV       STORED
STRING       STRUCT       STYLE        SUBMULTISET  SUBPARTITION SUBSTITUTABLE
SUM          SYNONYM      TDO          THE          TIME         TIMESTAMP
TIMEZONE_ABBR TIMEZONE_HOUR TIMEZONE_MINUTE TIMEZONE_REGION     TRAILING
TRANSACTION  TRANSACTIONAL TRUSTED     UB1          UB2          UB4
UNDER        UNPLUG       UNSIGNED     UNTRUSTED    USE          USING
VALIST       VALUE        VARIABLE     VARIANCE     VARRAY       VARYING
VOID         WHILE        WORK         WRAPPED      WRITE        YEAR
ZONE
```

---

## Contextual treatment in the legacy reference grammar (`grammar-ref.js`)

The corpus-derived reference grammar (read-only) does **not** treat the two Appendix D sets as a flat allow/deny split. It re-admits selected keywords as identifiers **only in specific positions**, via `alias(keyword(x), $.identifier)`. This is the crucial input to the identifier policy: even Oracle keywords (which Oracle says *are* usable as identifiers) still need explicit re-allowance in a tree-sitter grammar, because the lexer tokenizes them as their keyword and won't fall through to `identifier` on its own.

**`name` rule** (ordinary-identifier position) re-admits, as identifiers:

| Word        | Appendix D classification |
|-------------|---------------------------|
| `date`      | Keyword (Table D-2)       |
| `timestamp` | Keyword (Table D-2)       |
| `interval`  | Keyword (Table D-2)       |
| `document`  | **Not listed in Appendix D** |
| `content`   | **Not listed in Appendix D** |

**`member_name` rule** (position after `.` — attribute / collection-method names) re-admits, as identifiers:

| Word      | Appendix D classification |
|-----------|---------------------------|
| `delete`  | Keyword (Table D-2)       |
| `exists`  | Keyword (Table D-2)       |
| `first`   | Keyword (Table D-2)       |
| `prior`   | Keyword (Table D-2)       |
| `extract` | **Not listed in Appendix D** |
| `last`    | **Not listed in Appendix D** |
| `next`    | **Not listed in Appendix D** |
| `trim`    | **Not listed in Appendix D** |

`identifier` in the ref grammar is `/[A-Za-z_][A-Za-z0-9_$#]*/`; `keyword()` is `token(prec(1, caseInsensitive(word)))` — case-insensitive, one precedence step above a bare identifier.

**Two takeaways for the identifier policy (input to `docs/spec/01-lexical.md`):**

1. **Appendix D's "keywords are usable as identifiers" is not free** in a scanner-based grammar. Each keyword we want usable as a name must be explicitly aliased back to `identifier` in the relevant name rule. The legacy grammar does this narrowly (only where the corpus needed it), not for the whole 227-word set.
2. **The corpus reaches past Appendix D.** Six words the legacy grammar treats as contextual identifiers (`document`, `content`, `extract`, `last`, `next`, `trim`) are **not in either Appendix D set** — they are SQL functions / collection-method names / XML keywords that appear in identifier-like positions in real code. The identifier policy must decide whether to (a) mirror the legacy narrow, position-specific allow-list, (b) broaden it, or (c) formalize a "contextual keyword" mechanism. That decision belongs to the lexical-spec lock (ticket *Lock spec: 01-lexical.md*) and the reference-ambiguity ticket (*Decide: reference-ambiguity strategy*).

---

## Recommendation to downstream tickets

- Encode Set 1 (85 reserved words) as the hard identifier blacklist — never aliasable to `identifier`.
- Do **not** merge Set 2 (252 keywords) into the blacklist. Keywords are lexed as keywords but must remain alias-able to `identifier` in name positions.
- The exact allow-list of *which* keywords (and which not-in-Appendix-D contextual words) are re-admitted, and in which positions, is a **design decision**, not a census fact — deferred to the lexical-spec lock and reference-ambiguity tickets. This census supplies the raw sets and the legacy grammar's actual choices as the evidence base.
